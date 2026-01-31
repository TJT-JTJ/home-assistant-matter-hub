import { LevelControlServer as Base } from "@matter/main/behaviors";
import type { LevelControl } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import {
  LightCommands,
  notifyEndpoint,
} from "../../../behaviors/callback-behavior.js";

const FeaturedBase = Base.with("OnOff", "Lighting");

/**
 * Vision 1 LevelControlBehavior - Callback-based behavior.
 */
export class LevelControlBehavior extends FeaturedBase {
  declare state: LevelControlBehavior.State;

  override async initialize() {
    await super.initialize();
    this.state.currentLevel = 254;
    this.state.minLevel = 1;
    this.state.maxLevel = 254;
    this.state.onLevel = 254;
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: { currentLevel?: number | null }): void {
    applyPatchState(this.state, update);
  }

  // Fix for Google Home: it sends moveToLevel/moveToLevelWithOnOff with transitionTime as null.
  // Matter.js validation fails on null/undefined, so we provide a default value of 0.
  override async moveToLevel(request: LevelControl.MoveToLevelRequest) {
    if (request.transitionTime == null) {
      request.transitionTime = 0;
    }
    return super.moveToLevel(request);
  }

  override async moveToLevelWithOnOff(
    request: LevelControl.MoveToLevelRequest,
  ) {
    if (request.transitionTime == null) {
      request.transitionTime = 0;
    }
    return super.moveToLevelWithOnOff(request);
  }

  override moveToLevelLogic(level: number): void {
    // Update state directly (Matter.js expects this)
    this.state.currentLevel = level;
    // Notify parent endpoint to call HA action
    notifyEndpoint(this, "LevelControl", LightCommands.SET_BRIGHTNESS, {
      level,
    });
  }
}

export namespace LevelControlBehavior {
  export class State extends FeaturedBase.State {}
}
