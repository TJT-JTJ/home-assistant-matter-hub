/**
 * Runtime patch for Matter.js LevelControl TLV schema.
 *
 * Google Home sends moveToLevel / moveToLevelWithOnOff commands without the
 * transitionTime field when adjusting brightness via the app slider for an
 * already-on light. The Matter spec defines transitionTime as nullable (allowed
 * to be null), but Matter.js marks it as a mandatory TLV field. When the field
 * is completely omitted, Matter.js throws ValidationMandatoryFieldMissingError
 * BEFORE our command handler can provide a default value.
 *
 * This patch makes transitionTime optional at the TLV schema level so that
 * omitted fields pass validation. Our LevelControlServer handler already
 * defaults null/undefined transitionTime to 0 (instant transition).
 *
 * Affects: TlvMoveToLevelRequest (moveToLevel + moveToLevelWithOnOff)
 *          TlvStepRequest (step + stepWithOnOff)
 *
 * See: https://github.com/RiDDiX/home-assistant-matter-hub/issues/41
 */

import { Logger } from "@matter/general";
import { LevelControl } from "@matter/main/clusters/level-control";

const logger = Logger.get("PatchLevelControlTlv");

export function patchLevelControlTlv(): void {
  let patched = 0;

  // Patch TlvMoveToLevelRequest (used by moveToLevel and moveToLevelWithOnOff)
  const moveToLevelFields = (
    LevelControl.TlvMoveToLevelRequest as unknown as {
      fieldDefinitions: Record<string, { id: number; optional?: boolean }>;
    }
  ).fieldDefinitions;

  if (moveToLevelFields?.transitionTime) {
    moveToLevelFields.transitionTime.optional = true;
    patched++;
  }

  // Patch TlvStepRequest (used by step and stepWithOnOff)
  const stepFields = (
    LevelControl.TlvStepRequest as unknown as {
      fieldDefinitions: Record<string, { id: number; optional?: boolean }>;
    }
  ).fieldDefinitions;

  if (stepFields?.transitionTime) {
    stepFields.transitionTime.optional = true;
    patched++;
  }

  if (patched > 0) {
    logger.info(
      `Patched ${patched} LevelControl TLV schema(s): transitionTime is now optional (Google Home compatibility)`,
    );
  } else {
    logger.warn(
      "Failed to patch LevelControl TLV schemas — field definitions not found. " +
        "Google Home brightness adjustment may not work.",
    );
  }
}
