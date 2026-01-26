import type {
  HomeAssistantEntityState,
  MediaPlayerDeviceAttributes,
} from "@home-assistant-matter-hub/common";
import { OnOffServer } from "../../../../behaviors/on-off-server.js";

export const MediaPlayerPowerOnOffServer = OnOffServer({
  isOn: (state: HomeAssistantEntityState<MediaPlayerDeviceAttributes>) => {
    return state.state !== "off" && state.state !== "standby";
  },
  turnOn: () => ({
    action: "media_player.turn_on",
  }),
  turnOff: () => ({
    action: "media_player.turn_off",
  }),
}).with();
