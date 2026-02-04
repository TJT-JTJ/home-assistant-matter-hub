import type {
  LockCredential,
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

const CURRENT_VERSION = 1;

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
    if (data.version < CURRENT_VERSION) {
      for (const credential of data.credentials) {
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

    const credential: LockCredential = {
      entityId: request.entityId,
      pinCode: request.pinCode,
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
}
