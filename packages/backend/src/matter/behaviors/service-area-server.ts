import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { ServiceAreaServer as Base } from "@matter/main/behaviors";
import { ServiceArea } from "@matter/main/clusters";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

export interface ServiceAreaServerConfig {
  /** Get the list of supported areas (rooms) */
  getSupportedAreas: ValueGetter<ServiceArea.Area[]>;
  /** Get the currently selected areas */
  getSelectedAreas: ValueGetter<number[]>;
  /** Get the current area being cleaned (null if not cleaning) */
  getCurrentArea: ValueGetter<number | null>;
  /** Clean selected areas */
  cleanAreas: ValueSetter<number[]>;
}

// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class ServiceAreaServerBase extends Base {
  declare state: ServiceAreaServerBase.State;

  override async initialize() {
    // Load HomeAssistantEntityBehavior FIRST to get initial entity data
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);

    // Set supportedAreas BEFORE super.initialize() so they're available at pairing
    if (homeAssistant.entity.state) {
      const supportedAreas = this.state.config.getSupportedAreas(
        homeAssistant.entity.state,
        this.agent,
      );
      this.state.supportedAreas = supportedAreas;
      this.state.selectedAreas = this.state.config.getSelectedAreas(
        homeAssistant.entity.state,
        this.agent,
      );
      const currentArea = this.state.config.getCurrentArea(
        homeAssistant.entity.state,
        this.agent,
      );
      this.state.currentArea = currentArea;
    }

    await super.initialize();
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const supportedAreas = this.state.config.getSupportedAreas(
      entity.state,
      this.agent,
    );
    const selectedAreas = this.state.config.getSelectedAreas(
      entity.state,
      this.agent,
    );
    const currentArea = this.state.config.getCurrentArea(
      entity.state,
      this.agent,
    );

    applyPatchState(this.state, {
      supportedAreas,
      selectedAreas,
      currentArea,
    });
  }

  override selectAreas(
    request: ServiceArea.SelectAreasRequest,
  ): ServiceArea.SelectAreasResponse {
    const { newAreas } = request;
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);

    // Validate that all requested areas exist in supportedAreas
    const supportedAreaIds = this.state.supportedAreas.map((a) => a.areaId);
    const invalidAreas = newAreas.filter(
      (id) => !supportedAreaIds.includes(id),
    );

    if (invalidAreas.length > 0) {
      return {
        status: ServiceArea.SelectAreasStatus.UnsupportedArea,
        statusText: `Invalid area IDs: ${invalidAreas.join(", ")}`,
      };
    }

    // Call Home Assistant to start cleaning the selected areas
    homeAssistant.callAction(
      this.state.config.cleanAreas(newAreas, this.agent),
    );

    // Update selected areas
    this.state.selectedAreas = newAreas;

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
  export class State extends Base.State {
    config!: ServiceAreaServerConfig;
  }
}

export function ServiceAreaServer(config: ServiceAreaServerConfig) {
  return ServiceAreaServerBase.set({ config });
}
