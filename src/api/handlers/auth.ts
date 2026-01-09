import type { Pool } from "pg";
import type { Request, Response } from "express";
import type { Redis } from "ioredis";
import { Queue } from "bullmq";
import type { AuthRequest } from "../middleware/auth.js";
import { nanoid } from "nanoid";
import { hashPassword, verifyPassword, validateEmail, validatePassword } from "../lib/password.js";
import { generateAccessToken, verifyAuthHeader } from "../lib/jwt.js";
import { logger } from "../../logger.js";
import { QUEUES } from "../../workers/queues.js";
import { hashToken, safeCompare } from "../lib/token-hash.js";
import { buildAuthEmail, resolveLocale } from "../lib/email-templates.js";
import { signPreferencesToken } from "../lib/preference-token.js";
import {
  createSession,
  listSessions,
  revokeAllSessions,
  revokeSession,
  touchSession,
} from "../lib/sessions.js";
import { computeRiskScore, recordAuthEvent } from "../lib/auth-audit.js";

export interface AuthDeps {
  pool: Pool;
  redis?: Redis;
}

const DEFAULT_SITE_URL = "https://cloudgpus.io";

function siteUrlFromEnv() {
  const raw = process.env["PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

function helpUrlFromEnv() {
  return `${siteUrlFromEnv()}/help`;
}

function preferencesUrlFor(email: string) {
  const token = signPreferencesToken(email, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  return `${siteUrlFromEnv()}/email-preferences?token=${encodeURIComponent(token)}`;
}

function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || null;
}

function getUserAgent(req: Request) {
  const raw = req.headers["user-agent"];
  if (!raw) return null;
  const ua = Array.isArray(raw) ? raw.join(" ") : raw;
  return ua.length > 300 ? ua.slice(0, 300) : ua;
}

async function enqueueAuthEmail(
  redis: Redis | undefined,
  payload: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    headers?: Record<string, string>;
  },
) {
  if (!redis) {
    logger.warn("Redis not configured; skipping auth email enqueue");
    return;
  }

  try {
    const emailQueue = new Queue(QUEUES.notifyEmail, { connection: redis });
    await emailQueue.add("email", payload, {
      removeOnComplete: { age: 24 * 3600, count: 5000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    });
    await emailQueue.close();
  } catch (err) {
    logger.warn({ err }, "Failed to enqueue auth email");
  }
}

/**
 * Helper to extract user from JWT token for protected endpoints.
 */
async function getUserFromRequest(
  req: Request,
  pool: Pool,
): Promise<(AuthRequest["user"] & { sessionId: string }) | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return null;

  const payload = verifyAuthHeader(authHeader);
  if (!payload || payload.type !== "access" || !payload.jti) return null;

  const result = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    is_verified: boolean;
    session_id: string;
    last_seen_at: string | null;
  }>(
    `SELECT u.id, u.email, u.name, u.is_verified, s.id AS session_id, s.last_seen_at::text
     FROM cloudgpus.users u
     JOIN cloudgpus.user_sessions s ON s.user_id = u.id
     WHERE u.id = $1
       AND s.token_id = $2
       AND s.revoked_at IS NULL
       AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
    [payload.userId, payload.jti],
  );

  const row = result.rows[0];
  if (!row) return null;

  if (!row.last_seen_at || Date.now() - new Date(row.last_seen_at).getTime() > 15 * 60 * 1000) {
    await touchSession(pool, { sessionId: row.session_id });
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isVerified: row.is_verified,
    sessionId: row.session_id,
  };
}

/**
 * Middleware wrapper to attach user to request for handlers.
 */
export function withAuth(deps: AuthDeps) {
  return async (req: Request, res: Response, next: () => void) => {
    const user = await getUserFromRequest(req, deps.pool);
    if (user) {
      (req as AuthRequest).user = user;
      (req as AuthRequest).sessionId = user.sessionId;
    }
    next();
  };
}

/**
 * POST /api/auth/register
 * Create a new user account with email + password.
 */
export function registerHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        status: 400,
        error: "missing_fields",
        message: "Email and password are required",
      });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: emailValidation.error,
      });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_password",
        message: passwordValidation.error,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const normalizedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : null;

    try {
      // Check for existing user
      const existingUser = await deps.pool.query(
        "SELECT id FROM cloudgpus.users WHERE email = $1",
        [normalizedEmail],
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          status: 409,
          error: "email_exists",
          message: "An account with this email already exists",
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const verifyToken = nanoid(32);
      const verifyTokenHash = hashToken(verifyToken);
      const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const result = await deps.pool.query(
        `INSERT INTO cloudgpus.users (email, password_hash, name, verify_token_hash, verify_expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, is_verified, created_at`,
        [normalizedEmail, passwordHash, normalizedName, verifyTokenHash, verifyExpiresAt],
      );

      const user = result.rows[0];

      const session = await createSession({
        pool: deps.pool,
        userId: user.id,
        ip: clientIp,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Generate JWT
      const accessToken = generateAccessToken(user.id, user.email, {
        expiresIn: "7d",
        sessionId: session.tokenId,
      });

      const verifyUrl = `${siteUrlFromEnv()}/verify-email?token=${encodeURIComponent(verifyToken)}`;
      const locale = resolveLocale(req.headers["accept-language"]);
      const preferencesUrl = preferencesUrlFor(user.email);
      const template = buildAuthEmail("verify", {
        brandName: "CloudGPUs.io",
        actionUrl: verifyUrl,
        supportUrl: helpUrlFromEnv(),
        preferencesUrl,
        locale,
      });

      await enqueueAuthEmail(deps.redis, {
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: {
          "List-Unsubscribe": `<${preferencesUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      res.status(201).json({
        status: 201,
        message: "Account created successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isVerified: user.is_verified,
          },
          accessToken,
          // Only include verify token in development
          ...(process.env["NODE_ENV"] !== "production" && {
            verifyToken,
            verifyUrl,
          }),
        },
      });
    } catch (err) {
      logger.error({ err }, "Register error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to create account",
      });
    }
  };
}

