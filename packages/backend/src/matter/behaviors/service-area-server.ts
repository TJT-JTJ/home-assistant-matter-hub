import { Logger } from "@matter/general";
import { ServiceAreaBehavior } from "@matter/main/behaviors";
import { ServiceArea } from "@matter/main/clusters";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueSetter } from "./utils/cluster-config.js";

const logger = Logger.get("ServiceAreaServer");

export interface ServiceAreaServerConfig {
  /** Clean selected areas - called when selectAreas command is received */
  cleanAreas: ValueSetter<number[]>;
}

/**
 * ServiceArea server implementation following the Matterbridge pattern:
 * - No custom initialize() that calls super.initialize()
 * - Only override command handlers
 * - State is set via .set() at endpoint creation time
 */
class ServiceAreaServerBase extends ServiceAreaBehavior {
  declare state: ServiceAreaServerBase.State;

  override selectAreas(
    request: ServiceArea.SelectAreasRequest,
  ): ServiceArea.SelectAreasResponse {
    const { newAreas } = request;
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);

    logger.info(
      `ServiceArea selectAreas called with: ${JSON.stringify(newAreas)}`,
    );

    // Remove duplicates
    const uniqueAreas = [...new Set(newAreas)];

    // Validate that all requested areas exist in supportedAreas
    const supportedAreaIds = this.state.supportedAreas.map((a) => a.areaId);
    const invalidAreas = uniqueAreas.filter(
      (id) => !supportedAreaIds.includes(id),
    );

    if (invalidAreas.length > 0) {
      logger.warn(`Invalid area IDs requested: ${invalidAreas.join(", ")}`);
      return {
        status: ServiceArea.SelectAreasStatus.UnsupportedArea,
        statusText: `Invalid area IDs: ${invalidAreas.join(", ")}`,
      };
    }

    // Call Home Assistant to start cleaning the selected areas
    homeAssistant.callAction(
      this.state.config.cleanAreas(uniqueAreas, this.agent),
    );

    // Update selected areas
    this.state.selectedAreas = uniqueAreas;

    logger.info(
      `ServiceArea: Selected ${uniqueAreas.length} areas for cleaning`,
    );
    return {
      status: ServiceArea.SelectAreasStatus.Success,
      statusText: "Areas selected for cleaning",
    };
  }

  override skipArea(
    _request: ServiceArea.SkipAreaRequest,
  ): ServiceArea.SkipAreaResponse {
    // Skip area is not commonly supported by vacuum integrations
    return {
      status: ServiceArea.SkipAreaStatus.InvalidInMode,
      statusText: "Skip area not supported",
    };
  }
}

namespace ServiceAreaServerBase {
  export class State extends ServiceAreaBehavior.State {
    config!: ServiceAreaServerConfig;
  }
}

export interface ServiceAreaServerInitialState {
  supportedAreas: ServiceArea.Area[];
  selectedAreas?: number[];
  currentArea?: number | null;
}

/**
 * Create a ServiceArea behavior with initial state.
 * Following Matterbridge pattern: state is set at creation, no custom initialize().
 * The initialState MUST include supportedAreas - Matter.js requires this at pairing time.
 */
export function ServiceAreaServer(
  config: ServiceAreaServerConfig,
  initialState: ServiceAreaServerInitialState,
) {
  logger.info(
    `Creating ServiceAreaServer with ${initialState.supportedAreas.length} areas`,
  );
  return ServiceAreaServerBase.set({
    config,
    supportedAreas: initialState.supportedAreas,
    selectedAreas: initialState.selectedAreas ?? [],
    currentArea: initialState.currentArea ?? null,
  });
}
