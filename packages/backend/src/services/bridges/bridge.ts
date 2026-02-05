import {
  BridgeStatus,
  type UpdateBridgeRequest,
} from "@home-assistant-matter-hub/common";
import type { Environment, Logger } from "@matter/general";
import type { LoggerService } from "../../core/app/logger.js";
import { BridgeServerNode } from "../../matter/endpoints/bridge-server-node.js";
import type {
  BridgeDataProvider,
  BridgeServerStatus,
} from "./bridge-data-provider.js";
import type { BridgeEndpointManager } from "./bridge-endpoint-manager.js";

export class Bridge {
  private readonly log: Logger;
  readonly server: BridgeServerNode;

  private status: BridgeServerStatus = {
    code: BridgeStatus.Stopped,
    reason: undefined,
  };

  get id() {
    return this.dataProvider.id;
  }

  get data() {
    return this.dataProvider.withMetadata(
      this.status,
      this.server,
      this.aggregator.parts.size,
      this.endpointManager.failedEntities,
    );
  }

  get aggregator() {
    return this.endpointManager.root;
  }

  constructor(
    env: Environment,
    logger: LoggerService,
    private readonly dataProvider: BridgeDataProvider,
    private readonly endpointManager: BridgeEndpointManager,
  ) {
    this.log = logger.get(`Bridge / ${dataProvider.id}`);
    this.server = new BridgeServerNode(
      env,
      this.dataProvider,
      this.endpointManager.root,
    );
  }

  async initialize(): Promise<void> {
    await this.server.construction.ready.then();
    await this.refreshDevices();
  }
  async dispose(): Promise<void> {
    await this.stop();
  }

  async refreshDevices() {
    await this.endpointManager.refreshDevices();
  }

  async start() {
    if (this.status.code === BridgeStatus.Running) {
      return;
    }
    try {
      this.status = {
        code: BridgeStatus.Starting,
        reason: "The bridge is starting... Please wait.",
      };
      await this.refreshDevices();
      this.endpointManager.startObserving();
      await this.server.start();
      this.status = { code: BridgeStatus.Running };
    } catch (e) {
      const reason = "Failed to start bridge due to error:";
      this.log.error(reason, e);
      await this.stop(BridgeStatus.Failed, `${reason}\n${e?.toString()}`);
    }
  }

  async stop(
    code: BridgeStatus = BridgeStatus.Stopped,
    reason = "Manually stopped",
  ) {
    this.endpointManager.stopObserving();
    try {
      await this.server.cancel();
    } catch (e) {
      // Ignore mutex-closed errors during shutdown - this is expected
      // when the environment is being disposed
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!errorMessage.includes("mutex-closed")) {
        this.log.warn("Error stopping bridge server:", e);
      }
    }
    this.status = { code, reason };
  }

  async update(update: UpdateBridgeRequest) {
    try {
      this.dataProvider.update(update);
      await this.refreshDevices();
    } catch (e) {
      const reason = "Failed to update bridge due to error:";
      this.log.error(reason, e);
      await this.stop(BridgeStatus.Failed, `${reason}\n${e?.toString()}`);
    }
  }

  async factoryReset() {
    if (this.status.code !== BridgeStatus.Running) {
      return;
    }
    await this.server.factoryReset();
    this.status = { code: BridgeStatus.Stopped };
    await this.start();
  }

  /**
   * Force sync all device states to connected controllers.
   * This triggers a state refresh for all endpoints, pushing current values
   * to all subscribed Matter controllers without requiring re-pairing.
   *
   * This works by re-emitting the current entity state, which causes all
   * behavior servers to re-apply their state patches. Matter.js then sends
   * subscription updates to all controllers for any changed attributes.
   */
  async forceSync(): Promise<number> {
    if (this.status.code !== BridgeStatus.Running) {
      this.log.warn("Cannot force sync - bridge is not running");
      return 0;
    }

    this.log.info("Force sync: Pushing all device states to controllers...");

    // Import dynamically to avoid circular dependencies
    const { HomeAssistantEntityBehavior } = await import(
      "../../matter/behaviors/home-assistant-entity-behavior.js"
    );

    const endpoints = this.aggregator.parts;
    let syncedCount = 0;

    for (const endpoint of endpoints) {
      try {
        // Check if this endpoint has the HomeAssistantEntityBehavior
        if (!endpoint.behaviors.has(HomeAssistantEntityBehavior)) {
          continue;
        }

        // Get the current entity state and re-emit it
        // This triggers all behaviors listening to onChange to re-apply their state
        const behavior = endpoint.stateOf(HomeAssistantEntityBehavior);
        const currentEntity = behavior.entity;

        if (currentEntity?.state) {
          // Re-set the state to trigger the entity$Changed event
          // Even setting to the same value will cause behaviors to re-evaluate
          await endpoint.setStateOf(HomeAssistantEntityBehavior, {
            entity: {
              ...currentEntity,
              // Add a timestamp to force Matter.js to consider this a change
              state: { ...currentEntity.state },
            },
          });
          syncedCount++;
        }
      } catch (e) {
        this.log.debug(`Force sync: Skipped endpoint due to error:`, e);
      }
    }

    this.log.info(`Force sync: Completed for ${syncedCount} devices`);
    return syncedCount;
  }

  async delete() {
    await this.server.delete();
  }
}
