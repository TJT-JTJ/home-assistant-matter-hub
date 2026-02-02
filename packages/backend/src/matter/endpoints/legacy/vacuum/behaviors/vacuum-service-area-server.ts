import type {
  VacuumDeviceAttributes,
  VacuumRoom,
} from "@home-assistant-matter-hub/common";
import type { ServiceArea } from "@matter/main/clusters";
import { HomeAssistantEntityBehavior } from "../../../../behaviors/home-assistant-entity-behavior.js";
import {
  ServiceAreaServer,
  type ServiceAreaServerConfig,
} from "../../../../behaviors/service-area-server.js";
import {
  isDreameVacuum,
  parseVacuumRooms,
} from "../utils/parse-vacuum-rooms.js";

/**
 * Convert vacuum room ID to a Matter-compatible area ID.
 * Room IDs from HA can be strings or numbers, but Matter requires uint32.
 */
function toAreaId(roomId: string | number): number {
  if (typeof roomId === "number") {
    return roomId;
  }
  // For string IDs, use a simple hash
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    const char = roomId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Convert VacuumRoom array to Matter ServiceArea.Area array
 */
function roomsToAreas(rooms: VacuumRoom[]): ServiceArea.Area[] {
  return rooms.map((room) => ({
    areaId: toAreaId(room.id),
    mapId: null,
    areaInfo: {
      locationInfo: {
        locationName: room.name,
        floorNumber: null,
        areaType: null,
      },
      landmarkInfo: null,
    },
  }));
}

/**
 * Create config for ServiceArea - only needs cleanAreas action
 */
function createVacuumServiceAreaConfig(
  _attributes: VacuumDeviceAttributes,
): ServiceAreaServerConfig {
  return {
    cleanAreas: (areaIds, agent) => {
      const entity = agent.get(HomeAssistantEntityBehavior).entity;
      const currentAttributes = entity.state
        .attributes as VacuumDeviceAttributes;
      const currentRooms = parseVacuumRooms(currentAttributes);

      // Convert Matter area IDs back to HA room IDs
      const roomIds: (string | number)[] = [];
      for (const areaId of areaIds) {
        const room = currentRooms.find((r) => toAreaId(r.id) === areaId);
        if (room) {
          roomIds.push(room.id);
        }
      }

      if (roomIds.length === 0) {
        // No valid rooms, just start regular cleaning
        return { action: "vacuum.start" };
      }

      // Dreame vacuums use their own service
      if (isDreameVacuum(currentAttributes)) {
        return {
          action: "dreame_vacuum.vacuum_clean_segment",
          data: {
            segments: roomIds.length === 1 ? roomIds[0] : roomIds,
          },
        };
      }

      // Roborock/Xiaomi vacuums use vacuum.send_command with app_segment_clean
      return {
        action: "vacuum.send_command",
        data: {
          command: "app_segment_clean",
          params: roomIds,
        },
      };
    },
  };
}

/**
 * Create a VacuumServiceAreaServer with initial supportedAreas.
 * The areas MUST be provided at creation time for Matter.js initialization.
 * Following Matterbridge pattern: all state is set at creation time.
 */
export function createVacuumServiceAreaServer(
  attributes: VacuumDeviceAttributes,
) {
  const rooms = parseVacuumRooms(attributes);
  const supportedAreas = roomsToAreas(rooms);
  const config = createVacuumServiceAreaConfig(attributes);

  return ServiceAreaServer(config, {
    supportedAreas,
    selectedAreas: [],
    currentArea: null,
  });
}