/**
 * POST /api/auth/login
 * Authenticate with email + password, returns JWT.
 */
export function loginHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { email, password, rememberMe } = req.body as {
      email?: unknown;
      password?: unknown;
      rememberMe?: unknown;
    };

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({
        status: 400,
        error: "missing_credentials",
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);

    try {
      // Find user
      const result = await deps.pool.query(
        `SELECT id, email, name, password_hash, is_verified
         FROM cloudgpus.users
         WHERE email = $1`,
        [normalizedEmail],
      );

      const user = result.rows[0];
      if (!user) {
        const riskScore = await computeRiskScore(deps.pool, {
          ip: clientIp,
          email: normalizedEmail,
        });
        await recordAuthEvent(deps.pool, {
          userId: null,
          email: normalizedEmail,
          ip: clientIp,
          userAgent,
          success: false,
          reason: "invalid_credentials",
          eventType: "login",
          riskScore,
        });
        if (riskScore >= 70) {
          logger.warn(
            { email: normalizedEmail, ip: clientIp, riskScore },
            "High-risk login attempt",
          );
        }
        return res.status(401).json({
          status: 401,
          error: "invalid_credentials",
          message: "Invalid email or password",
        });
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        const riskScore = await computeRiskScore(deps.pool, {
          ip: clientIp,
          email: normalizedEmail,
        });
        await recordAuthEvent(deps.pool, {
          userId: user.id,
          email: normalizedEmail,
          ip: clientIp,
          userAgent,
          success: false,
          reason: "invalid_credentials",
          eventType: "login",
          riskScore,
        });
        if (riskScore >= 70) {
          logger.warn(
            { email: normalizedEmail, ip: clientIp, riskScore },
            "High-risk login attempt",
          );
        }
        return res.status(401).json({
          status: 401,
          error: "invalid_credentials",
          message: "Invalid email or password",
        });
      }

      // Update last login
      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET last_login_at = NOW(), last_login_ip = $1
         WHERE id = $2`,
        [clientIp, user.id],
      );

      // Generate JWT
      const remember =
        rememberMe === true ||
        rememberMe === "true" ||
        rememberMe === 1 ||
        rememberMe === "1" ||
        rememberMe === "on";
      const session = await createSession({
        pool: deps.pool,
        userId: user.id,
        ip: clientIp,
        userAgent,
        expiresAt: new Date(Date.now() + (remember ? 30 : 7) * 24 * 60 * 60 * 1000),
      });

      const accessToken = generateAccessToken(user.id, user.email, {
        expiresIn: remember ? "30d" : "7d",
        sessionId: session.tokenId,
      });

      await recordAuthEvent(deps.pool, {
        userId: user.id,
        email: normalizedEmail,
        ip: clientIp,
        userAgent,
        success: true,
        reason: null,
        eventType: "login",
        riskScore: 0,
      });

      res.json({
        status: 200,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isVerified: user.is_verified,
          },
          accessToken,
        },
      });
    } catch (err) {
      logger.error({ err }, "Login error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Login failed",
      });
    }
  };
}

/**
 * POST /api/auth/magic-link
 * Request a magic link for passwordless login (optional feature).
 */
export function magicLinkHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { email } = req.body;

    if (typeof email !== "string") {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: "Email is required",
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: emailValidation.error,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Check if user exists
      const result = await deps.pool.query("SELECT id FROM cloudgpus.users WHERE email = $1", [
        normalizedEmail,
      ]);

      const user = result.rows[0];

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({
          status: 200,
          message: "If an account exists with this email, a magic link will be sent",
        });
      }

      // Generate magic link token (24 hour expiry)
      const magicToken = nanoid(32);
      const magicTokenHash = hashToken(magicToken);
      const magicTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET magic_token_hash = $1, magic_expires_at = $2, magic_token = NULL
         WHERE id = $3`,
        [magicTokenHash, magicTokenExpiresAt, user.id],
      );

      const magicLink = `${siteUrlFromEnv()}/magic-login?token=${encodeURIComponent(magicToken)}`;

      const locale = resolveLocale(req.headers["accept-language"]);
      const preferencesUrl = preferencesUrlFor(normalizedEmail);
      const template = buildAuthEmail("magic", {
        brandName: "CloudGPUs.io",
        actionUrl: magicLink,
        supportUrl: helpUrlFromEnv(),
        preferencesUrl,
        locale,
      });

      await enqueueAuthEmail(deps.redis, {
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: {
          "List-Unsubscribe": `<${preferencesUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      res.json({
        status: 200,
        message: "If an account exists with this email, a magic link will be sent",
        ...(process.env["NODE_ENV"] !== "production" && { magicLink }),
      });
    } catch (err) {
      logger.error({ err }, "Magic link error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to send magic link",
      });
    }
  };
}

/**
 * GET /api/auth/magic-login
 * Exchange magic link token for an access token.
 */
export function magicLoginHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        status: 400,
        error: "invalid_token",
        message: "Magic login token is required",
      });
    }

    try {
      const tokenHash = hashToken(token);
      const result = await deps.pool.query<{
        id: string;
        email: string;
        name: string | null;
        is_verified: boolean;
        magic_expires_at: string | null;
        magic_token_hash: string | null;
        magic_token: string | null;
      }>(
        `SELECT id, email, name, is_verified, magic_expires_at::text, magic_token_hash, magic_token
         FROM cloudgpus.users
         WHERE magic_token_hash = $1 OR magic_token = $2`,
        [tokenHash, token],
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(400).json({
          status: 400,
          error: "invalid_token",
          message: "Invalid magic login token",
        });
      }

      const matchesHash = user.magic_token_hash && safeCompare(user.magic_token_hash, tokenHash);
      const matchesLegacy = user.magic_token && safeCompare(user.magic_token, token);
      if (!matchesHash && !matchesLegacy) {
        return res.status(400).json({
          status: 400,
          error: "invalid_token",
          message: "Invalid magic login token",
        });
      }

      if (user.magic_expires_at && new Date(user.magic_expires_at) < new Date()) {
        return res.status(400).json({
          status: 400,
          error: "token_expired",
          message: "Magic login token has expired",
        });
      }

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET magic_token_hash = NULL,
             magic_token = NULL,
             magic_expires_at = NULL,
             is_verified = CASE WHEN is_verified = false THEN true ELSE is_verified END,
             verified_at = CASE WHEN is_verified = false THEN NOW() ELSE verified_at END
         WHERE id = $1`,
        [user.id],
      );

      const session = await createSession({
        pool: deps.pool,
        userId: user.id,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const accessToken = generateAccessToken(user.id, user.email, {
        expiresIn: "7d",
        sessionId: session.tokenId,
      });

      await recordAuthEvent(deps.pool, {
        userId: user.id,
        email: user.email,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        success: true,
        reason: null,
        eventType: "magic_login",
        riskScore: 0,
      });

      res.json({
        status: 200,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isVerified: true,
          },
          accessToken,
        },
      });
    } catch (err) {
      logger.error({ err }, "Magic login error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to complete magic login",
      });
    }
  };
}

