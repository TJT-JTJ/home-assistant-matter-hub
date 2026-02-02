import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { RvcRunModeServer as Base } from "@matter/main/behaviors";
import { ModeBase } from "@matter/main/clusters/mode-base";
import { RvcRunMode } from "@matter/main/clusters/rvc-run-mode";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

export enum RvcSupportedRunMode {
  Idle = 0,
  Cleaning = 1,
}

export interface RvcRunModeServerConfig {
  getCurrentMode: ValueGetter<RvcSupportedRunMode>;
  getSupportedModes: ValueGetter<RvcRunMode.ModeOption[]>;

  start: ValueSetter<void>;
  returnToBase: ValueSetter<void>;
  pause: ValueSetter<void>;
  /** Optional: Clean a specific room by mode value */
  cleanRoom?: ValueSetter<number>;
}

/** Base mode value for room-specific cleaning modes */
export const ROOM_MODE_BASE = 100;

/** Check if a mode value represents a room-specific cleaning mode */
export function isRoomMode(mode: number): boolean {
  return mode >= ROOM_MODE_BASE;
}

// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class RvcRunModeServerBase extends Base {
  declare state: RvcRunModeServerBase.State;

  override async initialize() {
    // Load HomeAssistantEntityBehavior FIRST to get initial entity data
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);

    // Set supportedModes with room data BEFORE super.initialize()
    // Matter controllers cache supportedModes at pairing time, so they must be set early
    if (homeAssistant.entity.state) {
      this.state.supportedModes = this.state.config.getSupportedModes(
        homeAssistant.entity.state,
        this.agent,
      );
      this.state.currentMode = this.state.config.getCurrentMode(
        homeAssistant.entity.state,
        this.agent,
      );
    } else {
      // Fallback to base modes if entity state not yet available
      this.state.supportedModes = [
        {
          label: "Idle",
          mode: RvcSupportedRunMode.Idle,
          modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
        },
        {
          label: "Cleaning",
          mode: RvcSupportedRunMode.Cleaning,
          modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
        },
      ];
      this.state.currentMode = RvcSupportedRunMode.Idle;
    }

    await super.initialize();
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    applyPatchState(this.state, {
      currentMode: this.state.config.getCurrentMode(entity.state, this.agent),
      supportedModes: this.state.config.getSupportedModes(
        entity.state,
        this.agent,
      ),
    });
  }

  override changeToMode(
    request: ModeBase.ChangeToModeRequest,
  ): ModeBase.ChangeToModeResponse {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const { newMode } = request;

    // Check for room-specific cleaning mode
    if (isRoomMode(newMode) && this.state.config.cleanRoom) {
      homeAssistant.callAction(
        this.state.config.cleanRoom(newMode, this.agent),
      );
      return {
        status: ModeBase.ModeChangeStatus.Success,
        statusText: "Starting room cleaning",
      };
    }

    switch (newMode) {
      case RvcSupportedRunMode.Cleaning:
        homeAssistant.callAction(this.state.config.start(void 0, this.agent));
        break;
      case RvcSupportedRunMode.Idle:
        homeAssistant.callAction(
          this.state.config.returnToBase(void 0, this.agent),
        );
        break;
      default:
        homeAssistant.callAction(this.state.config.pause(void 0, this.agent));
        break;
    }
    return {
      status: ModeBase.ModeChangeStatus.Success,
      statusText: "Successfully switched mode",
    };
  }
}

namespace RvcRunModeServerBase {
  export class State extends Base.State {
    config!: RvcRunModeServerConfig;
  }
}

export function RvcRunModeServer(config: RvcRunModeServerConfig) {
  return RvcRunModeServerBase.set({ config });
}
