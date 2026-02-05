import type {
  HomeAssistantEntityState,
  HumidiferDeviceAttributes,
} from "@home-assistant-matter-hub/common";
import type { Agent } from "@matter/main";
import {
  FanControlServer,
  type FanControlServerConfig,
} from "../../../../behaviors/fan-control-server.js";

function getHumidityPercent(state: HomeAssistantEntityState): number {
  // The humidity attribute is the TARGET humidity (e.g., 60 means 60%)
  // This is already a percentage value, no scaling needed
  const { humidity } = state.attributes as HumidiferDeviceAttributes;
  return humidity ?? 0;
}

function setHumidityFromPercent(percent: number, _agent: Agent) {
  // The percent from Matter FanControl is directly the target humidity percentage
  // No scaling needed - 60% means 60% humidity
  return {
    action: "humidifier.set_humidity",
    data: { humidity: Math.round(percent) },
  };
}

function isInAutoMode(state: HomeAssistantEntityState): boolean {
  const { mode } = state.attributes as HumidiferDeviceAttributes;
  return mode?.toLowerCase() === "auto";
}

const config: FanControlServerConfig = {
  getPercentage: (state: HomeAssistantEntityState) => getHumidityPercent(state),
  getStepSize: () => undefined,
  getAirflowDirection: () => undefined,
  isInAutoMode: (state: HomeAssistantEntityState) => isInAutoMode(state),
  getPresetModes: (state: HomeAssistantEntityState) => {
    const { available_modes } = state.attributes as HumidiferDeviceAttributes;
    return available_modes;
  },
  getCurrentPresetMode: (state: HomeAssistantEntityState) => {
    const { mode } = state.attributes as HumidiferDeviceAttributes;
    return mode;
  },
  supportsPercentage: () => true,
  turnOff: () => ({ action: "humidifier.turn_off" }),
  turnOn: (percent: number, agent: Agent) =>
    setHumidityFromPercent(percent, agent),
  setAutoMode: () => ({
    action: "humidifier.set_mode",
    data: { mode: "auto" },
  }),
  setAirflowDirection: () => ({ action: "humidifier.turn_on" }),
  setPresetMode: (mode: string) => ({
    action: "humidifier.set_mode",
    data: { mode },
  }),
};

export const HumidifierFanControlServer = FanControlServer(config).with(
  "MultiSpeed",
  "Step",
);

export const HumidifierFanControlServerWithAuto = FanControlServer(config).with(
  "MultiSpeed",
  "Step",
  "Auto",
);
