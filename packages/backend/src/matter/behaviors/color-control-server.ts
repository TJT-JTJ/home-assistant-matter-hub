import {
  ColorConverter,
  type HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { ColorControlServer as Base } from "@matter/main/behaviors/color-control";
import { ColorControl } from "@matter/main/clusters";
import type { ColorInstance } from "color";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

const logger = Logger.get("ColorControlServer");

export type ColorControlMode =
  | ColorControl.ColorMode.CurrentHueAndCurrentSaturation
  | ColorControl.ColorMode.ColorTemperatureMireds;

export interface ColorControlConfig {
  getCurrentMode: ValueGetter<ColorControlMode | undefined>;
  getCurrentKelvin: ValueGetter<number | undefined>;
  getMinColorTempKelvin: ValueGetter<number | undefined>;
  getMaxColorTempKelvin: ValueGetter<number | undefined>;
  getColor: ValueGetter<ColorInstance | undefined>;

  setTemperature: ValueSetter<number>;
  setColor: ValueSetter<ColorInstance>;
}

const FeaturedBase = Base.with("ColorTemperature", "HueSaturation");

export class ColorControlServerBase extends FeaturedBase {
  declare state: ColorControlServerBase.State;

  override async initialize() {
    // Set default values BEFORE super.initialize() to prevent validation errors.
    // colorMode and enhancedColorMode are required and must match the active features
    if (this.state.colorMode === undefined) {
      if (this.features.colorTemperature) {
        this.state.colorMode = ColorControl.ColorMode.ColorTemperatureMireds;
      } else if (this.features.hueSaturation) {
        this.state.colorMode =
          ColorControl.ColorMode.CurrentHueAndCurrentSaturation;
      }
    }
    // enhancedColorMode must also be set for controllers to work properly
    if (this.state.enhancedColorMode === undefined) {
      if (this.features.colorTemperature) {
        this.state.enhancedColorMode =
          ColorControl.EnhancedColorMode.ColorTemperatureMireds;
      } else {
        this.state.enhancedColorMode =
          ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation;
      }
    }

    // Matter.js defaults colorTempPhysicalMinMireds and colorTempPhysicalMaxMireds to 0,
    // but 0 is invalid per Matter spec - these must be > 0 for ColorTemperature feature.
    if (this.features.colorTemperature) {
      // Use reasonable defaults matching common LED color temp ranges
      // Matter.js defaults: colorTemperatureMireds=250, min/max=0 (invalid)
      const defaultMinMireds = 153; // ~6500K (cool white)
      const defaultMaxMireds = 500; // ~2000K (warm white)

      // Only override if Matter.js default (0) is invalid
      if (
        this.state.colorTempPhysicalMinMireds == null ||
        this.state.colorTempPhysicalMinMireds === 0
      ) {
        this.state.colorTempPhysicalMinMireds = defaultMinMireds;
      }
      if (
        this.state.colorTempPhysicalMaxMireds == null ||
        this.state.colorTempPhysicalMaxMireds === 0
      ) {
        this.state.colorTempPhysicalMaxMireds = defaultMaxMireds;
      }
      // colorTemperatureMireds: Matter.js defaults to 250, which is valid
      if (this.state.colorTemperatureMireds == null) {
        this.state.colorTemperatureMireds = 250;
      }
      // coupleColorTempToLevelMinMireds must be >= colorTempPhysicalMinMireds
      if (
        this.state.coupleColorTempToLevelMinMireds == null ||
        this.state.coupleColorTempToLevelMinMireds <
          this.state.colorTempPhysicalMinMireds
      ) {
        this.state.coupleColorTempToLevelMinMireds =
          this.state.colorTempPhysicalMinMireds;
      }
      // startUpColorTemperatureMireds is required for ColorTemperature feature
      if (this.state.startUpColorTemperatureMireds === undefined) {
        this.state.startUpColorTemperatureMireds =
          this.state.colorTemperatureMireds;
      }

      logger.debug(
        `initialize: ColorTemperature defaults - min=${this.state.colorTempPhysicalMinMireds}, max=${this.state.colorTempPhysicalMaxMireds}, current=${this.state.colorTemperatureMireds}`,
      );
    }

    // HueSaturation: Matter.js defaults currentHue=0, currentSaturation=0 - no override needed

    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const config = this.state.config;
    const currentKelvin = config.getCurrentKelvin(entity.state, this.agent);
    let minKelvin =
      config.getMinColorTempKelvin(entity.state, this.agent) ?? 1500;
    let maxKelvin =
      config.getMaxColorTempKelvin(entity.state, this.agent) ?? 8000;
    minKelvin = Math.min(
      minKelvin,
      maxKelvin,
      currentKelvin ?? Number.POSITIVE_INFINITY,
    );
    maxKelvin = Math.max(
      minKelvin,
      maxKelvin,
      currentKelvin ?? Number.NEGATIVE_INFINITY,
    );

    const color = config.getColor(entity.state, this.agent);
    const [hue, saturation] = color ? ColorConverter.toMatterHS(color) : [0, 0];

    const minMireds = Math.floor(
      ColorConverter.temperatureKelvinToMireds(maxKelvin),
    );
    const maxMireds = Math.ceil(
      ColorConverter.temperatureKelvinToMireds(minKelvin),
    );
    const startUpMireds = ColorConverter.temperatureKelvinToMireds(
      currentKelvin ?? maxKelvin,
    );
    let currentMireds: number | undefined;
    if (currentKelvin != null) {
      currentMireds = ColorConverter.temperatureKelvinToMireds(currentKelvin);
      currentMireds = Math.max(Math.min(currentMireds, maxMireds), minMireds);
    }

    applyPatchState(this.state, {
      colorMode: this.getColorModeFromFeatures(
        config.getCurrentMode(entity.state, this.agent),
      ),
      ...(this.features.hueSaturation
        ? {
            currentHue: hue,
            currentSaturation: saturation,
          }
        : {}),
      ...(this.features.colorTemperature
        ? {
            coupleColorTempToLevelMinMireds: minMireds,
            colorTempPhysicalMinMireds: minMireds,
            colorTempPhysicalMaxMireds: maxMireds,
            startUpColorTemperatureMireds: startUpMireds,
            colorTemperatureMireds: currentMireds,
          }
        : {}),
    });
  }

  override moveToColorTemperatureLogic(targetMireds: number) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const current = homeAssistant.entity.state;
    const currentKelvin = this.state.config.getCurrentKelvin(
      current,
      this.agent,
    );
    const targetKelvin = ColorConverter.temperatureMiredsToKelvin(targetMireds);

    if (currentKelvin === targetKelvin) {
      return;
    }

    const action = this.state.config.setTemperature(targetKelvin, this.agent);
    homeAssistant.callAction(action);
  }

  override moveToHueLogic(targetHue: number) {
    this.moveToHueAndSaturationLogic(targetHue, this.state.currentSaturation);
  }

  override moveToSaturationLogic(targetSaturation: number) {
    this.moveToHueAndSaturationLogic(this.state.currentHue, targetSaturation);
  }

  override moveToHueAndSaturationLogic(
    targetHue: number,
    targetSaturation: number,
  ) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const haColor = this.state.config.getColor(
      homeAssistant.entity.state,
      this.agent,
    );
    const [currentHue, currentSaturation] = haColor
      ? ColorConverter.toMatterHS(haColor)
      : [];
    if (currentHue === targetHue && currentSaturation === targetSaturation) {
      return;
    }
    const color = ColorConverter.fromMatterHS(targetHue, targetSaturation);
    const action = this.state.config.setColor(color, this.agent);
    homeAssistant.callAction(action);
  }

  private getColorModeFromFeatures(mode: ColorControlMode | undefined) {
    // This cluster is only used with HueSaturation, ColorTemperature or Both.
    // It is never used without any of them.
    if (this.features.colorTemperature && this.features.hueSaturation) {
      return mode ?? ColorControl.ColorMode.CurrentHueAndCurrentSaturation;
    }
    if (this.features.colorTemperature) {
      return ColorControl.ColorMode.ColorTemperatureMireds;
    }
    if (this.features.hueSaturation) {
      return ColorControl.ColorMode.CurrentHueAndCurrentSaturation;
    }
    throw new Error(
      "ColorControlServer does not support either HueSaturation or ColorTemperature",
    );
  }
}

export namespace ColorControlServerBase {
  export class State extends FeaturedBase.State {
    config!: ColorControlConfig;
  }
}

export function ColorControlServer(config: ColorControlConfig) {
  return ColorControlServerBase.set({
    options: { executeIfOff: true },
    config,
  });
}
