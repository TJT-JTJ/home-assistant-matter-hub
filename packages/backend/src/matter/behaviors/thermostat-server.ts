import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { ThermostatServer as Base } from "@matter/main/behaviors";
import { Thermostat } from "@matter/main/clusters";

const logger = Logger.get("ThermostatServer");

import type { HomeAssistantAction } from "../../services/home-assistant/home-assistant-actions.js";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { Temperature } from "../../utils/converters/temperature.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

import SystemMode = Thermostat.SystemMode;
import RunningMode = Thermostat.ThermostatRunningMode;

import type { ActionContext } from "@matter/main";
import { transactionIsOffline } from "../../utils/transaction-is-offline.js";

// NOTE: AutoMode feature IS included because it's required for the minSetpointDeadBand attribute.
// Matter.js's internal #handleSystemModeChange reactor tries to write thermostatRunningMode
// in post-commit without proper permissions (Matter.js issue #3105).
// WORKAROUND: We set thermostatRunningMode ourselves in initialize() and update(), so the
// internal reactor either sees the correct value already set or the error is harmless.
// See: https://github.com/matter-js/matter.js/issues/3105

// Default state values to prevent NaN validation errors during initialization.
// These MUST be set via .set() when creating the behavior class because Matter.js
// validates setpoints before our initialize() method runs.
const defaultState = {
  localTemperature: 2100, // 21°C
  occupiedHeatingSetpoint: 2000, // 20°C
  occupiedCoolingSetpoint: 2400, // 24°C
  // Wide limits (0-50°C)
  minHeatSetpointLimit: 0,
  maxHeatSetpointLimit: 5000,
  minCoolSetpointLimit: 0,
  maxCoolSetpointLimit: 5000,
  absMinHeatSetpointLimit: 0,
  absMaxHeatSetpointLimit: 5000,
  absMinCoolSetpointLimit: 0,
  absMaxCoolSetpointLimit: 5000,
  // Allow same setpoint for heating and cooling (HA heat_cool thermostats often
  // only have a single temperature setpoint, not separate high/low targets)
  minSetpointDeadBand: 0,
};

// Create the FeaturedBase with Heating, Cooling, and AutoMode features.
// AutoMode is required to expose minSetpointDeadBand attribute, which we set to 0
// to allow heat_cool thermostats with a single temperature setpoint.
// NOTE: We don't include AutoMode's thermostatRunningMode to avoid Matter.js issue #3105
// where the internal reactor tries to write without permissions.
const FeaturedBase = Base.with("Heating", "Cooling", "AutoMode").set(
  defaultState,
);

export interface ThermostatRunningState {
  heat: boolean;
  cool: boolean;
  fan: boolean;
  heatStage2: false;
  coolStage2: false;
  fanStage2: false;
  fanStage3: false;
}

export interface ThermostatServerConfig {
  supportsTemperatureRange: ValueGetter<boolean>;
  getMinTemperature: ValueGetter<Temperature | undefined>;
  getMaxTemperature: ValueGetter<Temperature | undefined>;
  getCurrentTemperature: ValueGetter<Temperature | undefined>;
  getTargetHeatingTemperature: ValueGetter<Temperature | undefined>;
  getTargetCoolingTemperature: ValueGetter<Temperature | undefined>;

  getSystemMode: ValueGetter<SystemMode>;
  getRunningMode: ValueGetter<RunningMode>;
  getControlSequence: ValueGetter<Thermostat.ControlSequenceOfOperation>;

  setSystemMode: ValueSetter<SystemMode>;
  setTargetTemperature: ValueSetter<Temperature>;
  setTargetTemperatureRange: ValueSetter<{
    low: Temperature;
    high: Temperature;
  }>;
}

export class ThermostatServerBase extends FeaturedBase {
  declare state: ThermostatServerBase.State;

  // State class only declares the config property type.
  // ALL defaults are set via .set() in the ThermostatServer function below.
  // This ensures Matter.js's internal cluster data store receives the values.
  static override State = class State extends FeaturedBase.State {
    config!: ThermostatServerConfig;
  };

