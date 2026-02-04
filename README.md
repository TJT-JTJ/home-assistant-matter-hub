<div align="center">

# Home-Assistant-Matter-Hub

!["Home-Assistant-Matter-Hub"](./docs/assets/hamh-logo-small.png)

**Expose your Home Assistant devices to Matter controllers like Apple Home, Google Home, and Alexa**

[![GitHub Release](https://img.shields.io/github/v/release/RiDDiX/home-assistant-matter-hub?label=stable&color=green)](https://github.com/RiDDiX/home-assistant-matter-hub/releases)
[![GitHub Pre-Release](https://img.shields.io/github/v/release/RiDDiX/home-assistant-matter-hub?include_prereleases&label=alpha&color=orange)](https://github.com/RiDDiX/home-assistant-matter-hub/releases)
[![GitHub Issues](https://img.shields.io/github/issues/RiDDiX/home-assistant-matter-hub)](https://github.com/RiDDiX/home-assistant-matter-hub/issues)
[![GitHub Stars](https://img.shields.io/github/stars/RiDDiX/home-assistant-matter-hub)](https://github.com/RiDDiX/home-assistant-matter-hub/stargazers)
[![License](https://img.shields.io/github/license/RiDDiX/home-assistant-matter-hub)](LICENSE)

[📖 Documentation](https://riddix.github.io/home-assistant-matter-hub) • [🐛 Report Bug](https://github.com/RiDDiX/home-assistant-matter-hub/issues/new?labels=bug) • [💡 Request Feature](https://github.com/RiDDiX/home-assistant-matter-hub/issues/new?labels=enhancement)

</div>

---

> [!NOTE]
> 🔀 **Community Fork** - This is a fork of the original [t0bst4r/home-assistant-matter-hub](https://github.com/t0bst4r/home-assistant-matter-hub), which was discontinued in January 2026. We continue active development with bug fixes, new features, and community support. Thank you **t0bst4r** for the original work! ❤️
>
> **📦 Migrating?** See [Migration Guide](#migration-from-t0bst4r) - your paired devices will continue to work!

---

## 📝 About

This project simulates bridges to publish your entities from Home Assistant to any Matter-compatible controller like
Alexa, Apple Home or Google Home. Using Matter, those can be connected easily using local communication without the need
of port forwarding etc.

---

## 📦 Releases & Branches

| Channel | Branch | Current Version | Description |
|---------|--------|-----------------|-------------|
| **Stable** | `main` | v2.0.x | Production-ready, recommended for most users |
| **Alpha** | `alpha` | v2.1.0-alpha.x | Pre-release with new features, for early adopters |
| **Testing** | `testing` | v4.1.0-testing.x | ⚠️ **Highly unstable!** Experimental features, may break |

### Semantic Versioning

We use [Semantic Release](https://semantic-release.gitbook.io/) for automatic versioning:

- `fix:` commits → Patch version bump (1.7.**x**)
- `feat:` commits → Minor version bump (1.**x**.0)
- `BREAKING CHANGE:` → Major version bump (**x**.0.0)

### Which version should I use?

- **Most users**: Use **Stable** (`main` branch) - thoroughly tested
- **Early adopters**: Use **Alpha** (`alpha` branch) - new features, occasional bugs
- **Developers/Testers**: Use **Testing** (`testing` branch) - bleeding edge, expect breakage

### Stable Features (v2.0.x) - Current 🎉

**💡 Light Entity Fixes**
- **ColorTemperature + HueSaturation** - Fixed "Behaviors have errors" for lights supporting both color modes
- **Boundary Order Fix** - Color temperature boundaries are now set before values to prevent validation errors
- **LevelControlServer** - Fixed validation errors during initialization

**🌡️ Concentration Sensors**
- **PM2.5, PM10, CO2, TVOC** - Fixed "Behaviors have errors" for all concentration measurement sensors
- **Feature Configuration** - Corrected to use `NumericMeasurement` only (not `LevelIndication`)
- **Apple Home Compatibility** - Proper default values for seamless Apple Home integration

**🌡️ New Device Support**
- **Water Heater** - New `water_heater` domain mapped to Thermostat device (Heating only) ([#14](https://github.com/RiDDiX/home-assistant-matter-hub/issues/14))

**🤖 Vacuum Enhancements**
- **Apple Home Room Selection** - Matter 1.4 Service Area cluster for native room selection
- **Dreame Vacuum Support** - Full support for nested room format (`rooms: { "Map Name": [...] }`)
- **Room Selection** - Vacuum room/segment selection via RvcRunMode cluster ([#49](https://github.com/RiDDiX/home-assistant-matter-hub/issues/49))

**🏷️ Entity Mapping**
- **Sensor Type Override** - Entity mapping now correctly overrides sensor device types ([#73](https://github.com/RiDDiX/home-assistant-matter-hub/issues/73))

**�️ Backup & Restore**
- **Bridge Icons in Backup** - Full backup now includes bridge icons when exporting with identity

**🌬️ Air Purifier**
- **HEPA Filter Life Monitoring** - Filter life via HepaFilterMonitoring cluster
- **Filter Life Sensor Mapping** - Map sensor entities via Entity Mapping UI

**🌡️ Combined Temperature & Humidity Sensors** - [Documentation](https://riddix.github.io/home-assistant-matter-hub/Devices/Temperature%20Humidity%20Sensor/)
- **Unified Device** - Combine separate temperature, humidity, and battery entities into one Matter device
- **Manual Mapping** - Link humidity and battery sensors via Entity Mapping UI
- **Better UX** - Single device in Apple Home, Google Home, Alexa instead of 3 separate ones

**🚪 Cover/Blinds**
- **Binary Cover Fix** - Garage doors show Open/Close buttons in Apple Home ([#78](https://github.com/RiDDiX/home-assistant-matter-hub/issues/78))
- **WindowCover Position** - Prevent duplicate commands ([#76](https://github.com/RiDDiX/home-assistant-matter-hub/issues/76))

**🎨 UI/UX**
- **Bridge Sorting** - Sort dropdown on Bridge Status page ([#80](https://github.com/RiDDiX/home-assistant-matter-hub/issues/80))

**� Documentation**
- New [Robot Vacuum](docs/Devices/Robot%20Vacuum.md) guide with Apple Home workarounds
- New [Air Purifier](docs/Devices/Air%20Purifier.md) guide

<details>
<summary><strong>📦 Previous Stable Versions</strong> (click to expand)</summary>

### Stable Features (v1.5.x)

- **Matter Bridge** - Expose Home Assistant entities to Matter controllers
- **Multi-Fabric Support** - Connect to multiple ecosystems (Apple, Google, Alexa)
- **Graceful Error Handling** - Skips problematic entities without crashing
- **Failed Entity Reporting** - Shows which entities couldn't be loaded and why
- **Health Monitoring Dashboard** - Real-time bridge and fabric status monitoring
- **Automatic Recovery** - Auto-restart failed bridges with configurable intervals
- **Bridge Wizard** - Guided setup for creating multiple bridges with automatic port assignment
- **AirQuality Sensors** - Support for AQI, PM2.5, PM10, CO2, and VOC sensors
- **Improved Fan Control** - Better speed control compatibility with Matter controllers
- **Media Player Playback** - Play/Pause/Stop/Next/Previous track controls
- **Node.js 24** - Latest LTS runtime
- **64-bit Only** - Supports `amd64` and `arm64` (aarch64)

### Stable Features (v1.7.x)

- **Dark Mode Toggle** - Switch between light and dark theme
- **Device List Sorting** - Sort endpoints by name, type, or ID

### Stable Features (v1.8.x)

- **Graceful Crash Handler** - Failed entities no longer crash the bridge
- **PM2.5/PM10 Numeric Sensors** - Real concentration values in µg/m³
- **Access Control Fix** - Fixed attribute write issues using `asLocalActor`
- **Water Valve Support** - Control water valves via Matter
- **Smoke/CO Detector** - Binary sensors for smoke and carbon monoxide alarms
- **Pressure Sensor** - Atmospheric pressure measurements
- **Flow Sensor** - Volume flow rate measurements
- **Air Purifier** - Map fans to Air Purifier device type
- **Pump Device** - Map switches/valves to Pump device type

### Stable Features (v1.9.0)

- **Custom Bridge Icons** - Upload your own icons
- **Domain-based Icons** - Automatic icon assignment
- **Basic Video Player** - TV and media player support for Apple Home
- **Alexa Deduplication** - UniqueId prevents duplicate devices
- **Auto-only Thermostat Support** - Thermostats with only "auto" mode work correctly
- **Health Check API** - System status and Kubernetes-ready probes
- **WebSocket Live Updates** - Real-time bridge status
- **Full Backup/Restore** - Complete backups including entity mappings

### Stable Features (v1.10.4)

- **Climate/Thermostat Fixes** - Humidity sensor, HVAC auto mode mapping, thermostat limits
- **Cover/Blinds Fixes** - Position fix, percentage consistency
- **Vacuum Battery Support** - Battery level for vacuums
- **Humidifier Improvements** - Humidity sensor, auto mode, FanDevice type
- **Entity Mapping** - Custom name support, auto-refresh
- **Alexa Brightness Preserve** - Prevent brightness reset on turn on
- **UI Improvements** - Icon selection, button state fixes

</details>

### Alpha Features (v2.1.0-alpha.x) 🧪

> [!WARNING]
> Alpha versions are for early adopters and may contain bugs!

**All Stable v2.0.x features plus:**

**� Force Sync** - NEW!
- **Push Device States** - Force sync all current device states to connected Matter controllers
- **No Re-Pairing Required** - Updates controllers without losing fabric connections
- **UI Button** - Available in Bridge Details → Connected Fabrics section
- **Use Case** - Helpful when controllers show stale/incorrect device states

> Note: This pushes current values to controllers but doesn't clear their internal cache. For a full cache reset, devices must be removed and re-paired.

**�🔋 Auto Entity Grouping** ([#99](https://github.com/RiDDiX/home-assistant-matter-hub/issues/99)) - NEW!
- **Auto Battery Mapping** - Automatically assign battery sensors to their parent devices
- **Auto Humidity Mapping** - Automatically combine Temperature + Humidity sensors from the same device
- **Bridge Feature Flags** - Enable separately via "Auto Battery Mapping" / "Auto Humidity Mapping" in Bridge settings
- **Reduced Device Clutter** - One combined device instead of 3 separate sensors in Apple Home/Google Home

Example: A climate sensor with `sensor.temp`, `sensor.humidity`, and `sensor.battery` becomes **one** `TemperatureHumiditySensorWithBattery` device.

**🔢 All Devices Sorting** ([#100](https://github.com/RiDDiX/home-assistant-matter-hub/issues/100)) - NEW!
- **Sort Direction Toggle** - Click column headers to toggle ascending/descending
- **Persistent Sorting** - Sort preference is remembered

**🌡️ Water Heater High Temperature Fix** - NEW!
- **Kettles & Boilers** - Now supports temperatures up to 100°C (was limited to 50°C)
- **Electric Water Heaters** - Proper support for 70-100°C range

**🤖 Server Mode for Robot Vacuums** ([#49](https://github.com/RiDDiX/home-assistant-matter-hub/issues/49), [#102](https://github.com/RiDDiX/home-assistant-matter-hub/issues/102), [#103](https://github.com/RiDDiX/home-assistant-matter-hub/issues/103))
- **Standalone Device Mode** - Expose vacuums as native Matter devices (not bridged)
- **Apple Home Siri Support** - Voice commands now work with Server Mode
- **Alexa Discovery Fix** - Alexa now discovers vacuums properly
- **"Updating" Fix** - No more stuck "Updating" status in Apple Home

**🧹 Vacuum Cleaning Mode Fix** ([#49](https://github.com/RiDDiX/home-assistant-matter-hub/issues/49))
- **Dreame Cleaning Modes** - Fixed "Vacuum & Mop" selecting wrong mode (was "sweeping" instead of "sweeping_and_mopping")
- **Partial Match Logic** - Corrected option matching to prevent false positives

**🖼️ Bridge Icons Backup Fix** ([#101](https://github.com/RiDDiX/home-assistant-matter-hub/issues/101))
- **Icons Now Restore** - Bridge icons are now correctly restored from full backups

**🌡️ Combined Sensors** - [Documentation](https://riddix.github.io/home-assistant-matter-hub/Devices/Temperature%20Humidity%20Sensor/)
- **Temperature + Humidity + Battery** - Combine multiple entities into one Matter device
- **Entity Mapping UI** - Configure `humidityEntity` and `batteryEntity` in the UI
- **Single Device UX** - One device in Apple Home/Google Home instead of 3 separate sensors

**🔋 PowerSource Cluster**
- **Battery Support** - Climate, Fan devices now show battery level if available

### Testing Features (v4.1.0-testing) ⚠️

> [!CAUTION]
> Testing versions are **highly unstable** and intended for developers only!
> Features may be incomplete, broken, or removed without notice.

**🏗️ Vision 1: Callback-based Architecture**

Complete refactoring of the behavior system from self-updating to callback-based:

| Old (Legacy) | New (Vision 1) |
|--------------|----------------|
| Behaviors update themselves via `reactTo(homeAssistant.onChange)` | Endpoint updates behaviors via `setStateOf()` |
| Behaviors call HA actions directly | Behaviors notify endpoint via `notifyEndpoint()` |
| Endpoint has no control over behaviors | Endpoint handles all HA action calls |

**New Callback-Behaviors:**
- `OnOffBehavior` - On/Off control for lights, switches, buttons, valves, scenes
- `LevelControlBehavior` - Brightness/level control for dimmable lights, humidifiers
- `LockBehavior` - Lock/unlock for door locks
- `CoverBehavior` - Open/close/position for covers and blinds
- `FanBehavior` - Speed control for fans
- `ColorControlBehavior` - Color and temperature control for lights
- `VacuumRunModeBehavior` - Run mode control for vacuums
- `VacuumOperationalStateBehavior` - Operational state for vacuums

**Updated DomainEndpoints with Vision 1:**
- ✅ SwitchEndpoint, LockEndpoint, CoverEndpoint
- ✅ VacuumEndpoint, ButtonEndpoint, ValveEndpoint
- ✅ SceneEndpoint, HumidifierEndpoint
- ✅ LightEndpoint (OnOff + Dimmable)
- ✅ FanEndpoint

**Benefits:**
- Endpoint has full control over all HA service calls
- Behaviors are simpler and easier to test
- Enables future multi-entity scenarios (nested endpoints, neighbor entity access)
- Clean separation between Matter protocol and HA logic

**🖼️ Bridge Icons in Backup**
- Full backup now includes bridge icons when exporting with identity
- Icons are automatically restored during backup import

Experimental features being actively developed before promotion to alpha.

---

## Supported Device Types

| Home Assistant Domain | Matter Device Type |
|-----------------------|-------------------|
| `light` | On/Off, Dimmable, Color Temperature, Extended Color Light |
| `switch`, `input_boolean` | On/Off Plug-in Unit |
| `lock` | Door Lock |
| `cover` | Window Covering |
| `climate` | Thermostat |
| `fan` | Fan |
| `binary_sensor` | Contact, Occupancy, Smoke/CO Alarm, Water Leak Sensor |
| `sensor` | Temperature, Humidity, Pressure, Flow, Light, AirQuality Sensor |
| `button`, `input_button` | Generic Switch |
| `media_player` | Speaker, Basic Video Player (TV) |
| `valve` | Water Valve |
| `vacuum` | Robot Vacuum Cleaner ⚠️ [Server Mode recommended](#-robot-vacuum-server-mode) |
| `humidifier` | Humidifier/Dehumidifier |
| `automation`, `script`, `scene` | On/Off Switch |

---

## 🤖 Robot Vacuum Server Mode

<details>
<summary><strong>⚠️ Important: Apple Home & Alexa require Server Mode for Robot Vacuums</strong> (click to expand)</summary>

### The Problem

Apple Home and Alexa **do not properly support bridged robot vacuums**. When your vacuum is exposed through a standard Matter bridge, you may experience:

- **Apple Home**: "Updating" status, Siri commands don't work, room selection fails
- **Alexa**: Vacuum is not discovered at all

This is because these platforms expect robot vacuums to be **standalone Matter devices**, not bridged devices.

### The Solution: Server Mode

**Server Mode** exposes your vacuum as a standalone Matter device without the bridge wrapper. This makes it fully compatible with Apple Home and Alexa.

### Setup Instructions

1. **Create a new bridge** in the Matter Hub web interface
2. **Enable "Server Mode"** checkbox in the bridge creation wizard
3. Add **only your vacuum** to this bridge
4. **Pair the new Server Mode bridge** with Apple Home or Alexa
5. Your other devices stay on your regular bridge(s)

### Important Notes

- Server Mode bridges support **exactly one device**
- Your vacuum needs its own dedicated Server Mode bridge
- Other device types (lights, switches, sensors) work fine on regular bridges
- After switching to Server Mode, Siri commands like "Hey Siri, start the vacuum" will work

### Documentation

For more details, see the [Robot Vacuum Documentation](https://riddix.github.io/home-assistant-matter-hub/Devices/Robot%20Vacuum/).

</details>

---

## Installation

### Home Assistant Add-on (Recommended)

Add this repository to your Add-on Store:

```
https://github.com/RiDDiX/home-assistant-addons
```

Two add-ons are available:
- **Home-Assistant-Matter-Hub** - Stable release
- **Home-Assistant-Matter-Hub (Alpha)** - Pre-release for testing

### Docker

```bash
docker run -d \
  --name home-assistant-matter-hub \
  --network host \
  -v /path/to/data:/data \
  -e HOME_ASSISTANT_URL=http://homeassistant.local:8123 \
  -e HOME_ASSISTANT_ACCESS_TOKEN=your_token \
  ghcr.io/riddix/home-assistant-matter-hub:latest
```

For alpha versions, use tag `alpha` instead of `latest`.

---

## Documentation

Please see the [documentation](https://riddix.github.io/home-assistant-matter-hub) for detailed installation instructions,
configuration options, known issues, limitations and guides.

---

## Migration from t0bst4r

Migrating from the original `t0bst4r/home-assistant-matter-hub` is straightforward. **Your Matter fabric connections and paired devices will be preserved!**

### Home Assistant Add-on

1. **Backup your data:**
   ```bash
   # SSH into Home Assistant and find your add-on folder
   ls /addon_configs/
   # Look for folder ending with _hamh (e.g., a0c_hamh)
   
   cp -r /addon_configs/*_hamh /config/hamh-backup
   ```

2. **Uninstall the old add-on** (Settings → Add-ons → Uninstall)

3. **Add the new repository:**
   ```
   https://github.com/RiDDiX/home-assistant-addons
   ```

4. **Install and start the new add-on**, then check the new _hamh folder:
   ```bash
   ls /addon_configs/
   ```

5. **Stop the add-on** and restore your backup:
   ```bash
   cp -r /config/hamh-backup/* /addon_configs/*_hamh/
   ```

6. **Start the add-on again** - your devices should reconnect automatically

### Docker / Docker Compose

Simply change the image from:
```
ghcr.io/t0bst4r/home-assistant-matter-hub:latest
```
to:
```
ghcr.io/riddix/home-assistant-matter-hub:latest
```

Your volume mounts stay the same - no data migration needed.

> For detailed instructions, see the [full Migration Guide](https://riddix.github.io/home-assistant-matter-hub/migration-from-t0bst4r/).

---

## 🙏 Contributors & Acknowledgments

This project thrives thanks to the amazing community! Special thanks to everyone who contributes by reporting bugs, suggesting features, and helping others.

### 🏆 Top Contributors

| Contributor | Contributions |
|-------------|---------------|
| [@codyc1515](https://github.com/codyc1515) | 🥇 **Top Reporter** - Climate/thermostat bugs (#52, #24, #21, #20), extensive testing feedback |
| [@Hatton920](https://github.com/Hatton920) | 🤖 **Vacuum Expert** - Intensive testing of Robot Vacuum Server Mode, Apple Home & Siri validation |
| [@Chrulf](https://github.com/Chrulf) | 🔍 Google Home brightness debugging (#41), detailed logs & testing |
| [@SH1FT-W](https://github.com/SH1FT-W) | 💎 **Sponsor** + Vacuum room selection feature request (#49) |
| [@depahk](https://github.com/depahk) | 📝 Migration documentation fix ([#32](https://github.com/RiDDiX/home-assistant-matter-hub/pull/32)) |
| [@Fettkeewl](https://github.com/Fettkeewl) | 🐛 Script import bug (#26), Alias feature request (#25) |
| [@razzietheman](https://github.com/razzietheman) | 🥈 **Active Tester** - Bridge icons (#101), sorting (#80), feature requests (#31, #30), extensive UI/UX feedback |

### 📋 Issue Tracker - All Contributors

Thank you to everyone who helps improve this project by reporting issues!

| User | Issues | Type |
|------|--------|------|
| [@400HPMustang](https://github.com/400HPMustang) | [#103](https://github.com/RiDDiX/home-assistant-matter-hub/issues/103) | 🐛 Vacuum "Updating" |
| [@vandir](https://github.com/vandir) | [#102](https://github.com/RiDDiX/home-assistant-matter-hub/issues/102) | 🐛 Alexa vacuum discovery |
| [@razzietheman](https://github.com/razzietheman) | [#101](https://github.com/RiDDiX/home-assistant-matter-hub/issues/101), [#80](https://github.com/RiDDiX/home-assistant-matter-hub/issues/80), [#31](https://github.com/RiDDiX/home-assistant-matter-hub/issues/31), [#30](https://github.com/RiDDiX/home-assistant-matter-hub/issues/30) | 🐛💡 Bridge icons, sorting, features |
| [@italoc](https://github.com/italoc) | [#78](https://github.com/RiDDiX/home-assistant-matter-hub/issues/78) | 🐛 Garage door cover |
| [@marksev1](https://github.com/marksev1) | [#62](https://github.com/RiDDiX/home-assistant-matter-hub/issues/62) | 💡 Aliases support |
| [@smacpi](https://github.com/smacpi) | [#60](https://github.com/RiDDiX/home-assistant-matter-hub/issues/60) | 💡 Battery sensor |
| [@semonR](https://github.com/semonR) | [#58](https://github.com/RiDDiX/home-assistant-matter-hub/issues/58) | 🐛 Dehumidifier |
| [@mrbluebrett](https://github.com/mrbluebrett) | [#53](https://github.com/RiDDiX/home-assistant-matter-hub/issues/53) | 🐛 Alexa duplicates |
| [@anpak](https://github.com/anpak) | [#45](https://github.com/RiDDiX/home-assistant-matter-hub/issues/45) | 💡 TV media player |
| [@alondin](https://github.com/alondin) | [#43](https://github.com/RiDDiX/home-assistant-matter-hub/issues/43) | 💡 Air Purifier |
| [@Chrulf](https://github.com/Chrulf) | [#41](https://github.com/RiDDiX/home-assistant-matter-hub/issues/41) | 🐛 Google brightness |
| [@Weske90](https://github.com/Weske90) | [#40](https://github.com/RiDDiX/home-assistant-matter-hub/issues/40) | 💡 Harmony remote |
| [@didiht](https://github.com/didiht) | [#37](https://github.com/RiDDiX/home-assistant-matter-hub/issues/37) | 🐛 Alexa brightness |
| [@Dixiland20](https://github.com/Dixiland20) | [#34](https://github.com/RiDDiX/home-assistant-matter-hub/issues/34) | 🐛 Somfy shutters |
| [@chromaxx7](https://github.com/chromaxx7) | [#29](https://github.com/RiDDiX/home-assistant-matter-hub/issues/29) | 🐛 Climate crash |
| [@Tomyk9991](https://github.com/Tomyk9991) | [#28](https://github.com/RiDDiX/home-assistant-matter-hub/issues/28) | 🐛 Heat/Cool startup |
| [@datvista](https://github.com/datvista) | [#27](https://github.com/RiDDiX/home-assistant-matter-hub/issues/27) | 🐛 Add-on start |
| [@bwynants](https://github.com/bwynants) | [#23](https://github.com/RiDDiX/home-assistant-matter-hub/issues/23) | 🐛 OccupancySensor |
| [@Pozzi831](https://github.com/Pozzi831) | [#22](https://github.com/RiDDiX/home-assistant-matter-hub/issues/22) | 🐛 AC problems |

### 💖 Sponsors

> **Donations are completely voluntary!** I'm incredibly grateful to everyone who has supported this project - it wasn't necessary, but it truly means a lot. This project exists because of passion for open source, not money. ❤️

| Sponsor | |
|---------|---|
| [@thorsten-gehrig](https://github.com/thorsten-gehrig) | 🥇 **First Sponsor!** Thank you for believing in this project! |
| [@SH1FT-W](https://github.com/SH1FT-W) | 💎 Thank you for your generous support! |
| [@ilGaspa](https://github.com/ilGaspa) | 💎 Thank you for your generous support! |
| [@linux4life798](https://github.com/linux4life798) | 💎 Thank you for your generous support! |
| *Anonymous supporters* | 🙏 Thank you to those who prefer not to be named - your support is equally appreciated! |

### � UI/UX Contributors

| Contributor | Contribution |
|-------------|--------------|
| [@razzietheman](https://github.com/razzietheman) | 💡 Countless ideas for UI/UX improvements - making this project more user-friendly! |

### �🌟 Original Author

- **[@t0bst4r](https://github.com/t0bst4r)** - Creator of the original Home-Assistant-Matter-Hub project

---

## ☕ Support the Project

> [!NOTE]
> **Completely optional!** This project will continue regardless of donations.
> I maintain this in my free time because I believe in open source.

If you find this project useful, consider supporting its development:

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal&style=for-the-badge)](https://www.paypal.me/RiDDiX93)

Your support helps cover hosting costs and motivates continued development. Thank you! ❤️

---

## 📊 Project Stats

<div align="center">

![GitHub commit activity](https://img.shields.io/github/commit-activity/m/RiDDiX/home-assistant-matter-hub)
![GitHub last commit](https://img.shields.io/github/last-commit/RiDDiX/home-assistant-matter-hub)
![GitHub issues](https://img.shields.io/github/issues/RiDDiX/home-assistant-matter-hub)
![GitHub closed issues](https://img.shields.io/github/issues-closed/RiDDiX/home-assistant-matter-hub)
![GitHub pull requests](https://img.shields.io/github/issues-pr/RiDDiX/home-assistant-matter-hub)

</div>

---
