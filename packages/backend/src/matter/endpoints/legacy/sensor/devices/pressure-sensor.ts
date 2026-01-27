import type { SensorDeviceAttributes } from "@home-assistant-matter-hub/common";
import { PressureSensorDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../../behaviors/identify-server.js";
import {
  type PressureMeasurementConfig,
  PressureMeasurementServer,
} from "../../../../behaviors/pressure-measurement-server.js";

const pressureSensorConfig: PressureMeasurementConfig = {
  getValue(entity) {
    const state = entity.state;
    const attributes = entity.attributes as SensorDeviceAttributes;
    const pressure = state == null || Number.isNaN(+state) ? null : +state;
    if (pressure == null) {
      return undefined;
    }
    // Convert to hPa if needed (Matter expects kPa * 10 = dkPa, which equals hPa)
    const unit = attributes.unit_of_measurement?.toLowerCase();
    if (unit === "pa") {
      return pressure / 100; // Pa to hPa
    }
    if (unit === "kpa") {
      return pressure * 10; // kPa to hPa
    }
    if (unit === "mbar" || unit === "hpa") {
      return pressure; // Already in hPa/mbar
    }
    // Assume hPa by default
    return pressure;
  },
};

export const PressureSensorType = PressureSensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  PressureMeasurementServer(pressureSensorConfig),
);