  override async initialize() {
    // CRITICAL: Matter.js's internal #clampSetpointToLimits() runs during super.initialize()
    // and reads setpoint values from a path that might not see our .set() defaults.
    // The logs show our this.state has correct values (2200) but Matter.js sees "undefined".
    //
    // FIX: UNCONDITIONALLY force-set all values before super.initialize() to ensure
    // Matter.js's internal validation has valid values to work with.
    // We use the current values if they're valid numbers, otherwise use sensible defaults.

    const currentHeating = this.state.occupiedHeatingSetpoint;
    const currentCooling = this.state.occupiedCoolingSetpoint;
    const currentLocal = this.state.localTemperature;

    logger.debug(
      `initialize: before defaults - heating=${currentHeating}, cooling=${currentCooling}, local=${currentLocal}`,
    );

    // ALWAYS set these values unconditionally to ensure Matter.js sees them.
    // Use current value if valid, otherwise use default.
    const heatingValue =
      typeof currentHeating === "number" && !Number.isNaN(currentHeating)
        ? currentHeating
        : 2000;
    const coolingValue =
      typeof currentCooling === "number" && !Number.isNaN(currentCooling)
        ? currentCooling
        : 2400;
    const localValue =
      typeof currentLocal === "number" && !Number.isNaN(currentLocal)
        ? currentLocal
        : 2100;

    // Force-set ALL thermostat values unconditionally
    this.state.occupiedHeatingSetpoint = heatingValue;
    this.state.occupiedCoolingSetpoint = coolingValue;
    this.state.localTemperature = localValue;
    this.state.minHeatSetpointLimit = this.state.minHeatSetpointLimit ?? 0;
    this.state.maxHeatSetpointLimit = this.state.maxHeatSetpointLimit ?? 5000;
    this.state.minCoolSetpointLimit = this.state.minCoolSetpointLimit ?? 0;
    this.state.maxCoolSetpointLimit = this.state.maxCoolSetpointLimit ?? 5000;
    this.state.absMinHeatSetpointLimit =
      this.state.absMinHeatSetpointLimit ?? 0;
    this.state.absMaxHeatSetpointLimit =
      this.state.absMaxHeatSetpointLimit ?? 5000;
    this.state.absMinCoolSetpointLimit =
      this.state.absMinCoolSetpointLimit ?? 0;
    this.state.absMaxCoolSetpointLimit =
      this.state.absMaxCoolSetpointLimit ?? 5000;

    logger.debug(
      `initialize: after force-set - heating=${this.state.occupiedHeatingSetpoint}, cooling=${this.state.occupiedCoolingSetpoint}`,
    );

    // Initialize thermostatRunningMode (required by AutoMode feature).
    // Setting this ourselves prevents Matter.js issue #3105 where the internal
    // #handleSystemModeChange reactor tries to write thermostatRunningMode
    // without proper permissions in post-commit.
    this.state.thermostatRunningMode = Thermostat.ThermostatRunningMode.Off;

    // Set initial controlSequenceOfOperation based on enabled features.
    // Will be updated from HA entity's actual hvac_modes in update().
    this.state.controlSequenceOfOperation =
      this.features.cooling && this.features.heating
        ? Thermostat.ControlSequenceOfOperation.CoolingAndHeating
        : this.features.cooling
          ? Thermostat.ControlSequenceOfOperation.CoolingOnly
          : Thermostat.ControlSequenceOfOperation.HeatingOnly;

    await super.initialize();

    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);

    this.reactTo(this.events.systemMode$Changed, this.systemModeChanged);
    // Use $Changing (pre-commit) for setpoint changes to avoid access control issues
    // The $Changed event fires in post-commit where we lose write permissions
    if (this.features.cooling) {
      this.reactTo(
        this.events.occupiedCoolingSetpoint$Changing,
        this.coolingSetpointChanging,
      );
    }
    if (this.features.heating) {
      this.reactTo(
        this.events.occupiedHeatingSetpoint$Changing,
        this.heatingSetpointChanging,
      );
    }
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const config = this.state.config;

    // When unavailable, keep last known values but report offline via BasicInformation.reachable
    // Only update temperatures if entity is available to prevent null/invalid values
    const isAvailable = homeAssistant.isAvailable;

