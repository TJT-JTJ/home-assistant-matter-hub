import {
  ClusterId,
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Behavior, EventEmitter } from "@matter/main";

import {
  type HomeAssistantAction,
  HomeAssistantActions,
} from "../../services/home-assistant/home-assistant-actions.js";
import { AsyncObservable } from "../../utils/async-observable.js";

export class HomeAssistantEntityBehavior extends Behavior {
  static override readonly id = ClusterId.homeAssistantEntity;
  declare state: HomeAssistantEntityBehavior.State;
  declare events: HomeAssistantEntityBehavior.Events;

  private _updateCallbacks: Array<
    (entity: HomeAssistantEntityInformation) => void
  > = [];

  get entityId(): string {
    return this.entity.entity_id;
  }

  get entity(): HomeAssistantEntityInformation {
    return this.state.entity;
  }

  get onChange(): HomeAssistantEntityBehavior.Events["entity$Changed"] {
    return this.events.entity$Changed;
  }

  get isAvailable(): boolean {
    return (
      this.entity.state.state !== "unavailable" &&
      this.entity.state.state !== "unknown"
    );
  }

  callAction(action: HomeAssistantAction) {
    const actions = this.env.get(HomeAssistantActions);
    actions.call(action, this.entityId);
  }

  /**
   * Register a behavior update callback for Phase 2 endpoint-driven updates.
   * Called by behaviors during initialize() when managedByEndpoint is true.
   */
  registerUpdate(
    callback: (entity: HomeAssistantEntityInformation) => void,
  ): void {
    this._updateCallbacks.push(callback);
  }

  /**
   * Dispatch entity state update to all registered behaviors.
   * Called by DomainEndpoint after setting the entity state.
   */
  dispatchUpdate(): void {
    const entity = this.entity;
    for (const callback of this._updateCallbacks) {
      callback(entity);
    }
  }
}

export namespace HomeAssistantEntityBehavior {
  export class State {
    entity!: HomeAssistantEntityInformation;
    customName?: string;
    /** Entity mapping configuration (optional, used for advanced features like filter life sensor) */
    mapping?: EntityMappingConfig;
    /** When true, the DomainEndpoint orchestrates behavior updates (Vision 1 Phase 2).
     *  Behaviors skip self-subscribing to onChange and instead get updated by the endpoint. */
    managedByEndpoint?: boolean;
  }

  export class Events extends EventEmitter {
    entity$Changed = AsyncObservable<HomeAssistantEntityInformation>();
  }
}
