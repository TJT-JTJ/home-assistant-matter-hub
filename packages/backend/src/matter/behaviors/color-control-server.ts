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
    // CRITICAL: Set ALL required default values BEFORE super.initialize().
    // Matter.js requires these attributes to be set before initialization
    // to prevent "Behaviors have errors".

    // Set colorCapabilities based on features (required by Matter.js)
    this.state.colorCapabilities = {
      hueSaturation: this.features.hueSaturation ?? false,
      enhancedHue: false,
      colorLoop: false,
      xy: false,
      colorTemperature: this.features.colorTemperature ?? false,
    };

    // Set numberOfPrimaries (required by Matter.js, null = not defined)
    this.state.numberOfPrimaries = null;

    // Set remainingTime (required by Matter.js)
    this.state.remainingTime = 0;

    // Determine colorMode and enhancedColorMode based on features
    if (this.features.colorTemperature && this.features.hueSaturation) {
      // Both features: default to HueSaturation mode
      this.state.colorMode =
        ColorControl.ColorMode.CurrentHueAndCurrentSaturation;
      this.state.enhancedColorMode =
        ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation;
    } else if (this.features.colorTemperature) {
      // ColorTemperature only
      this.state.colorMode = ColorControl.ColorMode.ColorTemperatureMireds;
      this.state.enhancedColorMode =
        ColorControl.EnhancedColorMode.ColorTemperatureMireds;
    } else if (this.features.hueSaturation) {
      // HueSaturation only
      this.state.colorMode =
        ColorControl.ColorMode.CurrentHueAndCurrentSaturation;
      this.state.enhancedColorMode =
        ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation;
    }

    if (this.features.colorTemperature) {
      // Default color temp range: 2000K - 6500K (147-500 mireds)
      const defaultMinMireds = 147; // ~6800K
      const defaultMaxMireds = 500; // ~2000K
      const defaultMireds = 250; // ~4000K (neutral white)

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
      if (this.state.colorTemperatureMireds == null) {
        this.state.colorTemperatureMireds = defaultMireds;
      }
      if (this.state.coupleColorTempToLevelMinMireds == null) {
        this.state.coupleColorTempToLevelMinMireds = defaultMinMireds;
      }
      if (this.state.startUpColorTemperatureMireds == null) {
        this.state.startUpColorTemperatureMireds = null; // null = previous value
      }

      logger.debug(
        `initialize: set ColorTemperature defaults - min=${this.state.colorTempPhysicalMinMireds}, max=${this.state.colorTempPhysicalMaxMireds}, current=${this.state.colorTemperatureMireds}`,
      );
    }

    if (this.features.hueSaturation) {
      // Default hue/saturation to 0 (red, no saturation = white)
      if (this.state.currentHue == null) {
        this.state.currentHue = 0;
      }
      if (this.state.currentSaturation == null) {
        this.state.currentSaturation = 0;
      }
    }

    logger.debug(
      `initialize: calling super.initialize() with features: CT=${this.features.colorTemperature}, HS=${this.features.hueSaturation}`,
    );
    try {
      await super.initialize();
      logger.debug(`initialize: super.initialize() completed successfully`);
    } catch (error) {
      logger.error(`initialize: super.initialize() FAILED:`, error);
      throw error;
    }
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
    let currentMireds: number | undefined;
    if (currentKelvin != null) {
      currentMireds = ColorConverter.temperatureKelvinToMireds(currentKelvin);
      currentMireds = Math.max(Math.min(currentMireds, maxMireds), minMireds);
    }

    const newColorMode = this.getColorModeFromFeatures(
      config.getCurrentMode(entity.state, this.agent),
    );

    applyPatchState(this.state, {
      colorMode: newColorMode,
      // enhancedColorMode must match colorMode for proper operation
      enhancedColorMode:
        newColorMode as unknown as ColorControl.EnhancedColorMode,
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
            // Only update colorTemperatureMireds if we have a valid value.
            // When the light is OFF, currentKelvin is null, so we keep the existing value
            // to prevent overwriting the default set in initialize().
            ...(currentMireds != null
              ? { colorTemperatureMireds: currentMireds }
              : {}),
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
