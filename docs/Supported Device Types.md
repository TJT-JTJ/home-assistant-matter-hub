# Supported Device Types

The following device types are currently supported. If you need other device types, feel free to create a feature
request. Please make sure, that such devices are already supported by the
[Matter Device Specification](https://handbook.buildwithmatter.com/how-it-works/device-types/) and the controller
you are using.

You can check matter support for Alexa
[here](https://developer.amazon.com/en-US/docs/alexa/smarthome/matter-support.html#device-categories-and-clusters).

You can check matter support for Google Home
[here](https://developers.home.google.com/matter/supported-devices#device_type_and_control_support).

| Domain        | Represented as Device Class                                          | Comment                                                                                                                                                                                                                                                                                                                                 |
|---------------|----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| automation    | OnOffPlugInUnit                                                      |                                                                                                                                                                                                                                                                                                                                         |
| button        | OnOffPluginUnit                                                      | Buttons can be triggered via your controller. They are visible as OnOff switch. When turning it on, it will turn itself off after three seconds.                                                                                                                                                                                        |
| binary_sensor | OnOffSensor, ContactSensor, OccupancySensor, WaterLeakDetector, SmokeCoAlarm | Smoke (`smoke`), CO (`carbon_monoxide`), and Gas (`gas`) device classes are mapped to SmokeCoAlarm. Opening device class (`opening`) is mapped to ContactSensor.<br/>Water Leak Detectors and SmokeCoAlarm are not supported by every controller.                                                                                                                                              |
| climate       | Thermostat                                                           | Matter and Home Assistant have different definitions of "Auto" mode. In Matter, "Auto" mode means that a device will automatically choose between heat and cool based on the current local temperature. This is matching the "heat_cool" feature in Home Assistant, but not the "Auto" feature. There is no matching feature in matter. |
| cover         | WindowCovering                                                       |                                                                                                                                                                                                                                                                                                                                         |
| fan           | Fan                                                                  |                                                                                                                                                                                                                                                                                                                                         |
| humidifier    | OnOffPlugInUnit                                                      | Matter does not support humidifiers yet. Therefore, mapped to an OnOffPlugInUnit with Level Control.                                                                                                                                                                                                                                    |
| input_boolean | OnOffPlugInUnit                                                      |                                                                                                                                                                                                                                                                                                                                         |
| input_button  | OnOffPluginUnit                                                      | Input Buttons can be triggered via your controller. They are visible as OnOff switch. When turning it on, it will turn itself off after three seconds.                                                                                                                                                                                  |
| light         | OnOffLight, DimmableLight, ColorTemperatureLight, ExtendedColorLight | Depends on the supported features attribute of the device.                                                                                                                                                                                                                                                                              |
| lock          | DoorLock                                                             |                                                                                                                                                                                                                                                                                                                                         |
| media_player  | Speaker                                                              | Supports On/Off, Volume Control, and Playback (Play/Pause/Stop/Next/Previous). Media Players are not supported by most controllers yet.                                                                                                                    |
| scene         | OnOffPlugInUnit                                                      |                                                                                                                                                                                                                                                                                                                         |
| script        | OnOffPlugInUnit                                                      |                                                                                                                                                                                                                                                                                                                         |
| sensor        | TemperatureSensor, HumiditySensor, PressureSensor, FlowSensor, IlluminanceSensor, AirQualitySensor | Temperature, Humidity, Pressure, Flow, Illuminance and Air Quality (AQI, PM2.5, PM10, CO2, VOC) sensors are supported.                                                                                                                                                                                                                                          |
| switch        | OnOffPlugInUnit                                                      |                                                                                                                                                                                                                                                                                                                         |
| valve         | WaterValve                                                           | Controls water valves (open/close). Not supported by all controllers yet.                                                                                                                              |                                                                                                |
| vacuum        | RoboticVacuumCleaner                                                 | Currently only supported by Apple Home. Needs to be THE ONLY device in the bridge. (Ensure that all home hubs in the Apple Home app are updated to iOS/tvOS/AudioOS 18.4+).                                                                                                                                                                                                                                                      |

## Entity Mapping (Custom Device Types)

Some Matter device types don't have a direct Home Assistant domain equivalent. You can use **Entity Mapping** to expose entities as different Matter device types.

| Source Domain | Target Matter Device | Description |
|---------------|---------------------|-------------|
| fan           | AirPurifier         | Map fan entities to Matter Air Purifier device. Supports speed control, auto mode, and airflow direction. |
| switch, valve | Pump                | Map switch or valve entities to Matter Pump device. Simple on/off control with PumpConfigurationAndControl cluster. |

To configure entity mapping, go to **Settings → Entity Mapping** in the web interface.

## Alpha Features (v2.0.0-alpha)

:::{warning}
Alpha versions are for testing only and may contain bugs. Use at your own risk!
:::

The following features are available in the **alpha** version only:

### Additional Device Types

All stable device types plus:

- **Health Check API** - System status endpoints (`/api/health`, `/live`, `/ready`) for Kubernetes-ready deployments
- **WebSocket API** - Real-time updates via `/api/ws`
- **Bridge Export/Import** - Backup and restore bridge configurations
- **Enhanced Entity Mapping UI** - More device type options in the web interface
