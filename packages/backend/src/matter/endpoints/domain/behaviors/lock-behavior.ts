import { DoorLockServer as Base } from "@matter/main/behaviors";
import { DoorLock } from "@matter/main/clusters";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import {
  LockCommands,
  notifyEndpoint,
} from "../../../behaviors/callback-behavior.js";

/**
 * Vision 1 LockBehavior - Callback-based behavior.
 */
export class LockBehavior extends Base {
  declare state: LockBehavior.State;

  override async initialize() {
    await super.initialize();
    this.state.lockState = DoorLock.LockState.Unlocked;
    this.state.lockType = DoorLock.LockType.DeadBolt;
    this.state.actuatorEnabled = true;
    this.state.operatingMode = DoorLock.OperatingMode.Normal;
    this.state.supportedOperatingModes = {
      normal: true,
      vacation: false,
      privacy: false,
      noRemoteLockUnlock: false,
      passage: false,
    };
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: { lockState?: DoorLock.LockState }): void {
    applyPatchState(this.state, update);
  }

  override lockDoor(): void {
    notifyEndpoint(this, "Lock", LockCommands.LOCK);
  }

  override unlockDoor(): void {
    notifyEndpoint(this, "Lock", LockCommands.UNLOCK);
  }
}

export namespace LockBehavior {
  export class State extends Base.State {}
}
