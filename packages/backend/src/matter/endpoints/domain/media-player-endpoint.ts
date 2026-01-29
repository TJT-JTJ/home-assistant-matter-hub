import {
  type EntityMappingConfig,
  type HomeAssistantEntityInformation,
  type MediaPlayerDeviceAttributes,
  MediaPlayerDeviceFeature,
} from "@home-assistant-matter-hub/common";
import type { EndpointType } from "@matter/main";
import { SpeakerDevice } from "@matter/main/devices";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { testBit } from "../../../utils/test-bit.js";
import { BasicInformationServer } from "../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../behaviors/identify-server.js";
import type { LevelControlFeatures } from "../../behaviors/level-control-server.js";
import { MediaPlayerLevelControlServer } from "../legacy/media-player/behaviors/media-player-level-control-server.js";
import { MediaPlayerMediaInputServer } from "../legacy/media-player/behaviors/media-player-media-input-server.js";
import { MediaPlayerMediaPlaybackServer } from "../legacy/media-player/behaviors/media-player-media-playback-server.js";
import { MediaPlayerOnOffServer } from "../legacy/media-player/behaviors/media-player-on-off-server.js";
import { MediaPlayerPowerOnOffServer } from "../legacy/media-player/behaviors/media-player-power-on-off-server.js";
import { type BehaviorCommand, DomainEndpoint } from "./domain-endpoint.js";

const SpeakerEndpointType = SpeakerDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
);

/**
 * MediaPlayerEndpoint - Vision 1 implementation for media_player entities.
 */
export class MediaPlayerEndpoint extends DomainEndpoint {
  public static async create(
    registry: BridgeRegistry,
    entityId: string,
    mapping?: EntityMappingConfig,
  ): Promise<MediaPlayerEndpoint | undefined> {
    const state = registry.initialState(entityId);
    const entity = registry.entity(entityId);
    const deviceRegistry = registry.deviceOf(entityId);

    if (!state) {
      return undefined;
    }

    const attributes = state.attributes as MediaPlayerDeviceAttributes;
    const supportedFeatures = attributes.supported_features ?? 0;

    const supportsPower =
      testBit(supportedFeatures, MediaPlayerDeviceFeature.TURN_ON) &&
      testBit(supportedFeatures, MediaPlayerDeviceFeature.TURN_OFF);
    const supportsMute = testBit(
      supportedFeatures,
      MediaPlayerDeviceFeature.VOLUME_MUTE,
    );
    const supportsVolume = testBit(
      supportedFeatures,
      MediaPlayerDeviceFeature.VOLUME_SET,
    );
    const supportsSelectSource = testBit(
      supportedFeatures,
      MediaPlayerDeviceFeature.SELECT_SOURCE,
    );
    const supportsPlay = testBit(
      supportedFeatures,
      MediaPlayerDeviceFeature.PLAY,
    );
    const supportsPause = testBit(
      supportedFeatures,
      MediaPlayerDeviceFeature.PAUSE,
    );

    let device = SpeakerEndpointType;

    if (supportsPower) {
      device = device.with(MediaPlayerPowerOnOffServer);
    } else if (supportsMute) {
      device = device.with(MediaPlayerOnOffServer);
    }

    if (supportsVolume) {
      const volumeFeatures: LevelControlFeatures = [];
      if (supportsPower || supportsMute) {
        volumeFeatures.push("OnOff");
      }
      device = device.with(
        MediaPlayerLevelControlServer.with(...volumeFeatures),
      );
    }

    if (supportsSelectSource) {
      device = device.with(MediaPlayerMediaInputServer);
    }

    if (supportsPlay || supportsPause) {
      device = device.with(MediaPlayerMediaPlaybackServer);
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
    return new MediaPlayerEndpoint(
      device.set({ homeAssistantEntity }),
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
  ): void {
    // Behaviors handle their own state updates
  }

  protected onBehaviorCommand(_command: BehaviorCommand): void {
    // Behaviors handle their own commands
  }
}
