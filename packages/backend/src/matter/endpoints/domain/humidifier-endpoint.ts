import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
  HumidiferDeviceAttributes,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { LightCommands } from "../../behaviors/callback-behavior.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { LevelControlBehavior } from "./behaviors/level-control-behavior.js";
import { OnOffBehavior } from "./behaviors/on-off-behavior.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const HumidifierEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OnOffBehavior,
  LevelControlBehavior,
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

  protected onEntityStateChanged(entity: HomeAssistantEntityInformation): void {
    if (!entity.state) return;

    const isOn =
      entity.state.state !== "off" && entity.state.state !== "unavailable";
    const attributes = entity.state.attributes as HumidiferDeviceAttributes;
    const humidity = attributes.humidity ?? 50;
    const matterLevel = Math.round((humidity / 100) * 254);

    try {
      this.setStateOf(OnOffBehavior, { onOff: isOn });
      this.setStateOf(LevelControlBehavior, { currentLevel: matterLevel });
    } catch {
      // Behavior may not be initialized yet
    }
  }

  protected onBehaviorCommand(command: BehaviorCommand): void {
    switch (command.command) {
      case LightCommands.TURN_ON:
        this.callAction("humidifier", "turn_on");
        break;
      case LightCommands.TURN_OFF:
        this.callAction("humidifier", "turn_off");
        break;
      case LightCommands.SET_BRIGHTNESS: {
        const args = command.args as { level?: number } | undefined;
        if (args?.level != null) {
          const humidity = Math.round((args.level / 254) * 100);
          this.callAction("humidifier", "set_humidity", { humidity });
        }
        break;
      }
    }
  }
}
