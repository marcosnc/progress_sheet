import { createHash, timingSafeEqual } from "node:crypto";

const SALT = "progress-sheet-v1"; // In production use per-user salt

export async function hashPassword(password: string): Promise<string> {
  const hash = createHash("sha256").update(SALT + password).digest("hex");
  return hash;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  if (computed.length !== hash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}
