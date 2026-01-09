import crypto from "node:crypto";

function tokenSecret() {
  const secret =
    process.env["TOKEN_PEPPER"] ||
    process.env["PREFERENCES_TOKEN_SECRET"] ||
    process.env["JWT_SECRET"] ||
    process.env["PAYLOAD_SECRET"];
  if (!secret) {
    throw new Error(
      "TOKEN_PEPPER, PREFERENCES_TOKEN_SECRET, JWT_SECRET, or PAYLOAD_SECRET must be set",
    );
  }
  return secret;
}

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(token).digest("hex");
}

export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  const max = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(max);
  const bPadded = Buffer.alloc(max);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  const isEqual = crypto.timingSafeEqual(aPadded, bPadded);
  return isEqual && aBuf.length === bBuf.length;
}
