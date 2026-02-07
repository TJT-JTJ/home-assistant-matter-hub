import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { RvcCleanModeServer as Base } from "@matter/main/behaviors";
import { ModeBase } from "@matter/main/clusters/mode-base";
import { RvcCleanMode } from "@matter/main/clusters/rvc-clean-mode";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

export interface RvcCleanModeServerConfig {
  getCurrentMode: ValueGetter<number>;
  getSupportedModes: ValueGetter<RvcCleanMode.ModeOption[]>;
  setCleanMode: ValueSetter<number>;
}

export interface RvcCleanModeServerInitialState {
  supportedModes: RvcCleanMode.ModeOption[];
  currentMode: number;
}

// biome-ignore lint/correctness/noUnusedVariables: Used by RvcCleanModeServer function
class RvcCleanModeServerBase extends Base {
  declare state: RvcCleanModeServerBase.State;

  override async initialize() {
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    if (homeAssistant.state.managedByEndpoint) {
      homeAssistant.registerUpdate(this.callback(this.update));
    } else {
      this.reactTo(homeAssistant.onChange, this.update);
    }
  }

  public update(entity: HomeAssistantEntityInformation) {
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

    homeAssistant.callAction(
      this.state.config.setCleanMode(newMode, this.agent),
    );

    return {
      status: ModeBase.ModeChangeStatus.Success,
      statusText: "Cleaning mode changed",
    };
  }
}

namespace RvcCleanModeServerBase {
  export class State extends Base.State {
    config!: RvcCleanModeServerConfig;
  }
}

/**
 * Create an RvcCleanMode behavior with initial state.
 * Used for vacuum cleaning modes (vacuum, mop, vacuum+mop, etc.)
 */
export function RvcCleanModeServer(
  config: RvcCleanModeServerConfig,
  initialState?: RvcCleanModeServerInitialState,
) {
  const defaultModes: RvcCleanMode.ModeOption[] = [
    {
      label: "Vacuum",
      mode: 0,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
    },
  ];

  return RvcCleanModeServerBase.set({
    config,
    supportedModes: initialState?.supportedModes ?? defaultModes,
    currentMode: initialState?.currentMode ?? 0,
  });
}
