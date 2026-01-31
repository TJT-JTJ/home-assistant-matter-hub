import type {
  CoverDeviceAttributes,
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { WindowCoveringDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { CoverCommands } from "../../behaviors/callback-behavior.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { CoverBehavior } from "./behaviors/cover-behavior.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const CoverDeviceType = WindowCoveringDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  CoverBehavior,
);

/**
 * CoverEndpoint - Vision 1 implementation for cover entities.
 */
export class CoverEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<CoverEndpoint | undefined> {
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
    return new CoverEndpoint(
      CoverDeviceType.set({ homeAssistantEntity }),
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

    const attributes = entity.state.attributes as CoverDeviceAttributes;
    const currentPosition = attributes.current_position;

    // Convert HA position (0=closed, 100=open) to Matter (0=open, 10000=closed)
    const matterPosition =
      currentPosition != null ? (100 - currentPosition) * 100 : 0;

    try {
      this.setStateOf(CoverBehavior, {
        currentPositionLiftPercent100ths: matterPosition,
        targetPositionLiftPercent100ths: matterPosition,
      });
    } catch {
      // Behavior may not be initialized yet
    }
  }

  protected onBehaviorCommand(command: BehaviorCommand): void {
    switch (command.command) {
      case CoverCommands.OPEN:
        this.callAction("cover", "open_cover");
        break;
      case CoverCommands.CLOSE:
        this.callAction("cover", "close_cover");
        break;
      case CoverCommands.STOP:
        this.callAction("cover", "stop_cover");
        break;
      case CoverCommands.SET_POSITION: {
        const args = command.args as { position?: number } | undefined;
        if (args?.position != null) {
          this.callAction("cover", "set_cover_position", {
            position: Math.round(args.position),
          });
        }
        break;
      }
    }
  }
}
