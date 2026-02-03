import {
  type VacuumDeviceAttributes,
  VacuumDeviceFeature,
  VacuumState,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { Agent } from "@matter/main";
import { ServiceAreaBehavior } from "@matter/main/behaviors";
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
  isDreameVacuum,
  parseVacuumRooms,
} from "../utils/parse-vacuum-rooms.js";
import { toAreaId } from "./vacuum-service-area-server.js";

const logger = Logger.get("VacuumRvcRunModeServer");

/**
 * Build supported modes from vacuum attributes.
 * This includes base modes (Idle, Cleaning) plus room-specific modes if available.
 *
 * @param attributes - Vacuum device attributes
 * @param includeUnnamedRooms - If true, includes rooms with generic names like "Room 7". Default: false
 */
function buildSupportedModes(
  attributes: VacuumDeviceAttributes,
  includeUnnamedRooms = false,
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

  const rooms = parseVacuumRooms(attributes, includeUnnamedRooms);
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
  getCurrentMode: (entity: { state: string }) => {
    const state = entity.state as VacuumState;
    // All cleaning-related states should map to Cleaning mode
    const cleaningStates: string[] = [
      VacuumState.cleaning,
      VacuumState.segment_cleaning,
      VacuumState.zone_cleaning,
      VacuumState.spot_cleaning,
      VacuumState.mop_cleaning,
    ];
    const isCleaning = cleaningStates.includes(state);
    logger.info(
      `Vacuum state: "${state}", isCleaning: ${isCleaning}, currentMode: ${isCleaning ? "Cleaning" : "Idle"}`,
    );
    return isCleaning ? RvcSupportedRunMode.Cleaning : RvcSupportedRunMode.Idle;
  },

  getSupportedModes: (entity: { attributes: unknown }) => {
    const attributes = entity.attributes as VacuumDeviceAttributes;
    return buildSupportedModes(attributes);
  },

  start: (_: void, agent: Agent) => {
    // Check if there are selected areas from ServiceArea
    try {
      const serviceArea = agent.get(ServiceAreaBehavior);
      const selectedAreas = serviceArea.state.selectedAreas;

      if (selectedAreas && selectedAreas.length > 0) {
        const entity = agent.get(HomeAssistantEntityBehavior).entity;
        const attributes = entity.state.attributes as VacuumDeviceAttributes;
        const rooms = parseVacuumRooms(attributes);

        // Convert area IDs back to room IDs
        const roomIds: (string | number)[] = [];
        for (const areaId of selectedAreas) {
          const room = rooms.find((r) => toAreaId(r.id) === areaId);
          if (room) {
            roomIds.push(room.id);
          }
        }

        if (roomIds.length > 0) {
          logger.info(
            `Starting cleaning with selected areas: ${roomIds.join(", ")}`,
          );

          // Clear selected areas after use
          serviceArea.state.selectedAreas = [];

          // Dreame vacuums use their own service
          if (isDreameVacuum(attributes)) {
            return {
              action: "dreame_vacuum.vacuum_clean_segment",
              data: {
                segments: roomIds.length === 1 ? roomIds[0] : roomIds,
              },
            };
          }

          // Roborock/Xiaomi vacuums use vacuum.send_command
          return {
            action: "vacuum.send_command",
            data: {
              command: "app_segment_clean",
              params: roomIds,
            },
          };
        }
      }
    } catch {
      // ServiceArea not available, fall through to regular start
    }

    logger.info("Starting regular cleaning (no areas selected)");
    return { action: "vacuum.start" };
  },
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

      // Dreame vacuums use their own service: dreame_vacuum.vacuum_clean_segment
      if (isDreameVacuum(attributes)) {
        logger.debug(
          `Dreame vacuum detected, using dreame_vacuum.vacuum_clean_segment for room ${room.name} (id: ${room.id})`,
        );
        return {
          action: "dreame_vacuum.vacuum_clean_segment",
          data: {
            segments: room.id,
          },
        };
      }

      // Roborock/Xiaomi vacuums use vacuum.send_command with app_segment_clean
      logger.debug(
        `Using vacuum.send_command with app_segment_clean for room ${room.name} (id: ${room.id})`,
      );
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
 *
 * @param attributes - Vacuum device attributes
 * @param includeUnnamedRooms - If true, includes rooms with generic names like "Room 7". Default: false
 */
export function createVacuumRvcRunModeServer(
  attributes: VacuumDeviceAttributes,
  includeUnnamedRooms = false,
) {
  // Get all rooms first for logging
  const allRooms = parseVacuumRooms(attributes, true);
  const rooms = includeUnnamedRooms
    ? allRooms
    : parseVacuumRooms(attributes, false);
  const filteredCount = allRooms.length - rooms.length;

  const supportedModes = buildSupportedModes(attributes, includeUnnamedRooms);

  logger.info(
    `Creating VacuumRvcRunModeServer with ${rooms.length} rooms, ${supportedModes.length} total modes`,
  );
  if (rooms.length > 0) {
    logger.info(`Rooms found: ${rooms.map((r) => r.name).join(", ")}`);
  }
  if (filteredCount > 0) {
    const filtered = allRooms.filter((r) => !rooms.some((x) => x.id === r.id));
    logger.info(
      `Filtered out ${filteredCount} unnamed room(s): ${filtered.map((r) => r.name).join(", ")}`,
    );
  }
  if (allRooms.length === 0) {
    logger.debug(
      `No rooms found. Attributes: rooms=${JSON.stringify(attributes.rooms)}, segments=${JSON.stringify(attributes.segments)}, room_list=${attributes.room_list}`,
    );
  }

  return RvcRunModeServer(vacuumRvcRunModeConfig, {
    supportedModes,
    currentMode: RvcSupportedRunMode.Idle,
  });
}

/** @deprecated Use createVacuumRvcRunModeServer instead */
export const VacuumRvcRunModeServer = RvcRunModeServer(vacuumRvcRunModeConfig);
