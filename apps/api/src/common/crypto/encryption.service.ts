import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

export interface EncryptedField {
  encrypted: string;
  iv: string;
}

export interface EncryptedCredentials {
  usernameEncrypted?: string | null;
  passwordEncrypted?: string | null;
  encryptionIv?: string | null;
}

export interface DecryptedCredentials {
  username?: string;
  password?: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor() {
    const rawKey =
      process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

    if (rawKey) {
      if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
        // 64-char hex string = 32 bytes
        this.key = Buffer.from(rawKey, "hex");
      } else if (Buffer.byteLength(rawKey, "utf8") === 32) {
        this.key = Buffer.from(rawKey, "utf8");
      } else {
        // Derive standard 32-byte (256-bit) key using scrypt
        this.key = crypto.scryptSync(rawKey, "testpilot-credential-salt", 32);
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        this.logger.error(
          "CREDENTIAL_ENCRYPTION_KEY is not set in production! Using fallback.",
        );
      }
      this.key = crypto.scryptSync(
        "testpilot-default-dev-secret-key-32b",
        "testpilot-credential-salt",
        32,
      );
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Produces an authenticated ciphertext incorporating the GCM auth tag.
   * Output format: `${ciphertextHex}:${authTagHex}` with separate hex IV.
   */
  encrypt(plaintext: string, existingIv?: string): EncryptedField {
    const iv = existingIv
      ? Buffer.from(existingIv, "hex")
      : crypto.randomBytes(12); // NIST recommended 96-bit IV for GCM

    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const tag = cipher.getAuthTag().toString("hex");

    return {
      encrypted: `${ciphertext}:${tag}`,
      iv: iv.toString("hex"),
    };
  }

  /**
   * Decrypts AES-256-GCM encrypted ciphertext.
   * Verifies the authentication tag to ensure data integrity.
   */
  decrypt(encrypted: string, ivHex: string): string {
    const parts = encrypted.split(":");
    if (parts.length !== 2) {
      throw new Error(
        "Invalid AES-GCM encrypted format. Expected format: '<ciphertext>:<authTag>'",
      );
    }

    const [ciphertextHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Encrypts username and password bundle for an environment.
   * Secrets are encrypted with AES-256-GCM before database storage.
   */
  encryptCredentials(
    username?: string,
    password?: string,
  ): EncryptedCredentials {
    if (!username && !password) {
      return {
        usernameEncrypted: null,
        passwordEncrypted: null,
        encryptionIv: null,
      };
    }

    // Shared IV per credential row
    const iv = crypto.randomBytes(12).toString("hex");

    const usernameEncrypted = username
      ? this.encrypt(username, iv).encrypted
      : null;

    const passwordEncrypted = password
      ? this.encrypt(password, iv).encrypted
      : null;

    return {
      usernameEncrypted,
      passwordEncrypted,
      encryptionIv: iv,
    };
  }

  /**
   * Decrypts credentials for internal service use (crawler / runner).
   * Note: This must NEVER be returned over the public REST API.
   */
  decryptCredentials(
    credentials: EncryptedCredentials,
  ): DecryptedCredentials {
    const { usernameEncrypted, passwordEncrypted, encryptionIv } = credentials;

    if (!encryptionIv) {
      return {};
    }

    const username = usernameEncrypted
      ? this.decrypt(usernameEncrypted, encryptionIv)
      : undefined;

    const password = passwordEncrypted
      ? this.decrypt(passwordEncrypted, encryptionIv)
      : undefined;

    return { username, password };
  }
}
