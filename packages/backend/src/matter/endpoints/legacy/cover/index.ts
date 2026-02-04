import {
  type CoverDeviceAttributes,
  CoverSupportedFeatures,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { WindowCovering } from "@matter/main/clusters";
import { WindowCoveringDevice } from "@matter/main/devices";
import type { FeatureSelection } from "../../../../utils/feature-selection.js";
import { testBit } from "../../../../utils/test-bit.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";
import { CoverWindowCoveringServer } from "./behaviors/cover-window-covering-server.js";

// PowerSource configuration for battery-powered covers
const CoverPowerSourceServer = PowerSourceServer({
  getBatteryPercent: (entity) => {
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
});

const CoverDeviceType = (supportedFeatures: number, hasBattery: boolean) => {
  const features: FeatureSelection<WindowCovering.Complete> = new Set();
  if (testBit(supportedFeatures, CoverSupportedFeatures.support_open)) {
    features.add("Lift");
    // Only add PositionAwareLift if the cover supports position control.
    // Binary covers (like garage doors) only support open/close, not positions.
    // Adding PositionAwareLift for binary covers causes Apple Home to show only
    // a percentage slider instead of Open/Close buttons (#78).
    if (
      testBit(supportedFeatures, CoverSupportedFeatures.support_set_position)
    ) {
      features.add("PositionAwareLift");
      features.add("AbsolutePosition");
    }
  }

  if (testBit(supportedFeatures, CoverSupportedFeatures.support_open_tilt)) {
    features.add("Tilt");
    // Same logic for tilt - only add PositionAwareTilt if position control is supported
    if (
      testBit(
        supportedFeatures,
        CoverSupportedFeatures.support_set_tilt_position,
      )
    ) {
      features.add("PositionAwareTilt");
      features.add("AbsolutePosition");
    }
  }

  const baseBehaviors = [
    BasicInformationServer,
    IdentifyServer,
    HomeAssistantEntityBehavior,
    CoverWindowCoveringServer.with(...features),
  ] as const;

  if (hasBattery) {
    return WindowCoveringDevice.with(...baseBehaviors, CoverPowerSourceServer);
  }
  return WindowCoveringDevice.with(...baseBehaviors);
};

export function CoverDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  const attributes = homeAssistantEntity.entity.state
    .attributes as CoverDeviceAttributes & {
    battery?: number;
    battery_level?: number;
  };
  const hasBattery =
    attributes.battery_level != null || attributes.battery != null;
  return CoverDeviceType(attributes.supported_features ?? 0, hasBattery).set({
    homeAssistantEntity,
  });
}