    const minSetpointLimit = isAvailable
      ? config.getMinTemperature(entity.state, this.agent)?.celsius(true)
      : (this.state.minHeatSetpointLimit ?? this.state.minCoolSetpointLimit);
    const maxSetpointLimit = isAvailable
      ? config.getMaxTemperature(entity.state, this.agent)?.celsius(true)
      : (this.state.maxHeatSetpointLimit ?? this.state.maxCoolSetpointLimit);
    const currentTemperature = isAvailable
      ? config.getCurrentTemperature(entity.state, this.agent)?.celsius(true)
      : this.state.localTemperature;
    const targetHeatingTemperature = isAvailable
      ? (config
          .getTargetHeatingTemperature(entity.state, this.agent)
          ?.celsius(true) ?? this.state.occupiedHeatingSetpoint)
      : this.state.occupiedHeatingSetpoint;
    const targetCoolingTemperature = isAvailable
      ? (config
          .getTargetCoolingTemperature(entity.state, this.agent)
          ?.celsius(true) ?? this.state.occupiedCoolingSetpoint)
      : this.state.occupiedCoolingSetpoint;

    const systemMode = isAvailable
      ? this.getSystemMode(entity)
      : (this.state.systemMode ?? Thermostat.SystemMode.Off);
    const runningMode = isAvailable
      ? config.getRunningMode(entity.state, this.agent)
      : Thermostat.ThermostatRunningMode.Off;

    // When current_temperature is not available (common for AC controllers),
    // fall back to the target setpoint temperature (matching HA's UI behavior)
    const localTemperature =
      currentTemperature ??
      targetHeatingTemperature ??
      targetCoolingTemperature ??
      this.state.localTemperature;

    // Temperature limit handling:
    // Use HA's actual min/max limits for ALL modes (single and dual).
    // With minSetpointDeadBand: 0, there are no deadband constraints to worry about.
    // Fall back to wide limits (0-50°C) only when HA doesn't provide limits.
    const WIDE_MIN = 0; // 0°C
    const WIDE_MAX = 5000; // 50°C

    let minHeatLimit: number | undefined;
    let minCoolLimit: number | undefined;
    let maxHeatLimit: number | undefined;
    let maxCoolLimit: number | undefined;

    if (this.features.heating) {
      minHeatLimit = minSetpointLimit ?? WIDE_MIN;
      maxHeatLimit = maxSetpointLimit ?? WIDE_MAX;
    }
    if (this.features.cooling) {
      minCoolLimit = minSetpointLimit ?? WIDE_MIN;
      maxCoolLimit = maxSetpointLimit ?? WIDE_MAX;
    }

    // Clamp setpoints to be within the calculated limits to prevent Matter.js validation errors
    // This handles cases where HA reports setpoints outside the valid range
    const clampedHeatingSetpoint = this.clampSetpoint(
      targetHeatingTemperature,
      minHeatLimit,
      maxHeatLimit,
      "heat",
    );
    const clampedCoolingSetpoint = this.clampSetpoint(
      targetCoolingTemperature,
      minCoolLimit,
      maxCoolLimit,
      "cool",
    );

    logger.debug(
      `update: limits heat=[${minHeatLimit}, ${maxHeatLimit}], cool=[${minCoolLimit}, ${maxCoolLimit}], systemMode=${systemMode}, runningMode=${runningMode}`,
    );

