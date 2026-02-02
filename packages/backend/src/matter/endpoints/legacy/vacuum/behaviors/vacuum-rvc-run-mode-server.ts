import {
  type VacuumDeviceAttributes,
  VacuumDeviceFeature,
  VacuumState,
} from "@home-assistant-matter-hub/common";
import { RvcRunMode } from "@matter/main/clusters";
import { testBit } from "../../../../../utils/test-bit.js";
import { HomeAssistantEntityBehavior } from "../../../../behaviors/home-assistant-entity-behavior.js";
import {
  RvcRunModeServer,
  RvcSupportedRunMode,
} from "../../../../behaviors/rvc-run-mode-server.js";
import {
  getRoomIndexFromMode,
  getRoomModeValue,
  parseVacuumRooms,
} from "../utils/parse-vacuum-rooms.js";

/**
 * Build supported modes from vacuum attributes.
 * This includes base modes (Idle, Cleaning) plus room-specific modes if available.
 */
function buildSupportedModes(
  attributes: VacuumDeviceAttributes,
): RvcRunMode.ModeOption[] {
  const modes: RvcRunMode.ModeOption[] = [
    {
      label: "Idle",
      mode: RvcSupportedRunMode.Idle,
      modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
    },
    {
      label: "Cleaning",
      mode: RvcSupportedRunMode.Cleaning,
      modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
    },
  ];

  const rooms = parseVacuumRooms(attributes);
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    modes.push({
      label: `Clean ${room.name}`,
      mode: getRoomModeValue(i),
      modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
    });
  }

  return modes;
}

const vacuumRvcRunModeConfig = {
  getCurrentMode: (entity: { state: string }) =>
    [VacuumState.cleaning].includes(entity.state as VacuumState)
      ? RvcSupportedRunMode.Cleaning
      : RvcSupportedRunMode.Idle,

  getSupportedModes: (entity: { attributes: unknown }) => {
    const attributes = entity.attributes as VacuumDeviceAttributes;
    return buildSupportedModes(attributes);
  },

  start: () => ({ action: "vacuum.start" }),
  returnToBase: () => ({ action: "vacuum.return_to_base" }),
  // biome-ignore lint/suspicious/noConfusingVoidType: Required by ValueSetter<void> interface
  pause: (
    _: void,
    agent: {
      get: (
        type: typeof HomeAssistantEntityBehavior,
      ) => HomeAssistantEntityBehavior;
    },
  ) => {
    const supportedFeatures =
      agent.get(HomeAssistantEntityBehavior).entity.state.attributes
        .supported_features ?? 0;
    if (testBit(supportedFeatures, VacuumDeviceFeature.PAUSE)) {
      return { action: "vacuum.pause" };
    }
    return { action: "vacuum.stop" };
  },

  cleanRoom: (
    roomMode: number,
    agent: {
      get: (
        type: typeof HomeAssistantEntityBehavior,
      ) => HomeAssistantEntityBehavior;
    },
  ) => {
    const entity = agent.get(HomeAssistantEntityBehavior).entity;
    const attributes = entity.state.attributes as VacuumDeviceAttributes;
    const rooms = parseVacuumRooms(attributes);
    const roomIndex = getRoomIndexFromMode(roomMode);

    if (roomIndex >= 0 && roomIndex < rooms.length) {
      const room = rooms[roomIndex];
      return {
        action: "vacuum.send_command",
        data: {
          command: "app_segment_clean",
          params: [room.id],
        },
      };
    }
    return { action: "vacuum.start" };
  },
};

/**
 * Create a VacuumRvcRunModeServer with initial supportedModes.
 * The modes MUST be provided at creation time for Matter.js initialization.
 */
export function createVacuumRvcRunModeServer(
  attributes: VacuumDeviceAttributes,
) {
  const supportedModes = buildSupportedModes(attributes);

  return RvcRunModeServer(vacuumRvcRunModeConfig, {
    supportedModes,
    currentMode: RvcSupportedRunMode.Idle,
  });
}

/** @deprecated Use createVacuumRvcRunModeServer instead */
export const VacuumRvcRunModeServer = RvcRunModeServer(vacuumRvcRunModeConfig);
