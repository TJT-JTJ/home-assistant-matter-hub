import type {
  VacuumDeviceAttributes,
  VacuumRoom,
} from "@home-assistant-matter-hub/common";
import type { ServiceArea } from "@matter/main/clusters";
import { ServiceAreaServer } from "../../../../behaviors/service-area-server.js";
import { parseVacuumRooms } from "../utils/parse-vacuum-rooms.js";

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
 * Create a VacuumServiceAreaServer with initial supportedAreas.
 * The areas MUST be provided at creation time for Matter.js initialization.
 * Following Matterbridge pattern: all state is set at creation time.
 *
 * Note: selectAreas only stores selected areas. Actual cleaning starts when
 * RvcRunMode.changeToMode(Cleaning) is called - the RvcRunModeServer reads
 * the selectedAreas from ServiceArea state and triggers the appropriate
 * vacuum service (dreame_vacuum.vacuum_clean_segment or vacuum.send_command).
 *
 * @param attributes - Vacuum device attributes
 * @param includeUnnamedRooms - If true, includes rooms with generic names like "Room 7". Default: false
 */
export function createVacuumServiceAreaServer(
  attributes: VacuumDeviceAttributes,
  includeUnnamedRooms = false,
) {
  const rooms = parseVacuumRooms(attributes, includeUnnamedRooms);
  const supportedAreas = roomsToAreas(rooms);

  return ServiceAreaServer({
    supportedAreas,
    selectedAreas: [],
    currentArea: null,
  });
}

/**
 * Export toAreaId for use by RvcRunModeServer to convert area IDs back to room IDs
 */
export { toAreaId };
