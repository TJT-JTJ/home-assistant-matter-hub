import {
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
  type LightDeviceAttributes,
  LightDeviceColorMode,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { ColorControl } from "@matter/main/clusters";
import {
  ColorTemperatureLightDevice,
  DimmableLightDevice,
  ExtendedColorLightDevice,
  OnOffLightDevice,
} from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { FeatureSelection } from "../../../utils/feature-selection.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { LightColorControlServer } from "../legacy/light/behaviors/light-color-control-server.js";
import { LightLevelControlServer } from "../legacy/light/behaviors/light-level-control-server.js";
import { LightOnOffServer } from "../legacy/light/behaviors/light-on-off-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const brightnessModes: LightDeviceColorMode[] = Object.values(
  LightDeviceColorMode,
)
  .filter((mode) => mode !== LightDeviceColorMode.UNKNOWN)
  .filter((mode) => mode !== LightDeviceColorMode.ONOFF);

const colorModes: LightDeviceColorMode[] = [
  LightDeviceColorMode.HS,
  LightDeviceColorMode.RGB,
  LightDeviceColorMode.XY,
  LightDeviceColorMode.RGBW,
  LightDeviceColorMode.RGBWW,
];

/**
 * LightEndpoint - Vision 1 implementation for light entities.
 *
 * This endpoint uses the proven legacy behaviors but provides:
 * - Domain-specific coordination
 * - Access to neighbor entities (for future multi-entity scenarios)
 * - Clean separation between endpoint logic and behavior logic
 *
 * The behaviors handle:
 * - Self-updating via HomeAssistantEntityBehavior.onChange
 * - Matter commands (on/off, level control, color control)
 * - HA service calls
 */
export class LightEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<LightEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attributes = state.attributes as LightDeviceAttributes;
    const supportedColorModes: LightDeviceColorMode[] =
      attributes.supported_color_modes ?? [];

    const supportsBrightness = supportedColorModes.some((mode) =>
      brightnessModes.includes(mode),
    );
    const supportsColorControl = supportedColorModes.some((mode) =>
      colorModes.includes(mode),
    );
    const supportsColorTemperature = supportedColorModes.includes(
      LightDeviceColorMode.COLOR_TEMP,
    );

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    // Create appropriate device type based on capabilities
    const deviceType = supportsColorControl
      ? LightEndpoint.createExtendedColorType(supportsColorTemperature)
      : supportsColorTemperature
        ? LightEndpoint.createColorTemperatureType()
        : supportsBrightness
          ? LightEndpoint.createDimmableType()
          : LightEndpoint.createOnOffType();

    const customName = mapping?.customName;
    return new LightEndpoint(
      deviceType.set({ homeAssistantEntity }),
      entityId,
      customName,
    );
  }

  private static createOnOffType() {
    return OnOffLightDevice.with(
      IdentifyServer,
      BasicInformationServer,
      HomeAssistantEntityBehavior,
      LightOnOffServer,
    );
  }

  private static createDimmableType() {
    return DimmableLightDevice.with(
      IdentifyServer,
      BasicInformationServer,
      HomeAssistantEntityBehavior,
      LightOnOffServer,
      LightLevelControlServer,
    );
  }

  private static createColorTemperatureType() {
    return ColorTemperatureLightDevice.with(
      IdentifyServer,
      BasicInformationServer,
      HomeAssistantEntityBehavior,
      LightOnOffServer,
      LightLevelControlServer,
      LightColorControlServer.with("ColorTemperature"),
    );
  }

  private static createExtendedColorType(supportsTemperature: boolean) {
    const features: FeatureSelection<ColorControl.Cluster> = new Set([
      "HueSaturation",
    ]);
    if (supportsTemperature) {
      features.add("ColorTemperature");
    }
    return ExtendedColorLightDevice.with(
      IdentifyServer,
      BasicInformationServer,
      HomeAssistantEntityBehavior,
      LightOnOffServer,
      LightLevelControlServer,
      LightColorControlServer.with(...features),
    );
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  /**
   * Handle HA entity state changes.
   * Note: The behaviors already handle state updates via HomeAssistantEntityBehavior.onChange.
   * This method is for future domain-specific coordination (e.g., multi-entity scenarios).
   */
  protected onEntityStateChanged(
    _entity: HomeAssistantEntityInformation,
  ): void {
    // Behaviors handle their own state updates via HomeAssistantEntityBehavior.onChange.
    // This hook is available for domain-specific coordination if needed.
  }

  /**
   * Handle Matter commands from controllers.
   * Note: The behaviors already handle commands via their override methods.
   * This method is for future domain-specific coordination.
   */
  protected onBehaviorCommand(_command: BehaviorCommand): void {
    // Behaviors handle their own commands.
    // This hook is available for domain-specific coordination if needed.
  }
}
