import type {
  VacuumDeviceAttributes,
  VacuumRoom,
} from "@home-assistant-matter-hub/common";
import { startCase } from "lodash-es";

/**
 * Format a room name from snake_case to Title Case.
 * Example: "dining_room" -> "Dining Room"
 */
function formatRoomName(name: string): string {
  return startCase(name);
}

/**
 * Parse a single room data source into VacuumRoom array.
 * Handles multiple formats:
 * - Direct array: [{ id: 1, name: "Kitchen" }, ...]
 * - Simple object: { 1: "Kitchen", 2: "Living Room", ... }
 * - Nested/Dreame format: { "Map Name": [{ id: 1, name: "Kitchen" }, ...] }
 * - Ecovacs format 1: { dining_room: 0, kitchen: 4, ... }
 * - Ecovacs format 2: { bedroom: [1, 3], corridor: 2, ... }
 */
function parseRoomData(roomsData: unknown): VacuumRoom[] {
  if (!roomsData) {
    return [];
  }

  // Handle direct array format
  if (Array.isArray(roomsData)) {
    return roomsData
      .filter((room): room is VacuumRoom => {
        return (
          room != null &&
          typeof room === "object" &&
          "id" in room &&
          "name" in room &&
          (typeof room.id === "number" || typeof room.id === "string") &&
          typeof room.name === "string"
        );
      })
      .map((room) => ({
        id: room.id,
        name: room.name,
        icon: room.icon,
      }));
  }

  // Handle object formats
  if (typeof roomsData === "object" && roomsData !== null) {
    const rooms: VacuumRoom[] = [];
    for (const [key, value] of Object.entries(roomsData)) {
      // Format 1: Simple object { id: name, ... }
      if (typeof value === "string") {
        const id = /^\d+$/.test(key) ? Number.parseInt(key, 10) : key;
        rooms.push({ id, name: value });
      }
      // Format 2: Ecovacs format 1 { dining_room: 0, kitchen: 4, ... }
      // Key is room name, value is numeric ID
      else if (typeof value === "number") {
        const name = formatRoomName(key);
        rooms.push({ id: value, name });
      }
      // Format 3: Nested/Dreame format { "Map Name": [rooms...] }
      // The key is the map name, value is an array of room objects
      else if (Array.isArray(value)) {
        // Check if it's an array of room objects (Dreame format)
        if (
          value.length > 0 &&
          typeof value[0] === "object" &&
          value[0] !== null &&
          "id" in value[0]
        ) {
          const nestedRooms = parseRoomData(value);
          rooms.push(...nestedRooms);
        }
        // Ecovacs format 2: array of numeric IDs { bedroom: [1, 3], ... }
        else if (value.length > 0 && typeof value[0] === "number") {
          const roomName = formatRoomName(key);
          // If multiple IDs, append numbers: "Bedroom 1", "Bedroom 2"
          if (value.length > 1) {
            value.forEach((id: number, index: number) => {
              rooms.push({ id, name: `${roomName} ${index + 1}` });
            });
          } else {
            // Single ID, use room name as-is
            rooms.push({ id: value[0], name: roomName });
          }
        }
      }
    }
    return rooms;
  }

  return [];
}

/**
 * Regular expression to match generic/unnamed room names.
 * Matches patterns like "Room 1", "Room 7", "Raum 3", etc.
 * These are typically auto-generated names for unmapped/hidden rooms.
 */
const UNNAMED_ROOM_PATTERN =
  /^(Room|Raum|Zimmer|Chambre|Habitación|Stanza)\s+\d+$/i;

/**
 * Check if a room name appears to be a generic/unnamed room.
 * Generic rooms typically have names like "Room 7" which are auto-generated
 * by vacuum integrations for unmapped or hidden rooms.
 */
export function isUnnamedRoom(roomName: string): boolean {
  return UNNAMED_ROOM_PATTERN.test(roomName.trim());
}

/**
 * Parse vacuum rooms from various attribute formats.
 * Different integrations store rooms in different formats:
 * - Array of VacuumRoom objects: [{ id: 1, name: "Kitchen" }, ...]
 * - Record/Object: { 1: "Kitchen", 2: "Living Room", ... }
 * - Nested/Dreame: { "Map Name": [{ id: 1, name: "Room" }, ...] }
 * - May be in 'rooms', 'segments', or 'room_list' attribute
 *
 * Tries each attribute in order and returns the first one with valid rooms.
 *
 * @param attributes - Vacuum device attributes
 * @param includeUnnamedRooms - If false (default), filters out rooms with generic names like "Room 7"
 * @returns Array of normalized VacuumRoom objects, or empty array if no rooms found
 */
export function parseVacuumRooms(
  attributes: VacuumDeviceAttributes,
  includeUnnamedRooms = false,
): VacuumRoom[] {
  // Try each attribute source in order, return first one with valid rooms
  // This ensures that if 'rooms' exists but has no valid data, we still check 'segments'
  const sources = [attributes.rooms, attributes.segments, attributes.room_list];

  for (const source of sources) {
    let rooms = parseRoomData(source);
    if (rooms.length > 0) {
      // Filter out unnamed/generic rooms unless explicitly included
      if (!includeUnnamedRooms) {
        rooms = rooms.filter((room) => !isUnnamedRoom(room.name));
      }
      return rooms;
    }
  }

  return [];
}

/**
 * Base mode value for room-specific cleaning modes.
 * Room modes start at 100 to avoid conflicts with standard modes (Idle=0, Cleaning=1).
 */
export const ROOM_MODE_BASE = 100;

/**
 * Convert a room ID to a numeric mode-compatible value.
 * This ensures consistency between ServiceArea and RvcRunMode.
 */
function roomIdToNumeric(roomId: string | number): number {
  if (typeof roomId === "number") {
    return roomId;
  }
  // For string IDs, use a simple hash (same logic as toAreaId in service-area-server)
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    const char = roomId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Calculate the mode value for a specific room.
 * Uses the room's actual ID (not array index) to ensure consistency with ServiceArea.
 * @param room - The room object
 * @returns The mode value for this room
 */
export function getRoomModeValue(room: VacuumRoom): number {
  return ROOM_MODE_BASE + roomIdToNumeric(room.id);
}

/**
 * Check if a mode value represents a room-specific cleaning mode.
 * @param mode - The mode value to check
 * @returns True if this is a room mode, false otherwise
 */
export function isRoomMode(mode: number): boolean {
  return mode >= ROOM_MODE_BASE;
}

/**
 * Get the room ID from a room mode value.
 * @param mode - The room mode value
 * @returns The numeric room ID, or -1 if not a room mode
 */
export function getRoomIdFromMode(mode: number): number {
  if (!isRoomMode(mode)) {
    return -1;
  }
  return mode - ROOM_MODE_BASE;
}

/**
 * Detect if the vacuum uses Dreame integration format.
 * Dreame vacuums have rooms nested under a map name key: { "Map Name": [rooms...] }
 * This is different from Roborock/Xiaomi which use flat arrays or simple objects.
 */
export function isDreameVacuum(attributes: VacuumDeviceAttributes): boolean {
  const roomsData = attributes.rooms;
  if (!roomsData || typeof roomsData !== "object" || Array.isArray(roomsData)) {
    return false;
  }

  // Check if any value is an array (Dreame nested format)
  for (const value of Object.values(roomsData)) {
    if (Array.isArray(value)) {
      return true;
    }
  }
  return false;
}
