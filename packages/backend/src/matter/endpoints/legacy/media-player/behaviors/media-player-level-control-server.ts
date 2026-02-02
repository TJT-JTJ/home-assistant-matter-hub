import type { MediaPlayerDeviceAttributes } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { LevelControlServer } from "../../../../behaviors/level-control-server.js";

const logger = Logger.get("MediaPlayerLevelControl");

export const MediaPlayerLevelControlServer = LevelControlServer({
  getValuePercent: (state) => {
    const attributes = state.attributes as MediaPlayerDeviceAttributes;
    if (attributes.volume_level != null) {
      // Debug: Log volume conversion for troubleshooting Issue #79
      // HA volume_level is 0.0-1.0, Matter LevelControl expects 1-254
      // LevelControlServer will convert: level = percent * 253 + 1
      // So 0.75 (75%) -> 0.75 * 253 + 1 = 190.75 -> currentLevel ~191
      logger.debug(
        `Volume read: HA volume_level=${attributes.volume_level} (${Math.round(attributes.volume_level * 100)}%)`,
      );
      return attributes.volume_level;
    }
    return 0;
  },
  moveToLevelPercent: (value) => {
    // Debug: Log volume write for troubleshooting
    logger.debug(
      `Volume write: Matter percent=${value} -> HA volume_level=${value}`,
    );
    return {
      action: "media_player.volume_set",
      data: { volume_level: value },
    };
  },
});
