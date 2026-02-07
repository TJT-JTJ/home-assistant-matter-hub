import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { DomainEndpoint } from "../domain-endpoint.js";

/**
 * A factory function that creates an EndpointType from HA entity state.
 * This is the same signature as the legacy device factory functions
 * (e.g., SwitchDevice, LightDevice, CoverDevice, etc.).
 */
export type DeviceFactory = (
  homeAssistant: HomeAssistantEntityBehavior.State,
) => EndpointType | undefined;

/**
 * Generic Vision 1 domain endpoint that wraps any existing legacy device factory.
 *
 * This allows migrating ALL domains to the DomainEndpoint architecture without
 * rewriting each one individually. The existing factory functions (SwitchDevice,
 * LightDevice, etc.) are reused as-is.
 *
 * For domains that need multi-entity support or special orchestration,
 * create a specific DomainEndpoint subclass instead.
 */
export class GenericDomainEndpoint extends DomainEndpoint {
  static createFactory(
    factory: DeviceFactory,
  ): (
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ) => GenericDomainEndpoint | undefined {
    return (registry, entityId, mapping) => {
      return GenericDomainEndpoint.create(factory, registry, entityId, mapping);
    };
  }

  static create(
    factory: DeviceFactory,
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): GenericDomainEndpoint | undefined {
    const state = registry.initialState(entityId);
    if (!state) {
      return undefined;
    }

    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    const haState: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      },
      customName: mapping?.customName,
      mapping,
      managedByEndpoint: true,
    };

    const type = factory(haState);
    if (!type) {
      return undefined;
    }

    return new GenericDomainEndpoint(type, entityId, registry, mapping);
  }

  protected updateEntity(_entity: HomeAssistantEntityInformation): void {
    // Phase 1: Behaviors self-update via onChange. Nothing extra needed here.
    // Phase 2: Domain-specific subclasses will override this to set behavior state directly.
  }
}