    // Property order matters: applyPatchState sets properties sequentially, so if one
    // property write triggers an error, subsequent properties won't be set.
    // Limits are set FIRST to ensure they're applied even if mode changes trigger errors.
    // thermostatRunningMode is set BEFORE systemMode to prevent Matter.js issue #3105
    // (internal reactor tries to write thermostatRunningMode when systemMode changes).
    applyPatchState(this.state, {
      ...(this.features.heating
        ? {
            minHeatSetpointLimit: minHeatLimit,
            maxHeatSetpointLimit: maxHeatLimit,
            absMinHeatSetpointLimit: minHeatLimit,
            absMaxHeatSetpointLimit: maxHeatLimit,
          }
        : {}),
      ...(this.features.cooling
        ? {
            minCoolSetpointLimit: minCoolLimit,
            maxCoolSetpointLimit: maxCoolLimit,
            absMinCoolSetpointLimit: minCoolLimit,
            absMaxCoolSetpointLimit: maxCoolLimit,
          }
        : {}),
      localTemperature: localTemperature,
      controlSequenceOfOperation: config.getControlSequence(
        entity.state,
        this.agent,
      ),
      thermostatRunningMode: runningMode,
      thermostatRunningState: this.getRunningState(systemMode, runningMode),
      systemMode: systemMode,
      ...(this.features.heating
        ? { occupiedHeatingSetpoint: clampedHeatingSetpoint }
        : {}),
      ...(this.features.cooling
        ? { occupiedCoolingSetpoint: clampedCoolingSetpoint }
        : {}),
    });
  }

  override setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest) {
    const config = this.state.config;
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const state = homeAssistant.entity.state;

    let cool = config.getTargetCoolingTemperature(state, this.agent);
    let heat = config.getTargetHeatingTemperature(state, this.agent);

    if (!heat && !cool) {
      return;
    }
    heat = (heat ?? cool)!;
    cool = (cool ?? heat)!;

    const adjustedCool =
      request.mode !== Thermostat.SetpointRaiseLowerMode.Heat
        ? cool.plus(request.amount / 1000, "°C")
        : cool;
    const adjustedHeat =
      request.mode !== Thermostat.SetpointRaiseLowerMode.Cool
        ? heat.plus(request.amount / 1000, "°C")
        : heat;
    this.setTemperature(adjustedHeat, adjustedCool, request.mode);
  }

  /**
   * Pre-commit handler for heating setpoint changes.
   * Using $Changing instead of $Changed to ensure we have write permissions
   * when calling the Home Assistant action.
   */
  private heatingSetpointChanging(
    value: number,
    _oldValue: number,
    context?: ActionContext,
  ) {
    logger.debug(
      `heatingSetpointChanging: value=${value}, oldValue=${_oldValue}, isOffline=${transactionIsOffline(context)}`,
    );
    if (transactionIsOffline(context)) {
      logger.debug(
        "heatingSetpointChanging: skipping - transaction is offline",
      );
      return;
    }
    const next = Temperature.celsius(value / 100);
    if (!next) {
      logger.debug("heatingSetpointChanging: skipping - invalid temperature");
      return;
    }
    // Use asLocalActor to avoid access control issues when accessing HomeAssistantEntityBehavior
    this.agent.asLocalActor(() => {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const config = this.state.config;
      const supportsRange = config.supportsTemperatureRange(
        homeAssistant.entity.state,
        this.agent,
      );
      const currentMode = this.state.systemMode;
      logger.debug(
        `heatingSetpointChanging: supportsRange=${supportsRange}, systemMode=${currentMode}, features.heating=${this.features.heating}, features.cooling=${this.features.cooling}`,
      );

      // For single-temperature thermostats, determine if heating setpoint should update HA.
      // We check the ACTUAL HA hvac_mode to handle auto mode correctly.
      if (!supportsRange) {
        const haHvacMode = homeAssistant.entity.state.state;
        const isAutoMode = haHvacMode === "auto" || haHvacMode === "heat_cool";
        const isHeatingMode =
          currentMode === Thermostat.SystemMode.Heat ||
          currentMode === Thermostat.SystemMode.EmergencyHeat;

        // In Auto mode: heating setpoint updates temperature (cooling setpoint is ignored)
        // In Heat mode: heating setpoint updates temperature
        // In Cool mode: let coolingSetpointChanging handle this
        if (!isAutoMode && !isHeatingMode) {
          logger.debug(
            `heatingSetpointChanging: skipping - not in heating/auto mode (mode=${currentMode}, haMode=${haHvacMode})`,
          );
          return; // Let coolingSetpointChanging handle this
        }
        logger.debug(
          `heatingSetpointChanging: proceeding - isAutoMode=${isAutoMode}, isHeatingMode=${isHeatingMode}, haMode=${haHvacMode}`,
        );
      }

      const coolingSetpoint = this.state.occupiedCoolingSetpoint;
      logger.debug(
        `heatingSetpointChanging: calling setTemperature with heat=${next.celsius(true)}, cool=${coolingSetpoint}`,
      );
      this.setTemperature(
        next,
        Temperature.celsius(coolingSetpoint / 100)!,
        Thermostat.SetpointRaiseLowerMode.Heat,
      );
    });
  }

  /**
   * Pre-commit handler for cooling setpoint changes.
   * Using $Changing instead of $Changed to ensure we have write permissions
   * when calling the Home Assistant action.
   */
  private coolingSetpointChanging(
    value: number,
    _oldValue: number,
    context?: ActionContext,
  ) {
    if (transactionIsOffline(context)) {
      return;
    }
    const next = Temperature.celsius(value / 100);
    if (!next) {
      return;
    }
    // Use asLocalActor to avoid access control issues when accessing HomeAssistantEntityBehavior
    this.agent.asLocalActor(() => {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const config = this.state.config;
      const supportsRange = config.supportsTemperatureRange(
        homeAssistant.entity.state,
        this.agent,
      );

      // For single-temperature thermostats, determine if cooling setpoint should update HA.
      // We check the ACTUAL HA hvac_mode to handle auto mode correctly.
      if (!supportsRange) {
        const currentMode = this.state.systemMode;
        const haHvacMode = homeAssistant.entity.state.state;
        const isAutoMode = haHvacMode === "auto" || haHvacMode === "heat_cool";
        const isCoolingMode =
          currentMode === Thermostat.SystemMode.Cool ||
          currentMode === Thermostat.SystemMode.Precooling;

        // In Auto mode: BOTH heating and cooling setpoint should update temperature (#71)
        // In Cool mode: cooling setpoint updates temperature
        // In Heat mode: let heatingSetpointChanging handle this
        if (!isAutoMode && !isCoolingMode) {
          logger.debug(
            `coolingSetpointChanging: skipping - not in cooling/auto mode (mode=${currentMode}, haMode=${haHvacMode})`,
          );
          return; // Let heatingSetpointChanging handle this
        }
        logger.debug(
          `coolingSetpointChanging: proceeding - isAutoMode=${isAutoMode}, isCoolingMode=${isCoolingMode}, haMode=${haHvacMode}`,
        );
      }

      const heatingSetpoint = this.state.occupiedHeatingSetpoint;
      this.setTemperature(
        Temperature.celsius(heatingSetpoint / 100)!,
        next,
        Thermostat.SetpointRaiseLowerMode.Cool,
      );
    });
  }

  private setTemperature(
    low: Temperature,
    high: Temperature,
    mode: Thermostat.SetpointRaiseLowerMode,
  ) {
    const config = this.state.config;
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);

    const supportsTemperatureRange = config.supportsTemperatureRange(
      homeAssistant.entity.state,
      this.agent,
    );

    let action: HomeAssistantAction;
    if (supportsTemperatureRange) {
      action = config.setTargetTemperatureRange({ low, high }, this.agent);
    } else {
      const both = mode === Thermostat.SetpointRaiseLowerMode.Heat ? low : high;
      action = config.setTargetTemperature(both, this.agent);
    }
    homeAssistant.callAction(action);
  }

  private systemModeChanged(
    systemMode: Thermostat.SystemMode,
    _oldValue: Thermostat.SystemMode,
    context?: ActionContext,
  ) {
    if (transactionIsOffline(context)) {
      return;
    }
    // Use asLocalActor to avoid access control issues when accessing HomeAssistantEntityBehavior
    this.agent.asLocalActor(() => {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const action = this.state.config.setSystemMode(systemMode, this.agent);
      homeAssistant.callAction(action);
    });
  }

  private getSystemMode(entity: HomeAssistantEntityInformation) {
    // NOTE: We intentionally allow SystemMode.Auto to be displayed without the AutoMode feature.
    // The AutoMode feature only adds thermostatRunningMode attribute and its internal reactor.
    // The systemMode attribute itself (including Auto value) is part of the base Thermostat cluster.
    // Controllers should be able to display Auto mode without the AutoMode feature enabled.
    // See: https://github.com/matter-js/matter.js/issues/3105 for why we don't enable AutoMode.
    return this.state.config.getSystemMode(entity.state, this.agent);
  }

  private getRunningState(
    systemMode: SystemMode,
    runningMode: RunningMode,
  ): ThermostatRunningState {
    const allOff: ThermostatRunningState = {
      cool: false,
      fan: false,
      heat: false,
      heatStage2: false,
      coolStage2: false,
      fanStage2: false,
      fanStage3: false,
    };
    const heat = { ...allOff, heat: true };
    const cool = { ...allOff, cool: true };
    const dry = { ...allOff, heat: true, fan: true };
    const fanOnly = { ...allOff, fan: true };

    // Controllers like Apple Home use thermostatRunningState for mode coloring
    // (orange = heat, blue = cool). Using runningMode (from hvac_action) would
    // cause "black in all modes" because idle states return allOff even in Heat
    // mode. Instead, reflect the SELECTED systemMode so coloring always matches.
    // Only Auto mode uses runningMode to distinguish which of heat/cool is active.
    switch (systemMode) {
      case SystemMode.Heat:
      case SystemMode.EmergencyHeat:
        return heat;
      case SystemMode.Cool:
      case SystemMode.Precooling:
        return cool;
      case SystemMode.Dry:
        return dry;
      case SystemMode.FanOnly:
        return fanOnly;
      case SystemMode.Off:
      case SystemMode.Sleep:
        return allOff;
      case SystemMode.Auto:
        switch (runningMode) {
          case RunningMode.Heat:
            return heat;
          case RunningMode.Cool:
            return cool;
          case RunningMode.Off:
            return allOff;
        }
    }
  }

  private clampSetpoint(
    value: number | undefined,
    min: number | undefined,
    max: number | undefined,
    type: "heat" | "cool",
  ): number {
    // Use reasonable defaults if limits not provided
    const effectiveMin = min ?? 0; // 0°C
    const effectiveMax = max ?? 5000; // 50°C

    // If value is undefined, use a reasonable default based on type
    // Heat defaults to 20°C (2000), Cool defaults to 24°C (2400)
    if (value == null) {
      const defaultValue = type === "heat" ? 2000 : 2400;
      logger.debug(
        `${type} setpoint is undefined, using default: ${defaultValue}`,
      );
      return Math.max(effectiveMin, Math.min(effectiveMax, defaultValue));
    }

    // Clamp value to be within limits
    return Math.max(effectiveMin, Math.min(effectiveMax, value));
  }
}

