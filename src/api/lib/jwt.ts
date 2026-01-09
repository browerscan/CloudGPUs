import jwt, { type SignOptions } from "jsonwebtoken";
const { sign, verify } = jwt;

const JWT_SECRET = () => {
  const secret = process.env["JWT_SECRET"] || process.env["PAYLOAD_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET or PAYLOAD_SECRET must be set");
  }
  return secret;
};

export interface JwtPayload {
  userId: string;
  email: string;
  type: "access" | "refresh" | "verify" | "reset";
  jti?: string | undefined;
}

/**
 * Generate an access token for authenticated requests.
 */
export function generateAccessToken(
  userId: string,
  email: string,
  opts?: { expiresIn?: SignOptions["expiresIn"]; sessionId?: string },
): string {
  const signOptions: SignOptions = {
    expiresIn: opts?.expiresIn ?? "30d",
    issuer: "cloudgpus.io",
  };
  return sign(
    { userId, email, type: "access", jti: opts?.sessionId } satisfies JwtPayload,
    JWT_SECRET(),
    signOptions,
  );
}

/**
 * Generate an email verification token.
 * Expires in 24 hours.
 */
export function generateVerifyToken(userId: string, email: string): string {
  return sign({ userId, email, type: "verify" } satisfies JwtPayload, JWT_SECRET(), {
    expiresIn: "24h",
    issuer: "cloudgpus.io",
  });
}

/**
 * Generate a password reset token.
 * Expires in 1 hour.
 */
export function generateResetToken(userId: string, email: string): string {
  return sign({ userId, email, type: "reset" } satisfies JwtPayload, JWT_SECRET(), {
    expiresIn: "1h",
    issuer: "cloudgpus.io",
  });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET(), { issuer: "cloudgpus.io" });
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify JWT from Authorization header.
 */
export function verifyAuthHeader(authHeader: string): JwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}
