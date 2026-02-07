import type {
  EntityMappingConfig,
  HomeAssistantDomain,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { DomainEndpoint } from "../domain-endpoint.js";
import { AlarmControlPanelDevice } from "../legacy/alarm-control-panel/index.js";
import { AutomationDevice } from "../legacy/automation/index.js";
import { BinarySensorDevice } from "../legacy/binary-sensor/index.js";
import { ButtonDevice } from "../legacy/button/index.js";
import { ClimateDevice } from "../legacy/climate/index.js";
import { CoverDevice } from "../legacy/cover/index.js";
import { createLegacyEndpointType } from "../legacy/create-legacy-endpoint-type.js";
import { FanDevice } from "../legacy/fan/index.js";
import { HumidifierDevice } from "../legacy/humidifier/index.js";
import { InputButtonDevice } from "../legacy/input-button/index.js";
import { LightDevice } from "../legacy/light/index.js";
import { LockDevice } from "../legacy/lock/index.js";
import { MediaPlayerDevice } from "../legacy/media-player/index.js";
import { RemoteDevice } from "../legacy/remote/index.js";
import { SceneDevice } from "../legacy/scene/index.js";
import { ScriptDevice } from "../legacy/script/index.js";
import { SensorDevice } from "../legacy/sensor/index.js";
import { SwitchDevice } from "../legacy/switch/index.js";
import { VacuumDevice } from "../legacy/vacuum/index.js";
import { ValveDevice } from "../legacy/valve/index.js";
import { WaterHeaterDevice } from "../legacy/water-heater/index.js";
import { computeAutoMapping, shouldSkipAutoAssigned } from "./auto-mapping.js";
import {
  type DeviceFactory,
  GenericDomainEndpoint,
} from "./generic-domain-endpoint.js";

const logger = Logger.get("DomainEndpointFactory");

/**
 * Registry of domain → device factory mappings.
 * Every supported HA domain is registered here.
 * The existing legacy device factories are reused as-is.
 */
const domainFactories: Partial<Record<HomeAssistantDomain, DeviceFactory>> = {
  light: LightDevice,
  switch: SwitchDevice,
  lock: LockDevice,
  fan: FanDevice,
  binary_sensor: BinarySensorDevice,
  sensor: SensorDevice,
  cover: CoverDevice,
  climate: ClimateDevice,
  input_boolean: SwitchDevice,
  input_button: InputButtonDevice,
  button: ButtonDevice,
  automation: AutomationDevice,
  script: ScriptDevice,
  scene: SceneDevice,
  media_player: MediaPlayerDevice,
  humidifier: HumidifierDevice,
  vacuum: VacuumDevice,
  valve: ValveDevice,
  alarm_control_panel: AlarmControlPanelDevice,
  remote: RemoteDevice,
  water_heater: WaterHeaterDevice,
};

/**
 * Create a Vision 1 DomainEndpoint for the given entity.
 * Handles auto-mapping (battery, humidity) and delegates to the
 * appropriate device factory via GenericDomainEndpoint.
 *
 * Returns undefined if:
 * - The domain is not supported
 * - The entity should be skipped (auto-assigned to another device)
 * - The factory returns no endpoint type
 */
export function createDomainEndpoint(
  registry: BridgeRegistry,
  entityId: string,
  mapping?: EntityMappingConfig,
): DomainEndpoint | undefined {
  // Skip entities that have been auto-assigned to another device
  if (shouldSkipAutoAssigned(registry, entityId)) {
    return undefined;
  }

  // Compute effective mapping with auto-assigned entities
  const effectiveMapping = computeAutoMapping(registry, entityId, mapping);

  // If a matterDeviceType override is set, use the legacy factory which
  // handles all device type overrides (e.g., force a switch to be a light).
  if (effectiveMapping?.matterDeviceType) {
    const overrideFactory: DeviceFactory = (haState) => {
      return createLegacyEndpointType(haState.entity, effectiveMapping);
    };
    logger.debug(
      `Creating DomainEndpoint for ${entityId} (matterDeviceType: ${effectiveMapping.matterDeviceType})`,
    );
    return GenericDomainEndpoint.create(
      overrideFactory,
      registry,
      entityId,
      effectiveMapping,
    );
  }

  const domain = entityId.split(".")[0] as HomeAssistantDomain;
  const factory = domainFactories[domain];
  if (!factory) {
    return undefined;
  }

  logger.debug(`Creating DomainEndpoint for ${entityId} (domain: ${domain})`);
  return GenericDomainEndpoint.create(
    factory,
    registry,
    entityId,
    effectiveMapping,
  );
}
