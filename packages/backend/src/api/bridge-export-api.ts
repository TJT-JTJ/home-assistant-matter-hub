import type {
  BridgeData,
  BridgeExportData,
  BridgeImportError,
  BridgeImportPreview,
  BridgeImportRequest,
  BridgeImportResult,
} from "@home-assistant-matter-hub/common";
import express from "express";
import type { BridgeStorage } from "../services/storage/bridge-storage.js";

export function bridgeExportApi(bridgeStorage: BridgeStorage): express.Router {
  const router = express.Router();

  router.get("/export", (_, res) => {
    const bridges = bridgeStorage.bridges;
    const exportData: BridgeExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bridges: bridges as BridgeData[],
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hamh-bridges-${new Date().toISOString().split("T")[0]}.json"`,
    );
    res.json(exportData);
  });

  router.get("/export/:bridgeId", (req, res) => {
    const { bridgeId } = req.params;
    const bridge = bridgeStorage.bridges.find((b) => b.id === bridgeId);
    if (!bridge) {
      res.status(404).json({ error: "Bridge not found" });
      return;
    }
    const exportData: BridgeExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bridges: [bridge as BridgeData],
    };
    const safeName = bridge.name.replace(/[^a-zA-Z0-9]/g, "-");
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hamh-bridge-${safeName}-${new Date().toISOString().split("T")[0]}.json"`,
    );
    res.json(exportData);
  });

  router.post("/import/preview", (req, res) => {
    try {
      const exportData = req.body as BridgeExportData;
      if (!exportData.version || !exportData.bridges) {
        res.status(400).json({ error: "Invalid export file format" });
        return;
      }

      const existingIds = new Set(bridgeStorage.bridges.map((b) => b.id));
      const preview: BridgeImportPreview = {
        version: exportData.version,
        exportedAt: exportData.exportedAt,
        bridges: exportData.bridges.map((bridge: BridgeData) => ({
          id: bridge.id,
          name: bridge.name,
          port: bridge.port,
          entityCount:
            (bridge.filter.include?.length || 0) +
            (bridge.filter.exclude?.length || 0),
          exists: existingIds.has(bridge.id),
        })),
      };
      res.json(preview);
    } catch {
      res.status(400).json({ error: "Failed to parse export file" });
    }
  });

  router.post("/import", async (req, res) => {
    try {
      const { data, options } = req.body as {
        data: BridgeExportData;
        options: BridgeImportRequest;
      };

      if (!data.version || !data.bridges) {
        res.status(400).json({ error: "Invalid export file format" });
        return;
      }

      const existingIds = new Set(bridgeStorage.bridges.map((b) => b.id));
      const bridgesToImport = data.bridges.filter((b: BridgeData) =>
        options.bridgeIds.includes(b.id),
      );

      let imported = 0;
      let skipped = 0;
      const errors: BridgeImportError[] = [];

      for (const bridge of bridgesToImport) {
        try {
          const exists = existingIds.has(bridge.id);
          if (exists && !options.overwriteExisting) {
            skipped++;
            continue;
          }

          await bridgeStorage.add(bridge);
          imported++;
        } catch (e) {
          errors.push({
            bridgeId: bridge.id,
            bridgeName: bridge.name,
            reason: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }

      const result: BridgeImportResult = { imported, skipped, errors };
      res.json(result);
    } catch {
      res.status(400).json({ error: "Failed to import bridges" });
    }
  });

  return router;
}
