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

const SwitchDeviceType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OnOffBehavior,
);

/**
 * SwitchEndpoint - Vision 1 implementation for switch/input_boolean entities.
 *
 * This endpoint:
 * - Receives entity state changes and updates behavior states
 * - Receives command callbacks from behaviors and calls HA services
 */
export class SwitchEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<SwitchEndpoint | undefined> {
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
    return new SwitchEndpoint(
      SwitchDeviceType.set({ homeAssistantEntity }),
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

    const isOn =
      entity.state.state !== "off" && entity.state.state !== "unavailable";

    try {
      this.setStateOf(OnOffBehavior, { onOff: isOn });
    } catch {
      // Behavior may not be initialized yet
    }
  }

  protected onBehaviorCommand(command: BehaviorCommand): void {
    switch (command.command) {
      case LightCommands.TURN_ON:
        this.callAction("homeassistant", "turn_on");
        break;
      case LightCommands.TURN_OFF:
        this.callAction("homeassistant", "turn_off");
        break;
    }
  }
}
