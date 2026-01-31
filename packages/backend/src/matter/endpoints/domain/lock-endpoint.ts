import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { DoorLock } from "@matter/main/clusters";
import { DoorLockDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { LockCommands } from "../../behaviors/callback-behavior.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { LockBehavior } from "./behaviors/lock-behavior.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const mapHAState: Record<string, DoorLock.LockState> = {
  locked: DoorLock.LockState.Locked,
  locking: DoorLock.LockState.Locked,
  unlocked: DoorLock.LockState.Unlocked,
  unlocking: DoorLock.LockState.Unlocked,
};

const LockDeviceType = DoorLockDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  LockBehavior,
);

/**
 * LockEndpoint - Vision 1 implementation for lock entities.
 */
export class LockEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<LockEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const customName = mapping?.customName;
    return new LockEndpoint(
      LockDeviceType.set({ homeAssistantEntity }),
      entityId,
      customName,
    );
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  protected onEntityStateChanged(entity: HomeAssistantEntityInformation): void {
    if (!entity.state) return;

    const lockState =
      mapHAState[entity.state.state] ?? DoorLock.LockState.NotFullyLocked;

    try {
      this.setStateOf(LockBehavior, { lockState });
    } catch {
      // Behavior may not be initialized yet
    }
  }

  protected onBehaviorCommand(command: BehaviorCommand): void {
    switch (command.command) {
      case LockCommands.LOCK:
        this.callAction("lock", "lock");
        break;
      case LockCommands.UNLOCK:
        this.callAction("lock", "unlock");
        break;
    }
  }
}
