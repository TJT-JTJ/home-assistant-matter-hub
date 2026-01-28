import { Endpoint } from "@matter/main";
import type { EndpointType } from "@matter/main/node";
import type { HomeAssistantStates } from "../../services/home-assistant/home-assistant-registry.js";

export abstract class EntityEndpoint extends Endpoint {
  protected constructor(
    type: EndpointType,
    readonly entityId: string,
    customName?: string,
  ) {
    super(type, { id: createEndpointId(entityId, customName) });
  }

  abstract updateStates(states: HomeAssistantStates): Promise<void>;
}

function createEndpointId(entityId: string, customName?: string): string {
  const baseName = customName || entityId;
  return baseName.replace(/\./g, "_").replace(/\s+/g, "_");
}
