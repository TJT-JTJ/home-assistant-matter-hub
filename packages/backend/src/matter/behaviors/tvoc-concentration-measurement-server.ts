import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { TotalVolatileOrganicCompoundsConcentrationMeasurementServer as Base } from "@matter/main/behaviors";
import { ConcentrationMeasurement } from "@matter/main/clusters";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";

// Enable both NumericMeasurement (for actual ppb values) and LevelIndication (for level descriptions)
// Some controllers only show LevelIndication, others show NumericMeasurement
const TvocConcentrationMeasurementServerBase = Base.with(
  ConcentrationMeasurement.Feature.NumericMeasurement,
  ConcentrationMeasurement.Feature.LevelIndication,
);

// TVOC level thresholds in ppb (based on German Federal Environment Agency guidelines)
// Excellent: 0-65 ppb, Good: 65-220 ppb, Moderate: 220-660 ppb, Poor: 660-2200 ppb, Bad: >2200 ppb
const TVOC_LEVEL_LOW = 220; // Below this is "Low" (good air quality)
const TVOC_LEVEL_MEDIUM = 660; // Below this is "Medium"
const TVOC_LEVEL_HIGH = 2200; // Below this is "High", above is "Critical"

export class TvocConcentrationMeasurementServer extends TvocConcentrationMeasurementServerBase {
  override async initialize() {
    // Matter.js defaults: measuredValue=null, minMeasuredValue=null, maxMeasuredValue=null
    // These are valid per Matter spec - we set actual values in update()
    // levelValue defaults to undefined but is required for LevelIndication feature
    // measurementUnit and measurementMedium default to undefined but are required
    // No pre-init overrides needed - we set all required values in update()

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

      // Calculate level based on TVOC value
      if (measuredValue < TVOC_LEVEL_LOW) {
        levelValue = ConcentrationMeasurement.LevelValue.Low;
      } else if (measuredValue < TVOC_LEVEL_MEDIUM) {
        levelValue = ConcentrationMeasurement.LevelValue.Medium;
      } else if (measuredValue < TVOC_LEVEL_HIGH) {
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
      measurementUnit: ConcentrationMeasurement.MeasurementUnit.Ppb,
      measurementMedium: ConcentrationMeasurement.MeasurementMedium.Air,
    });
  }
}
