import {
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
  type SensorDeviceAttributes,
  SensorDeviceClass,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { AirQualitySensorType } from "../legacy/sensor/devices/air-quality-sensor.js";
import { BatterySensorType } from "../legacy/sensor/devices/battery-sensor.js";
import { FlowSensorType } from "../legacy/sensor/devices/flow-sensor.js";
import { HumiditySensorType } from "../legacy/sensor/devices/humidity-sensor.js";
import { IlluminanceSensorType } from "../legacy/sensor/devices/illuminance-sensor.js";
import { Pm10SensorType } from "../legacy/sensor/devices/pm10-sensor.js";
import { Pm25SensorType } from "../legacy/sensor/devices/pm25-sensor.js";
import { PressureSensorType } from "../legacy/sensor/devices/pressure-sensor.js";
import { TemperatureSensorType } from "../legacy/sensor/devices/temperature-sensor.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

function getDeviceType(
  deviceClass: SensorDeviceClass | undefined,
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType | undefined {
  switch (deviceClass) {
    case SensorDeviceClass.temperature:
      return TemperatureSensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.humidity:
      return HumiditySensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.illuminance:
      return IlluminanceSensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.pressure:
    case SensorDeviceClass.atmospheric_pressure:
      return PressureSensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.volume_flow_rate:
      return FlowSensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.battery:
      return BatterySensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.pm25:
      return Pm25SensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.pm10:
      return Pm10SensorType.set({ homeAssistantEntity });
    case SensorDeviceClass.aqi:
    case SensorDeviceClass.carbon_dioxide:
    case SensorDeviceClass.volatile_organic_compounds:
    case SensorDeviceClass.volatile_organic_compounds_parts:
      return AirQualitySensorType.set({ homeAssistantEntity });
    default:
      return undefined;
  }
}

/**
 * SensorEndpoint - Vision 1 implementation for sensor entities.
 */
export class SensorEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<SensorEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attributes = state.attributes as SensorDeviceAttributes;
    const deviceClass = attributes.device_class;

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const deviceType = getDeviceType(deviceClass, homeAssistantEntity);
    if (!deviceType) {
      return undefined;
    }

    const customName = mapping?.customName;
    return new SensorEndpoint(deviceType, entityId, customName);
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  protected onEntityStateChanged(
    _entity: HomeAssistantEntityInformation,
  ): void {
    // Behaviors handle their own state updates
  }

  protected onBehaviorCommand(_command: BehaviorCommand): void {
    // Behaviors handle their own commands
  }
}