export namespace ThermostatServerBase {
  export type State = InstanceType<typeof ThermostatServerBase.State>;
}

export interface ThermostatServerFeatures {
  heating: boolean;
  cooling: boolean;
}

/**
 * Initial state values for the thermostat.
 * These MUST be provided when creating the behavior to prevent NaN validation errors.
 * Matter.js validates setpoints during initialization BEFORE our initialize() runs.
 */
export interface ThermostatServerInitialState {
  /** Local temperature in 0.01°C units (e.g., 2100 = 21°C). Default: 2100 */
  localTemperature?: number;
  /** Heating setpoint in 0.01°C units (e.g., 2000 = 20°C). Default: 2000 */
  occupiedHeatingSetpoint?: number;
  /** Cooling setpoint in 0.01°C units (e.g., 2400 = 24°C). Default: 2400 */
  occupiedCoolingSetpoint?: number;
  /** Minimum heat setpoint limit. Default: 0 (0°C) */
  minHeatSetpointLimit?: number;
  /** Maximum heat setpoint limit. Default: 5000 (50°C) */
  maxHeatSetpointLimit?: number;
  /** Minimum cool setpoint limit. Default: 0 (0°C) */
  minCoolSetpointLimit?: number;
  /** Maximum cool setpoint limit. Default: 5000 (50°C) */
  maxCoolSetpointLimit?: number;
}

/**
 * Creates a ThermostatServer behavior with the specified config and initial state.
 *
 * CRITICAL: The initialState values are passed DIRECTLY to Matter.js during behavior
 * registration. This is the ONLY way to prevent NaN validation errors, because
 * Matter.js validates setpoints BEFORE our initialize() method runs.
 *
 * Pass ALL thermostat attributes directly to behaviors.require() call.
 *
 * @param config - The thermostat server configuration (getters/setters for HA)
 * @param initialState - Initial attribute values. MUST include valid setpoints!
 */
export function ThermostatServer(
  config: ThermostatServerConfig,
  initialState: ThermostatServerInitialState = {},
) {
  // Merge provided initial state with defaults
  // These values are passed DIRECTLY to Matter.js during registration,
  // ensuring they are available BEFORE any validation runs.
  const state = {
    config,
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
  };

  return ThermostatServerBase.set(state);
}
