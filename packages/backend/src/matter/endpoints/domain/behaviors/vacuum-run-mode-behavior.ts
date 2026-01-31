import { RvcRunModeServer as Base } from "@matter/main/behaviors";
import { ModeBase } from "@matter/main/clusters/mode-base";
import { RvcRunMode } from "@matter/main/clusters/rvc-run-mode";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import {
  notifyEndpoint,
  VacuumCommands,
} from "../../../behaviors/callback-behavior.js";

/**
 * Supported run modes for vacuum.
 */
export enum VacuumRunMode {
  Idle = 0,
  Cleaning = 1,
}

/** Base mode value for room-specific cleaning modes */
export const ROOM_MODE_BASE = 100;

/** Check if a mode value represents a room-specific cleaning mode */
export function isRoomMode(mode: number): boolean {
  return mode >= ROOM_MODE_BASE;
}

/**
 * Vision 1 VacuumRunModeBehavior - Callback-based behavior.
 *
 * This behavior does NOT:
 * - Update itself from HA entity changes
 * - Call HA actions directly
 *
 * Instead, it:
 * - Notifies the parent endpoint when commands are received
 * - Receives state updates from the parent endpoint
 */
export class VacuumRunModeBehavior extends Base {
  declare state: VacuumRunModeBehavior.State;

  override async initialize() {
    await super.initialize();

    // Set initial supportedModes with required Idle tag
    this.state.supportedModes = [
      {
        label: "Idle",
        mode: VacuumRunMode.Idle,
        modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
      },
      {
        label: "Cleaning",
        mode: VacuumRunMode.Cleaning,
        modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
      },
    ];
    this.state.currentMode = VacuumRunMode.Idle;

    // NOTE: We do NOT subscribe to homeAssistant.onChange here!
    // The parent endpoint will call updateFromEndpoint() when state changes.
  }

  /**
   * Called by the parent endpoint to update behavior state.
   */
  public updateFromEndpoint(update: {
    currentMode?: VacuumRunMode;
    supportedModes?: RvcRunMode.ModeOption[];
  }): void {
    applyPatchState(this.state, update);
  }

  override changeToMode(
    request: ModeBase.ChangeToModeRequest,
  ): ModeBase.ChangeToModeResponse {
    const { newMode } = request;

    // Check for room-specific cleaning mode
    if (isRoomMode(newMode)) {
      notifyEndpoint(this, "VacuumRunMode", VacuumCommands.CLEAN_ROOM, {
        roomModeValue: newMode,
      });
      return {
        status: ModeBase.ModeChangeStatus.Success,
        statusText: "Starting room cleaning",
      };
    }

    switch (newMode) {
      case VacuumRunMode.Cleaning:
        notifyEndpoint(this, "VacuumRunMode", VacuumCommands.START);
        break;
      case VacuumRunMode.Idle:
        notifyEndpoint(this, "VacuumRunMode", VacuumCommands.RETURN_TO_BASE);
        break;
      default:
        notifyEndpoint(this, "VacuumRunMode", VacuumCommands.PAUSE);
        break;
    }

    return {
      status: ModeBase.ModeChangeStatus.Success,
      statusText: "Successfully switched mode",
    };
  }
}

export namespace VacuumRunModeBehavior {
  export class State extends Base.State {
    // No config needed - endpoint handles everything
  }
}
