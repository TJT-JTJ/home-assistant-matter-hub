import type { HomeAssistantEntityState } from "@home-assistant-matter-hub/common";
import { Service } from "../../core/ioc/service.js";
import type { HomeAssistantRegistry } from "../home-assistant/home-assistant-registry.js";

/**
 * Service that provides access to Home Assistant entity states.
 * Used by behaviors that need to read states from entities other than their own
 * (e.g., Air Purifier reading filter life from a separate sensor entity).
 */
export class EntityStateProvider extends Service {
  constructor(private readonly registry: HomeAssistantRegistry) {
    super("EntityStateProvider");
  }

  /**
   * Get the current state of an entity by its ID.
   * Returns undefined if the entity doesn't exist or has no state.
   */
  getState(entityId: string): HomeAssistantEntityState | undefined {
    return this.registry.states[entityId];
  }

  /**
   * Get a numeric value from an entity's state.
   * Parses the state string as a number, returns null if not a valid number.
   */
  getNumericState(entityId: string): number | null {
    const state = this.getState(entityId);
    if (!state) {
      return null;
    }
    const value = Number.parseFloat(state.state);
    if (Number.isNaN(value)) {
      return null;
    }
    return value;
  }
}
