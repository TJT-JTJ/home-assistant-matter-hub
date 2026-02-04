# Robot Vacuum

Robot vacuums are exposed as Matter **Robotic Vacuum Cleaner** devices with the following capabilities:

- **On/Off** - Start and stop cleaning
- **RVC Operational State** - Current state (idle, running, docked, error)
- **RVC Run Mode** - Cleaning modes including room-specific cleaning
- **Service Area** - Room selection for Apple Home (Matter 1.4)
- **Power Source** - Battery level (if available)

## Room Selection

Room selection is supported through two mechanisms:

### 1. RVC Run Mode (Google Home, Alexa, etc.)

Custom cleaning modes are created for each room, e.g., "Clean Kitchen", "Clean Living Room". These appear as selectable modes in compatible controllers.

### 2. Service Area Cluster (Apple Home)

Apple Home uses the Matter 1.4 **Service Area** cluster for room selection. This is automatically enabled when your vacuum exposes room data.

## Room Data Requirements

For room selection to work, your vacuum integration must expose room data as entity attributes. Supported formats:

```yaml
# Format 1: Direct array
rooms:
  - id: 1
    name: Kitchen
  - id: 2
    name: Living Room

# Format 2: Segments array
segments:
  - id: 1
    name: Kitchen
  - id: 2
    name: Living Room

# Format 3: Dreame nested format
rooms:
  "My Home":
    - id: 1
      name: Kitchen
    - id: 2
      name: Living Room
```

## Apple Home Limitations

Apple Home has specific limitations with robot vacuums over Matter:

### Bridge Limitation

**Important:** Apple Home currently only supports robot vacuums as:
- A **single device** (not in a bridge), OR
- The **only device** in a bridge

If your vacuum is in a bridge with other devices, Apple Home may not display it correctly or may crash.

### Workaround: Separate Bridge

If you experience issues with your vacuum in Apple Home:

1. Create a **new bridge** in Home Assistant Matter Hub
2. Add **only** the vacuum to this bridge
3. Pair this bridge separately with Apple Home
4. Your other devices remain on the main bridge

This ensures the vacuum works correctly with Apple Home while your other devices continue to work on the main bridge.

## Supported Integrations

Room selection works with any integration that exposes room data as attributes:

| Integration | Room Attribute | Notes |
|-------------|---------------|-------|
| Roborock | `rooms` or `segments` | Native support |
| Dreame | `rooms` | Nested format with map name |
| Xiaomi | `rooms` | May require custom integration |
| Ecovacs | `rooms` | Varies by model |

### Dreame Integration Note

The Dreame integration exposes room data in a nested format. As of version 1.x-alpha.150+, this format is fully supported.

If your vacuum uses separate `select` entities for room selection instead of attributes, room selection via Matter is not currently supported.

## Troubleshooting

### Rooms not appearing in Apple Home

1. **Re-pair the vacuum**: Remove it from Apple Home and add it again after updating
2. **Check room attributes**: Verify your vacuum has `rooms`, `segments`, or `room_list` in its attributes
3. **Separate bridge**: Try putting the vacuum in its own bridge (see above)

### Room selection not working

1. Check the logs for errors when selecting a room
2. Verify the vacuum integration supports the `vacuum.send_command` service with `app_segment_clean`

### Vacuum not showing in Apple Home

This is likely the bridge limitation issue. Create a separate bridge with only the vacuum.
