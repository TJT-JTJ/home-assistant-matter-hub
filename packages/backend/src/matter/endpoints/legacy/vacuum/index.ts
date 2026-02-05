import {
  type VacuumDeviceAttributes,
  VacuumDeviceFeature,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { RoboticVacuumCleanerDevice } from "@matter/main/devices";
import { testBit } from "../../../../utils/test-bit.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
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

const VacuumEndpointType = RoboticVacuumCleanerDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  VacuumRvcOperationalStateServer,
);

export function VacuumDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType | undefined {
  if (homeAssistantEntity.entity.state === undefined) {
    return undefined;
  }

  const attributes = homeAssistantEntity.entity.state
    .attributes as VacuumDeviceAttributes;
  const supportedFeatures = attributes.supported_features ?? 0;

  // Add RvcRunModeServer with initial supportedModes (including room modes if available)
  let device = VacuumEndpointType.with(
    createVacuumRvcRunModeServer(attributes),
  ).set({ homeAssistantEntity });

  if (testBit(supportedFeatures, VacuumDeviceFeature.START)) {
    device = device.with(VacuumOnOffServer);
  }
  // Add PowerSource if BATTERY feature is set OR if battery attribute exists
  // Some vacuums use 'battery_level', others use 'battery' (e.g. Dreame)
  const batteryValue = attributes.battery_level ?? attributes.battery;
  const hasBattery = batteryValue != null && typeof batteryValue === "number";
  if (testBit(supportedFeatures, VacuumDeviceFeature.BATTERY) || hasBattery) {
    device = device.with(VacuumPowerSourceServer);
  }

  // ServiceArea cluster for native room selection in Apple Home
  // All state is set at creation time (no custom initialize())
  // Support both: 1) rooms from vacuum attributes (Dreame, Xiaomi Miot)
  //               2) button entities from mapping (Roborock official integration)
  const roomEntities = homeAssistantEntity.mapping?.roomEntities;
  const rooms = parseVacuumRooms(attributes);
  if (rooms.length > 0 || (roomEntities && roomEntities.length > 0)) {
    device = device.with(
      createVacuumServiceAreaServer(attributes, roomEntities),
    );
  }

  // RvcCleanMode for Dreame vacuum cleaning modes (Sweeping, Mopping, etc.)
  if (supportsCleaningModes(attributes)) {
    device = device.with(createVacuumRvcCleanModeServer(attributes));
  }

  return device;
}