/**
 * GET /api/auth/verify
 * Verify email using token.
 */
export function verifyEmailHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        status: 400,
        error: "invalid_token",
        message: "Verification token is required",
      });
    }

    try {
      const tokenHash = hashToken(token);
      const result = await deps.pool.query<{
        id: string;
        email: string;
        verify_expires_at: string | null;
        verify_token_hash: string | null;
        verify_token: string | null;
      }>(
        `SELECT id, email, verify_expires_at::text, verify_token_hash, verify_token
         FROM cloudgpus.users
         WHERE verify_token_hash = $1 OR verify_token = $2`,
        [tokenHash, token],
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(400).json({
          status: 400,
          error: "invalid_token",
          message: "Invalid verification token",
        });
      }

      const matchesHash = user.verify_token_hash && safeCompare(user.verify_token_hash, tokenHash);
      const matchesLegacy = user.verify_token && safeCompare(user.verify_token, token);
      if (!matchesHash && !matchesLegacy) {
        return res.status(400).json({
          status: 400,
          error: "invalid_token",
          message: "Invalid verification token",
        });
      }

      if (user.verify_expires_at && new Date(user.verify_expires_at) < new Date()) {
        return res.status(400).json({
          status: 400,
          error: "token_expired",
          message: "Verification token has expired",
        });
      }

      // Mark as verified
      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET is_verified = true,
             verified_at = NOW(),
             verify_token_hash = NULL,
             verify_token = NULL,
             verify_expires_at = NULL
         WHERE id = $1`,
        [user.id],
      );

      res.json({
        status: 200,
        message: "Email verified successfully",
        data: {
          userId: user.id,
          email: user.email,
        },
      });
    } catch (err) {
      logger.error({ err }, "Verify error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to verify email",
      });
    }
  };
}

/**
 * POST /api/auth/resend-verify
 * Resend verification email.
 */
export function resendVerifyHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { email } = req.body;

    if (typeof email !== "string") {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: "Email is required",
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: emailValidation.error,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await deps.pool.query(
        `SELECT id, is_verified FROM cloudgpus.users WHERE email = $1`,
        [normalizedEmail],
      );

      const user = result.rows[0];

      if (!user) {
        return res.json({
          status: 200,
          message: "If an account exists with this email, a verification email will be sent",
        });
      }

      if (user.is_verified) {
        return res.json({
          status: 200,
          message: "Email is already verified",
        });
      }

      // Generate new verify token
      const verifyToken = nanoid(32);
      const verifyTokenHash = hashToken(verifyToken);
      const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET verify_token_hash = $1, verify_expires_at = $2, verify_token = NULL
         WHERE id = $3`,
        [verifyTokenHash, verifyExpiresAt, user.id],
      );

      const verifyUrl = `${siteUrlFromEnv()}/verify-email?token=${encodeURIComponent(verifyToken)}`;
      const locale = resolveLocale(req.headers["accept-language"]);
      const preferencesUrl = preferencesUrlFor(normalizedEmail);
      const template = buildAuthEmail("verify", {
        brandName: "CloudGPUs.io",
        actionUrl: verifyUrl,
        supportUrl: helpUrlFromEnv(),
        preferencesUrl,
        locale,
      });

      await enqueueAuthEmail(deps.redis, {
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: {
          "List-Unsubscribe": `<${preferencesUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      res.json({
        status: 200,
        message: "Verification email sent",
        ...(process.env["NODE_ENV"] !== "production" && {
          verifyUrl,
        }),
      });
    } catch (err) {
      logger.error({ err }, "Resend verify error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to send verification email",
      });
    }
  };
}

/**
 * POST /api/auth/reset-password
 * Request a password reset email.
 */
export function requestResetHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { email } = req.body;

    if (typeof email !== "string") {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: "Email is required",
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_email",
        message: emailValidation.error,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await deps.pool.query("SELECT id FROM cloudgpus.users WHERE email = $1", [
        normalizedEmail,
      ]);

      const user = result.rows[0];

      if (!user) {
        return res.json({
          status: 200,
          message: "If an account exists with this email, a password reset link will be sent",
        });
      }

      // Generate reset token
      const resetToken = nanoid(32);
      const resetTokenHash = hashToken(resetToken);
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET reset_token_hash = $1, reset_expires_at = $2, reset_token = NULL
         WHERE id = $3`,
        [resetTokenHash, resetExpiresAt, user.id],
      );

      const resetUrl = `${siteUrlFromEnv()}/reset-password?token=${encodeURIComponent(resetToken)}`;
      const locale = resolveLocale(req.headers["accept-language"]);
      const preferencesUrl = preferencesUrlFor(normalizedEmail);
      const template = buildAuthEmail("reset", {
        brandName: "CloudGPUs.io",
        actionUrl: resetUrl,
        supportUrl: helpUrlFromEnv(),
        preferencesUrl,
        locale,
      });

      await enqueueAuthEmail(deps.redis, {
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: {
          "List-Unsubscribe": `<${preferencesUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      res.json({
        status: 200,
        message: "If an account exists with this email, a password reset link will be sent",
        ...(process.env["NODE_ENV"] !== "production" && {
          resetUrl,
        }),
      });
    } catch (err) {
      logger.error({ err }, "Request reset error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to send reset email",
      });
    }
  };
}

/**
 * POST /api/auth/reset-password
 * Reset password using token.
 */
export function resetPasswordHandler(deps: AuthDeps) {
  return async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (typeof token !== "string" || typeof password !== "string" || !token || !password) {
      return res.status(400).json({
        status: 400,
        error: "missing_fields",
        message: "Token and new password are required",
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_password",
        message: passwordValidation.error,
      });
    }

    try {
      const tokenHash = hashToken(token);
      const result = await deps.pool.query<{
        id: string;
        reset_expires_at: string | null;
        reset_token_hash: string | null;
        reset_token: string | null;
      }>(
        `SELECT id, reset_expires_at::text, reset_token_hash, reset_token
         FROM cloudgpus.users
         WHERE reset_token_hash = $1 OR reset_token = $2`,
        [tokenHash, token],
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(400).json({
          status: 400,
          error: "invalid_token",
          message: "Invalid reset token",
        });
      }

      const matchesHash = user.reset_token_hash && safeCompare(user.reset_token_hash, tokenHash);
      const matchesLegacy = user.reset_token && safeCompare(user.reset_token, token);
      if (!matchesHash && !matchesLegacy) {
        return res.status(400).json({
          status: 400,
          error: "invalid_token",
          message: "Invalid reset token",
        });
      }

      if (user.reset_expires_at && new Date(user.reset_expires_at) < new Date()) {
        return res.status(400).json({
          status: 400,
          error: "token_expired",
          message: "Reset token has expired",
        });
      }

      // Hash new password and update
      const passwordHash = await hashPassword(password);

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET password_hash = $1, reset_token_hash = NULL, reset_token = NULL, reset_expires_at = NULL
         WHERE id = $2`,
        [passwordHash, user.id],
      );

      await revokeAllSessions(deps.pool, { userId: user.id });

      res.json({
        status: 200,
        message: "Password reset successfully",
      });
    } catch (err) {
      logger.error({ err }, "Reset password error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to reset password",
      });
    }
  };
}

