import * as ws from "ws";
import type { ArgumentsCamelCase } from "yargs";
import { WebApi } from "../../api/web-api.js";
import { configureDefaultEnvironment } from "../../core/app/configure-default-environment.js";
import { Options } from "../../core/app/options.js";
import { AppEnvironment } from "../../core/ioc/app-environment.js";
import { BridgeService } from "../../services/bridges/bridge-service.js";
import { HomeAssistantRegistry } from "../../services/home-assistant/home-assistant-registry.js";
import type { StartOptions } from "./start-options.js";

// Suppress Matter.js internal errors that occur asynchronously during bridge deletion
// These errors happen when endpoints are already detached but Matter.js tries to persist data
function shouldSuppressError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("Endpoint storage inaccessible");
}

process.on("uncaughtException", (error) => {
  if (shouldSuppressError(error)) {
    return; // Suppress this specific error
  }
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (shouldSuppressError(reason)) {
    return; // Suppress this specific error
  }
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

export async function startHandler(
  startOptions: ArgumentsCamelCase<StartOptions>,
  webUiDist?: string,
): Promise<void> {
  Object.assign(globalThis, {
    WebSocket: globalThis.WebSocket ?? ws.WebSocket,
  });
  const options = new Options({ ...startOptions, webUiDist });
  const rootEnv = configureDefaultEnvironment(options);
  const appEnvironment = await AppEnvironment.create(rootEnv, options);

  const bridgeService$ = appEnvironment.load(BridgeService);
  const webApi$ = appEnvironment.load(WebApi);
  const registry$ = appEnvironment.load(HomeAssistantRegistry);

  const initBridges = bridgeService$.then((b) => b.startAll());
  const initApi = webApi$.then((w) => w.start());

  const enableAutoRefresh = initBridges
    .then(() => Promise.all([registry$, bridgeService$]))
    .then(([r, b]) => r.enableAutoRefresh(() => b.refreshAll()));

  await Promise.all([initBridges, initApi, enableAutoRefresh]);
}
