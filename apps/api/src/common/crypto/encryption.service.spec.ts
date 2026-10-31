import { describe, it, expect, beforeEach } from "vitest";
import { EncryptionService } from "./encryption.service";

describe("EncryptionService (AES-256-GCM)", () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should encrypt and decrypt plaintext accurately", () => {
    const secret = "secret_sauce_password_123!";
    const { encrypted, iv } = service.encrypt(secret);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(secret);
    expect(encrypted).toContain(":"); // ciphertext:authTag
    expect(iv).toBeDefined();
    expect(iv).toHaveLength(24); // 12 bytes = 24 hex chars

    const decrypted = service.decrypt(encrypted, iv);
    expect(decrypted).toBe(secret);
  });

  it("should generate different ciphertexts and IVs for repeated encryptions of the same plaintext", () => {
    const text = "standard_user";
    const enc1 = service.encrypt(text);
    const enc2 = service.encrypt(text);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encrypted).not.toBe(enc2.encrypted);

    expect(service.decrypt(enc1.encrypted, enc1.iv)).toBe(text);
    expect(service.decrypt(enc2.encrypted, enc2.iv)).toBe(text);
  });

  it("should throw an error if the ciphertext has been tampered with", () => {
    const secret = "super_sensitive_key";
    const { encrypted, iv } = service.encrypt(secret);

    const [ciphertext, tag] = encrypted.split(":");
    // Flip first character of ciphertext
    const tamperedCiphertext =
      (ciphertext[0] === "a" ? "b" : "a") + ciphertext.slice(1);
    const tamperedEncrypted = `${tamperedCiphertext}:${tag}`;

    expect(() => service.decrypt(tamperedEncrypted, iv)).toThrow();
  });

  it("should throw an error if the auth tag has been tampered with", () => {
    const secret = "super_sensitive_key";
    const { encrypted, iv } = service.encrypt(secret);

    const [ciphertext, tag] = encrypted.split(":");
    // Flip first character of auth tag
    const tamperedTag = (tag[0] === "a" ? "b" : "a") + tag.slice(1);
    const tamperedEncrypted = `${ciphertext}:${tamperedTag}`;

    expect(() => service.decrypt(tamperedEncrypted, iv)).toThrow();
  });

  it("should throw an error if an incorrect IV is provided during decryption", () => {
    const secret = "super_sensitive_key";
    const { encrypted } = service.encrypt(secret);
    const wrongIv = "000000000000000000000000";

    expect(() => service.decrypt(encrypted, wrongIv)).toThrow();
  });

  it("should encrypt and decrypt a credential pair (username and password)", () => {
    const username = "standard_user";
    const password = "secret_sauce";

    const encryptedBundle = service.encryptCredentials(username, password);

    expect(encryptedBundle.usernameEncrypted).toBeDefined();
    expect(encryptedBundle.usernameEncrypted).not.toBe(username);
    expect(encryptedBundle.passwordEncrypted).toBeDefined();
    expect(encryptedBundle.passwordEncrypted).not.toBe(password);
    expect(encryptedBundle.encryptionIv).toBeDefined();

    const decrypted = service.decryptCredentials(encryptedBundle);
    expect(decrypted.username).toBe(username);
    expect(decrypted.password).toBe(password);
  });

  it("should handle partial credentials (only password, no username)", () => {
    const password = "api_key_only";
    const encryptedBundle = service.encryptCredentials(undefined, password);

    expect(encryptedBundle.usernameEncrypted).toBeNull();
    expect(encryptedBundle.passwordEncrypted).toBeDefined();
    expect(encryptedBundle.encryptionIv).toBeDefined();

    const decrypted = service.decryptCredentials(encryptedBundle);
    expect(decrypted.username).toBeUndefined();
    expect(decrypted.password).toBe(password);
  });

  it("should handle empty credentials safely", () => {
    const encryptedBundle = service.encryptCredentials();
    expect(encryptedBundle.usernameEncrypted).toBeNull();
    expect(encryptedBundle.passwordEncrypted).toBeNull();
    expect(encryptedBundle.encryptionIv).toBeNull();

    const decrypted = service.decryptCredentials(encryptedBundle);
    expect(decrypted).toEqual({});
  });
});