/**
 * GET /api/me
 * Get current user info.
 */
export function getMeHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    try {
      const result = await deps.pool.query(
        `SELECT id, email, name, is_verified, created_at, last_login_at
         FROM cloudgpus.users
         WHERE id = $1`,
        [req.user.id],
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({
          status: 404,
          error: "not_found",
          message: "User not found",
        });
      }

      res.json({
        status: 200,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isVerified: user.is_verified,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at,
          },
        },
      });
    } catch (err) {
      logger.error({ err }, "Get me error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to fetch user",
      });
    }
  };
}

/**
 * PATCH /api/me
 * Update current user profile.
 */
export function updateMeHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { name } = req.body;

    if (name !== undefined && typeof name !== "string") {
      return res.status(400).json({
        status: 400,
        error: "invalid_name",
        message: "Name must be a string",
      });
    }

    try {
      const result = await deps.pool.query(
        `UPDATE cloudgpus.users
         SET name = $2
         WHERE id = $1
         RETURNING id, email, name, is_verified, updated_at`,
        [req.user.id, name?.trim() || null],
      );

      const user = result.rows[0];

      res.json({
        status: 200,
        message: "Profile updated",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isVerified: user.is_verified,
            updatedAt: user.updated_at,
          },
        },
      });
    } catch (err) {
      logger.error({ err }, "Update me error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to update profile",
      });
    }
  };
}

