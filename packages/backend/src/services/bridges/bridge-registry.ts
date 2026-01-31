import type {
  HomeAssistantDeviceRegistry,
  HomeAssistantEntityRegistry,
  HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import { keys, pickBy, values } from "lodash-es";
import type {
  HomeAssistantDevices,
  HomeAssistantEntities,
  HomeAssistantRegistry,
  HomeAssistantStates,
} from "../home-assistant/home-assistant-registry.js";
import type { BridgeDataProvider } from "./bridge-data-provider.js";
import { testMatchers } from "./matcher/matches-entity-filter.js";

export interface BridgeRegistryProps {
  readonly registry: HomeAssistantRegistry;
  readonly dataProvider: BridgeDataProvider;
}

export class BridgeRegistry {
  get entityIds() {
    return keys(this._entities);
  }

  private _devices: HomeAssistantDevices = {};
  private _entities: HomeAssistantEntities = {};
  private _states: HomeAssistantStates = {};

  deviceOf(entityId: string): HomeAssistantDeviceRegistry {
    const entity = this._entities[entityId];
    return this._devices[entity.device_id];
  }
  entity(entityId: string) {
    return this._entities[entityId];
  }
  initialState(entityId: string) {
    return this._states[entityId];
  }

  /**
   * Get all entities that belong to the same HA device as the given entity.
   * This enables domain endpoints to access neighbor entities (e.g., a thermostat
   * accessing an external temperature sensor from the same device).
   */
  neighborsOf(entityId: string): Map<string, HomeAssistantEntityRegistry> {
    const entity = this._entities[entityId];
    if (!entity?.device_id) {
      return new Map();
    }

    const neighbors = new Map<string, HomeAssistantEntityRegistry>();
    for (const [id, ent] of Object.entries(this.registry.entities)) {
      if (ent.device_id === entity.device_id && id !== entityId) {
        neighbors.set(id, ent);
      }
    }
    return neighbors;
  }

  /**
   * Get neighbor entity information including state for domain endpoints.
   */
  neighborInfoOf(
    entityId: string,
  ): Map<
    string,
    { entity: HomeAssistantEntityRegistry; state: HomeAssistantStates[string] }
  > {
    const neighbors = this.neighborsOf(entityId);
    const result = new Map<
      string,
      {
        entity: HomeAssistantEntityRegistry;
        state: HomeAssistantStates[string];
      }
    >();

    for (const [id, entity] of neighbors) {
      const state = this.registry.states[id];
      if (state) {
        result.set(id, { entity, state });
      }
    }
    return result;
  }

  constructor(
    private readonly registry: HomeAssistantRegistry,
    private readonly dataProvider: BridgeDataProvider,
  ) {
    this.refresh();
  }

  refresh() {
    this._entities = pickBy(this.registry.entities, (entity) => {
      const device = this.registry.devices[entity.device_id];
      const filter = this.dataProvider.filter;
      const featureFlags = this.dataProvider.featureFlags ?? {};

      // Always exclude disabled entities
      if (entity.disabled_by != null) {
        return false;
      }

      // Hidden entities are only included if includeHiddenEntities feature flag is enabled
      const isHidden = entity.hidden_by != null;
      if (isHidden && !featureFlags.includeHiddenEntities) {
        return false;
      }

      // Check filter matching
      return this.matchesFilter(filter, entity, device);
    });
    this._states = pickBy(
      this.registry.states,
      (e) => !!this._entities[e.entity_id],
    );
    this._devices = pickBy(this.registry.devices, (d) =>
      values(this._entities)
        .map((e) => e.device_id)
        .some((id) => d.id === id),
    );
  }

  private matchesFilter(
    filter: HomeAssistantFilter,
    entity: HomeAssistantEntityRegistry,
    device: HomeAssistantDeviceRegistry,
  ) {
    if (
      filter.include.length > 0 &&
      !testMatchers(filter.include, device, entity)
    ) {
      return false;
    }
    if (
      filter.exclude.length > 0 &&
      testMatchers(filter.exclude, device, entity)
    ) {
      return false;
    }
    return true;
  }
}
