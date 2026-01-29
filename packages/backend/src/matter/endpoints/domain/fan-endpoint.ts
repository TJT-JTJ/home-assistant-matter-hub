import {
  type EntityMappingConfig,
  type FanDeviceAttributes,
  FanDeviceFeature,
  type HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { FanControl } from "@matter/main/clusters";
import { FanDevice as Device } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { FeatureSelection } from "../../../utils/feature-selection.js";
import { testBit } from "../../../utils/test-bit.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { FanFanControlServer } from "../legacy/fan/behaviors/fan-fan-control-server.js";
import { FanOnOffServer } from "../legacy/fan/behaviors/fan-on-off-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

/**
 * FanEndpoint - Vision 1 implementation for fan entities.
 */
export class FanEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<FanEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attributes = state.attributes as FanDeviceAttributes;
    const supportedFeatures = attributes.supported_features ?? 0;

    const hasSetSpeed = testBit(supportedFeatures, FanDeviceFeature.SET_SPEED);
    const hasPresetMode = testBit(
      supportedFeatures,
      FanDeviceFeature.PRESET_MODE,
    );
    const presetModes = attributes.preset_modes ?? [];
    const speedPresets = presetModes.filter((m) => m.toLowerCase() !== "auto");

    const features: FeatureSelection<FanControl.Cluster> = new Set();
    if (hasSetSpeed || speedPresets.length > 0) {
      features.add("MultiSpeed");
      features.add("Step");
    }
    if (hasPresetMode) {
      features.add("Auto");
    }
    if (testBit(supportedFeatures, FanDeviceFeature.DIRECTION)) {
      features.add("AirflowDirection");
    }

    const deviceType = Device.with(
      IdentifyServer,
      BasicInformationServer,
      HomeAssistantEntityBehavior,
      FanOnOffServer,
      FanFanControlServer.with(...features),
    );

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const customName = mapping?.customName;
    return new FanEndpoint(
      deviceType.set({ homeAssistantEntity }),
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
