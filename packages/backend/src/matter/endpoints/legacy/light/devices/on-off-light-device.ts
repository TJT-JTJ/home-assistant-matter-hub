import { OnOffLightDevice as Device } from "@matter/main/devices";
import { BasicInformationServer } from "../../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../../behaviors/identify-server.js";
import { PowerSourceServer } from "../../../../behaviors/power-source-server.js";
import { LightOnOffServer } from "../behaviors/light-on-off-server.js";

const LightPowerSourceServer = PowerSourceServer({
  getBatteryPercent: (entity) => {
    const attrs = entity.attributes as {
      battery?: number;
      battery_level?: number;
    };
    const level = attrs.battery_level ?? attrs.battery;
    if (level == null || Number.isNaN(Number(level))) {
      return null;
    }
    return Number(level);
  },
});

export const OnOffLightType = Device.with(
  IdentifyServer,
  BasicInformationServer,
  HomeAssistantEntityBehavior,
  LightOnOffServer,
);

export const OnOffLightWithBatteryType = Device.with(
  IdentifyServer,
  BasicInformationServer,
  HomeAssistantEntityBehavior,
  LightOnOffServer,
  LightPowerSourceServer,
);
