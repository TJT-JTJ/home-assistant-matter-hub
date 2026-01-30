import type { EndpointType } from "@matter/main";
import { FanDevice as Device } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { HumidifierFanControlServer } from "./behaviors/humidifier-fan-control-server.js";
import { HumidifierOnOffServer } from "./behaviors/humidifier-on-off-server.js";

const HumidifierEndpointType = Device.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  HumidifierOnOffServer,
  HumidifierFanControlServer,
);

export function HumidifierDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  return HumidifierEndpointType.set({ homeAssistantEntity });
}
