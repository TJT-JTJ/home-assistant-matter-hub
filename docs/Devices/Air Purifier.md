# Air Purifier

Air Purifiers from Home Assistant's `fan` domain can be exposed to Matter controllers as Air Purifier devices.

## Features

- **On/Off Control** - Turn the air purifier on or off
- **Speed Control** - Adjust fan speed (if supported)
- **Preset Modes** - Auto mode and other presets (if supported)
- **HEPA Filter Life Monitoring** - Show filter life remaining in Matter controllers

## HEPA Filter Life Monitoring

Matter's Air Purifier device type includes HEPA Filter Monitoring, which displays the remaining filter life in compatible Matter controllers (Apple Home, Google Home, Alexa).

### Automatic Detection

If your air purifier entity has any of these attributes, filter life monitoring is automatically enabled:

- `filter_life`
- `filter_life_remaining`
- `filter_life_level`

The value should be a percentage (0-100), where 100 = new filter and 0 = needs replacement.

### Using a Separate Sensor Entity

Many Home Assistant integrations expose filter life as a separate sensor entity (e.g., `sensor.air_purifier_filter_life`) instead of an attribute on the fan entity.

To use a separate sensor, configure it in **Entity Mapping**:

1. Go to your Bridge in the Dashboard
2. Find your air purifier entity
3. Click **Edit Mapping**
4. In the **Filter Life Sensor** field, enter your sensor entity ID (e.g., `sensor.luftreiniger_filter_life`)
5. Save the mapping

The sensor should provide a percentage value (0-100).

### Template Sensor Workaround

If you prefer to add filter life as an attribute directly to your fan entity, you can use Home Assistant's customization:

```yaml
# configuration.yaml
homeassistant:
  customize:
    fan.air_purifier:
      filter_life: "{{ states('sensor.air_purifier_filter_life') | int }}"
```

Or create a template fan entity that includes the filter life attribute.

## Change Indication

The filter monitoring automatically sets the `changeIndication` attribute based on filter life:

| Filter Life | Change Indication | Meaning |
|-------------|-------------------|---------|
| > 20% | **Ok** | Filter is fine |
| 5% - 20% | **Warning** | Filter life is low |
| < 5% | **Critical** | Filter needs immediate replacement |

## Example Entity

```yaml
# Example air purifier entity with filter life attribute
fan.living_room_air_purifier:
  state: "on"
  attributes:
    percentage: 50
    preset_mode: "auto"
    preset_modes:
      - "auto"
      - "sleep"
      - "turbo"
    filter_life: 85  # 85% remaining
    supported_features: 15
```

## Compatibility

| Controller | Filter Life Display |
|------------|---------------------|
| Apple Home | ✅ Shows filter status |
| Google Home | ✅ Shows filter status |
| Amazon Alexa | ⚠️ Limited support |

## Troubleshooting

### Filter life not showing

1. Check that your sensor provides a numeric percentage value (0-100)
2. Verify the sensor entity ID is correct in Entity Mapping
3. Remove and re-add the device in your Matter controller (device capabilities changed)

### Filter always shows 100%

The sensor value might not be updating. Check in Home Assistant Developer Tools > States that the sensor is returning the correct value.
