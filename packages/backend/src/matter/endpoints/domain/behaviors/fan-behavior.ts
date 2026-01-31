import type { ActionContext } from "@matter/main";
import { FanControlServer as Base } from "@matter/main/behaviors";
import { FanControl } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import { transactionIsOffline } from "../../../../utils/transaction-is-offline.js";
import {
  FanCommands,
  LightCommands,
  notifyEndpoint,
} from "../../../behaviors/callback-behavior.js";

const FeaturedBase = Base.with("MultiSpeed", "Auto");

/**
 * Vision 1 FanBehavior - Callback-based behavior.
 *
 * Fans are controlled via attribute changes ($Changed events), not commands.
 * We react to these changes and notify the parent endpoint.
 */
export class FanBehavior extends FeaturedBase {
  declare state: FanBehavior.State;

  override async initialize() {
    await super.initialize();
    this.state.fanMode = FanControl.FanMode.Off;
    this.state.fanModeSequence = FanControl.FanModeSequence.OffLowMedHighAuto;
    this.state.percentCurrent = 0;
    this.state.percentSetting = 0;
    this.state.speedMax = 100;
    this.state.speedCurrent = 0;
    this.state.speedSetting = 0;

    // React to attribute changes from Matter controllers
    this.reactTo(
      this.events.percentSetting$Changed,
      this.onPercentSettingChanged,
    );
    this.reactTo(this.events.fanMode$Changed, this.onFanModeChanged);
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

  private onPercentSettingChanged(
    percentage: number | null,
    _oldValue?: number | null,
    context?: ActionContext,
  ) {
    if (transactionIsOffline(context)) {
      return;
    }
    if (percentage == null) {
      return;
    }

    if (percentage === 0) {
      notifyEndpoint(this, "Fan", LightCommands.TURN_OFF);
    } else {
      notifyEndpoint(this, "Fan", FanCommands.SET_SPEED, { speed: percentage });
    }
  }

  private onFanModeChanged(
    fanMode: FanControl.FanMode,
    _oldValue: FanControl.FanMode,
    context?: ActionContext,
  ) {
    if (transactionIsOffline(context)) {
      return;
    }

    if (fanMode === FanControl.FanMode.Off) {
      notifyEndpoint(this, "Fan", LightCommands.TURN_OFF);
    } else if (fanMode === FanControl.FanMode.Auto) {
      // For auto mode, just turn on - HA will handle auto
      notifyEndpoint(this, "Fan", LightCommands.TURN_ON);
    } else {
      // Low/Med/High modes - map to percentage
      let percentage = 50;
      switch (fanMode) {
        case FanControl.FanMode.Low:
          percentage = 33;
          break;
        case FanControl.FanMode.Medium:
          percentage = 66;
          break;
        case FanControl.FanMode.High:
          percentage = 100;
          break;
      }
      notifyEndpoint(this, "Fan", FanCommands.SET_SPEED, { speed: percentage });
    }
  }
}

export namespace FanBehavior {
  export class State extends FeaturedBase.State {}
}
