import type {
  BridgeExportData,
  BridgeImportPreview,
  BridgeImportRequest,
  BridgeImportResult,
} from "@home-assistant-matter-hub/common";

export async function exportAllBridges(): Promise<void> {
  const response = await fetch("api/bridges/export");
  if (!response.ok) {
    throw new Error(`Failed to export bridges: ${response.statusText}`);
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  const filename =
    contentDisposition?.match(/filename="(.+)"/)?.[1] ||
    `hamh-bridges-${new Date().toISOString().split("T")[0]}.json`;
  downloadBlob(blob, filename);
}

export async function exportBridge(bridgeId: string): Promise<void> {
  const response = await fetch(`api/bridges/export/${bridgeId}`);
  if (!response.ok) {
    throw new Error(`Failed to export bridge: ${response.statusText}`);
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  const filename =
    contentDisposition?.match(/filename="(.+)"/)?.[1] ||
    `hamh-bridge-${bridgeId}.json`;
  downloadBlob(blob, filename);
}

export async function previewImport(
  data: BridgeExportData,
): Promise<BridgeImportPreview> {
  const response = await fetch("api/bridges/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to preview import: ${response.statusText}`);
  }
  return response.json();
}

export async function importBridges(
  data: BridgeExportData,
  options: BridgeImportRequest,
): Promise<BridgeImportResult> {
  const response = await fetch("api/bridges/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, options }),
  });
  if (!response.ok) {
    throw new Error(`Failed to import bridges: ${response.statusText}`);
  }
  return response.json();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
