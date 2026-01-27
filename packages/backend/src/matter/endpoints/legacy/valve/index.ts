import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import type { HomeAssistantAction } from "../../../../services/home-assistant/home-assistant-actions.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { OnOffServer } from "../../../behaviors/on-off-server.js";

// Use OnOff for valve control since Matter valve devices use on/off
const ValveOnOffServer = OnOffServer({
  turnOn: (): HomeAssistantAction => ({ action: "open_valve" }),
  turnOff: (): HomeAssistantAction => ({ action: "close_valve" }),
});

const ValveEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  ValveOnOffServer,
);

export function ValveDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  return ValveEndpointType.set({ homeAssistantEntity });
}
