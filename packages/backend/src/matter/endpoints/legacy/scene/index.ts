import type { EndpointType } from "@matter/main";
import { OnOffServer as Base } from "@matter/main/behaviors";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { applyPatchState } from "../../../../utils/apply-patch-state.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";

/**
 * Scene-specific OnOffServer that auto-resets to OFF after activation.
 * This prevents scenes from appearing "stuck on" in controllers like Google Home.
 */
class SceneOnOffServerBase extends Base.with("Lighting") {
  override async initialize() {
    await super.initialize();
    // Scenes are always "off" - they're momentary actions
    applyPatchState(this.state, { onOff: false });
  }

  override on() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    homeAssistant.callAction({ action: "scene.turn_on" });
    // Auto-reset to OFF after 1 second so scene doesn't stay "on"
    setTimeout(this.callback(this.resetToOff), 1000);
  }

  override off() {
    // Scenes don't have an "off" action, just reset state
    setTimeout(this.callback(this.resetToOff), 100);
  }

  private resetToOff() {
    applyPatchState(this.state, { onOff: false });
  }
}

const SceneDeviceType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  SceneOnOffServerBase,
);

export function SceneDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  return SceneDeviceType.set({ homeAssistantEntity });
}
