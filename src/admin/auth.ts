import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

function constantTimeEquals(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function requireAdminAuth() {
  const user = process.env["ADMIN_USER"] ?? "";
  const pass = process.env["ADMIN_PASSWORD"] ?? "";
  const allowNoAuth = process.env["ALLOW_NO_AUTH"] === "true";

  const enabled = Boolean(user && pass);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      // Explicit opt-in required to disable auth - never allow open admin routes in production
      if (!allowNoAuth) {
        res.status(500).send("Admin authentication is not configured.");
        return;
      }
      if ((process.env["NODE_ENV"] ?? "development") === "production") {
        res.status(500).send("Admin authentication is required in production.");
        return;
      }
      next();
      return;
    }

    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="CloudGPUs Admin", charset="UTF-8"');
      res.status(401).send("Authentication required.");
      return;
    }

    const raw = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const idx = raw.indexOf(":");
    const suppliedUser = idx >= 0 ? raw.slice(0, idx) : "";
    const suppliedPass = idx >= 0 ? raw.slice(idx + 1) : "";

    if (!constantTimeEquals(suppliedUser, user) || !constantTimeEquals(suppliedPass, pass)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="CloudGPUs Admin", charset="UTF-8"');
      res.status(401).send("Invalid credentials.");
      return;
    }

    next();
  };
}
