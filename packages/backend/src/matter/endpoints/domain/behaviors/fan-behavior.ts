import { FanControlServer as Base } from "@matter/main/behaviors";
import { FanControl } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";

const FeaturedBase = Base.with("MultiSpeed", "Auto");

/**
 * Vision 1 FanBehavior - Callback-based behavior.
 */
export class FanBehavior extends FeaturedBase {
  declare state: FanBehavior.State;

  override async initialize() {
    this.state.fanMode = FanControl.FanMode.Off;
    this.state.fanModeSequence = FanControl.FanModeSequence.OffLowMedHighAuto;
    this.state.percentCurrent = 0;
    this.state.percentSetting = 0;
    this.state.speedMax = 100;
    this.state.speedCurrent = 0;
    this.state.speedSetting = 0;
    await super.initialize();
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: {
    fanMode?: FanControl.FanMode;
    percentCurrent?: number;
    percentSetting?: number;
    speedCurrent?: number;
    speedSetting?: number;
  }): void {
    applyPatchState(this.state, update);
  }
}

export namespace FanBehavior {
  export class State extends FeaturedBase.State {}
}
