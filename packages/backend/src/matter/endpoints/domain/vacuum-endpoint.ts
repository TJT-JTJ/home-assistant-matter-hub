import {
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
  type VacuumDeviceAttributes,
  VacuumDeviceFeature,
  VacuumState,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { RvcOperationalState } from "@matter/main/clusters";
import { RvcRunMode } from "@matter/main/clusters/rvc-run-mode";
import { RoboticVacuumCleanerDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { testBit } from "../../../utils/test-bit.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { VacuumCommands } from "../../behaviors/callback-behavior.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { VacuumOnOffServer } from "../legacy/vacuum/behaviors/vacuum-on-off-server.js";
import { VacuumPowerSourceServer } from "../legacy/vacuum/behaviors/vacuum-power-source-server.js";
import {
  getRoomIndexFromMode,
  getRoomModeValue,
  parseVacuumRooms,
} from "../legacy/vacuum/utils/parse-vacuum-rooms.js";
import { VacuumOperationalStateBehavior } from "./behaviors/vacuum-operational-state-behavior.js";
import {
  VacuumRunMode,
  VacuumRunModeBehavior,
} from "./behaviors/vacuum-run-mode-behavior.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const VacuumEndpointType = RoboticVacuumCleanerDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  VacuumOperationalStateBehavior,
  VacuumRunModeBehavior,
);

/**
 * VacuumEndpoint - Vision 1 implementation for vacuum entities.
 *
 * This endpoint:
 * - Receives entity state changes and updates behavior states
 * - Receives command callbacks from behaviors and calls HA services
 * - Can access neighbor entities for room information
 */
export class VacuumEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<VacuumEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attributes = state.attributes as VacuumDeviceAttributes;
    const supportedFeatures = attributes.supported_features ?? 0;

    let device = VacuumEndpointType;
    if (testBit(supportedFeatures, VacuumDeviceFeature.START)) {
      device = device.with(VacuumOnOffServer);
    }
    // Add PowerSource if BATTERY feature is set OR battery_level attribute exists
    const hasBatteryLevel =
      attributes.battery_level != null &&
      typeof attributes.battery_level === "number";
    if (
      testBit(supportedFeatures, VacuumDeviceFeature.BATTERY) ||
      hasBatteryLevel
    ) {
      device = device.with(VacuumPowerSourceServer);
    }

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const customName = mapping?.customName;
    return new VacuumEndpoint(
      device.set({ homeAssistantEntity }),
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

  /**
   * Called when HA entity state changes.
   * Updates behavior states based on entity attributes.
   */
  protected onEntityStateChanged(entity: HomeAssistantEntityInformation): void {
    if (!entity.state) return;

    const attributes = entity.state.attributes as VacuumDeviceAttributes;
    const vacuumState = entity.state.state as VacuumState;

    // Update VacuumRunModeBehavior
    try {
      const currentMode =
        vacuumState === VacuumState.cleaning
          ? VacuumRunMode.Cleaning
          : VacuumRunMode.Idle;
      const supportedModes = this.buildSupportedModes(attributes);

      this.setStateOf(VacuumRunModeBehavior, {
        currentMode,
        supportedModes,
      });
    } catch {
      // Behavior may not be initialized yet
    }

    // Update VacuumOperationalStateBehavior
    try {
      const operationalState = this.mapStateToOperationalState(vacuumState);
      this.setStateOf(VacuumOperationalStateBehavior, {
        operationalState,
      });
    } catch {
      // Behavior may not be initialized yet
    }
  }

  /**
   * Build supported modes including room-specific modes.
   */
  private buildSupportedModes(
    attributes: VacuumDeviceAttributes,
  ): RvcRunMode.ModeOption[] {
    const baseModes: RvcRunMode.ModeOption[] = [
      {
        label: "Idle",
        mode: VacuumRunMode.Idle,
        modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
      },
      {
        label: "Cleaning",
        mode: VacuumRunMode.Cleaning,
        modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
      },
    ];

    const rooms = parseVacuumRooms(attributes);
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      baseModes.push({
        label: `Clean ${room.name}`,
        mode: getRoomModeValue(i),
        modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
      });
    }

    return baseModes;
  }

  /**
   * Map HA vacuum state to Matter operational state.
   */
  private mapStateToOperationalState(
    state: VacuumState,
  ): RvcOperationalState.OperationalState {
    switch (state) {
      case VacuumState.cleaning:
        return RvcOperationalState.OperationalState.Running;
      case VacuumState.paused:
        return RvcOperationalState.OperationalState.Paused;
      case VacuumState.returning:
        return RvcOperationalState.OperationalState.SeekingCharger;
      case VacuumState.docked:
        return RvcOperationalState.OperationalState.Docked;
      case VacuumState.error:
        return RvcOperationalState.OperationalState.Error;
      default:
        return RvcOperationalState.OperationalState.Stopped;
    }
  }

  /**
   * Handle commands from behaviors and call HA services.
   */
  protected onBehaviorCommand(command: BehaviorCommand): void {
    const attributes = this.stateOf(HomeAssistantEntityBehavior).entity.state
      ?.attributes as VacuumDeviceAttributes | undefined;
    const supportedFeatures = attributes?.supported_features ?? 0;

    switch (command.command) {
      case VacuumCommands.START:
        this.callAction("vacuum", "start");
        break;

      case VacuumCommands.STOP:
        this.callAction("vacuum", "stop");
        break;

      case VacuumCommands.PAUSE:
        if (testBit(supportedFeatures, VacuumDeviceFeature.PAUSE)) {
          this.callAction("vacuum", "pause");
        } else {
          this.callAction("vacuum", "stop");
        }
        break;

      case VacuumCommands.RETURN_TO_BASE:
        this.callAction("vacuum", "return_to_base");
        break;

      case VacuumCommands.CLEAN_ROOM: {
        const args = command.args as { roomModeValue: number } | undefined;
        if (args && attributes) {
          const rooms = parseVacuumRooms(attributes);
          const roomIndex = getRoomIndexFromMode(args.roomModeValue);
          if (roomIndex >= 0 && roomIndex < rooms.length) {
            const room = rooms[roomIndex];
            this.callAction("vacuum", "send_command", {
              command: "app_segment_clean",
              params: [room.id],
            });
          } else {
            this.callAction("vacuum", "start");
          }
        }
        break;
      }

      default:
        console.warn(
          `[VacuumEndpoint] Unknown command: ${command.behavior}.${command.command}`,
        );
    }
  }
}
