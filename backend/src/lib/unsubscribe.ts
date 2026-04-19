import crypto from "crypto";

const SECRET = () => process.env.JWT_SECRET || "fallback-dev-secret";

export function generateUnsubscribeToken(userId: string): string {
  const payload = userId;
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const sepIdx = decoded.lastIndexOf(":");
    if (sepIdx === -1) return null;
    const userId = decoded.slice(0, sepIdx);
    const sig = decoded.slice(sepIdx + 1);
    const expected = crypto.createHmac("sha256", SECRET()).update(userId).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return userId;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(userId: string, frontendUrl: string): string {
  const token = generateUnsubscribeToken(userId);
  return `${frontendUrl}/unsubscribe?token=${token}`;
}
