import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
  HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import {
  DestroyedDependencyError,
  Logger,
  TransactionDestroyedError,
} from "@matter/general";
import type { EndpointType } from "@matter/main";
import debounce from "debounce";
import type { BridgeRegistry } from "../../services/bridges/bridge-registry.js";
import type { HomeAssistantStates } from "../../services/home-assistant/home-assistant-registry.js";
import { HomeAssistantEntityBehavior } from "../behaviors/home-assistant-entity-behavior.js";
import { EntityEndpoint } from "./entity-endpoint.js";

const logger = Logger.get("DomainEndpoint");

/**
 * Base class for Vision 1 domain-specific endpoints.
 *
 * Unlike LegacyEndpoint where each behavior independently subscribes to
 * entity state changes and updates itself, DomainEndpoint orchestrates
 * state updates from a single place. This enables:
 *
 * - Multi-entity support (accessing neighbor entities from the same HA device)
 * - Coordinated updates across behaviors
 * - Domain-specific parsing logic in one place instead of scattered across behaviors
 *
 * When managedByEndpoint is true (Phase 2), behaviors register their update
 * callbacks via HomeAssistantEntityBehavior.registerUpdate() instead of
 * self-subscribing to onChange. The DomainEndpoint dispatches updates to all
 * registered behaviors after setting the entity state.
 *
 * When managedByEndpoint is false (Phase 1 / legacy fallback), behaviors
 * self-subscribe to onChange as before. This provides backward compatibility.
 */
export abstract class DomainEndpoint extends EntityEndpoint {
  protected readonly registry: BridgeRegistry;
  protected readonly mapping?: EntityMappingConfig;
  private lastState?: HomeAssistantEntityState;
  private readonly flushUpdate: ReturnType<typeof debounce>;

  protected constructor(
    type: EndpointType,
    entityId: string,
    registry: BridgeRegistry,
    mapping?: EntityMappingConfig,
  ) {
    super(type, entityId, mapping?.customName);
    this.registry = registry;
    this.mapping = mapping;
    this.flushUpdate = debounce(this.flushPendingUpdate.bind(this), 50);
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

    logger.debug(`State update for ${this.entityId}: state=${state.state}`);
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
      // Update HomeAssistantEntityBehavior so behaviors and commands
      // have access to the latest entity state.
      const current = this.stateOf(HomeAssistantEntityBehavior).entity;
      await this.setStateOf(HomeAssistantEntityBehavior, {
        entity: { ...current, state },
      });

      // Phase 2: Dispatch update to all behaviors that registered via
      // registerUpdate() during initialize(). In Phase 1 (managedByEndpoint=false),
      // no callbacks are registered and this is a no-op.
      await this.act((agent) => {
        agent.get(HomeAssistantEntityBehavior).dispatchUpdate();
      });

      // Call the domain-specific update hook for cross-entity features.
      // Cast needed: Matter.js state returns readonly properties.
      const updatedEntity = this.stateOf(HomeAssistantEntityBehavior)
        .entity as HomeAssistantEntityInformation;
      this.updateEntity(updatedEntity);
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

  /**
   * Called when the entity state changes. Domain endpoints override this to
   * implement domain-specific state parsing and cross-entity features.
   *
   * Phase 1: Behaviors still self-update. Use this for multi-entity features
   *   that the legacy self-updating behaviors can't handle.
   *
   * Phase 2: This becomes the primary state update mechanism. Set behavior
   *   state directly via this.stateOf() / this.setStateOf().
   */
  protected abstract updateEntity(entity: HomeAssistantEntityInformation): void;
}
