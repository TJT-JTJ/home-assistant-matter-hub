import type { EntityMappingConfig } from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { BridgeRegistry } from "../../services/bridges/bridge-registry.js";
import type { HomeAssistantStates } from "../../services/home-assistant/home-assistant-registry.js";
import { HomeAssistantEntityBehavior } from "../behaviors/home-assistant-entity-behavior.js";
import { EntityEndpoint } from "./entity-endpoint.js";
import { ServerModeVacuumDevice } from "./legacy/vacuum/server-mode-vacuum-device.js";

/**
 * Server Mode Vacuum Endpoint.
 *
 * This endpoint does NOT include BridgedDeviceBasicInformationServer,
 * making it appear as a standalone Matter device rather than a bridged device.
 * This is required for Apple Home Siri voice commands and Alexa discovery.
 */
export class ServerModeVacuumEndpoint extends EntityEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<ServerModeVacuumEndpoint | undefined> {
    const deviceRegistry = registry.deviceOf(entityId);
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);

    if (!state) {
      return undefined;
    }

    const payload = {
      entity_id: entityId,
      state,
      registry: entity,
      deviceRegistry,
    };

    const customName = mapping?.customName;
    const endpointType = ServerModeVacuumDevice({
      entity: payload,
      customName,
      mapping,
    });

    if (!endpointType) {
      return undefined;
    }

    return new ServerModeVacuumEndpoint(endpointType, entityId, customName);
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  async updateStates(states: HomeAssistantStates): Promise<void> {
    const state = states[this.entityId] ?? {};
    if (!state) {
      return;
    }

    try {
      await this.construction.ready;
    } catch {
      return;
    }

    try {
      const current = this.stateOf(HomeAssistantEntityBehavior).entity;
      await this.setStateOf(HomeAssistantEntityBehavior, {
        entity: { ...current, state },
      });
    } catch {
      // Ignore errors during state updates (endpoint may be shutting down)
    }
  }
}
