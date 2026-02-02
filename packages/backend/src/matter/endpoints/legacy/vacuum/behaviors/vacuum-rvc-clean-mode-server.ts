import type { VacuumDeviceAttributes } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { RvcCleanMode } from "@matter/main/clusters";
import {
  RvcCleanModeServer,
  type RvcCleanModeServerInitialState,
} from "../../../../behaviors/rvc-clean-mode-server.js";
import { isDreameVacuum } from "../utils/parse-vacuum-rooms.js";

const logger = Logger.get("VacuumRvcCleanModeServer");

/**
 * Dreame cleaning mode mapping.
 * Dreame uses these mode names: Sweeping, Mopping, Sweeping and mopping, Mopping after sweeping
 */
export enum DreameCleaningMode {
  Sweeping = 0,
  Mopping = 1,
  SweepingAndMopping = 2,
  MoppingAfterSweeping = 3,
}

/**
 * Map Dreame cleaning mode string to our internal mode value
 */
function parseDreameCleaningMode(modeString: string | undefined): number {
  if (!modeString) return DreameCleaningMode.Sweeping;

  const mode = modeString.toLowerCase();
  if (mode.includes("mopping after") || mode.includes("after sweeping")) {
    return DreameCleaningMode.MoppingAfterSweeping;
  }
  if (mode.includes("and") || mode.includes("sweeping and mopping")) {
    return DreameCleaningMode.SweepingAndMopping;
  }
  if (mode === "mopping" || mode.includes("mop")) {
    return DreameCleaningMode.Mopping;
  }
  return DreameCleaningMode.Sweeping;
}

/**
 * Build supported cleaning modes for vacuum.
 * For Dreame vacuums, these are: Sweeping, Mopping, Sweeping and mopping, Mopping after sweeping
 */
function buildSupportedCleanModes(): RvcCleanMode.ModeOption[] {
  return [
    {
      label: "Sweeping",
      mode: DreameCleaningMode.Sweeping,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
    },
    {
      label: "Mopping",
      mode: DreameCleaningMode.Mopping,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }],
    },
    {
      label: "Sweeping and mopping",
      mode: DreameCleaningMode.SweepingAndMopping,
      modeTags: [{ value: RvcCleanMode.ModeTag.DeepClean }],
    },
    {
      label: "Mopping after sweeping",
      mode: DreameCleaningMode.MoppingAfterSweeping,
      modeTags: [{ value: RvcCleanMode.ModeTag.VacuumThenMop }],
    },
  ];
}

/**
 * Get the Dreame cleaning mode string from our internal mode value
 */
function getDreameCleaningModeString(mode: number): string {
  switch (mode) {
    case DreameCleaningMode.Mopping:
      return "Mopping";
    case DreameCleaningMode.SweepingAndMopping:
      return "Sweeping and mopping";
    case DreameCleaningMode.MoppingAfterSweeping:
      return "Mopping after sweeping";
    case DreameCleaningMode.Sweeping:
    default:
      return "Sweeping";
  }
}

const vacuumRvcCleanModeConfig = {
  getCurrentMode: (entity: { attributes: unknown }) => {
    const attributes = entity.attributes as VacuumDeviceAttributes & {
      cleaning_mode?: string;
    };
    const currentMode = parseDreameCleaningMode(attributes.cleaning_mode);
    logger.debug(
      `Current cleaning mode: "${attributes.cleaning_mode}" -> ${getDreameCleaningModeString(currentMode)}`,
    );
    return currentMode;
  },

  getSupportedModes: () => buildSupportedCleanModes(),

  setCleanMode: (mode: number) => {
    const modeString = getDreameCleaningModeString(mode);
    logger.info(`Setting cleaning mode to: ${modeString} (mode=${mode})`);

    // Dreame vacuums use select entity for cleaning mode
    // The service is typically select.select_option
    return {
      action: "select.select_option",
      data: {
        option: modeString,
      },
      // Note: This targets the vacuum entity, but Dreame uses a separate select entity
      // The user may need to configure this via entity mapping
    };
  },
};

/**
 * Create a VacuumRvcCleanModeServer with Dreame cleaning modes.
 */
export function createVacuumRvcCleanModeServer(
  attributes: VacuumDeviceAttributes,
): ReturnType<typeof RvcCleanModeServer> {
  const supportedModes = buildSupportedCleanModes();

  logger.info(
    `Creating VacuumRvcCleanModeServer with ${supportedModes.length} cleaning modes`,
  );
  logger.info(`Modes: ${supportedModes.map((m) => m.label).join(", ")}`);

  const initialState: RvcCleanModeServerInitialState = {
    supportedModes,
    currentMode: DreameCleaningMode.Sweeping,
  };

  return RvcCleanModeServer(vacuumRvcCleanModeConfig, initialState);
}

/**
 * Check if vacuum supports cleaning modes (Dreame vacuums typically do)
 */
export function supportsCleaningModes(
  attributes: VacuumDeviceAttributes,
): boolean {
  return isDreameVacuum(attributes);
}
