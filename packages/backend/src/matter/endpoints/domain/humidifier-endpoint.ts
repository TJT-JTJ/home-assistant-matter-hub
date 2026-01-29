import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { OnOffServer } from "../../behaviors/on-off-server.js";
import { HumidifierLevelControlServer } from "../legacy/humidifier/behaviors/humidifier-level-control-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const HumidifierEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OnOffServer().with(),
  HumidifierLevelControlServer,
);

/**
 * HumidifierEndpoint - Vision 1 implementation for humidifier entities.
 */
export class HumidifierEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<HumidifierEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const customName = mapping?.customName;
    return new HumidifierEndpoint(
      HumidifierEndpointType.set({ homeAssistantEntity }),
      entityId,
      customName,
    );
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  protected onEntityStateChanged(
    _entity: HomeAssistantEntityInformation,
  ): void {
    // Behaviors handle their own state updates
  }

  protected onBehaviorCommand(_command: BehaviorCommand): void {
    // Behaviors handle their own commands
  }
}
