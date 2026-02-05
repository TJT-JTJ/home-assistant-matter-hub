/**
 * Lock credential configuration for Matter DoorLock PIN support
 */
export interface LockCredential {
  /** The entity ID of the lock (e.g., lock.front_door) */
  entityId: string;
  /** The hashed PIN code (PBKDF2 with salt) */
  pinCodeHash: string;
  /** Salt used for PIN hashing */
  pinCodeSalt: string;
  /** Optional friendly name for this credential */
  name?: string;
  /** Whether this credential is enabled */
  enabled: boolean;
  /** Timestamp when this credential was created */
  createdAt: number;
  /** Timestamp when this credential was last updated */
  updatedAt: number;
}

/**
 * @deprecated Use LockCredential with pinCodeHash instead
 * Legacy credential format with plain text PIN (for migration)
 */
export interface LockCredentialLegacy {
  entityId: string;
  pinCode: string;
  name?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Request to create or update a lock credential
 */
export interface LockCredentialRequest {
  entityId: string;
  pinCode: string;
  name?: string;
  enabled?: boolean;
}

/**
 * Response containing all lock credentials
 */
export interface LockCredentialsResponse {
  credentials: LockCredential[];
}
