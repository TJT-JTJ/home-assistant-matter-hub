import { OnOffSensorDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { OnOffServer } from "../../../behaviors/on-off-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";

const OnOffSensorServer = OnOffServer({
  turnOn: null,
  turnOff: null,
}).with();

export const OnOffSensorType = OnOffSensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OnOffSensorServer,
);

export const OnOffSensorWithBatteryType = OnOffSensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OnOffSensorServer,
  PowerSourceServer({
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
  }),
);
