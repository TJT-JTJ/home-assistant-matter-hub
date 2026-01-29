import type { Logger } from "@matter/general";
import { callService } from "home-assistant-js-websocket";
import type { HassServiceTarget } from "home-assistant-js-websocket/dist/types.js";
import type { LoggerService } from "../../core/app/logger.js";
import { Service } from "../../core/ioc/service.js";
import { DebounceContext } from "../../utils/debounce-context.js";
import { CircuitBreaker, withRetry } from "../../utils/retry.js";
import type { HomeAssistantClient } from "./home-assistant-client.js";

export interface HomeAssistantAction {
  action: string;
  data?: object | undefined;
}

interface HomeAssistantActionCall extends HomeAssistantAction {
  entityId: string;
}

export interface HomeAssistantActionsConfig {
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
}

const defaultConfig: Required<HomeAssistantActionsConfig> = {
  retryAttempts: 3,
  retryBaseDelayMs: 100,
  retryMaxDelayMs: 5000,
  circuitBreakerThreshold: 10,
  circuitBreakerResetMs: 30000,
};

export class HomeAssistantActions extends Service {
  private readonly log: Logger;
  private readonly debounceContext = new DebounceContext(
    this.processAction.bind(this),
  );
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: Required<HomeAssistantActionsConfig>;
  private consecutiveFailures = 0;
  private lastSuccessTime = Date.now();

  constructor(
    logger: LoggerService,
    private readonly client: HomeAssistantClient,
    config?: HomeAssistantActionsConfig,
  ) {
    super("HomeAssistantActions");
    this.log = logger.get(this);
    this.config = { ...defaultConfig, ...config };
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetMs,
    );
  }

  private processAction(_key: string, calls: HomeAssistantActionCall[]) {
    const entity_id = calls[0].entityId;
    const action = calls[0].action;
    const data = Object.assign({}, ...calls.map((c) => c.data));
    const [domain, actionName] = action.split(".");
    this.callAction(domain, actionName, data, { entity_id }, false).catch(
      (error) => {
        this.log.error(
          `Failed to call action '${action}' for entity '${entity_id}': ${error}`,
        );
      },
    );
  }

  call(action: HomeAssistantAction, entityId: string) {
    const key = `${entityId}-${action.action}`;
    this.debounceContext.get(key, 100)({ ...action, entityId });
  }

  async callAction<T = void>(
    domain: string,
    action: string,
    data: object | undefined,
    target: HassServiceTarget,
    returnResponse?: boolean,
  ): Promise<T> {
    const actionKey = `${domain}.${action}`;
    const targetStr = JSON.stringify(target);

    this.log.debug(
      `Calling action '${actionKey}' for target ${targetStr} with data ${JSON.stringify(data ?? {})}`,
    );

    try {
      const result = await this.circuitBreaker.execute(() =>
        withRetry(
          async () => {
            const res = await callService(
              this.client.connection,
              domain,
              action,
              data,
              target,
              returnResponse,
            );
            return res as T;
          },
          {
            maxAttempts: this.config.retryAttempts,
            baseDelayMs: this.config.retryBaseDelayMs,
            maxDelayMs: this.config.retryMaxDelayMs,
            onRetry: (attempt, error, delayMs) => {
              this.log.warn(
                `Retrying action '${actionKey}' for ${targetStr} (attempt ${attempt}): ${error.message}. Next retry in ${delayMs}ms`,
              );
            },
          },
        ),
      );

      this.onActionSuccess();
      return result;
    } catch (error) {
      this.onActionFailure(actionKey, targetStr, error);
      throw error;
    }
  }

  private onActionSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
  }

  private onActionFailure(
    action: string,
    target: string,
    error: unknown,
  ): void {
    this.consecutiveFailures++;
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (this.circuitBreaker.isOpen) {
      this.log.error(
        `Circuit breaker OPEN after ${this.consecutiveFailures} consecutive failures. ` +
          `Action '${action}' for ${target} blocked. Last error: ${errorMsg}`,
      );
    } else {
      this.log.error(
        `Action '${action}' for ${target} failed after retries: ${errorMsg}`,
      );
    }
  }

  getHealthStatus(): {
    consecutiveFailures: number;
    circuitBreakerOpen: boolean;
    lastSuccessMs: number;
  } {
    return {
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      lastSuccessMs: Date.now() - this.lastSuccessTime,
    };
  }

  override async dispose(): Promise<void> {
    this.debounceContext.unregisterAll();
  }
}
