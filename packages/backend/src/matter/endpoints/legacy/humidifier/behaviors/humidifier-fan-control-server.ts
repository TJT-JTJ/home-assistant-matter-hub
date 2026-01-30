import type {
  HomeAssistantEntityState,
  HumidiferDeviceAttributes,
} from "@home-assistant-matter-hub/common";
import type { Agent } from "@matter/main";
import { FanControl } from "@matter/main/clusters";
import {
  FanControlServer,
  type FanControlServerConfig,
} from "../../../../behaviors/fan-control-server.js";
import { HomeAssistantEntityBehavior } from "../../../../behaviors/home-assistant-entity-behavior.js";

function getHumidityPercent(state: HomeAssistantEntityState): number {
  const { min_humidity, max_humidity, humidity } =
    state.attributes as HumidiferDeviceAttributes;
  if (humidity != null && min_humidity != null && max_humidity != null) {
    const range = max_humidity - min_humidity;
    if (range > 0) {
      return ((humidity - min_humidity) / range) * 100;
    }
  }
  return 0;
}

function setHumidityFromPercent(percent: number, agent: Agent) {
  const { min_humidity, max_humidity } = agent.get(HomeAssistantEntityBehavior)
    .entity.state.attributes as HumidiferDeviceAttributes;
  const range = max_humidity - min_humidity;
  const humidity = Math.round((range * percent) / 100 + min_humidity);
  return {
    action: "humidifier.set_humidity",
    data: { humidity },
  };
}

const config: FanControlServerConfig = {
  getPercentage: (state: HomeAssistantEntityState) => getHumidityPercent(state),
  getStepSize: () => undefined,
  getAirflowDirection: () => undefined,
  isInAutoMode: () => false,
  getPresetModes: () => undefined,
  getCurrentPresetMode: () => undefined,
  supportsPercentage: () => true,
  turnOff: () => ({ action: "humidifier.turn_off" }),
  turnOn: (percent: number, agent: Agent) =>
    setHumidityFromPercent(percent, agent),
  setAutoMode: () => ({ action: "humidifier.turn_on" }),
  setAirflowDirection: () => ({ action: "humidifier.turn_on" }),
  setPresetMode: () => ({ action: "humidifier.turn_on" }),
};

export const HumidifierFanControlServer = FanControlServer(config).with(
  "MultiSpeed",
  "Step",
);
