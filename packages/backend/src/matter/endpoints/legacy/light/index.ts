import {
  type LightDeviceAttributes,
  LightDeviceColorMode,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { DimmableLightType } from "./devices/dimmable-light.js";
import { ExtendedColorLightType } from "./devices/extended-color-light.js";
import { OnOffLightType } from "./devices/on-off-light-device.js";

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

export function LightDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  const attributes = homeAssistantEntity.entity.state
    .attributes as LightDeviceAttributes;

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

  // Use ExtendedColorLight for all color-capable lights, including ColorTemperature-only lights.
  // ColorTemperatureLightDevice has issues with Matter.js initialization that cause
  // "Behaviors have errors" during endpoint creation. ExtendedColorLight works correctly
  // with just the ColorTemperature feature enabled (supportsColorControl=false).
  const deviceType =
    supportsColorControl || supportsColorTemperature
      ? ExtendedColorLightType(supportsColorControl, supportsColorTemperature)
      : supportsBrightness
        ? DimmableLightType
        : OnOffLightType;
  return deviceType.set({ homeAssistantEntity });
}
