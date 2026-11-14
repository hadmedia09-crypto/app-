/**
 * Token encryption at rest: AES-256-GCM with a versioned key.
 * Format: v{version}:{iv b64}:{authTag b64}:{ciphertext b64}
 *
 * Rotation: add ENCRYPTION_KEY_V{n} for old keys, bump ENCRYPTION_KEY_VERSION,
 * and re-encrypt rows lazily on next token refresh.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyFor(version: number): Buffer {
  const current = Number(process.env.ENCRYPTION_KEY_VERSION ?? 1);
  const raw = version === current ? process.env.ENCRYPTION_KEY : process.env[`ENCRYPTION_KEY_V${version}`];
  if (!raw) throw new Error(`Encryption key v${version} is not configured`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (run: pnpm gen:key)");
  return key;
}

export function currentKeyVersion(): number {
  return Number(process.env.ENCRYPTION_KEY_VERSION ?? 1);
}

export function encryptJson(value: unknown): string {
  const version = currentKeyVersion();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(version), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [`v${version}`, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptJson<T>(payload: string): T {
  const [v, ivB64, tagB64, ctB64] = payload.split(":");
  if (!v || !ivB64 || !tagB64 || !ctB64) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(Number(v.slice(1))), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}
