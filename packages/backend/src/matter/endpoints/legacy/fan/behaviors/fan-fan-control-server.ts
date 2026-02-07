import {
  type FanDeviceAttributes,
  FanDeviceDirection,
  FanDeviceFeature,
  type HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import { FanControl } from "@matter/main/clusters";
import { testBit } from "../../../../../utils/test-bit.js";
import {
  FanControlServer,
  type FanControlServerConfig,
} from "../../../../behaviors/fan-control-server.js";

const attributes = (e: HomeAssistantEntityState) =>
  e.attributes as FanDeviceAttributes;

const fanControlConfig: FanControlServerConfig = {
  getPercentage: (state) =>
    state.state === "off" ? 0 : attributes(state).percentage,
  getStepSize: (state) => attributes(state).percentage_step,
  getAirflowDirection: (state) =>
    attributes(state).current_direction === FanDeviceDirection.FORWARD
      ? FanControl.AirflowDirection.Forward
      : attributes(state).current_direction === FanDeviceDirection.REVERSE
        ? FanControl.AirflowDirection.Reverse
        : FanControl.AirflowDirection.Forward,
  isInAutoMode: (state) => attributes(state).preset_mode === "Auto",
  // Preset mode support
  getPresetModes: (state) => attributes(state).preset_modes,
  getCurrentPresetMode: (state) => attributes(state).preset_mode,
  supportsPercentage: (state) =>
    testBit(
      attributes(state).supported_features ?? 0,
      FanDeviceFeature.SET_SPEED,
    ),
  // Rocking (oscillation) support
  isOscillating: (state) => attributes(state).oscillating ?? false,
  supportsOscillation: (state) =>
    testBit(
      attributes(state).supported_features ?? 0,
      FanDeviceFeature.OSCILLATE,
    ),
  // Wind mode support - check if preset_modes contains natural/sleep
  getWindMode: (state) => {
    const mode = attributes(state).preset_mode?.toLowerCase();
    if (mode === "natural" || mode === "nature") return "natural";
    if (mode === "sleep") return "sleep";
    return undefined;
  },
  supportsWind: (state) => {
    const modes = attributes(state).preset_modes ?? [];
    return modes.some(
      (m) =>
        m.toLowerCase() === "natural" ||
        m.toLowerCase() === "nature" ||
        m.toLowerCase() === "sleep",
    );
  },

  turnOff: () => ({ action: "fan.turn_off" }),
  turnOn: (percentage) => ({ action: "fan.turn_on", data: { percentage } }),
  setAutoMode: () => ({ action: "fan.turn_on", data: { preset_mode: "Auto" } }),
  setAirflowDirection: (direction) => ({
    action: "fan.set_direction",
    data: {
      direction:
        direction === FanControl.AirflowDirection.Forward
          ? FanDeviceDirection.FORWARD
          : FanDeviceDirection.REVERSE,
    },
  }),
  setPresetMode: (presetMode) => ({
    action: "fan.set_preset_mode",
    data: { preset_mode: presetMode },
  }),
  setOscillation: (oscillating) => ({
    action: "fan.oscillate",
    data: { oscillating },
  }),
  setWindMode: (mode) => ({
    action: "fan.set_preset_mode",
    data: {
      preset_mode:
        mode === "natural" ? "Natural" : mode === "sleep" ? "Sleep" : "Normal",
    },
  }),
};

export const FanFanControlServer = FanControlServer(fanControlConfig);
