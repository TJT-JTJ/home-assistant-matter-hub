import { ContactSensorDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { BooleanStateServer } from "../../../behaviors/boolean-state-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";

export const ContactSensorType = ContactSensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  BooleanStateServer({ inverted: true }),
);

export const ContactSensorWithBatteryType = ContactSensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  BooleanStateServer({ inverted: true }),
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
