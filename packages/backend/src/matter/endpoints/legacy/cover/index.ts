import {
  type CoverDeviceAttributes,
  CoverSupportedFeatures,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { EndpointType } from "@matter/main";
import type { WindowCovering } from "@matter/main/clusters";
import { WindowCoveringDevice } from "@matter/main/devices";

const logger = Logger.get("CoverDevice");

import { EntityStateProvider } from "../../../../services/bridges/entity-state-provider.js";
import type { FeatureSelection } from "../../../../utils/feature-selection.js";
import { testBit } from "../../../../utils/test-bit.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";
import { CoverWindowCoveringServer } from "./behaviors/cover-window-covering-server.js";

// PowerSource configuration for battery-powered covers
const CoverPowerSourceServer = PowerSourceServer({
  getBatteryPercent: (entity, agent) => {
    // First check for battery entity from mapping (auto-assigned or manual)
    const homeAssistant = agent.get(HomeAssistantEntityBehavior);
    const batteryEntity = homeAssistant.state.mapping?.batteryEntity;
    if (batteryEntity) {
      const stateProvider = agent.env.get(EntityStateProvider);
      const battery = stateProvider.getNumericState(batteryEntity);
      if (battery != null) {
        return Math.max(0, Math.min(100, battery));
      }
    }

    // Fallback to entity's own battery attribute
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

const CoverDeviceType = (
  supportedFeatures: number,
  hasBattery: boolean,
  entityId: string,
) => {
  const features: FeatureSelection<WindowCovering.Complete> = new Set();

  // Always add Lift as minimum feature - a WindowCovering without Lift or Tilt
  // may cause issues with some controllers (Apple Home showing as wrong device type)
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
  } else {
    // Fallback: Add Lift even if support_open is not set
    // This ensures the WindowCovering device is always valid
    logger.warn(
      `[${entityId}] Cover has no support_open feature (supported_features=${supportedFeatures}), adding Lift anyway`,
    );
    features.add("Lift");
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

  logger.info(
    `[${entityId}] Creating WindowCovering with features: [${[...features].join(", ")}], supported_features=${supportedFeatures}`,
  );

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
  const entityId = homeAssistantEntity.entity.entity_id;
  const attributes = homeAssistantEntity.entity.state
    .attributes as CoverDeviceAttributes & {
    battery?: number;
    battery_level?: number;
  };
  const hasBatteryAttr =
    attributes.battery_level != null || attributes.battery != null;
  const hasBatteryEntity = !!homeAssistantEntity.mapping?.batteryEntity;
  const hasBattery = hasBatteryAttr || hasBatteryEntity;

  if (hasBattery) {
    logger.info(
      `[${entityId}] Creating cover with PowerSource cluster, ` +
        `batteryAttr=${hasBatteryAttr}, batteryEntity=${homeAssistantEntity.mapping?.batteryEntity ?? "none"}`,
    );
  } else {
    logger.debug(
      `[${entityId}] Creating cover without battery (batteryAttr=${hasBatteryAttr}, batteryEntity=${homeAssistantEntity.mapping?.batteryEntity ?? "none"})`,
    );
  }

  return CoverDeviceType(
    attributes.supported_features ?? 0,
    hasBattery,
    entityId,
  ).set({
    homeAssistantEntity,
  });
}
