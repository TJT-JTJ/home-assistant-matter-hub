import type { BridgeDataWithMetadata } from "@home-assistant-matter-hub/common";
import { createAction } from "@reduxjs/toolkit";
import {
  createBridge as createBridgeApi,
  deleteBridge as deleteBridgeApi,
  fetchBridges,
  resetBridge as resetBridgeApi,
  updateBridge as updateBridgeApi,
} from "../../api/bridges.ts";
import { createAppThunk } from "../types.ts";

export const loadBridges = createAppThunk("bridges/load", fetchBridges);

export const createBridge = createAppThunk("bridges/create", createBridgeApi);

export const deleteBridge = createAppThunk("bridges/delete", deleteBridgeApi);

export const updateBridge = createAppThunk("bridges/update", updateBridgeApi);

export const resetBridge = createAppThunk("bridges/reset", resetBridgeApi);

export const setBridgesFromWebSocket = createAction<BridgeDataWithMetadata[]>(
  "bridges/setFromWebSocket",
);

export const updateBridgeFromWebSocket = createAction<BridgeDataWithMetadata>(
  "bridges/updateFromWebSocket",
);
