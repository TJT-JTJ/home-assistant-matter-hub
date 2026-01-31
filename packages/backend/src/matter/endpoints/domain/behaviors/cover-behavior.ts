import { WindowCoveringServer as Base } from "@matter/main/behaviors";
import { WindowCovering } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import {
  CoverCommands,
  notifyEndpoint,
} from "../../../behaviors/callback-behavior.js";

const FeaturedBase = Base.with("Lift", "PositionAwareLift", "AbsolutePosition");

/**
 * Vision 1 CoverBehavior - Callback-based behavior.
 */
export class CoverBehavior extends FeaturedBase {
  declare state: CoverBehavior.State;

  override async initialize() {
    this.state.type = WindowCovering.WindowCoveringType.Rollershade;
    this.state.configStatus = {
      operational: true,
      onlineReserved: false,
      liftMovementReversed: false,
      liftPositionAware: true,
      tiltPositionAware: false,
      liftEncoderControlled: true,
      tiltEncoderControlled: false,
    };
    this.state.operationalStatus = {
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    };
    this.state.endProductType = WindowCovering.EndProductType.RollerShade;
    this.state.mode = {};
    this.state.targetPositionLiftPercent100ths = 0;
    this.state.currentPositionLiftPercent100ths = 0;
    await super.initialize();
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: {
    currentPositionLiftPercent100ths?: number;
    targetPositionLiftPercent100ths?: number;
  }): void {
    applyPatchState(this.state, update);
  }

  override upOrOpen(): void {
    notifyEndpoint(this, "Cover", CoverCommands.OPEN);
  }

  override downOrClose(): void {
    notifyEndpoint(this, "Cover", CoverCommands.CLOSE);
  }

  override stopMotion(): void {
    notifyEndpoint(this, "Cover", CoverCommands.STOP);
  }

  override goToLiftPercentage(
    request: WindowCovering.GoToLiftPercentageRequest,
  ): void {
    const position = request.liftPercent100thsValue;
    notifyEndpoint(this, "Cover", CoverCommands.SET_POSITION, {
      position: position != null ? 100 - position / 100 : undefined,
    });
  }
}

export namespace CoverBehavior {
  export class State extends FeaturedBase.State {}
}