/**
 * POST /api/me/change-password
 * Change current user's password (revokes all sessions).
 */
export function changePasswordHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({
        status: 400,
        error: "missing_fields",
        message: "currentPassword and newPassword are required",
      });
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({
        status: 400,
        error: "invalid_password",
        message: validation.error,
      });
    }

    try {
      const result = await deps.pool.query<{ password_hash: string }>(
        `SELECT password_hash FROM cloudgpus.users WHERE id = $1`,
        [req.user.id],
      );
      const row = result.rows[0];
      if (!row) {
        return res.status(404).json({
          status: 404,
          error: "not_found",
          message: "User not found",
        });
      }

      const matches = await verifyPassword(currentPassword, row.password_hash);
      if (!matches) {
        return res.status(403).json({
          status: 403,
          error: "invalid_credentials",
          message: "Current password is incorrect",
        });
      }

      const newHash = await hashPassword(newPassword);
      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET password_hash = $1
         WHERE id = $2`,
        [newHash, req.user.id],
      );

      await revokeAllSessions(deps.pool, { userId: req.user.id });

      res.json({
        status: 200,
        message: "Password updated. Please sign in again.",
      });
    } catch (err) {
      logger.error({ err }, "Change password error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to change password",
      });
    }
  };
}

/**
 * GET /api/me/sessions
 * List active and recent sessions.
 */
export function listSessionsHandler(deps: AuthDeps) {
  return async (req: AuthRequest, res: Response) => {
    if (!req.user || !req.sessionId) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    try {
      const sessions = await listSessions(deps.pool, req.user.id);
      res.json({
        status: 200,
        data: {
          sessions: sessions.map((s) => ({
            id: s.id,
            ip: s.ip,
            userAgent: s.user_agent,
            createdAt: s.created_at,
            lastSeenAt: s.last_seen_at,
            expiresAt: s.expires_at,
            revokedAt: s.revoked_at,
            isCurrent: s.id === req.sessionId,
          })),
        },
      });
    } catch (err) {
      logger.error({ err }, "List sessions error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to list sessions",
      });
    }
  };
}

/**
 * POST /api/me/sessions/revoke
 * Revoke a specific session.
 */
export function revokeSessionHandler(deps: AuthDeps) {
  return async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { sessionId } = req.body as { sessionId?: unknown };
    if (typeof sessionId !== "string" || sessionId.length < 10) {
      return res.status(400).json({
        status: 400,
        error: "invalid_session",
        message: "sessionId is required",
      });
    }

    try {
      const revoked = await revokeSession(deps.pool, { userId: req.user.id, sessionId });
      if (!revoked) {
        return res.status(404).json({
          status: 404,
          error: "not_found",
          message: "Session not found",
        });
      }

      res.json({
        status: 200,
        message: "Session revoked",
      });
    } catch (err) {
      logger.error({ err }, "Revoke session error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to revoke session",
      });
    }
  };
}

/**
 * POST /api/me/sessions/revoke-all
 * Revoke all sessions (optionally keep current).
 */
export function revokeAllSessionsHandler(deps: AuthDeps) {
  return async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { exceptCurrent } = req.body as { exceptCurrent?: unknown };
    const keepCurrent = exceptCurrent === true;

    try {
      await revokeAllSessions(deps.pool, {
        userId: req.user.id,
        exceptSessionId: keepCurrent ? req.sessionId : undefined,
      });

      res.json({
        status: 200,
        message: keepCurrent ? "Other sessions revoked" : "All sessions revoked",
      });
    } catch (err) {
      logger.error({ err }, "Revoke all sessions error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to revoke sessions",
      });
    }
  };
}

/**
 * POST /api/me/comparisons
 * Save a comparison.
 */
export function saveComparisonHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { comparisonType, comparisonKey, items, name } = req.body;

    if (!comparisonType || !comparisonKey || !items) {
      return res.status(400).json({
        status: 400,
        error: "missing_fields",
        message: "comparisonType, comparisonKey, and items are required",
      });
    }

    if (!["gpu", "provider"].includes(comparisonType)) {
      return res.status(400).json({
        status: 400,
        error: "invalid_type",
        message: "comparisonType must be 'gpu' or 'provider'",
      });
    }

    try {
      const result = await deps.pool.query(
        `INSERT INTO cloudgpus.saved_comparisons (user_id, comparison_type, comparison_key, items, name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, comparison_type, comparison_key)
         DO UPDATE SET items = EXCLUDED.items, name = EXCLUDED.name, updated_at = NOW()
         RETURNING id, comparison_type, comparison_key, items, name, created_at, updated_at`,
        [req.user.id, comparisonType, comparisonKey, JSON.stringify(items), name || null],
      );

      const saved = result.rows[0];

      res.status(201).json({
        status: 201,
        message: "Comparison saved",
        data: {
          comparison: {
            id: saved.id,
            comparisonType: saved.comparison_type,
            comparisonKey: saved.comparison_key,
            items: saved.items,
            name: saved.name,
            createdAt: saved.created_at,
            updatedAt: saved.updated_at,
          },
        },
      });
    } catch (err) {
      logger.error({ err }, "Save comparison error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to save comparison",
      });
    }
  };
}

/**
 * GET /api/me/comparisons
 * List saved comparisons.
 */
export function listComparisonsHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    try {
      const result = await deps.pool.query(
        `SELECT id, comparison_type, comparison_key, items, name, created_at, updated_at
         FROM cloudgpus.saved_comparisons
         WHERE user_id = $1 AND is_active = true
         ORDER BY updated_at DESC`,
        [req.user.id],
      );

      res.json({
        status: 200,
        data: {
          comparisons: result.rows.map((row) => ({
            id: row.id,
            comparisonType: row.comparison_type,
            comparisonKey: row.comparison_key,
            items: row.items,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
        },
      });
    } catch (err) {
      logger.error({ err }, "List comparisons error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to fetch comparisons",
      });
    }
  };
}

/**
 * DELETE /api/me/comparisons/:id
 * Delete a saved comparison.
 */
export function deleteComparisonHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { id } = req.params;

    try {
      const result = await deps.pool.query(
        `DELETE FROM cloudgpus.saved_comparisons
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 404,
          error: "not_found",
          message: "Comparison not found",
        });
      }

      res.json({
        status: 200,
        message: "Comparison deleted",
      });
    } catch (err) {
      logger.error({ err }, "Delete comparison error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to delete comparison",
      });
    }
  };
}

