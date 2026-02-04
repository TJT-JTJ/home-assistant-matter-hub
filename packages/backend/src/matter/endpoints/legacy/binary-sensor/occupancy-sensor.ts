import { OccupancySensorDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { OccupancySensingServer } from "../../../behaviors/occupancy-sensing-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";

export const OccupancySensorType = OccupancySensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OccupancySensingServer,
);

export const OccupancySensorWithBatteryType = OccupancySensorDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  OccupancySensingServer,
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
