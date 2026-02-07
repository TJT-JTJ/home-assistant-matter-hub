import type { EntityMappingConfig } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { DomainEndpoint } from "../domain-endpoint.js";
import { SwitchDomainEndpoint } from "./switch-endpoint.js";

const logger = Logger.get("DomainEndpointFactory");

/**
 * Registry of Vision 1 domain endpoint factories.
 * Domains listed here use the new DomainEndpoint architecture.
 * Domains NOT listed here fall back to LegacyEndpoint.
 */
const domainFactories: Record<
  string,
  (
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ) => DomainEndpoint | undefined
> = {
  switch: SwitchDomainEndpoint.create,
  input_boolean: SwitchDomainEndpoint.create,
};

/**
 * Try to create a Vision 1 DomainEndpoint for the given entity.
 * Returns undefined if no domain endpoint is registered for this entity's domain,
 * in which case the caller should fall back to LegacyEndpoint.
 */
export function createDomainEndpoint(
  registry: BridgeRegistry,
  entityId: string,
  mapping?: EntityMappingConfig,
): DomainEndpoint | undefined {
  const domain = entityId.split(".")[0];
  const factory = domainFactories[domain];
  if (!factory) {
    return undefined;
  }

  logger.info(
    `Creating Vision 1 DomainEndpoint for ${entityId} (domain: ${domain})`,
  );
  return factory(registry, entityId, mapping);
}
