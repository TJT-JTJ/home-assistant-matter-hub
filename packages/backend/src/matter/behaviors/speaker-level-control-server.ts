import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { LevelControlServer as Base } from "@matter/main/behaviors";
import type { LevelControl } from "@matter/main/clusters/level-control";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

const logger = Logger.get("SpeakerLevelControlServer");

export interface SpeakerLevelControlConfig {
  getValuePercent: ValueGetter<number | null>;
  moveToLevelPercent: ValueSetter<number>;
}

/**
 * LevelControlServer for Speaker/MediaPlayer devices.
 *
 * Key difference from LevelControlServer (for lights):
 * - Does NOT use the "Lighting" feature
 * - Uses range 0-100 for currentLevel (Google Home expects volume as percentage)
 * - minLevel = 0, maxLevel = 100
 *
 * Google Home interprets currentLevel for speakers as a percentage value (0-100),
 * not as the 1-254 range used for lights with the Lighting feature.
 */
const FeaturedBase = Base.with("OnOff");

export class SpeakerLevelControlServerBase extends FeaturedBase {
  declare state: SpeakerLevelControlServerBase.State;

  override async initialize() {
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update({ state }: HomeAssistantEntityInformation) {
    const config = this.state.config;

    // For speakers, use 0-100 range (Google Home expects percentage)
    const minLevel = 0;
    const maxLevel = 100;

    const currentLevelPercent =
      config.getValuePercent(state, this.agent) ??
      this.state.currentLevelPercent;

    let currentLevel =
      currentLevelPercent != null
        ? Math.round(currentLevelPercent * maxLevel)
        : null;

    if (currentLevel != null) {
      currentLevel = Math.min(Math.max(minLevel, currentLevel), maxLevel);
    }

    const entityId = this.agent.get(HomeAssistantEntityBehavior).entity
      .entity_id;
    logger.debug(
      `[${entityId}] Volume update: HA=${currentLevelPercent != null ? Math.round(currentLevelPercent * 100) : "null"}% -> currentLevel=${currentLevel}`,
    );

    applyPatchState(this.state, {
      minLevel: minLevel,
      maxLevel: maxLevel,
      currentLevel: currentLevel,
      currentLevelPercent: currentLevelPercent,
    });
  }

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

  override moveToLevelLogic(level: number) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const config = this.state.config;
    const entityId = homeAssistant.entity.entity_id;

    // Level is already 0-100, convert to 0.0-1.0 for HA
    const levelPercent = level / 100;

    logger.debug(
      `[${entityId}] Volume command: level=${level} -> HA volume_level=${levelPercent}`,
    );

    const current = config.getValuePercent(
      homeAssistant.entity.state,
      this.agent,
    );
    if (levelPercent === current) {
      return;
    }
    homeAssistant.callAction(
      config.moveToLevelPercent(levelPercent, this.agent),
    );
  }
}

export namespace SpeakerLevelControlServerBase {
  export class State extends FeaturedBase.State {
    config!: SpeakerLevelControlConfig;
    currentLevelPercent: number | null = null;
  }
}

export function SpeakerLevelControlServer(config: SpeakerLevelControlConfig) {
  return SpeakerLevelControlServerBase.set({
    options: { executeIfOff: true },
    config,
  });
}
