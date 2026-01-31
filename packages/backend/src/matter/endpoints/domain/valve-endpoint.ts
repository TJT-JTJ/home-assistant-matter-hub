import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { LightCommands } from "../../behaviors/callback-behavior.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { OnOffBehavior } from "./behaviors/on-off-behavior.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const ValveEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OnOffBehavior,
);

/**
 * ValveEndpoint - Vision 1 implementation for valve entities.
 */
export class ValveEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<ValveEndpoint | undefined> {
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
    return new ValveEndpoint(
      ValveEndpointType.set({ homeAssistantEntity }),
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

  protected onEntityStateChanged(entity: HomeAssistantEntityInformation): void {
    if (!entity.state) return;

    const isOpen = entity.state.state === "open";

    try {
      this.setStateOf(OnOffBehavior, { onOff: isOpen });
    } catch {
      // Behavior may not be initialized yet
    }
  }

  protected onBehaviorCommand(command: BehaviorCommand): void {
    switch (command.command) {
      case LightCommands.TURN_ON:
        this.callAction("valve", "open_valve");
        break;
      case LightCommands.TURN_OFF:
        this.callAction("valve", "close_valve");
        break;
    }
  }
}
