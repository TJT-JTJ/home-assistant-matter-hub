import { OnOffServer as Base } from "@matter/main/behaviors";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import {
  LightCommands,
  notifyEndpoint,
} from "../../../behaviors/callback-behavior.js";

const FeaturedBase = Base.with("Lighting");

/**
 * Vision 1 OnOffBehavior - Callback-based behavior.
 *
 * This behavior does NOT:
 * - Update itself from HA entity changes
 * - Call HA actions directly
 *
 * Instead, it:
 * - Notifies the parent endpoint when commands are received
 * - Receives state updates from the parent endpoint
 */
export class OnOffBehavior extends FeaturedBase {
  declare state: OnOffBehavior.State;

  override async initialize() {
    await super.initialize();
    this.state.onOff = false;
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: { onOff?: boolean }): void {
    applyPatchState(this.state, update);
  }

  override on() {
    notifyEndpoint(this, "OnOff", LightCommands.TURN_ON);
  }

  override off() {
    notifyEndpoint(this, "OnOff", LightCommands.TURN_OFF);
  }
}

export namespace OnOffBehavior {
  export class State extends FeaturedBase.State {}
}
