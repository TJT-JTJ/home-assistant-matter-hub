import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { Pm25ConcentrationMeasurementServer as Base } from "@matter/main/behaviors";
import { ConcentrationMeasurement } from "@matter/main/clusters";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";

// Enable both NumericMeasurement and LevelIndication for maximum controller compatibility
const Pm25ConcentrationMeasurementServerBase = Base.with(
  ConcentrationMeasurement.Feature.NumericMeasurement,
  ConcentrationMeasurement.Feature.LevelIndication,
);

// PM2.5 level thresholds in µg/m³ (based on WHO and EPA guidelines)
// Good: 0-12, Moderate: 12-35, Unhealthy for Sensitive: 35-55, Unhealthy: 55-150, Very Unhealthy: >150
const PM25_LEVEL_LOW = 12; // Below this is "Low" (good air quality)
const PM25_LEVEL_MEDIUM = 35; // Below this is "Medium"
const PM25_LEVEL_HIGH = 55; // Below this is "High", above is "Critical"

export class Pm25ConcentrationMeasurementServer extends Pm25ConcentrationMeasurementServerBase {
  override async initialize() {
    // Set default values BEFORE super.initialize() to prevent validation errors
    if (this.state.measuredValue === undefined) {
      this.state.measuredValue = null;
    }
    if (this.state.minMeasuredValue === undefined) {
      this.state.minMeasuredValue = 0;
    }
    if (this.state.maxMeasuredValue === undefined) {
      this.state.maxMeasuredValue = 65535; // Max uint16 for µg/m³
    }
    if (this.state.levelValue === undefined) {
      this.state.levelValue = ConcentrationMeasurement.LevelValue.Unknown;
    }

    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const state = entity.state.state;
    let measuredValue: number | null = null;
    let levelValue = ConcentrationMeasurement.LevelValue.Unknown;

    if (state != null && !Number.isNaN(+state)) {
      measuredValue = +state;

      // Calculate level based on PM2.5 value
      if (measuredValue < PM25_LEVEL_LOW) {
        levelValue = ConcentrationMeasurement.LevelValue.Low;
      } else if (measuredValue < PM25_LEVEL_MEDIUM) {
        levelValue = ConcentrationMeasurement.LevelValue.Medium;
      } else if (measuredValue < PM25_LEVEL_HIGH) {
        levelValue = ConcentrationMeasurement.LevelValue.High;
      } else {
        levelValue = ConcentrationMeasurement.LevelValue.Critical;
      }
    }

    applyPatchState(this.state, {
      measuredValue,
      minMeasuredValue: 0,
      maxMeasuredValue: 65535,
      levelValue,
      measurementUnit: ConcentrationMeasurement.MeasurementUnit.Ugm3,
      measurementMedium: ConcentrationMeasurement.MeasurementMedium.Air,
    });
  }
}
