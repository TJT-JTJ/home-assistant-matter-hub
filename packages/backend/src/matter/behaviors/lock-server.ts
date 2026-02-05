import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { DoorLockServer as Base } from "@matter/main/behaviors";
import { DoorLock } from "@matter/main/clusters";
import { StatusCode, StatusResponseError } from "@matter/main/types";
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

/**
 * Base DoorLock server - used when no PIN is configured for the entity.
 * This provides basic lock/unlock functionality without PIN requirements.
 */
// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class LockServerBase extends Base {
  declare state: LockServerBase.State;

  override async initialize() {
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
    const pinCode = this.getStoredPinCode(homeAssistant.entityId);
    const action = this.state.config.lock(void 0, this.agent);
    if (pinCode) {
      action.data = { ...action.data, code: pinCode };
    }
    homeAssistant.callAction(action);
  }

  override unlockDoor() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const pinCode = this.getStoredPinCode(homeAssistant.entityId);
    const action = this.state.config.unlock(void 0, this.agent);
    if (pinCode) {
      action.data = { ...action.data, code: pinCode };
    }
    homeAssistant.callAction(action);
  }

  protected getStoredPinCode(entityId: string): string | undefined {
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

/**
 * Extended DoorLock server with PinCredential feature.
 * This enables requirePinForRemoteOperation which tells Matter controllers
 * (like Google Home) that a PIN is required for remote unlock operations.
 *
 * Google Home will then prompt for PIN in the app before allowing unlock.
 * Note: Voice unlock is still disabled by Google for Matter locks (this is
 * a Google policy, not a Matter limitation).
 */
const PinCredentialBase = Base.with(
  "PinCredential",
  "CredentialOverTheAirAccess",
);

// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class LockServerWithPinBase extends PinCredentialBase {
  declare state: LockServerWithPinBase.State;

  override async initialize() {
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }

    // Check if a PIN credential is configured for this entity
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const hasPinConfigured = !!this.getStoredPinCode(homeAssistant.entityId);

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
      // PIN credential configuration
      numberOfPinUsersSupported: 1,
      maxPinCodeLength: 8,
      minPinCodeLength: 4,
      // Only require PIN for remote operation if a PIN is actually configured
      // This tells Google Home to prompt for PIN in the app before unlocking
      requirePinForRemoteOperation: hasPinConfigured,
      sendPinOverTheAir: true,
    });
  }

  override lockDoor(request: DoorLock.LockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storedPin = this.getStoredPinCode(homeAssistant.entityId);
    const action = this.state.config.lock(void 0, this.agent);

    // If a PIN was provided by the controller, validate it
    if (request.pinCode) {
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (storedPin && providedPin !== storedPin) {
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
    }

    // Use stored PIN for HA action if available
    if (storedPin) {
      action.data = { ...action.data, code: storedPin };
    }
    homeAssistant.callAction(action);
  }

  override unlockDoor(request: DoorLock.UnlockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storedPin = this.getStoredPinCode(homeAssistant.entityId);
    const action = this.state.config.unlock(void 0, this.agent);

    // Validate provided PIN against stored PIN
    if (this.state.requirePinForRemoteOperation) {
      if (!request.pinCode) {
        throw new StatusResponseError(
          "PIN code required for remote unlock",
          StatusCode.Failure,
        );
      }
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (storedPin && providedPin !== storedPin) {
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
    }

    // Use stored PIN for HA action if available
    if (storedPin) {
      action.data = { ...action.data, code: storedPin };
    }
    homeAssistant.callAction(action);
  }

  protected getStoredPinCode(entityId: string): string | undefined {
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

  /**
   * Set a PIN code for a user slot.
   * We store this in our LockCredentialStorage.
   */
  override async setPinCode(
    request: DoorLock.SetPinCodeRequest,
  ): Promise<void> {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storage = this.env.get(LockCredentialStorage);

    const pinCode = new TextDecoder().decode(request.pin);

    await storage.setCredential({
      entityId: homeAssistant.entityId,
      pinCode,
      name: `User ${request.userId}`,
      enabled: request.userStatus === DoorLock.UserStatus.OccupiedEnabled,
    });
  }

  /**
   * Get a PIN code for a user slot.
   */
  override getPinCode(
    request: DoorLock.GetPinCodeRequest,
  ): DoorLock.GetPinCodeResponse {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const credential = this.getStoredCredential(homeAssistant.entityId);

    if (!credential || request.userId !== 1) {
      return {
        userId: request.userId,
        userStatus: DoorLock.UserStatus.Available,
        userType: null,
        pinCode: null,
      };
    }

    return {
      userId: request.userId,
      userStatus: credential.enabled
        ? DoorLock.UserStatus.OccupiedEnabled
        : DoorLock.UserStatus.OccupiedDisabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      pinCode: credential.pinCode
        ? new TextEncoder().encode(credential.pinCode)
        : null,
    };
  }

  /**
   * Clear a specific PIN code.
   */
  override async clearPinCode(
    request: DoorLock.ClearPinCodeRequest,
  ): Promise<void> {
    if (request.pinSlotIndex === 1) {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const storage = this.env.get(LockCredentialStorage);
      await storage.deleteCredential(homeAssistant.entityId);
    }
  }

  /**
   * Clear all PIN codes.
   */
  override async clearAllPinCodes(): Promise<void> {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storage = this.env.get(LockCredentialStorage);
    await storage.deleteCredential(homeAssistant.entityId);
  }

  private getStoredCredential(entityId: string) {
    try {
      const storage = this.env.get(LockCredentialStorage);
      return storage.getCredentialForEntity(entityId);
    } catch {
      return undefined;
    }
  }
}

namespace LockServerWithPinBase {
  export class State extends PinCredentialBase.State {
    config!: LockServerConfig;
  }
}

/**
 * Creates a basic LockServer without PIN credential support.
 * Use this when no PIN is configured for the entity.
 */
export function LockServer(config: LockServerConfig) {
  return LockServerBase.set({ config });
}

/**
 * Creates a LockServer with PIN credential support.
 * This enables requirePinForRemoteOperation which tells Matter controllers
 * that a PIN is required for remote unlock operations.
 *
 * Note: This enables PIN entry in apps like Google Home, but voice unlock
 * remains disabled by Google's policy for Matter locks.
 */
export function LockServerWithPin(config: LockServerConfig) {
  return LockServerWithPinBase.set({ config });
}
