import {
  type VacuumDeviceAttributes,
  VacuumDeviceFeature,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { RoboticVacuumCleanerDevice } from "@matter/main/devices";
import { testBit } from "../../../../utils/test-bit.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { VacuumOnOffServer } from "./behaviors/vacuum-on-off-server.js";
import { VacuumPowerSourceServer } from "./behaviors/vacuum-power-source-server.js";
import {
  createVacuumRvcCleanModeServer,
  supportsCleaningModes,
} from "./behaviors/vacuum-rvc-clean-mode-server.js";
import { VacuumRvcOperationalStateServer } from "./behaviors/vacuum-rvc-operational-state-server.js";
import { createVacuumRvcRunModeServer } from "./behaviors/vacuum-rvc-run-mode-server.js";
import { createVacuumServiceAreaServer } from "./behaviors/vacuum-service-area-server.js";
import { parseVacuumRooms } from "./utils/parse-vacuum-rooms.js";

/**
 * Server Mode Vacuum Endpoint Type.
 *
 * This is different from the normal VacuumDevice:
 * - NO BridgedDeviceBasicInformationServer (BasicInformationServer)
 * - The device appears as a standalone Matter device, not bridged
 * - Required for Apple Home Siri voice commands and Alexa discovery
 *
 * The BasicInformation comes from the ServerNode itself, not the endpoint.
 */
const ServerModeVacuumEndpointType = RoboticVacuumCleanerDevice.with(
  IdentifyServer,
  HomeAssistantEntityBehavior,
  VacuumRvcOperationalStateServer,
);

/**
 * Creates a Server Mode Vacuum Device endpoint.
 *
 * Unlike the bridged VacuumDevice, this version does NOT include
 * BridgedDeviceBasicInformationServer, making it appear as a
 * standalone (non-bridged) Matter device.
 */
export function ServerModeVacuumDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType | undefined {
  if (homeAssistantEntity.entity.state === undefined) {
    return undefined;
  }

  const attributes = homeAssistantEntity.entity.state
    .attributes as VacuumDeviceAttributes;
  const supportedFeatures = attributes.supported_features ?? 0;

  // Add RvcRunModeServer with initial supportedModes (including room modes if available)
  let device = ServerModeVacuumEndpointType.with(
    createVacuumRvcRunModeServer(attributes),
  ).set({ homeAssistantEntity });

  if (testBit(supportedFeatures, VacuumDeviceFeature.START)) {
    device = device.with(VacuumOnOffServer);
  }

  // Add PowerSource if BATTERY feature is set OR if battery attribute exists
  const batteryValue = attributes.battery_level ?? attributes.battery;
  const hasBattery = batteryValue != null && typeof batteryValue === "number";
  if (testBit(supportedFeatures, VacuumDeviceFeature.BATTERY) || hasBattery) {
    device = device.with(VacuumPowerSourceServer);
  }

  // ServiceArea cluster for native room selection
  const rooms = parseVacuumRooms(attributes);
  if (rooms.length > 0) {
    device = device.with(createVacuumServiceAreaServer(attributes));
  }

  // RvcCleanMode for Dreame vacuum cleaning modes
  if (supportsCleaningModes(attributes)) {
    device = device.with(createVacuumRvcCleanModeServer(attributes));
  }

  return device;
}
