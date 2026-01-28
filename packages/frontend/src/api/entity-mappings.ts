import type {
  EntityMappingConfig,
  EntityMappingRequest,
  EntityMappingResponse,
} from "@home-assistant-matter-hub/common";

export async function fetchEntityMappings(
  bridgeId: string,
): Promise<EntityMappingResponse> {
  const response = await fetch(`api/entity-mappings/${bridgeId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch entity mappings: ${response.statusText}`);
  }
  return response.json();
}

export async function updateEntityMapping(
  bridgeId: string,
  entityId: string,
  config: Partial<EntityMappingRequest>,
): Promise<EntityMappingConfig> {
  const response = await fetch(
    `api/entity-mappings/${bridgeId}/${encodeURIComponent(entityId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update entity mapping: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteEntityMapping(
  bridgeId: string,
  entityId: string,
): Promise<void> {
  const response = await fetch(
    `api/entity-mappings/${bridgeId}/${encodeURIComponent(entityId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete entity mapping: ${response.statusText}`);
  }
}
