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
    this.state.currentLevel = 254;
    this.state.minLevel = 1;
    this.state.maxLevel = 254;
    this.state.onLevel = 254;
    await super.initialize();
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: { currentLevel?: number | null }): void {
    applyPatchState(this.state, update);
  }

  override moveToLevel(request: LevelControl.MoveToLevelRequest): void {
    notifyEndpoint(this, "LevelControl", LightCommands.SET_BRIGHTNESS, {
      level: request.level,
    });
  }

  override moveToLevelWithOnOff(
    request: LevelControl.MoveToLevelRequest,
  ): void {
    if (request.level === 0) {
      notifyEndpoint(this, "LevelControl", LightCommands.TURN_OFF);
    } else {
      notifyEndpoint(this, "LevelControl", LightCommands.SET_BRIGHTNESS, {
        level: request.level,
        withOnOff: true,
      });
    }
  }
}

export namespace LevelControlBehavior {
  export class State extends FeaturedBase.State {}
}
