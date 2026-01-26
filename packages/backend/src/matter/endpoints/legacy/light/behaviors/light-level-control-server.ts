import type {
  HomeAssistantEntityState,
  LightDeviceAttributes,
} from "@home-assistant-matter-hub/common";
import {
  type LevelControlConfig,
  LevelControlServer,
} from "../../../../behaviors/level-control-server.js";

const config: LevelControlConfig = {
  getValuePercent: (state: HomeAssistantEntityState<LightDeviceAttributes>) => {
    const brightness = state.attributes.brightness;
    if (brightness != null) {
      return brightness / 255;
    }
    // When brightness is null (e.g., light is off), return minimum level (0)
    // to ensure Apple Home doesn't show "not responding".
    // Matter spec allows null for "undefined", but Apple Home doesn't handle it well.
    // Returning 0 maps to minLevel (1) in Matter, which is valid for the Lighting feature.
    return 0;
  },
  moveToLevelPercent: (brightnessPercent) => ({
    action: "light.turn_on",
    data: {
      brightness: Math.round(brightnessPercent * 255),
    },
  }),
};

export const LightLevelControlServer = LevelControlServer(config).with(
  "OnOff",
  "Lighting",
);
