import {
  type ClimateDeviceAttributes,
  ClimateDeviceFeature,
  ClimateHvacMode,
} from "@home-assistant-matter-hub/common";
import type { ClusterBehavior, EndpointType } from "@matter/main";
import {
  RoomAirConditionerDevice,
  ThermostatDevice,
} from "@matter/main/devices";
import { InvalidDeviceError } from "../../../../utils/errors/invalid-device-error.js";
import { testBit } from "../../../../utils/test-bit.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";
import { ClimateFanControlServer } from "./behaviors/climate-fan-control-server.js";
import { ClimateHumidityMeasurementServer } from "./behaviors/climate-humidity-measurement-server.js";
import { ClimateOnOffServer } from "./behaviors/climate-on-off-server.js";
import { ClimateThermostatServer } from "./behaviors/climate-thermostat-server.js";

const ClimatePowerSourceServer = PowerSourceServer({
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

/**
 * Initial thermostat state extracted from Home Assistant entity.
 * Used to provide valid defaults BEFORE Matter.js validation runs.
 */
interface InitialThermostatState {
  localTemperature?: number;
  occupiedHeatingSetpoint?: number;
  occupiedCoolingSetpoint?: number;
  minHeatSetpointLimit?: number;
  maxHeatSetpointLimit?: number;
  minCoolSetpointLimit?: number;
  maxCoolSetpointLimit?: number;
}

const ClimateDeviceType = (
  supportsOnOff: boolean,
  supportsHumidity: boolean,
  supportsFanMode: boolean,
  hasBattery: boolean,
  initialState: InitialThermostatState,
) => {
  const additionalClusters: ClusterBehavior.Type[] = [];

  if (supportsOnOff) {
    additionalClusters.push(ClimateOnOffServer);
  }
  if (supportsHumidity) {
    additionalClusters.push(ClimateHumidityMeasurementServer);
  }
  if (hasBattery) {
    additionalClusters.push(ClimatePowerSourceServer);
  }

  // CRITICAL: Pass initial state values to ThermostatServer so they are set
  // via .set() BEFORE Matter.js validation runs. This prevents NaN errors.
  const thermostatServer = ClimateThermostatServer(initialState);

  if (supportsFanMode) {
    return RoomAirConditionerDevice.with(
      BasicInformationServer,
      IdentifyServer,
      HomeAssistantEntityBehavior,
      thermostatServer,
      ClimateFanControlServer,
      ...additionalClusters,
    );
  }

  return ThermostatDevice.with(
    BasicInformationServer,
    IdentifyServer,
    HomeAssistantEntityBehavior,
    thermostatServer,
    ...additionalClusters,
  );
};

const coolingModes: ClimateHvacMode[] = [
  ClimateHvacMode.heat_cool,
  ClimateHvacMode.cool,
];
const heatingModes: ClimateHvacMode[] = [
  ClimateHvacMode.heat_cool,
  ClimateHvacMode.heat,
];
// Auto-only thermostats (no explicit heat/cool) should be treated as heating
const autoOnlyMode: ClimateHvacMode[] = [ClimateHvacMode.auto];

/**
 * Convert HA temperature to Matter temperature (0.01°C units).
 * Returns undefined if value is null/undefined/invalid.
 */
function toMatterTemp(
  value: string | number | null | undefined,
): number | undefined {
  if (value == null) return undefined;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return undefined;
  return Math.round(num * 100);
}

export function ClimateDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  const attributes = homeAssistantEntity.entity.state
    .attributes as ClimateDeviceAttributes & {
    battery?: number;
    battery_level?: number;
  };
  const supportedFeatures = attributes.supported_features ?? 0;
  const hasBattery =
    attributes.battery_level != null || attributes.battery != null;

  const supportsCooling = coolingModes.some((mode) =>
    attributes.hvac_modes.includes(mode),
  );
  const hasExplicitHeating = heatingModes.some((mode) =>
    attributes.hvac_modes.includes(mode),
  );
  // Treat auto-only thermostats (no heat/cool/heat_cool) as heating devices
  // This allows simple thermostats that only have "auto" mode to work
  const isAutoOnly =
    !hasExplicitHeating &&
    !supportsCooling &&
    autoOnlyMode.some((mode) => attributes.hvac_modes.includes(mode));
  const supportsHeating = hasExplicitHeating || isAutoOnly;

  // Validate that at least one of heating or cooling is supported
  if (!supportsCooling && !supportsHeating) {
    throw new InvalidDeviceError(
      'Climates have to support either "heating" or "cooling". Just "auto" is not enough.',
    );
  }

  // Check if current_humidity attribute exists (not just TARGET_HUMIDITY feature)
  // Many devices report humidity without supporting target humidity control
  const supportsHumidity =
    attributes.current_humidity != null ||
    testBit(supportedFeatures, ClimateDeviceFeature.TARGET_HUMIDITY);
  const supportsOnOff =
    testBit(supportedFeatures, ClimateDeviceFeature.TURN_ON) &&
    testBit(supportedFeatures, ClimateDeviceFeature.TURN_OFF);
  const supportsFanMode = testBit(
    supportedFeatures,
    ClimateDeviceFeature.FAN_MODE,
  );

  // WORKAROUND: Due to Matter.js architecture, .set() values on behaviors are lost
  // when ThermostatDevice.with() is called. This causes the limits from HA to be set
  // but the setpoints remain undefined, leading to NaN validation errors.
  //
  // Until this is fixed upstream or we find a better solution, we DO NOT use custom
  // limits from HA. Instead, we use the standard limits (0-50°C) which are compatible
  // with the default setpoints (20°C heating, 24°C cooling) defined in ThermostatServerBase.
  //
  // The actual temperature control still works correctly through HA - only the Matter-side
  // limits are restricted to the safe default range.
  const initialState: InitialThermostatState = {
    localTemperature: toMatterTemp(attributes.current_temperature),
    occupiedHeatingSetpoint:
      toMatterTemp(attributes.target_temp_low) ??
      toMatterTemp(attributes.temperature) ??
      2000,
    occupiedCoolingSetpoint:
      toMatterTemp(attributes.target_temp_high) ??
      toMatterTemp(attributes.temperature) ??
      2400,
    // Use standard limits (0-50°C) to ensure compatibility with default setpoints
    minHeatSetpointLimit: 0,
    maxHeatSetpointLimit: 5000,
    minCoolSetpointLimit: 0,
    maxCoolSetpointLimit: 5000,
  };

  return ClimateDeviceType(
    supportsOnOff,
    supportsHumidity,
    supportsFanMode,
    hasBattery,
    initialState,
  ).set({ homeAssistantEntity });
}
