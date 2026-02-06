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
    const action = this.state.config.lock(void 0, this.agent);
    homeAssistant.callAction(action);
  }

  override unlockDoor() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.unlock(void 0, this.agent);
    homeAssistant.callAction(action);
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
).set({
  // Required defaults for PinCredential feature
  wrongCodeEntryLimit: 3,
  userCodeTemporaryDisableTime: 10, // seconds
});

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
    const hasPinConfigured = this.hasStoredCredential(homeAssistant.entityId);

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
    const action = this.state.config.lock(void 0, this.agent);

    // If a PIN was provided by the controller, validate it against the hashed PIN
    if (request.pinCode) {
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (!this.verifyStoredPin(homeAssistant.entityId, providedPin)) {
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
      // Pass the provided PIN to Home Assistant (for locks that require it)
      action.data = { ...action.data, code: providedPin };
    }

    homeAssistant.callAction(action);
  }

  override unlockDoor(request: DoorLock.UnlockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.unlock(void 0, this.agent);

    // Validate provided PIN against stored hashed PIN
    if (this.state.requirePinForRemoteOperation) {
      if (!request.pinCode) {
        throw new StatusResponseError(
          "PIN code required for remote unlock",
          StatusCode.Failure,
        );
      }
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (!this.verifyStoredPin(homeAssistant.entityId, providedPin)) {
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
      // Pass the provided PIN to Home Assistant (for locks that require it)
      action.data = { ...action.data, code: providedPin };
    }

    homeAssistant.callAction(action);
  }

  /**
   * Check if a PIN credential exists and is enabled for an entity
   */
  protected hasStoredCredential(entityId: string): boolean {
    try {
      const storage = this.env.get(LockCredentialStorage);
      return storage.hasCredential(entityId);
    } catch {
      return false;
    }
  }

  /**
   * Verify a PIN against the stored hashed credential
   */
  protected verifyStoredPin(entityId: string, pin: string): boolean {
    try {
      const storage = this.env.get(LockCredentialStorage);
      return storage.verifyPin(entityId, pin);
    } catch {
      return false;
    }
  }

  /**
   * Set a PIN code for a user slot.
   * The PIN will be hashed before storage.
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
   * Note: We cannot return the actual PIN since it's hashed.
   * We return a placeholder to indicate a PIN exists.
   */
  override getPinCode(
    request: DoorLock.GetPinCodeRequest,
  ): DoorLock.GetPinCodeResponse {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const hasCredential = this.hasStoredCredential(homeAssistant.entityId);

    if (!hasCredential || request.userId !== 1) {
      return {
        userId: request.userId,
        userStatus: DoorLock.UserStatus.Available,
        userType: null,
        pinCode: null,
      };
    }

    // Cannot return actual PIN since it's hashed - return empty to indicate PIN exists
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      pinCode: null, // PIN is hashed, cannot be retrieved
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
