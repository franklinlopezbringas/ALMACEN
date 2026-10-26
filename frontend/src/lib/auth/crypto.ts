import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configure SESSION_SECRET (minimum 32 characters).");
  return createHash("sha256").update(secret).digest();
}
export function seal(value: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal(
  value: string | undefined,
  purpose: string,
): string | null {
  if (!value) return null;
  try {
    const data = Buffer.from(value, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
    cipher.setAAD(Buffer.from(purpose));
    cipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([
      cipher.update(data.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
