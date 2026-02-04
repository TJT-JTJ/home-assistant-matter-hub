import { OnOffServer } from "../../../../behaviors/on-off-server.js";

export const LightOnOffServer = OnOffServer({
  turnOn: () => ({
    // Use homeassistant.turn_on to support entity type overrides
    // (e.g., switch exposed as light via entity mapping)
    action: "homeassistant.turn_on",
  }),
  turnOff: () => ({
    action: "homeassistant.turn_off",
  }),
  isOn: (e) => e.state === "on",
}).with("Lighting");
