/**
 * Server-only encryption utilities for coupon codes.
 * Uses AES-256-GCM via Node.js crypto.
 * NEVER import this module from client components.
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  // Derive a 32-byte key from the provided secret
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypts a plaintext coupon code.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 */
export function encryptCode(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts an encrypted coupon code.
 * Expects a base64-encoded string: iv:authTag:ciphertext
 */
export function decryptCode(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Generates a masked coupon code for public display.
 * E.g. "IXIGO2024" → "IXI****"
 */
export function maskCode(plaintext: string): string {
  if (plaintext.length <= 3) return "***";
  const visible = plaintext.slice(0, 3);
  const masked = "*".repeat(Math.min(plaintext.length - 3, 5));
  return `${visible}${masked}`;
}
