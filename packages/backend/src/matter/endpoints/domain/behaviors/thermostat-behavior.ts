import { ThermostatServer as Base } from "@matter/main/behaviors";
import { Thermostat } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";

const FeaturedBase = Base.with("Heating", "Cooling", "AutoMode");

/**
 * Vision 1 ThermostatBehavior - Callback-based behavior.
 */
export class ThermostatBehavior extends FeaturedBase {
  declare state: ThermostatBehavior.State;

  override async initialize() {
    this.state.localTemperature = 2000;
    this.state.occupiedHeatingSetpoint = 2000;
    this.state.occupiedCoolingSetpoint = 2600;
    this.state.minHeatSetpointLimit = 700;
    this.state.maxHeatSetpointLimit = 3000;
    this.state.minCoolSetpointLimit = 1600;
    this.state.maxCoolSetpointLimit = 3200;
    this.state.minSetpointDeadBand = 25;
    this.state.controlSequenceOfOperation =
      Thermostat.ControlSequenceOfOperation.CoolingAndHeating;
    this.state.systemMode = Thermostat.SystemMode.Off;
    await super.initialize();
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: {
    localTemperature?: number | null;
    occupiedHeatingSetpoint?: number;
    occupiedCoolingSetpoint?: number;
    systemMode?: Thermostat.SystemMode;
    thermostatRunningMode?: Thermostat.ThermostatRunningMode;
    minHeatSetpointLimit?: number;
    maxHeatSetpointLimit?: number;
    minCoolSetpointLimit?: number;
    maxCoolSetpointLimit?: number;
  }): void {
    applyPatchState(this.state, update);
  }
}

export namespace ThermostatBehavior {
  export class State extends FeaturedBase.State {}
}
