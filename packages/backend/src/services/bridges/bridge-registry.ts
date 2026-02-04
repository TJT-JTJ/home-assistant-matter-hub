import type {
  HomeAssistantDeviceRegistry,
  HomeAssistantEntityRegistry,
  HomeAssistantFilter,
  SensorDeviceAttributes,
} from "@home-assistant-matter-hub/common";
import { SensorDeviceClass } from "@home-assistant-matter-hub/common";
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

  // Track battery entities that have been auto-assigned to other devices
  private _usedBatteryEntities: Set<string> = new Set();
  // Track humidity entities that have been auto-assigned to temperature sensors
  private _usedHumidityEntities: Set<string> = new Set();

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
   * Find a battery sensor entity that belongs to the same HA device.
   * Returns the entity_id of the battery sensor, or undefined if none found.
   */
  findBatteryEntityForDevice(deviceId: string): string | undefined {
    const entities = values(this._entities);
    for (const entity of entities) {
      if (entity.device_id !== deviceId) continue;
      if (!entity.entity_id.startsWith("sensor.")) continue;

      const state = this._states[entity.entity_id];
      if (!state) continue;

      const attrs = state.attributes as SensorDeviceAttributes;
      if (attrs.device_class === SensorDeviceClass.battery) {
        return entity.entity_id;
      }
    }
    return undefined;
  }

  /**
   * Mark a battery entity as used (auto-assigned to another device).
   */
  markBatteryEntityUsed(entityId: string): void {
    this._usedBatteryEntities.add(entityId);
  }

  /**
   * Check if a battery entity has been auto-assigned to another device.
   */
  isBatteryEntityUsed(entityId: string): boolean {
    return this._usedBatteryEntities.has(entityId);
  }

  /**
   * Check if auto battery mapping is enabled for this bridge.
   */
  isAutoBatteryMappingEnabled(): boolean {
    return this.dataProvider.featureFlags?.autoBatteryMapping === true;
  }

  /**
   * Check if auto humidity mapping is enabled for this bridge.
   * Default: true (enabled by default)
   */
  isAutoHumidityMappingEnabled(): boolean {
    return this.dataProvider.featureFlags?.autoHumidityMapping !== false;
  }

  /**
   * Find a humidity sensor entity that belongs to the same HA device.
   * Returns the entity_id of the humidity sensor, or undefined if none found.
   */
  findHumidityEntityForDevice(deviceId: string): string | undefined {
    const entities = values(this._entities);
    for (const entity of entities) {
      if (entity.device_id !== deviceId) continue;
      if (!entity.entity_id.startsWith("sensor.")) continue;

      const state = this._states[entity.entity_id];
      if (!state) continue;

      const attrs = state.attributes as SensorDeviceAttributes;
      if (attrs.device_class === SensorDeviceClass.humidity) {
        return entity.entity_id;
      }
    }
    return undefined;
  }

  /**
   * Mark a humidity entity as used (auto-assigned to a temperature sensor).
   */
  markHumidityEntityUsed(entityId: string): void {
    this._usedHumidityEntities.add(entityId);
  }

  /**
   * Check if a humidity entity has been auto-assigned to a temperature sensor.
   */
  isHumidityEntityUsed(entityId: string): boolean {
    return this._usedHumidityEntities.has(entityId);
  }

  constructor(
    private readonly registry: HomeAssistantRegistry,
    private readonly dataProvider: BridgeDataProvider,
  ) {
    this.refresh();
  }

  refresh() {
    // Clear used entities on refresh to allow re-assignment
    this._usedBatteryEntities.clear();
    this._usedHumidityEntities.clear();

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
      !testMatchers(filter.include, device, entity, filter.includeMode)
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
