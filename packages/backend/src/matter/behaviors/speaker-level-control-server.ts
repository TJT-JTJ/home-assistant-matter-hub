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
 * Key differences from LevelControlServer (for lights):
 * - Uses OnOff feature but NOT the "Lighting" feature
 * - Uses range 1-254 for currentLevel (matching Matterbridge's approach)
 * - minLevel = 1, maxLevel = 254
 *
 * Based on Matterbridge speaker.ts implementation:
 * - Volume < 1 coerced to 1
 * - Volume > 254 coerced to 254
 * - LevelControl (1..254) maps linearly to 0..100%
 *
 * Google Home calculates volume percentage as: currentLevel / 254 * 100
 */
const FeaturedBase = Base.with("OnOff");

export class SpeakerLevelControlServerBase extends FeaturedBase {
  declare state: SpeakerLevelControlServerBase.State;

  override async initialize() {
    // Set default values BEFORE super.initialize() to prevent validation errors.
    // Speaker uses 1-254 range (matching Matterbridge approach).
    if (this.state.currentLevel == null) {
      this.state.currentLevel = 1; // Minimum level (not 0, as per Matterbridge)
    }

    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update({ state }: HomeAssistantEntityInformation) {
    const config = this.state.config;

    // For speakers, use 1-254 range (matching Matterbridge approach)
    // 1 = muted/min, 254 = max volume
    const minLevel = 1;
    const maxLevel = 254;

    // Get volume as percentage (0.0-1.0) from Home Assistant
    const currentLevelPercent = config.getValuePercent(state, this.agent);

    // Convert percentage (0.0-1.0) to 1-254 range
    // Formula: level = percent * 253 + 1 (so 0% = 1, 100% = 254)
    let currentLevel =
      currentLevelPercent != null
        ? Math.round(currentLevelPercent * 253 + 1)
        : null;

    if (currentLevel != null) {
      currentLevel = Math.min(Math.max(minLevel, currentLevel), maxLevel);
    }

    const entityId = this.agent.get(HomeAssistantEntityBehavior).entity
      .entity_id;
    logger.info(
      `[${entityId}] Volume update: HA=${currentLevelPercent != null ? Math.round(currentLevelPercent * 100) : "null"}% -> currentLevel=${currentLevel}`,
    );

    // Only set currentLevel - minLevel/maxLevel are not available without Lighting feature
    applyPatchState(this.state, {
      currentLevel: currentLevel,
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

    // Level is 0-254, convert to 0.0-1.0 for HA
    const levelPercent = level / 254;

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
  }
}

export function SpeakerLevelControlServer(config: SpeakerLevelControlConfig) {
  return SpeakerLevelControlServerBase.set({
    config,
  });
}
