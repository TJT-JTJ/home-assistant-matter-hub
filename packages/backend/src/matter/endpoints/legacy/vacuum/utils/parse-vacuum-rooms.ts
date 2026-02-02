import type {
  VacuumDeviceAttributes,
  VacuumRoom,
} from "@home-assistant-matter-hub/common";

/**
 * Parse a single room data source into VacuumRoom array.
 * Handles multiple formats:
 * - Direct array: [{ id: 1, name: "Kitchen" }, ...]
 * - Simple object: { 1: "Kitchen", 2: "Living Room", ... }
 * - Nested/Dreame format: { "Map Name": [{ id: 1, name: "Kitchen" }, ...] }
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
      // Format 2: Nested/Dreame format { "Map Name": [rooms...] }
      // The key is the map name, value is an array of room objects
      else if (Array.isArray(value)) {
        const nestedRooms = parseRoomData(value);
        rooms.push(...nestedRooms);
      }
    }
    return rooms;
  }

  return [];
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
 * @returns Array of normalized VacuumRoom objects, or empty array if no rooms found
 */
export function parseVacuumRooms(
  attributes: VacuumDeviceAttributes,
): VacuumRoom[] {
  // Try each attribute source in order, return first one with valid rooms
  // This ensures that if 'rooms' exists but has no valid data, we still check 'segments'
  const sources = [attributes.rooms, attributes.segments, attributes.room_list];

  for (const source of sources) {
    const rooms = parseRoomData(source);
    if (rooms.length > 0) {
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
 * Calculate the mode value for a specific room.
 * @param roomIndex - The index of the room in the rooms array (0-based)
 * @returns The mode value for this room
 */
export function getRoomModeValue(roomIndex: number): number {
  return ROOM_MODE_BASE + roomIndex;
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
 * Get the room index from a room mode value.
 * @param mode - The room mode value
 * @returns The room index (0-based), or -1 if not a room mode
 */
export function getRoomIndexFromMode(mode: number): number {
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
