import {
  type BinarySensorDeviceAttributes,
  BinarySensorDeviceClass,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import {
  ContactSensorType,
  ContactSensorWithBatteryType,
} from "./contact-sensor.js";
import {
  OccupancySensorType,
  OccupancySensorWithBatteryType,
} from "./occupancy-sensor.js";
import {
  OnOffSensorType,
  OnOffSensorWithBatteryType,
} from "./on-off-sensor.js";
import { CoAlarmType, SmokeAlarmType } from "./smoke-co-alarm.js";
import { WaterLeakDetectorType } from "./water-leak-detector.js";

type CombinedType =
  | typeof ContactSensorType
  | typeof OccupancySensorType
  | typeof WaterLeakDetectorType
  | typeof SmokeAlarmType
  | typeof CoAlarmType
  | typeof OnOffSensorType;

const deviceClasses: Partial<Record<BinarySensorDeviceClass, CombinedType>> = {
  [BinarySensorDeviceClass.CarbonMonoxide]: CoAlarmType,
  [BinarySensorDeviceClass.Gas]: CoAlarmType,

  [BinarySensorDeviceClass.Battery]: ContactSensorType,
  [BinarySensorDeviceClass.BatteryCharging]: ContactSensorType,
  [BinarySensorDeviceClass.Cold]: ContactSensorType,
  [BinarySensorDeviceClass.Connectivity]: ContactSensorType,
  [BinarySensorDeviceClass.Door]: ContactSensorType,
  [BinarySensorDeviceClass.GarageDoor]: ContactSensorType,
  [BinarySensorDeviceClass.Heat]: ContactSensorType,
  [BinarySensorDeviceClass.Light]: ContactSensorType,
  [BinarySensorDeviceClass.Lock]: ContactSensorType,
  [BinarySensorDeviceClass.Opening]: ContactSensorType,
  [BinarySensorDeviceClass.Plug]: ContactSensorType,
  [BinarySensorDeviceClass.Power]: ContactSensorType,
  [BinarySensorDeviceClass.Problem]: ContactSensorType,
  [BinarySensorDeviceClass.Running]: ContactSensorType,
  [BinarySensorDeviceClass.Safety]: ContactSensorType,
  [BinarySensorDeviceClass.Sound]: ContactSensorType,
  [BinarySensorDeviceClass.Tamper]: ContactSensorType,
  [BinarySensorDeviceClass.Update]: ContactSensorType,
  [BinarySensorDeviceClass.Vibration]: ContactSensorType,
  [BinarySensorDeviceClass.Window]: ContactSensorType,

  [BinarySensorDeviceClass.Motion]: OccupancySensorType,
  [BinarySensorDeviceClass.Moving]: OccupancySensorType,
  [BinarySensorDeviceClass.Occupancy]: OccupancySensorType,
  [BinarySensorDeviceClass.Presence]: OccupancySensorType,

  [BinarySensorDeviceClass.Smoke]: SmokeAlarmType,

  [BinarySensorDeviceClass.Moisture]: WaterLeakDetectorType,
};

// Mapping from normal type to battery type
const batteryTypes = new Map<CombinedType, CombinedType>([
  [ContactSensorType, ContactSensorWithBatteryType],
  [OccupancySensorType, OccupancySensorWithBatteryType],
  [OnOffSensorType, OnOffSensorWithBatteryType],
]);

export function BinarySensorDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  const defaultDeviceType = OnOffSensorType;

  const attributes = homeAssistantEntity.entity.state
    .attributes as BinarySensorDeviceAttributes & {
    battery?: number;
    battery_level?: number;
  };
  const deviceClass = attributes.device_class;
  const hasBattery =
    attributes.battery_level != null || attributes.battery != null;

  let type: CombinedType =
    deviceClass && deviceClasses[deviceClass]
      ? deviceClasses[deviceClass]
      : defaultDeviceType;

  // Use battery variant if available
  if (hasBattery && batteryTypes.has(type)) {
    type = batteryTypes.get(type)!;
  }

  return type.set({ homeAssistantEntity });
}
