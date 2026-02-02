import type { FanDeviceAttributes } from "@home-assistant-matter-hub/common";
import {
  type HepaFilterMonitoringConfig,
  HepaFilterMonitoringServer,
} from "../../../../behaviors/hepa-filter-monitoring-server.js";

const attributes = (entity: { attributes: unknown }) =>
  entity.attributes as FanDeviceAttributes & {
    filter_life?: number;
    filter_life_remaining?: number;
    filter_life_level?: number;
  };

const config: HepaFilterMonitoringConfig = {
  getFilterLifePercent: (entity) => {
    const attrs = attributes(entity);
    // Try various attribute names used by different integrations
    const filterLife =
      attrs.filter_life ??
      attrs.filter_life_remaining ??
      attrs.filter_life_level;

    if (filterLife == null) {
      return null;
    }

    // Ensure value is in 0-100 range
    return Math.max(0, Math.min(100, filterLife));
  },
};

export const AirPurifierHepaFilterMonitoringServer =
  HepaFilterMonitoringServer(config);
