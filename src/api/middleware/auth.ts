import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import { verifyAuthHeader } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string | null;
    isVerified: boolean;
  };
  sessionId?: string;
}

export type AuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => void;

/**
 * JWT authentication middleware.
 * Verifies the Authorization header and attaches the user to req.user.
 */
export function authenticate(pool: Pool): AuthMiddleware {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers["authorization"];
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
          status: 401,
          error: "unauthorized",
          message: "Missing or invalid authorization header",
        });
      }

      const payload = verifyAuthHeader(authHeader);
      if (!payload || payload.type !== "access" || !payload.jti) {
        return res.status(401).json({
          status: 401,
          error: "unauthorized",
          message: "Invalid or expired token",
        });
      }

      // Fetch fresh user data from database
      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u.is_verified, s.id AS session_id, s.last_seen_at::text
         FROM cloudgpus.users u
         JOIN cloudgpus.user_sessions s ON s.user_id = u.id
         WHERE u.id = $1
           AND s.token_id = $2
           AND s.revoked_at IS NULL
           AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
        [payload.userId, payload.jti],
      );

      if (!result.rows[0]) {
        return res.status(401).json({
          status: 401,
          error: "unauthorized",
          message: "User not found",
        });
      }

      req.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        isVerified: result.rows[0].is_verified,
      };
      req.sessionId = result.rows[0].session_id;

      next();
    } catch (err) {
      console.error("Auth error:", err);
      res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Authentication failed",
      });
    }
  };
}

/**
 * Optional authentication - attaches user if valid, but doesn't require it.
 */
export function optionalAuth(pool: Pool): AuthMiddleware {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers["authorization"];
      if (authHeader?.startsWith("Bearer ")) {
        const payload = verifyAuthHeader(authHeader);
        if (payload && payload.type === "access" && payload.jti) {
          const result = await pool.query(
            `SELECT u.id, u.email, u.name, u.is_verified, s.id AS session_id
             FROM cloudgpus.users u
             JOIN cloudgpus.user_sessions s ON s.user_id = u.id
             WHERE u.id = $1
               AND s.token_id = $2
               AND s.revoked_at IS NULL
               AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
            [payload.userId, payload.jti],
          );
          if (result.rows[0]) {
            req.user = {
              id: result.rows[0].id,
              email: result.rows[0].email,
              name: result.rows[0].name,
              isVerified: result.rows[0].is_verified,
            };
            req.sessionId = result.rows[0].session_id;
          }
        }
      }
      next();
    } catch {
      next();
    }
  };
}

/**
 * Require verified email address.
 * Use after authenticate() middleware.
 */
export function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      status: 401,
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      status: 403,
      error: "email_not_verified",
      message: "Please verify your email address to access this feature",
    });
  }

  next();
}
