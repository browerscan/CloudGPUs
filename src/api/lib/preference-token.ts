import crypto from "node:crypto";
import { safeCompare } from "./token-hash.js";

function prefSecret() {
  const secret =
    process.env["PREFERENCES_TOKEN_SECRET"] ||
    process.env["TOKEN_PEPPER"] ||
    process.env["JWT_SECRET"] ||
    process.env["PAYLOAD_SECRET"];
  if (!secret) {
    throw new Error(
      "PREFERENCES_TOKEN_SECRET, TOKEN_PEPPER, JWT_SECRET, or PAYLOAD_SECRET must be set",
    );
  }
  return secret;
}

export function signPreferencesToken(email: string, expiresAt: Date) {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${email}:${exp}`;
  const sig = crypto.createHmac("sha256", prefSecret()).update(payload).digest("base64url");
  return Buffer.from(`${email}:${exp}:${sig}`).toString("base64url");
}

export function verifyPreferencesToken(token: string): { email: string; exp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [email, expRaw, sig] = decoded.split(":");
    if (!email || !expRaw || !sig) return null;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp)) return null;
    if (Date.now() / 1000 > exp) return null;
    const payload = `${email}:${exp}`;
    const expected = crypto.createHmac("sha256", prefSecret()).update(payload).digest("base64url");
    if (!safeCompare(sig, expected)) return null;
    return { email, exp };
  } catch {
    return null;
  }
}
