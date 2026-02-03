import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { CarbonDioxideConcentrationMeasurementServer as Base } from "@matter/main/behaviors";
import { ConcentrationMeasurement } from "@matter/main/clusters";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";

// Enable both NumericMeasurement and LevelIndication for maximum controller compatibility
const CarbonDioxideConcentrationMeasurementServerBase = Base.with(
  ConcentrationMeasurement.Feature.NumericMeasurement,
  ConcentrationMeasurement.Feature.LevelIndication,
);

// CO2 level thresholds in ppm (based on ASHRAE and health guidelines)
// Excellent: <600 ppm, Good: 600-1000 ppm, Moderate: 1000-1500 ppm, Poor: 1500-2500 ppm, Bad: >2500 ppm
const CO2_LEVEL_LOW = 1000; // Below this is "Low" (good air quality)
const CO2_LEVEL_MEDIUM = 1500; // Below this is "Medium"
const CO2_LEVEL_HIGH = 2500; // Below this is "High", above is "Critical"

export class CarbonDioxideConcentrationMeasurementServer extends CarbonDioxideConcentrationMeasurementServerBase {
  override async initialize() {
    // Set default values BEFORE super.initialize() to prevent validation errors
    if (this.state.measuredValue === undefined) {
      this.state.measuredValue = null;
    }
    if (this.state.minMeasuredValue === undefined) {
      this.state.minMeasuredValue = 0;
    }
    if (this.state.maxMeasuredValue === undefined) {
      this.state.maxMeasuredValue = 65535; // Max uint16 for ppm
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

      // Calculate level based on CO2 value
      if (measuredValue < CO2_LEVEL_LOW) {
        levelValue = ConcentrationMeasurement.LevelValue.Low;
      } else if (measuredValue < CO2_LEVEL_MEDIUM) {
        levelValue = ConcentrationMeasurement.LevelValue.Medium;
      } else if (measuredValue < CO2_LEVEL_HIGH) {
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
      measurementUnit: ConcentrationMeasurement.MeasurementUnit.Ppm,
      measurementMedium: ConcentrationMeasurement.MeasurementMedium.Air,
    });
  }
}
