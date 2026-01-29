import {
  type CoverDeviceAttributes,
  CoverSupportedFeatures,
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { WindowCovering } from "@matter/main/clusters";
import { WindowCoveringDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { FeatureSelection } from "../../../utils/feature-selection.js";
import { testBit } from "../../../utils/test-bit.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { CoverWindowCoveringServer } from "../legacy/cover/behaviors/cover-window-covering-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

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

    const attributes = state.attributes as CoverDeviceAttributes;
    const supportedFeatures = attributes.supported_features ?? 0;

    const features: FeatureSelection<WindowCovering.Complete> = new Set();
    if (testBit(supportedFeatures, CoverSupportedFeatures.support_open)) {
      features.add("Lift");
      features.add("PositionAwareLift");
      if (
        testBit(supportedFeatures, CoverSupportedFeatures.support_set_position)
      ) {
        features.add("AbsolutePosition");
      }
    }
    if (testBit(supportedFeatures, CoverSupportedFeatures.support_open_tilt)) {
      features.add("Tilt");
      features.add("PositionAwareTilt");
      if (
        testBit(
          supportedFeatures,
          CoverSupportedFeatures.support_set_tilt_position,
        )
      ) {
        features.add("AbsolutePosition");
      }
    }

    const deviceType = WindowCoveringDevice.with(
      BasicInformationServer,
      IdentifyServer,
      HomeAssistantEntityBehavior,
      CoverWindowCoveringServer.with(...features),
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
    return new CoverEndpoint(
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
