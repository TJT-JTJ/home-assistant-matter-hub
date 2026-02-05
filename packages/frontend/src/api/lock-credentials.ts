import type { LockCredentialRequest } from "@home-assistant-matter-hub/common";

/**
 * Sanitized credential returned from API (PIN is never exposed)
 */
export interface SanitizedCredential {
  entityId: string;
  name?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  hasPinCode: boolean;
}

export async function fetchLockCredentials(): Promise<{
  credentials: SanitizedCredential[];
}> {
  const response = await fetch("api/lock-credentials");
  if (!response.ok) {
    throw new Error(`Failed to fetch lock credentials: ${response.statusText}`);
  }
  return response.json();
}

export async function updateLockCredential(
  entityId: string,
  config: LockCredentialRequest,
): Promise<SanitizedCredential> {
  const response = await fetch(
    `api/lock-credentials/${encodeURIComponent(entityId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to update lock credential: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function toggleLockCredentialEnabled(
  entityId: string,
  enabled: boolean,
): Promise<SanitizedCredential> {
  const response = await fetch(
    `api/lock-credentials/${encodeURIComponent(entityId)}/enabled`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to toggle credential: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function deleteLockCredential(entityId: string): Promise<void> {
  const response = await fetch(
    `api/lock-credentials/${encodeURIComponent(entityId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete lock credential: ${response.statusText}`);
  }
}
