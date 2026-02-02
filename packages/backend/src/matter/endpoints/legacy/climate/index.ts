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
import { ClimateFanControlServer } from "./behaviors/climate-fan-control-server.js";
import { ClimateHumidityMeasurementServer } from "./behaviors/climate-humidity-measurement-server.js";
import { ClimateOnOffServer } from "./behaviors/climate-on-off-server.js";
import { ClimateThermostatServer } from "./behaviors/climate-thermostat-server.js";

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
) => {
  const additionalClusters: ClusterBehavior.Type[] = [];

  if (supportsOnOff) {
    additionalClusters.push(ClimateOnOffServer);
  }
  if (supportsHumidity) {
    additionalClusters.push(ClimateHumidityMeasurementServer);
  }

  // NOTE: ClimateThermostatServer() returns ThermostatServerBase which already
  // has HeatingCooling features and default setpoints. The actual initial values
  // are passed via .set() on the final device type in ClimateDevice().
  const thermostatServer = ClimateThermostatServer();

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
    .attributes as ClimateDeviceAttributes;
  const supportedFeatures = attributes.supported_features ?? 0;

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

  // CRITICAL: Extract initial thermostat values from HA entity state.
  // These are passed DIRECTLY to Matter.js during registration to prevent
  // NaN validation errors. Pattern from Matterbridge.
  const initialState: InitialThermostatState = {
    localTemperature: toMatterTemp(attributes.current_temperature),
    // Use target_temperature or target_temp_low/high depending on mode
    occupiedHeatingSetpoint:
      toMatterTemp(attributes.target_temp_low) ??
      toMatterTemp(attributes.temperature) ??
      2000, // 20°C default
    occupiedCoolingSetpoint:
      toMatterTemp(attributes.target_temp_high) ??
      toMatterTemp(attributes.temperature) ??
      2400, // 24°C default
    minHeatSetpointLimit: toMatterTemp(attributes.min_temp) ?? 0,
    maxHeatSetpointLimit: toMatterTemp(attributes.max_temp) ?? 5000,
    minCoolSetpointLimit: toMatterTemp(attributes.min_temp) ?? 0,
    maxCoolSetpointLimit: toMatterTemp(attributes.max_temp) ?? 5000,
  };

  // CRITICAL: Pass ALL thermostat attributes in the final .set() call.
  // Matter.js validates setpoints during initialization BEFORE our initialize() runs.
  // If we only pass homeAssistantEntity, the thermostat defaults from ThermostatServerBase
  // get overwritten with undefined values, causing NaN validation errors.
  // Pattern from Matterbridge: All attributes must be set during registration.
  return ClimateDeviceType(
    supportsOnOff,
    supportsHumidity,
    supportsFanMode,
  ).set({
    homeAssistantEntity,
    // Thermostat cluster attributes - pass directly to prevent NaN errors
    thermostat: {
      localTemperature: initialState.localTemperature ?? 2100,
      occupiedHeatingSetpoint: initialState.occupiedHeatingSetpoint ?? 2000,
      occupiedCoolingSetpoint: initialState.occupiedCoolingSetpoint ?? 2400,
      minHeatSetpointLimit: initialState.minHeatSetpointLimit ?? 0,
      maxHeatSetpointLimit: initialState.maxHeatSetpointLimit ?? 5000,
      minCoolSetpointLimit: initialState.minCoolSetpointLimit ?? 0,
      maxCoolSetpointLimit: initialState.maxCoolSetpointLimit ?? 5000,
      absMinHeatSetpointLimit: initialState.minHeatSetpointLimit ?? 0,
      absMaxHeatSetpointLimit: initialState.maxHeatSetpointLimit ?? 5000,
      absMinCoolSetpointLimit: initialState.minCoolSetpointLimit ?? 0,
      absMaxCoolSetpointLimit: initialState.maxCoolSetpointLimit ?? 5000,
    },
  });
}
