import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { DoorLockServer as Base } from "@matter/main/behaviors";
import { DoorLock } from "@matter/main/clusters";
import { LockCredentialStorage } from "../../services/storage/lock-credential-storage.js";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

import LockState = DoorLock.LockState;

export interface LockServerConfig {
  getLockState: ValueGetter<LockState>;
  lock: ValueSetter<void>;
  unlock: ValueSetter<void>;
}

// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class LockServerBase extends Base {
  declare state: LockServerBase.State;

  override async initialize() {
    // Matter.js defaults: lockState=null, actuatorEnabled=false
    // lockState=null is valid per Matter spec (means "unknown")
    // actuatorEnabled=false is the Matter.js default - we override to true in update()
    // No overrides needed here - Matter.js defaults are valid

    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    applyPatchState(this.state, {
      lockState: this.state.config.getLockState(entity.state, this.agent),
      lockType: DoorLock.LockType.DeadBolt,
      operatingMode: DoorLock.OperatingMode.Normal,
      actuatorEnabled: true,
      supportedOperatingModes: {
        noRemoteLockUnlock: false,
        normal: true,
        passage: false,
        privacy: false,
        vacation: false,
      },
    });
  }

  override lockDoor() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const pinCode = this.getPinCode(homeAssistant.entityId);
    const action = this.state.config.lock(void 0, this.agent);
    if (pinCode) {
      action.data = { ...action.data, code: pinCode };
    }
    homeAssistant.callAction(action);
  }

  override unlockDoor() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const pinCode = this.getPinCode(homeAssistant.entityId);
    const action = this.state.config.unlock(void 0, this.agent);
    if (pinCode) {
      action.data = { ...action.data, code: pinCode };
    }
    homeAssistant.callAction(action);
  }

  private getPinCode(entityId: string): string | undefined {
    try {
      const storage = this.env.get(LockCredentialStorage);
      const credential = storage.getCredentialForEntity(entityId);
      if (credential?.enabled && credential.pinCode) {
        return credential.pinCode;
      }
    } catch {
      // Storage not available or no credential found
    }
    return undefined;
  }
}

namespace LockServerBase {
  export class State extends Base.State {
    config!: LockServerConfig;
  }
}

export function LockServer(config: LockServerConfig) {
  return LockServerBase.set({ config });
}
