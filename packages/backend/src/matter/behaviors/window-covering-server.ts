import type {
  HomeAssistantEntityInformation,
  HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import {
  WindowCoveringServer as Base,
  MovementDirection,
  MovementType,
} from "@matter/main/behaviors";
import { WindowCovering } from "@matter/main/clusters";
import {
  type HomeAssistantAction,
  HomeAssistantActions,
} from "../../services/home-assistant/home-assistant-actions.js";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

import MovementStatus = WindowCovering.MovementStatus;

const FeaturedBase = Base.with(
  "Lift",
  "PositionAwareLift",
  "Tilt",
  "PositionAwareTilt",
  "AbsolutePosition",
);

export interface WindowCoveringConfig {
  getCurrentLiftPosition: ValueGetter<number | null>;
  getCurrentTiltPosition: ValueGetter<number | null>;
  getMovementStatus: ValueGetter<MovementStatus>;

  stopCover: ValueSetter<void>;
  openCoverLift: ValueSetter<void>;
  closeCoverLift: ValueSetter<void>;
  /**
   * "cover.set_cover_position", {
   *       tilt_position: targetPosition,
   *     }
   * invertPercentage?: boolean;
   * swapOpenAndClose?: boolean;
   */
  setLiftPosition: ValueSetter<number>;

  openCoverTilt: ValueSetter<void>;
  closeCoverTilt: ValueSetter<void>;
  /**
   * "cover.set_cover_tilt_position", {
   *       tilt_position: targetPosition,
   *     }
   *     invertPercentage?: boolean;
   * swapOpenAndClose?: boolean;
   */
  setTiltPosition: ValueSetter<number>;
}

export class WindowCoveringServerBase extends FeaturedBase {
  declare state: WindowCoveringServerBase.State;

  private liftDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tiltDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Store everything needed for debounced HA calls - entityId and actions service
  // must be captured before setTimeout because agent context expires after command handler
  private pendingLiftAction: {
    action: HomeAssistantAction;
    entityId: string;
    actions: HomeAssistantActions;
  } | null = null;
  private pendingTiltAction: {
    action: HomeAssistantAction;
    entityId: string;
    actions: HomeAssistantActions;
  } | null = null;
  private static readonly DEBOUNCE_MS = 500;

  override async initialize() {
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const config = this.state.config;
    const state = entity.state as HomeAssistantEntityState;
    const movementStatus = config.getMovementStatus(state, this.agent);

    const normalize = (value: number | null) => {
      if (value == null) {
        return value;
      }
      return Math.min(100, Math.abs(value));
    };

    const currentLift = normalize(
      config.getCurrentLiftPosition(state, this.agent),
    );
    const currentLift100ths = currentLift != null ? currentLift * 100 : null;
    const currentTilt = normalize(
      config.getCurrentTiltPosition(state, this.agent),
    );
    const currentTilt100ths = currentTilt != null ? currentTilt * 100 : null;

    applyPatchState<WindowCoveringServerBase.State>(this.state, {
      type:
        this.features.lift && this.features.tilt
          ? WindowCovering.WindowCoveringType.TiltBlindLift
          : this.features.tilt
            ? WindowCovering.WindowCoveringType.TiltBlindTiltOnly
            : WindowCovering.WindowCoveringType.Rollershade,
      endProductType:
        this.features.lift && this.features.tilt
          ? WindowCovering.EndProductType.SheerShade
          : this.features.tilt
            ? WindowCovering.EndProductType.TiltOnlyInteriorBlind
            : WindowCovering.EndProductType.RollerShade,
      operationalStatus: {
        global: movementStatus,
        ...(this.features.lift ? { lift: movementStatus } : {}),
        ...(this.features.tilt ? { tilt: movementStatus } : {}),
      },
      ...(this.features.absolutePosition && this.features.lift
        ? {
            installedOpenLimitLift: 0,
            installedClosedLimitLift: 100_00,
            currentPositionLift: currentLift100ths,
          }
        : {}),
      ...(this.features.absolutePosition && this.features.tilt
        ? {
            installedOpenLimitTilt: 0,
            installedClosedLimitTilt: 100_00,
            currentPositionTilt: currentTilt100ths,
          }
        : {}),
      ...(this.features.positionAwareLift
        ? {
            currentPositionLiftPercentage: currentLift,
            currentPositionLiftPercent100ths: currentLift100ths,
            targetPositionLiftPercent100ths:
              this.state.targetPositionLiftPercent100ths ?? currentLift100ths,
          }
        : {}),
      ...(this.features.positionAwareTilt
        ? {
            currentPositionTiltPercentage: currentTilt,
            currentPositionTiltPercent100ths: currentTilt100ths,
            targetPositionTiltPercent100ths:
              this.state.targetPositionTiltPercent100ths ?? currentTilt100ths,
          }
        : {}),
    });
  }

  override async handleMovement(
    type: MovementType,
    _: boolean,
    direction: MovementDirection,
    targetPercent100ths?: number,
  ) {
    const currentLift = this.state.currentPositionLiftPercent100ths ?? 0;
    const currentTilt = this.state.currentPositionTiltPercent100ths ?? 0;
    if (type === MovementType.Lift) {
      if (targetPercent100ths != null && this.features.absolutePosition) {
        this.handleGoToLiftPosition(targetPercent100ths);
      } else if (
        direction === MovementDirection.Close ||
        (targetPercent100ths != null && targetPercent100ths > currentLift)
      ) {
        this.handleLiftClose();
      } else if (direction === MovementDirection.Open) {
        this.handleLiftOpen();
      }
    } else if (type === MovementType.Tilt) {
      if (targetPercent100ths != null && this.features.absolutePosition) {
        this.handleGoToTiltPosition(targetPercent100ths);
      } else if (
        direction === MovementDirection.Close ||
        (targetPercent100ths != null && targetPercent100ths > currentTilt)
      ) {
        this.handleTiltClose();
      } else if (direction === MovementDirection.Open) {
        this.handleTiltOpen();
      }
    }
  }

  override handleStopMovement() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    homeAssistant.callAction(this.state.config.stopCover(void 0, this.agent));
  }

  private handleLiftOpen() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    homeAssistant.callAction(
      this.state.config.openCoverLift(void 0, this.agent),
    );
  }

  private handleLiftClose() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    homeAssistant.callAction(
      this.state.config.closeCoverLift(void 0, this.agent),
    );
  }

  private handleGoToLiftPosition(targetPercent100ths: number) {
    const config = this.state.config;
    // Compare in Matter space (both values should be in same coordinate system)
    const currentPositionMatter = this.state.currentPositionLiftPercent100ths;
    // Skip if already at target (with small tolerance for rounding)
    if (
      currentPositionMatter != null &&
      Math.abs(targetPercent100ths - currentPositionMatter) < 100
    ) {
      return;
    }
    // Update target immediately for UI feedback
    this.state.targetPositionLiftPercent100ths = targetPercent100ths;
    // Capture EVERYTHING needed for the debounced callback NOW while context is valid
    // The agent context expires after the command handler returns, so we must not
    // access any behavior properties (including entityId) inside setTimeout
    const targetPosition = targetPercent100ths / 100;
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = config.setLiftPosition(targetPosition, this.agent);
    const entityId = homeAssistant.entityId;
    const actions = this.env.get(HomeAssistantActions);
    this.pendingLiftAction = { action, entityId, actions };
    // Debounce the HA call to handle rapid commands from Google Home during slider drag
    if (this.liftDebounceTimer) {
      clearTimeout(this.liftDebounceTimer);
    }
    this.liftDebounceTimer = setTimeout(() => {
      this.liftDebounceTimer = null;
      if (this.pendingLiftAction) {
        const {
          action: pendingAction,
          entityId: eid,
          actions: act,
        } = this.pendingLiftAction;
        this.pendingLiftAction = null;
        act.call(pendingAction, eid);
      }
    }, WindowCoveringServerBase.DEBOUNCE_MS);
  }

  private handleTiltOpen() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    homeAssistant.callAction(
      this.state.config.openCoverTilt(void 0, this.agent),
    );
  }

  private handleTiltClose() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    homeAssistant.callAction(
      this.state.config.closeCoverTilt(void 0, this.agent),
    );
  }

  private handleGoToTiltPosition(targetPercent100ths: number) {
    const config = this.state.config;
    // Compare in Matter space (both values should be in same coordinate system)
    const currentPositionMatter = this.state.currentPositionTiltPercent100ths;
    // Skip if already at target (with small tolerance for rounding)
    if (
      currentPositionMatter != null &&
      Math.abs(targetPercent100ths - currentPositionMatter) < 100
    ) {
      return;
    }
    // Update target immediately for UI feedback
    this.state.targetPositionTiltPercent100ths = targetPercent100ths;
    // Capture EVERYTHING needed for the debounced callback NOW while context is valid
    // The agent context expires after the command handler returns, so we must not
    // access any behavior properties (including entityId) inside setTimeout
    const targetPosition = targetPercent100ths / 100;
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = config.setTiltPosition(targetPosition, this.agent);
    const entityId = homeAssistant.entityId;
    const actions = this.env.get(HomeAssistantActions);
    this.pendingTiltAction = { action, entityId, actions };
    // Debounce the HA call to handle rapid commands from Google Home during slider drag
    if (this.tiltDebounceTimer) {
      clearTimeout(this.tiltDebounceTimer);
    }
    this.tiltDebounceTimer = setTimeout(() => {
      this.tiltDebounceTimer = null;
      if (this.pendingTiltAction) {
        const {
          action: pendingAction,
          entityId: eid,
          actions: act,
        } = this.pendingTiltAction;
        this.pendingTiltAction = null;
        act.call(pendingAction, eid);
      }
    }, WindowCoveringServerBase.DEBOUNCE_MS);
  }
}

export namespace WindowCoveringServerBase {
  export class State extends FeaturedBase.State {
    config!: WindowCoveringConfig;
  }
}

export function WindowCoveringServer(config: WindowCoveringConfig) {
  return WindowCoveringServerBase.set({ config });
}
