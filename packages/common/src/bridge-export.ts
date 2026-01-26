import type { BridgeData } from "./bridge-data.js";

export const BRIDGE_EXPORT_VERSION = 1;

export interface BridgeExportData {
  readonly version: number;
  readonly exportedAt: string;
  readonly bridges: BridgeData[];
}

export interface BridgeImportPreview {
  readonly version: number;
  readonly exportedAt: string;
  readonly bridges: BridgeImportPreviewItem[];
}

export interface BridgeImportPreviewItem {
  readonly id: string;
  readonly name: string;
  readonly port: number;
  readonly entityCount: number;
  readonly exists: boolean;
}

export interface BridgeImportRequest {
  readonly bridgeIds: string[];
  readonly overwriteExisting: boolean;
}

export interface BridgeImportResult {
  readonly imported: number;
  readonly skipped: number;
  readonly errors: BridgeImportError[];
}

export interface BridgeImportError {
  readonly bridgeId: string;
  readonly bridgeName: string;
  readonly reason: string;
}