/**
 * GET /api/me/alerts
 * List user's price alerts.
 */
export function listAlertsHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string; email?: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    try {
      const result = await deps.pool.query(
        `SELECT pas.id, pas.target_price_per_gpu_hour, pas.is_active,
                pas.confirmed_at, pas.last_notified_at, pas.created_at,
                gm.slug as gpu_slug, gm.name as gpu_name,
                p.slug as provider_slug, p.name as provider_name
         FROM cloudgpus.price_alert_subscriptions pas
         LEFT JOIN cloudgpus.gpu_models gm ON pas.gpu_model_id = gm.id
         LEFT JOIN cloudgpus.providers p ON pas.provider_id = p.id
         WHERE pas.user_id = $1 OR pas.email = $2
         ORDER BY pas.created_at DESC`,
        [req.user.id, req.user.email ?? ""],
      );

      res.json({
        status: 200,
        data: {
          alerts: result.rows.map((row) => ({
            id: row.id,
            targetPricePerGpuHour: row.target_price_per_gpu_hour,
            isActive: row.is_active,
            confirmedAt: row.confirmed_at,
            lastNotifiedAt: row.last_notified_at,
            createdAt: row.created_at,
            gpu: {
              slug: row.gpu_slug,
              name: row.gpu_name,
            },
            provider: row.provider_slug
              ? { slug: row.provider_slug, name: row.provider_name }
              : null,
          })),
        },
      });
    } catch (err) {
      logger.error({ err }, "List alerts error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to fetch alerts",
      });
    }
  };
}

/**
 * POST /api/me/alerts/:id/claim
 * Claim an existing email-based alert to user account.
 */
export function claimAlertHandler(deps: AuthDeps) {
  return async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const { id } = req.params;

    try {
      const result = await deps.pool.query(
        `UPDATE cloudgpus.price_alert_subscriptions
         SET user_id = $1
         WHERE id = $2 AND (user_id IS NULL OR user_id = $1)
         RETURNING id`,
        [req.user.id, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 404,
          error: "not_found",
          message: "Alert not found or already claimed",
        });
      }

      res.json({
        status: 200,
        message: "Alert claimed successfully",
      });
    } catch (err) {
      logger.error({ err }, "Claim alert error");
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to claim alert",
      });
    }
  };
}
