import type {
  HomeAssistantEntityInformation,
  HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import {
  DestroyedDependencyError,
  TransactionDestroyedError,
} from "@matter/general";
import type { EndpointType } from "@matter/main";
import debounce from "debounce";
import { HomeAssistantActions } from "../../../services/home-assistant/home-assistant-actions.js";
import type { HomeAssistantStates } from "../../../services/home-assistant/home-assistant-registry.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { EntityEndpoint } from "../entity-endpoint.js";

/**
 * Command callback from a behavior to the domain endpoint.
 * The endpoint receives this when a Matter controller triggers a command.
 */
export interface BehaviorCommand {
  behavior: string;
  command: string;
  args?: unknown;
}

/**
 * State update to send to a behavior.
 */
export interface BehaviorStateUpdate {
  behavior: string;
  state: Record<string, unknown>;
}

/**
 * Base class for domain-specific endpoints (Vision 1 architecture).
 *
 * Unlike LegacyEndpoint where behaviors update themselves, DomainEndpoint:
 * - Receives entity state changes and decides how to update behaviors
 * - Receives command callbacks from behaviors
 * - Can access neighbor entities within the same HA device
 * - Supports nested endpoints for complex devices
 *
 * Subclasses implement:
 * - `onEntityStateChanged()` - Handle HA entity updates
 * - `onBehaviorCommand()` - Handle Matter controller commands
 */
export abstract class DomainEndpoint extends EntityEndpoint {
  private lastState?: HomeAssistantEntityState;
  private readonly flushUpdate: ReturnType<typeof debounce>;
  private neighborEntities: Map<string, HomeAssistantEntityInformation> =
    new Map();

  protected constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
    this.flushUpdate = debounce(this.flushPendingUpdate.bind(this), 50);
  }

  /**
   * Called when the primary entity's state changes.
   * Subclasses should update behavior states based on the entity.
   */
  protected abstract onEntityStateChanged(
    entity: HomeAssistantEntityInformation,
  ): void;

  /**
   * Called when a behavior command is triggered by a Matter controller.
   * Subclasses should call the appropriate HA service.
   */
  protected abstract onBehaviorCommand(command: BehaviorCommand): void;

  /**
   * Get a neighbor entity's information (within the same HA device).
   */
  protected getNeighborEntity(
    entityId: string,
  ): HomeAssistantEntityInformation | undefined {
    return this.neighborEntities.get(entityId);
  }

  /**
   * Get all neighbor entities.
   */
  protected getAllNeighborEntities(): Map<
    string,
    HomeAssistantEntityInformation
  > {
    return this.neighborEntities;
  }

  /**
   * Find neighbor entities by domain (e.g., "sensor", "binary_sensor").
   */
  protected findNeighborsByDomain(
    domain: string,
  ): HomeAssistantEntityInformation[] {
    const results: HomeAssistantEntityInformation[] = [];
    for (const [id, entity] of this.neighborEntities) {
      if (id.startsWith(`${domain}.`)) {
        results.push(entity);
      }
    }
    return results;
  }

  /**
   * Find neighbor entities by device class (e.g., "temperature", "humidity").
   */
  protected findNeighborsByDeviceClass(
    deviceClass: string,
  ): HomeAssistantEntityInformation[] {
    const results: HomeAssistantEntityInformation[] = [];
    for (const entity of this.neighborEntities.values()) {
      if (entity.state?.attributes?.device_class === deviceClass) {
        results.push(entity);
      }
    }
    return results;
  }

  /**
   * Register neighbor entities that this endpoint can access.
   */
  public registerNeighborEntities(
    entities: Map<string, HomeAssistantEntityInformation>,
  ): void {
    this.neighborEntities = entities;
  }

  /**
   * Update a specific neighbor entity's state.
   */
  public updateNeighborState(
    entityId: string,
    state: HomeAssistantEntityState,
  ): void {
    const existing = this.neighborEntities.get(entityId);
    if (existing) {
      this.neighborEntities.set(entityId, { ...existing, state });
      this.onNeighborStateChanged(entityId, { ...existing, state });
    }
  }

  /**
   * Called when a neighbor entity's state changes.
   * Subclasses can override to react to neighbor state changes.
   */
  protected onNeighborStateChanged(
    _entityId: string,
    _entity: HomeAssistantEntityInformation,
  ): void {
    // Default: do nothing. Subclasses can override.
  }

  /**
   * Call a Home Assistant action.
   */
  protected callAction(
    domain: string,
    action: string,
    data?: Record<string, unknown>,
  ): void {
    try {
      const homeAssistant = this.stateOf(HomeAssistantEntityBehavior);
      const actions = this.env.get(HomeAssistantActions);
      actions.call(
        { action: `${domain}.${action}`, data },
        homeAssistant.entity.entity_id,
      );
    } catch {
      // Endpoint may not be fully initialized yet
    }
  }

  /**
   * Receive a command callback from a behavior.
   * This is called by behaviors when they receive commands from Matter controllers.
   */
  public receiveBehaviorCommand(command: BehaviorCommand): void {
    this.onBehaviorCommand(command);
  }

  override async delete() {
    this.flushUpdate.clear();
    await super.delete();
  }

  async updateStates(states: HomeAssistantStates) {
    const state = states[this.entityId] ?? {};
    if (JSON.stringify(state) === JSON.stringify(this.lastState ?? {})) {
      return;
    }

    this.lastState = state;
    this.flushUpdate(state);
  }

  private async flushPendingUpdate(state: HomeAssistantEntityState) {
    try {
      await this.construction.ready;
    } catch {
      return;
    }

    try {
      const current = this.stateOf(HomeAssistantEntityBehavior).entity;
      // Type assertion needed due to readonly array mismatch in types
      const entity = {
        ...current,
        state,
      } as HomeAssistantEntityInformation;

      await this.setStateOf(HomeAssistantEntityBehavior, { entity });

      // Let the domain endpoint handle the state change
      this.onEntityStateChanged(entity);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        error instanceof TransactionDestroyedError ||
        error instanceof DestroyedDependencyError
      ) {
        return;
      }

      if (
        errorMessage.includes(
          "Endpoint storage inaccessible because endpoint is not a node and is not owned by another endpoint",
        )
      ) {
        return;
      }

      throw error;
    }
  }
}
