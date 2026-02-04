import type { EndpointType } from "@matter/main";
import { DoorLock } from "@matter/main/clusters";
import { DoorLockDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import {
  LockServer,
  type LockServerConfig,
} from "../../../behaviors/lock-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";

const mapHAState: Record<string, DoorLock.LockState> = {
  locked: DoorLock.LockState.Locked,
  locking: DoorLock.LockState.Locked,
  unlocked: DoorLock.LockState.Unlocked,
  unlocking: DoorLock.LockState.Unlocked,
};

const lockServerConfig: LockServerConfig = {
  getLockState: (entity) =>
    mapHAState[entity.state] ?? DoorLock.LockState.NotFullyLocked,
  lock: () => ({ action: "lock.lock" }),
  unlock: () => ({ action: "lock.unlock" }),
};

// Lock without battery
const LockDeviceType = DoorLockDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  LockServer(lockServerConfig),
);

// Lock with battery - includes PowerSource cluster
const LockWithBatteryDeviceType = DoorLockDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  LockServer(lockServerConfig),
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

export function LockDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  // Check if the lock has battery information
  const attrs = homeAssistantEntity.entity.state.attributes as {
    battery?: number;
    battery_level?: number;
  };
  const hasBattery = attrs.battery_level != null || attrs.battery != null;

  if (hasBattery) {
    return LockWithBatteryDeviceType.set({ homeAssistantEntity });
  }
  return LockDeviceType.set({ homeAssistantEntity });
}
