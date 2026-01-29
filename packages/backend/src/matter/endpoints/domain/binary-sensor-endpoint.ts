import {
  type BinarySensorDeviceAttributes,
  BinarySensorDeviceClass,
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { ContactSensorType } from "../legacy/binary-sensor/contact-sensor.js";
import { OccupancySensorType } from "../legacy/binary-sensor/occupancy-sensor.js";
import { OnOffSensorType } from "../legacy/binary-sensor/on-off-sensor.js";
import {
  CoAlarmType,
  SmokeAlarmType,
} from "../legacy/binary-sensor/smoke-co-alarm.js";
import { WaterLeakDetectorType } from "../legacy/binary-sensor/water-leak-detector.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

type SensorType =
  | typeof ContactSensorType
  | typeof OccupancySensorType
  | typeof WaterLeakDetectorType
  | typeof SmokeAlarmType
  | typeof CoAlarmType
  | typeof OnOffSensorType;

const deviceClasses: Partial<Record<BinarySensorDeviceClass, SensorType>> = {
  [BinarySensorDeviceClass.Occupancy]: OccupancySensorType,
  [BinarySensorDeviceClass.Motion]: OccupancySensorType,
  [BinarySensorDeviceClass.Moving]: OccupancySensorType,
  [BinarySensorDeviceClass.Presence]: OccupancySensorType,
  [BinarySensorDeviceClass.Door]: ContactSensorType,
  [BinarySensorDeviceClass.Window]: ContactSensorType,
  [BinarySensorDeviceClass.GarageDoor]: ContactSensorType,
  [BinarySensorDeviceClass.Lock]: ContactSensorType,
  [BinarySensorDeviceClass.Opening]: ContactSensorType,
  [BinarySensorDeviceClass.Moisture]: WaterLeakDetectorType,
  [BinarySensorDeviceClass.Smoke]: SmokeAlarmType,
  [BinarySensorDeviceClass.CarbonMonoxide]: CoAlarmType,
  [BinarySensorDeviceClass.Gas]: CoAlarmType,
};

/**
 * BinarySensorEndpoint - Vision 1 implementation for binary_sensor entities.
 */
export class BinarySensorEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<BinarySensorEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attributes = state.attributes as BinarySensorDeviceAttributes;
    const deviceClass = attributes.device_class;

    const deviceType =
      deviceClass && deviceClasses[deviceClass]
        ? deviceClasses[deviceClass]
        : OnOffSensorType;

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const customName = mapping?.customName;
    return new BinarySensorEndpoint(
      deviceType.set({ homeAssistantEntity }),
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

  protected onEntityStateChanged(
    _entity: HomeAssistantEntityInformation,
  ): void {
    // Behaviors handle their own state updates
  }

  protected onBehaviorCommand(_command: BehaviorCommand): void {
    // Behaviors handle their own commands
  }
}
