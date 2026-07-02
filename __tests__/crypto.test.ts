/**
 * Tests for encrypt/decrypt utility.
 */

import { encryptCode, decryptCode, maskCode } from "@/lib/crypto.server";

describe("encryptCode / decryptCode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ENCRYPTION_KEY: "test_encryption_key_for_unit_tests" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("encrypts and decrypts a coupon code round-trip", () => {
    const original = "IXIGO2024DEAL";
    const encrypted = encryptCode(original);
    const decrypted = decryptCode(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const code = "MYCODE123";
    const enc1 = encryptCode(code);
    const enc2 = encryptCode(code);
    expect(enc1).not.toBe(enc2);
    // But both decrypt to same value
    expect(decryptCode(enc1)).toBe(code);
    expect(decryptCode(enc2)).toBe(code);
  });

  it("throws if ENCRYPTION_KEY is not set", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptCode("test")).toThrow("ENCRYPTION_KEY");
    expect(() => decryptCode("abc")).toThrow("ENCRYPTION_KEY");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptCode("SAFEVALUE");
    const tampered = encrypted.slice(0, -4) + "XXXX";
    expect(() => decryptCode(tampered)).toThrow();
  });
});

describe("maskCode", () => {
  it("masks codes longer than 3 chars", () => {
    expect(maskCode("IXIGO2024")).toBe("IXI*****");
    expect(maskCode("AB1234")).toBe("AB1***");
  });

  it("handles very short codes", () => {
    expect(maskCode("AB")).toBe("***");
    expect(maskCode("A")).toBe("***");
  });

  it("caps mask stars at 5", () => {
    const result = maskCode("VERYLONGCOUPONCODE");
    expect(result).toBe("VER*****");
  });
});
