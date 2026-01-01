import type { Pool } from "pg";
import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { nanoid } from "nanoid";
import { hashPassword, verifyPassword, validateEmail, validatePassword } from "../lib/password.js";
import {
  generateAccessToken,
  generateVerifyToken,
  generateResetToken,
  verifyToken,
  verifyAuthHeader,
  type JwtPayload,
} from "../lib/jwt.js";

export interface AuthDeps {
  pool: Pool;
}

/**
 * Helper to extract user from JWT token for protected endpoints.
 */
async function getUserFromRequest(req: Request, pool: Pool): Promise<AuthRequest["user"] | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return null;

  const payload = verifyAuthHeader(authHeader);
  if (!payload) return null;

  const result = await pool.query(
    `SELECT id, email, name, is_verified
     FROM cloudgpus.users
     WHERE id = $1`,
    [payload.userId],
  );

  if (!result.rows[0]) return null;

  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    name: result.rows[0].name,
    isVerified: result.rows[0].is_verified,
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
      const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const result = await deps.pool.query(
        `INSERT INTO cloudgpus.users (email, password_hash, name, verify_token, verify_expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, is_verified, created_at`,
        [normalizedEmail, passwordHash, name || null, verifyToken, verifyExpiresAt],
      );

      const user = result.rows[0];

      // Generate JWT
      const accessToken = generateAccessToken(user.id, user.email);

      // TODO: Send verification email via SMTP
      // For now, the verify_token is returned for development

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
            verifyUrl: `${process.env["PUBLIC_SITE_URL"]}/api/auth/verify?token=${verifyToken}`,
          }),
        },
      });
    } catch (err) {
      console.error("Register error:", err);
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
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 400,
        error: "missing_credentials",
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

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
        return res.status(401).json({
          status: 401,
          error: "invalid_credentials",
          message: "Invalid email or password",
        });
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({
          status: 401,
          error: "invalid_credentials",
          message: "Invalid email or password",
        });
      }

      // Update last login
      const clientIp = req.ip || req.socket.remoteAddress || null;
      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET last_login_at = NOW(), last_login_ip = $1
         WHERE id = $2`,
        [clientIp, user.id],
      );

      // Generate JWT
      const accessToken = generateAccessToken(user.id, user.email);

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
      console.error("Login error:", err);
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
      const magicTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET reset_token = $1, reset_expires_at = $2
         WHERE id = $3`,
        [magicToken, magicTokenExpiresAt, user.id],
      );

      // TODO: Send magic link email
      // For now, return in development
      const magicLink = `${process.env["PUBLIC_SITE_URL"]}/api/auth/magic-login?token=${magicToken}`;

      res.json({
        status: 200,
        message: "If an account exists with this email, a magic link will be sent",
        ...(process.env["NODE_ENV"] !== "production" && { magicLink }),
      });
    } catch (err) {
      console.error("Magic link error:", err);
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to send magic link",
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
      const result = await deps.pool.query(
        `SELECT id, email, verify_expires_at
         FROM cloudgpus.users
         WHERE verify_token = $1`,
        [token],
      );

      const user = result.rows[0];
      if (!user) {
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
         SET is_verified = true, verified_at = NOW(), verify_token = NULL, verify_expires_at = NULL
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
      console.error("Verify error:", err);
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
      const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET verify_token = $1, verify_expires_at = $2
         WHERE id = $3`,
        [verifyToken, verifyExpiresAt, user.id],
      );

      // TODO: Send verification email

      res.json({
        status: 200,
        message: "Verification email sent",
        ...(process.env["NODE_ENV"] !== "production" && {
          verifyUrl: `${process.env["PUBLIC_SITE_URL"]}/api/auth/verify?token=${verifyToken}`,
        }),
      });
    } catch (err) {
      console.error("Resend verify error:", err);
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
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await deps.pool.query(
        `UPDATE cloudgpus.users
         SET reset_token = $1, reset_expires_at = $2
         WHERE id = $3`,
        [resetToken, resetExpiresAt, user.id],
      );

      // TODO: Send password reset email

      res.json({
        status: 200,
        message: "If an account exists with this email, a password reset link will be sent",
        ...(process.env["NODE_ENV"] !== "production" && {
          resetUrl: `${process.env["PUBLIC_SITE_URL"]}/api/auth/reset-password?token=${resetToken}`,
        }),
      });
    } catch (err) {
      console.error("Request reset error:", err);
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

    if (!token || !password) {
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
      const result = await deps.pool.query(
        `SELECT id, reset_expires_at FROM cloudgpus.users WHERE reset_token = $1`,
        [token],
      );

      const user = result.rows[0];
      if (!user) {
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
         SET password_hash = $1, reset_token = NULL, reset_expires_at = NULL
         WHERE id = $2`,
        [passwordHash, user.id],
      );

      res.json({
        status: 200,
        message: "Password reset successfully",
      });
    } catch (err) {
      console.error("Reset password error:", err);
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
      console.error("Get me error:", err);
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

    try {
      const result = await deps.pool.query(
        `UPDATE cloudgpus.users
         SET name = $2
         WHERE id = $1
         RETURNING id, email, name, is_verified, updated_at`,
        [req.user.id, name || null],
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
      console.error("Update me error:", err);
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to update profile",
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
      console.error("Save comparison error:", err);
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
      console.error("List comparisons error:", err);
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
      console.error("Delete comparison error:", err);
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
      console.error("List alerts error:", err);
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
      console.error("Claim alert error:", err);
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Failed to claim alert",
      });
    }
  };
}
