import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import type { HomeAssistantAction } from "../../../services/home-assistant/home-assistant-actions.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import { OnOffServer } from "../../behaviors/on-off-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const ValveOnOffServer = OnOffServer({
  isOn: (state) => state.state === "open",
  turnOn: (): HomeAssistantAction => ({ action: "valve.open_valve" }),
  turnOff: (): HomeAssistantAction => ({ action: "valve.close_valve" }),
});

const ValveEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  ValveOnOffServer,
);

/**
 * ValveEndpoint - Vision 1 implementation for valve entities.
 */
export class ValveEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<ValveEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const homeAssistantEntity: HomeAssistantEntityBehavior.State = {
      entity: {
        entity_id: entityId,
        state,
        registry: entity,
        deviceRegistry,
      } as HomeAssistantEntityInformation,
    };

    const customName = mapping?.customName;
    return new ValveEndpoint(
      ValveEndpointType.set({ homeAssistantEntity }),
      entityId,
      customName,
    );
  }

  private constructor(
    type: EndpointType,
    entityId: string,
    customName?: string,
  ) {
    super(type, entityId, customName);
  }

  protected onEntityStateChanged(
    _entity: HomeAssistantEntityInformation,
  ): void {}
  protected onBehaviorCommand(_command: BehaviorCommand): void {}
}
