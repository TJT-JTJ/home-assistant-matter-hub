import type {
  LockCredential,
  LockCredentialRequest,
  LockCredentialsResponse,
} from "@home-assistant-matter-hub/common";

export async function fetchLockCredentials(): Promise<LockCredentialsResponse> {
  const response = await fetch("api/lock-credentials");
  if (!response.ok) {
    throw new Error(`Failed to fetch lock credentials: ${response.statusText}`);
  }
  return response.json();
}

export async function updateLockCredential(
  entityId: string,
  config: LockCredentialRequest,
): Promise<LockCredential> {
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

export async function deleteLockCredential(entityId: string): Promise<void> {
  const response = await fetch(
    `api/lock-credentials/${encodeURIComponent(entityId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete lock credential: ${response.statusText}`);
  }
}
