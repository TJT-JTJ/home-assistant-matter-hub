import type { Behavior } from "@matter/main";
import type {
  BehaviorCommand,
  DomainEndpoint,
} from "../endpoints/domain/domain-endpoint.js";

/**
 * Helper to send commands from a behavior to the parent DomainEndpoint.
 *
 * Vision 1 Architecture:
 * - Behaviors do NOT update themselves
 * - Behaviors do NOT call HA actions directly
 * - Instead, behaviors notify their parent endpoint via callbacks
 * - The endpoint decides what HA actions to call
 */
export function notifyEndpoint(
  behavior: Behavior,
  behaviorName: string,
  command: string,
  args?: unknown,
): void {
  // Find the parent endpoint
  const endpoint = behavior.endpoint;
  if (!endpoint) {
    return;
  }

  // Check if it's a DomainEndpoint with receiveBehaviorCommand
  if (
    "receiveBehaviorCommand" in endpoint &&
    typeof endpoint.receiveBehaviorCommand === "function"
  ) {
    const domainEndpoint = endpoint as unknown as DomainEndpoint;
    const cmd: BehaviorCommand = {
      behavior: behaviorName,
      command,
      args,
    };
    domainEndpoint.receiveBehaviorCommand(cmd);
  }
}

/**
 * Command types that behaviors can send to their parent endpoint.
 */
export const VacuumCommands = {
  START: "start",
  STOP: "stop",
  PAUSE: "pause",
  RETURN_TO_BASE: "returnToBase",
  CLEAN_ROOM: "cleanRoom",
} as const;

export const ThermostatCommands = {
  SET_TEMPERATURE: "setTemperature",
  SET_TEMPERATURE_RANGE: "setTemperatureRange",
  SET_SYSTEM_MODE: "setSystemMode",
} as const;

export const LightCommands = {
  TURN_ON: "turnOn",
  TURN_OFF: "turnOff",
  SET_BRIGHTNESS: "setBrightness",
  SET_COLOR: "setColor",
  SET_COLOR_TEMPERATURE: "setColorTemperature",
} as const;

export const CoverCommands = {
  OPEN: "open",
  CLOSE: "close",
  STOP: "stop",
  SET_POSITION: "setPosition",
  SET_TILT: "setTilt",
} as const;

export const FanCommands = {
  TURN_ON: "turnOn",
  TURN_OFF: "turnOff",
  SET_SPEED: "setSpeed",
  SET_DIRECTION: "setDirection",
} as const;

export const LockCommands = {
  LOCK: "lock",
  UNLOCK: "unlock",
} as const;
