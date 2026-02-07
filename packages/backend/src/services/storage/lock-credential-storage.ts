import { pbkdf2Sync, randomBytes } from "node:crypto";
import type {
  LockCredential,
  LockCredentialLegacy,
  LockCredentialRequest,
} from "@home-assistant-matter-hub/common";
import type { StorageContext, SupportedStorageTypes } from "@matter/main";
import { Service } from "../../core/ioc/service.js";
import type { AppStorage } from "./app-storage.js";

type StorageObjectType = { [key: string]: SupportedStorageTypes };

interface StoredCredentials {
  version: number;
  credentials: LockCredential[];
}

// Version 1: Plain text PIN (legacy)
// Version 2: Hashed PIN with PBKDF2
const CURRENT_VERSION = 2;

// PBKDF2 configuration for PIN hashing
const HASH_ITERATIONS = 100000;
const HASH_KEY_LENGTH = 64;
const HASH_ALGORITHM = "sha512";
const SALT_LENGTH = 32;

export class LockCredentialStorage extends Service {
  private storage!: StorageContext;
  private credentials: Map<string, LockCredential> = new Map();

  constructor(private readonly appStorage: AppStorage) {
    super("LockCredentialStorage");
  }

  protected override async initialize() {
    this.storage = this.appStorage.createContext("lock-credentials");
    await this.load();
  }

  private async load(): Promise<void> {
    const stored = await this.storage.get<StorageObjectType>("data", {
      version: CURRENT_VERSION,
      credentials: [],
    } as unknown as StorageObjectType);

    if (!stored || Object.keys(stored).length === 0) {
      return;
    }

    const data = stored as unknown as StoredCredentials;
    if (data.version !== CURRENT_VERSION) {
      await this.migrate(data);
      return;
    }

    for (const credential of data.credentials) {
      this.credentials.set(credential.entityId, credential);
    }
  }

  private async migrate(data: StoredCredentials): Promise<void> {
    // Migrate from v1 (plain text PIN) to v2 (hashed PIN)
    if (data.version === 1) {
      for (const legacyCredential of data.credentials as unknown as LockCredentialLegacy[]) {
        // Hash the plain text PIN during migration
        const salt = randomBytes(SALT_LENGTH).toString("hex");
        const hash = this.hashPin(legacyCredential.pinCode, salt);

        const credential: LockCredential = {
          entityId: legacyCredential.entityId,
          pinCodeHash: hash,
          pinCodeSalt: salt,
          name: legacyCredential.name,
          enabled: legacyCredential.enabled,
          createdAt: legacyCredential.createdAt,
          updatedAt: Date.now(),
        };
        this.credentials.set(credential.entityId, credential);
      }
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const data: StoredCredentials = {
      version: CURRENT_VERSION,
      credentials: Array.from(this.credentials.values()),
    };

    await this.storage.set("data", data as unknown as StorageObjectType);
  }

  /**
   * Hash a PIN using PBKDF2 with the given salt
   */
  private hashPin(pin: string, salt: string): string {
    return pbkdf2Sync(
      pin,
      salt,
      HASH_ITERATIONS,
      HASH_KEY_LENGTH,
      HASH_ALGORITHM,
    ).toString("hex");
  }

  /**
   * Verify a PIN against a stored credential
   * @returns true if the PIN matches, false otherwise
   */
  verifyPin(entityId: string, pin: string): boolean {
    const credential = this.credentials.get(entityId);
    if (!credential?.enabled) {
      return false;
    }
    const hash = this.hashPin(pin, credential.pinCodeSalt);
    return hash === credential.pinCodeHash;
  }

  /**
   * Check if a credential exists and is enabled for an entity
   */
  hasCredential(entityId: string): boolean {
    const credential = this.credentials.get(entityId);
    return !!credential?.enabled && !!credential.pinCodeHash;
  }

  getAllCredentials(): LockCredential[] {
    return Array.from(this.credentials.values());
  }

  getCredential(entityId: string): LockCredential | undefined {
    return this.credentials.get(entityId);
  }

  getCredentialForEntity(entityId: string): LockCredential | undefined {
    return this.getCredential(entityId);
  }

  async setCredential(request: LockCredentialRequest): Promise<LockCredential> {
    const now = Date.now();
    const existing = this.credentials.get(request.entityId);

    // Generate new salt and hash the PIN
    const salt = randomBytes(SALT_LENGTH).toString("hex");
    const hash = this.hashPin(request.pinCode, salt);

    const credential: LockCredential = {
      entityId: request.entityId,
      pinCodeHash: hash,
      pinCodeSalt: salt,
      name: request.name?.trim() || undefined,
      enabled: request.enabled ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.credentials.set(request.entityId, credential);
    await this.persist();
    return credential;
  }

  async deleteCredential(entityId: string): Promise<void> {
    this.credentials.delete(entityId);
    await this.persist();
  }

  async deleteAllCredentials(): Promise<void> {
    this.credentials.clear();
    await this.persist();
  }

  /**
   * Toggle the enabled status of a credential without changing the PIN
   */
  async toggleEnabled(
    entityId: string,
    enabled: boolean,
  ): Promise<LockCredential | undefined> {
    const existing = this.credentials.get(entityId);
    if (!existing) {
      return undefined;
    }

    const updated: LockCredential = {
      ...existing,
      enabled,
      updatedAt: Date.now(),
    };

    this.credentials.set(entityId, updated);
    await this.persist();
    return updated;
  }
}
