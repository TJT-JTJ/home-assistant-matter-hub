import {
  type FanDeviceAttributes,
  FanDeviceFeature,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { FanControl } from "@matter/main/clusters";
import { FanDevice as Device } from "@matter/main/devices";
import type { FeatureSelection } from "../../../../utils/feature-selection.js";
import { testBit } from "../../../../utils/test-bit.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { FanFanControlServer } from "./behaviors/fan-fan-control-server.js";
import { FanOnOffServer } from "./behaviors/fan-on-off-server.js";

export function FanDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  const attributes = homeAssistantEntity.entity.state
    .attributes as FanDeviceAttributes;
  const supportedFeatures = attributes.supported_features ?? 0;

  const hasSetSpeed = testBit(supportedFeatures, FanDeviceFeature.SET_SPEED);
  const hasPresetMode = testBit(
    supportedFeatures,
    FanDeviceFeature.PRESET_MODE,
  );
  const presetModes = attributes.preset_modes ?? [];
  // Filter out "Auto" from presets for speed calculation
  const speedPresets = presetModes.filter((m) => m.toLowerCase() !== "auto");

  const features: FeatureSelection<FanControl.Cluster> = new Set();

  // Enable MultiSpeed and Step for fans with percentage control OR preset modes
  // For preset-only fans, speeds are mapped to preset modes (Low/Medium/High etc.)
  if (hasSetSpeed || speedPresets.length > 0) {
    features.add("MultiSpeed");
    features.add("Step");
  }

  // Enable Auto if fan supports preset modes (including "Auto" preset)
  if (hasPresetMode) {
    features.add("Auto");
  }
  if (testBit(supportedFeatures, FanDeviceFeature.DIRECTION)) {
    features.add("AirflowDirection");
  }

  const device = Device.with(
    IdentifyServer,
    BasicInformationServer,
    HomeAssistantEntityBehavior,
    FanOnOffServer,
    FanFanControlServer.with(...features),
  );
  return device.set({ homeAssistantEntity });
}
