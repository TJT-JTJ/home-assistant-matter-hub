import type {
  EntityMappingConfig,
  HomeAssistantDomain,
} from "@home-assistant-matter-hub/common";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { EntityEndpoint } from "../entity-endpoint.js";
import { LegacyEndpoint } from "../legacy/legacy-endpoint.js";
import { BinarySensorEndpoint } from "./binary-sensor-endpoint.js";
import { ButtonEndpoint } from "./button-endpoint.js";
import { CoverEndpoint } from "./cover-endpoint.js";
import { FanEndpoint } from "./fan-endpoint.js";
import { HumidifierEndpoint } from "./humidifier-endpoint.js";
import { LightEndpoint } from "./light-endpoint.js";
import { LockEndpoint } from "./lock-endpoint.js";
import { MediaPlayerEndpoint } from "./media-player-endpoint.js";
import { SceneEndpoint } from "./scene-endpoint.js";
import { SensorEndpoint } from "./sensor-endpoint.js";
import { SwitchEndpoint } from "./switch-endpoint.js";
import { ThermostatEndpoint } from "./thermostat-endpoint.js";
import { VacuumEndpoint } from "./vacuum-endpoint.js";
import { ValveEndpoint } from "./valve-endpoint.js";

type EndpointFactory = (
  registry: BridgeRegistry,
  entityId: string,
  mapping?: EntityMappingConfig,
) => Promise<EntityEndpoint | undefined>;

/**
 * Vision 1 Domain Endpoint Factory.
 *
 * Creates the appropriate Vision 1 endpoint for an entity.
 * Falls back to LegacyEndpoint for domains that don't have a Vision 1 implementation yet.
 */
export async function createDomainEndpoint(
  registry: BridgeRegistry,
  entityId: string,
  mapping?: EntityMappingConfig,
): Promise<EntityEndpoint | undefined> {
  const domain = entityId.split(".")[0] as HomeAssistantDomain;
  const factory = domainFactories[domain];

  if (factory) {
    const endpoint = await factory(registry, entityId, mapping);
    if (endpoint) {
      return endpoint;
    }
  }

  // Fallback to LegacyEndpoint for unsupported domains
  return LegacyEndpoint.create(registry, entityId, mapping);
}

/**
 * Exported Vision 1 factories for domains with full Vision 1 support.
 */
const domainFactories: Partial<Record<HomeAssistantDomain, EndpointFactory>> = {
  light: LightEndpoint.create,
  climate: ThermostatEndpoint.create,
  switch: SwitchEndpoint.create,
  lock: LockEndpoint.create,
  cover: CoverEndpoint.create,
  fan: FanEndpoint.create,
  sensor: SensorEndpoint.create,
  binary_sensor: BinarySensorEndpoint.create,
  input_boolean: SwitchEndpoint.create,
  button: ButtonEndpoint.create,
  input_button: ButtonEndpoint.create,
  scene: SceneEndpoint.create,
  media_player: MediaPlayerEndpoint.create,
  humidifier: HumidifierEndpoint.create,
  vacuum: VacuumEndpoint.create,
  valve: ValveEndpoint.create,
};
