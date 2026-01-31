import { RvcOperationalStateServer as Base } from "@matter/main/behaviors";
import { RvcOperationalState } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import {
  notifyEndpoint,
  VacuumCommands,
} from "../../../behaviors/callback-behavior.js";

/**
 * Vision 1 VacuumOperationalStateBehavior - Callback-based behavior.
 */
export class VacuumOperationalStateBehavior extends Base {
  declare state: VacuumOperationalStateBehavior.State;

  override async initialize() {
    await super.initialize();
    this.state.operationalState = RvcOperationalState.OperationalState.Stopped;

    // NOTE: We do NOT subscribe to homeAssistant.onChange here!
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: {
    operationalState?: RvcOperationalState.OperationalState;
  }): void {
    applyPatchState(this.state, update);
  }

  override pause(): RvcOperationalState.OperationalCommandResponse {
    notifyEndpoint(this, "VacuumOperationalState", VacuumCommands.PAUSE);
    return {
      commandResponseState: {
        errorStateId: RvcOperationalState.ErrorState.NoError,
      },
    };
  }

  override resume(): RvcOperationalState.OperationalCommandResponse {
    notifyEndpoint(this, "VacuumOperationalState", VacuumCommands.START);
    return {
      commandResponseState: {
        errorStateId: RvcOperationalState.ErrorState.NoError,
      },
    };
  }

  override goHome(): RvcOperationalState.OperationalCommandResponse {
    notifyEndpoint(
      this,
      "VacuumOperationalState",
      VacuumCommands.RETURN_TO_BASE,
    );
    return {
      commandResponseState: {
        errorStateId: RvcOperationalState.ErrorState.NoError,
      },
    };
  }
}

export namespace VacuumOperationalStateBehavior {
  export class State extends Base.State {}
}
