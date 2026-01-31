import { SwitchServer as Base } from "@matter/main/behaviors";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";

const FeaturedBase = Base.with("MomentarySwitch", "MomentarySwitchRelease");

/**
 * Vision 1 ButtonBehavior - Callback-based behavior for buttons/scenes.
 */
export class ButtonBehavior extends FeaturedBase {
  declare state: ButtonBehavior.State;

  override async initialize() {
    await super.initialize();
    this.state.numberOfPositions = 2;
    this.state.currentPosition = 0;
  }

  /**
   * Trigger a button press (called by endpoint).
   */
  public triggerPress(): void {
    applyPatchState(this.state, { currentPosition: 1 });
    setTimeout(() => {
      applyPatchState(this.state, { currentPosition: 0 });
    }, 100);
  }
}

export namespace ButtonBehavior {
  export class State extends FeaturedBase.State {}
}
