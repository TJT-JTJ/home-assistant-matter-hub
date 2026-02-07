# Temperature & Humidity Sensor

Many Zigbee-based sensors (like Xiaomi Aqara, Sonoff SNZB-02, etc.) report temperature, humidity, and battery level as **separate entities** in Home Assistant. This can result in three individual devices appearing in your Matter controller instead of one unified device.

With **Entity Mapping**, you can combine these into a **single Matter device** that shows temperature, humidity, and battery status together.

## Features

- **Combined Device** - Single device in Apple Home, Google Home, Alexa instead of 3 separate ones
- **Temperature** - Primary measurement from your temperature sensor
- **Humidity** - Linked from a separate humidity sensor entity
- **Battery Level** - Optional battery status from a separate battery sensor entity
- **Device Name** - Uses your Home Assistant entity name (e.g., "H&T Bad")

## How It Works

Instead of exposing each sensor entity separately:

| Without Mapping | With Mapping |
|-----------------|--------------|
| H&T Bad Temperature | **H&T Bad** (combined) |
| H&T Bad Humidity | — |
| H&T Bad Battery | — |

The combined device reports all values in one place.

## Configuration

### Step 1: Identify Your Entities

In Home Assistant, find your related sensor entities. For example, a typical Zigbee H&T sensor creates:

- `sensor.h_t_bad_temperature` - Temperature measurement
- `sensor.h_t_bad_humidity` - Humidity measurement  
- `sensor.h_t_bad_battery` - Battery percentage

### Step 2: Configure Entity Mapping

1. Go to your **Bridge** in the Dashboard
2. Find your **temperature** sensor entity (e.g., `sensor.h_t_bad_temperature`)
3. Click **Edit Mapping**
4. Fill in the optional fields:
   - **Humidity Sensor**: `sensor.h_t_bad_humidity`
   - **Battery Sensor**: `sensor.h_t_bad_battery`
5. Click **Save**

### Step 3: Exclude the Individual Entities

To prevent duplicate devices in your Matter controller:

1. Find the humidity entity (`sensor.h_t_bad_humidity`)
2. Click **Edit Mapping** → Enable **"Disable this entity"**
3. Repeat for the battery entity (`sensor.h_t_bad_battery`)

Or simply don't include them in your bridge's entity filter.

### Step 4: Re-pair (if necessary)

If your devices were already paired, you may need to remove and re-add them in your Matter controller because the device capabilities have changed.

## Example Configuration

For a sensor named "H&T Bad" with these entities:

| Entity | Mapping |
|--------|---------|
| `sensor.h_t_bad_temperature` | **Primary** - Set `humidityEntity` and `batteryEntity` |
| `sensor.h_t_bad_humidity` | **Disabled** or excluded from bridge |
| `sensor.h_t_bad_battery` | **Disabled** or excluded from bridge |

Result: One device "H&T Bad" showing temperature, humidity, and battery.

## Compatibility

| Controller | Temperature | Humidity | Battery |
|------------|-------------|----------|---------|
| Apple Home | ✅ | ✅ | ✅ |
| Google Home | ✅ | ✅ | ✅ |
| Amazon Alexa | ✅ | ✅ | ⚠️ Limited |

## Technical Details

The combined sensor uses these Matter clusters:

- **TemperatureMeasurement** - From the primary temperature entity
- **RelativeHumidityMeasurement** - From the linked humidity entity
- **PowerSource** - Battery level from the linked battery entity

## Troubleshooting

### Humidity/Battery not showing

1. Verify the entity IDs are correct (check spelling, case sensitivity)
2. Confirm the linked sensors provide numeric values
3. Remove and re-add the device in your Matter controller

### Device shows incorrect name

The Matter device name comes from your primary temperature entity's `friendly_name` in Home Assistant. Customize it there or use the **Custom Name** field in Entity Mapping.

### Old individual devices still appear

After configuring the combined sensor:

1. Disable or exclude the individual humidity/battery entities
2. Remove old devices from your Matter controller
3. Re-pair the bridge if necessary

## Example Home Assistant Entities

Typical Zigbee H&T sensor entities:

```yaml
# Temperature sensor
sensor.h_t_bad_temperature:
  state: "21.5"
  attributes:
    device_class: temperature
    unit_of_measurement: "°C"
    friendly_name: "H&T Bad"

# Humidity sensor  
sensor.h_t_bad_humidity:
  state: "58"
  attributes:
    device_class: humidity
    unit_of_measurement: "%"
    friendly_name: "H&T Bad Humidity"

# Battery sensor
sensor.h_t_bad_battery:
  state: "87"
  attributes:
    device_class: battery
    unit_of_measurement: "%"
    friendly_name: "H&T Bad Battery"
```
