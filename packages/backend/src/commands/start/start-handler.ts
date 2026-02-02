import * as ws from "ws";
import type { ArgumentsCamelCase } from "yargs";
import { WebApi } from "../../api/web-api.js";
import { configureDefaultEnvironment } from "../../core/app/configure-default-environment.js";
import { Options } from "../../core/app/options.js";
import { AppEnvironment } from "../../core/ioc/app-environment.js";
import { BridgeService } from "../../services/bridges/bridge-service.js";
import { HomeAssistantRegistry } from "../../services/home-assistant/home-assistant-registry.js";
import type { StartOptions } from "./start-options.js";

// Suppress Matter.js internal errors that occur asynchronously during bridge operations
// These errors happen when:
// - Endpoints are already detached but Matter.js tries to persist data
// - Subscription timing calculations overflow (Invalid intervalMs)
// - GeneralDiagnostics cluster has invalid timing values
function shouldSuppressError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Endpoint storage inaccessible") ||
    msg.includes("Invalid intervalMs") ||
    msg.includes("generalDiagnostics")
  );
}

// Register early error handlers to catch errors before Matter.js initializes
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

// Re-register error handlers after Matter.js initialization to override its handlers
// Matter.js registers its own handlers that call process.exit(1), so we need to be last
function registerFinalErrorHandlers() {
  // Remove all listeners and re-add ours as the only ones
  // This ensures our suppression logic takes precedence
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");

  process.on("uncaughtException", (error) => {
    if (shouldSuppressError(error)) {
      console.warn("Suppressed Matter.js internal error:", error);
      return;
    }
    console.error("Uncaught exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    if (shouldSuppressError(reason)) {
      console.warn("Suppressed Matter.js internal error:", reason);
      return;
    }
    console.error("Unhandled rejection:", reason);
    process.exit(1);
  });
}

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

  // Register final error handlers AFTER Matter.js initialization
  // This overrides Matter.js's crash handlers that would otherwise call process.exit(1)
  registerFinalErrorHandlers();

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
