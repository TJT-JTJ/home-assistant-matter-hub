import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { DimmableLightDevice, OnOffLightDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

interface LightAttributes {
  brightness?: number;
  supported_color_modes?: string[];
  color_temp?: number;
  rgb_color?: [number, number, number];
  friendly_name?: string;
}

/**
 * LightEndpoint - Vision 1 implementation for light entities.
 *
 * This endpoint handles all light-related logic:
 * - Parses HA entity attributes (brightness, color_temp, rgb_color, etc.)
 * - Updates Matter behaviors based on entity state
 * - Handles Matter commands and calls HA services
 */
export class LightEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<LightEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attrs = state.attributes as LightAttributes | undefined;

    // Determine light capabilities from attributes
    const supportsBrightness =
      attrs?.brightness !== undefined ||
      attrs?.supported_color_modes?.includes("brightness");

    // Create appropriate device type based on capabilities
    const deviceType = supportsBrightness
      ? LightEndpoint.createDimmableType(
          entityId,
          state,
          entity,
          deviceRegistry,
        )
      : LightEndpoint.createOnOffType(entityId, state, entity, deviceRegistry);

    const customName = mapping?.customName;
    return new LightEndpoint(deviceType, entityId, customName);
  }

  private static createOnOffType(
    entityId: string,
    state: HomeAssistantEntityInformation["state"],
    entity: HomeAssistantEntityInformation["registry"],
    deviceRegistry: HomeAssistantEntityInformation["deviceRegistry"],
  ): EndpointType {
    return OnOffLightDevice.with(
      BasicInformationServer,
      IdentifyServer,
      HomeAssistantEntityBehavior.set({
        entity: {
          entity_id: entityId,
          state,
          registry: entity,
          deviceRegistry,
        } as HomeAssistantEntityInformation,
      }),
    );
  }

  private static createDimmableType(
    entityId: string,
    state: HomeAssistantEntityInformation["state"],
    entity: HomeAssistantEntityInformation["registry"],
    deviceRegistry: HomeAssistantEntityInformation["deviceRegistry"],
  ): EndpointType {
    return DimmableLightDevice.with(
      BasicInformationServer,
      IdentifyServer,
      HomeAssistantEntityBehavior.set({
        entity: {
          entity_id: entityId,
          state,
          registry: entity,
          deviceRegistry,
        } as HomeAssistantEntityInformation,
      }),
    );
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  /**
   * Handle HA entity state changes and update Matter behaviors.
   */
  protected onEntityStateChanged(entity: HomeAssistantEntityInformation): void {
    const { state } = entity;
    const attrs = state.attributes as LightAttributes | undefined;
    const isOn = state.state === "on";

    // Update OnOff cluster
    this.updateOnOffState(isOn);

    // Update LevelControl cluster if brightness is supported
    if (attrs?.brightness !== undefined) {
      // HA brightness is 0-255, Matter is 0-254
      const level = Math.min(254, Math.round(attrs.brightness));
      this.updateLevelState(level);
    }
  }

  /**
   * Handle Matter commands from controllers.
   */
  protected onBehaviorCommand(command: BehaviorCommand): void {
    switch (command.behavior) {
      case "OnOff":
        this.handleOnOffCommand(command);
        break;
      case "LevelControl":
        this.handleLevelControlCommand(command);
        break;
      default:
        // Unknown behavior, ignore
        break;
    }
  }

  private handleOnOffCommand(command: BehaviorCommand): void {
    switch (command.command) {
      case "on":
        this.callAction("light", "turn_on");
        break;
      case "off":
        this.callAction("light", "turn_off");
        break;
      case "toggle":
        this.callAction("light", "toggle");
        break;
    }
  }

  private handleLevelControlCommand(command: BehaviorCommand): void {
    const args = command.args as { level?: number } | undefined;

    switch (command.command) {
      case "moveToLevel":
      case "moveToLevelWithOnOff":
        if (args?.level !== undefined) {
          // Matter level is 0-254, HA brightness is 0-255
          const brightness = Math.min(255, args.level);
          this.callAction("light", "turn_on", { brightness });
        }
        break;
    }
  }

  private updateOnOffState(isOn: boolean): void {
    try {
      // This will be called by the endpoint, not by behaviors self-updating
      // For now, we log the intended update - full implementation requires
      // behavior modifications to accept endpoint-driven updates
      console.debug(`[LightEndpoint] OnOff state: ${isOn}`);
    } catch {
      // Endpoint may not be ready yet
    }
  }

  private updateLevelState(level: number): void {
    try {
      console.debug(`[LightEndpoint] Level state: ${level}`);
    } catch {
      // Endpoint may not be ready yet
    }
  }
}
