import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { EntityStateProvider } from "../../../services/bridges/entity-state-provider.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { OnOffServer } from "../../behaviors/on-off-server.js";
import { PowerSourceServer } from "../../behaviors/power-source-server.js";
import { DomainEndpoint } from "../domain-endpoint.js";

const logger = Logger.get("SwitchDomainEndpoint");

const SwitchOnOffServer = OnOffServer().with("Lighting");

const SwitchEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  SwitchOnOffServer,
);

const SwitchWithBatteryEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  SwitchOnOffServer,
  PowerSourceServer({
    getBatteryPercent: (entity, agent) => {
      const homeAssistant = agent.get(HomeAssistantEntityBehavior);
      const batteryEntity = homeAssistant.state.mapping?.batteryEntity;
      if (batteryEntity) {
        const stateProvider = agent.env.get(EntityStateProvider);
        const battery = stateProvider.getNumericState(batteryEntity);
        if (battery != null) {
          return Math.max(0, Math.min(100, battery));
        }
      }
      const attrs = entity.attributes as {
        battery?: number;
        battery_level?: number;
      };
      const level = attrs.battery_level ?? attrs.battery;
      if (level == null || Number.isNaN(Number(level))) {
        return null;
      }
      return Number(level);
    },
  }),
);

/**
 * Vision 1 domain endpoint for HA switch / input_boolean entities.
 *
 * Phase 1: Behaviors still self-update via HomeAssistantEntityBehavior.onChange.
 *   This endpoint is structurally identical to the legacy SwitchDevice but uses
 *   the DomainEndpoint base class, proving the architecture works.
 *
 * Phase 2: The updateEntity() method will directly set OnOff behavior state,
 *   and the OnOffServer behavior will no longer subscribe to onChange.
 */
export class SwitchDomainEndpoint extends DomainEndpoint {
  static create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): SwitchDomainEndpoint | undefined {
    const state = registry.initialState(entityId);
    if (!state) {
      return undefined;
    }

    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    const attrs = state.attributes as {
      battery?: number;
      battery_level?: number;
    };
    const hasBatteryAttr = attrs.battery_level != null || attrs.battery != null;
    const hasBatteryEntity = !!mapping?.batteryEntity;
    const hasBattery = hasBatteryAttr || hasBatteryEntity;

    const haState: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      },
      customName: mapping?.customName,
      mapping,
    };

    const type = hasBattery
      ? SwitchWithBatteryEndpointType.set({ homeAssistantEntity: haState })
      : SwitchEndpointType.set({ homeAssistantEntity: haState });

    return new SwitchDomainEndpoint(type, entityId, registry, mapping);
  }

  protected updateEntity(_entity: HomeAssistantEntityInformation): void {
    // Phase 1: Behaviors self-update via onChange. Nothing extra needed.
    // Phase 2: Will directly set this.stateOf(OnOffBehavior).onOff here.
    logger.debug(`[${this.entityId}] updateEntity called`);
  }
}
