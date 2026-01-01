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
      if (!payload) {
        return res.status(401).json({
          status: 401,
          error: "unauthorized",
          message: "Invalid or expired token",
        });
      }

      // Fetch fresh user data from database
      const result = await pool.query(
        `SELECT id, email, name, is_verified
         FROM cloudgpus.users
         WHERE id = $1 AND deleted_at IS NULL`,
        [payload.userId],
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
        if (payload) {
          const result = await pool.query(
            `SELECT id, email, name, is_verified
             FROM cloudgpus.users
             WHERE id = $1`,
            [payload.userId],
          );
          if (result.rows[0]) {
            req.user = {
              id: result.rows[0].id,
              email: result.rows[0].email,
              name: result.rows[0].name,
              isVerified: result.rows[0].is_verified,
            };
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
