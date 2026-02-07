import type { EntityMappingConfig } from "@home-assistant-matter-hub/common";
import {
  type SensorDeviceAttributes,
  SensorDeviceClass,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";

const logger = Logger.get("AutoMapping");

/**
 * Check if an entity should be skipped because it has been auto-assigned
 * to another device (e.g., battery sensor used by a light).
 */
export function shouldSkipAutoAssigned(
  registry: BridgeRegistry,
  entityId: string,
): boolean {
  if (
    registry.isAutoBatteryMappingEnabled() &&
    registry.isBatteryEntityUsed(entityId)
  ) {
    logger.debug(
      `Skipping ${entityId} - already auto-assigned as battery to another device`,
    );
    return true;
  }
  if (
    registry.isAutoHumidityMappingEnabled() &&
    registry.isHumidityEntityUsed(entityId)
  ) {
    logger.debug(
      `Skipping ${entityId} - already auto-assigned as humidity to a temperature sensor`,
    );
    return true;
  }
  return false;
}

/**
 * Compute effective mapping by auto-assigning related entities
 * (humidity sensor, battery sensor) from the same HA device.
 *
 * Order matters: Humidity first, then Battery — so battery only goes
 * to the combined TemperatureHumiditySensor, not to both separately.
 */
export function computeAutoMapping(
  registry: BridgeRegistry,
  entityId: string,
  mapping?: EntityMappingConfig,
): EntityMappingConfig | undefined {
  const entity = registry.entity(entityId);
  const state = registry.initialState(entityId);
  if (!entity?.device_id || !state) {
    return mapping;
  }

  let effectiveMapping = mapping;

  // 1. Auto-assign humidity entity to temperature sensors FIRST
  if (registry.isAutoHumidityMappingEnabled()) {
    const attrs = state.attributes as SensorDeviceAttributes;
    if (
      !mapping?.humidityEntity &&
      entityId.startsWith("sensor.") &&
      attrs.device_class === SensorDeviceClass.temperature
    ) {
      const humidityEntityId = registry.findHumidityEntityForDevice(
        entity.device_id,
      );
      if (humidityEntityId && humidityEntityId !== entityId) {
        effectiveMapping = {
          ...effectiveMapping,
          entityId: effectiveMapping?.entityId ?? entityId,
          humidityEntity: humidityEntityId,
        };
        registry.markHumidityEntityUsed(humidityEntityId);
        logger.debug(
          `Auto-assigned humidity ${humidityEntityId} to ${entityId}`,
        );
      }
    }
  }

  // 2. Auto-assign battery entity AFTER humidity
  if (registry.isAutoBatteryMappingEnabled() && !mapping?.batteryEntity) {
    const batteryEntityId = registry.findBatteryEntityForDevice(
      entity.device_id,
    );
    if (batteryEntityId && batteryEntityId !== entityId) {
      effectiveMapping = {
        ...effectiveMapping,
        entityId: effectiveMapping?.entityId ?? entityId,
        batteryEntity: batteryEntityId,
      };
      registry.markBatteryEntityUsed(batteryEntityId);
      logger.debug(`Auto-assigned battery ${batteryEntityId} to ${entityId}`);
    }
  }

  return effectiveMapping;
}
