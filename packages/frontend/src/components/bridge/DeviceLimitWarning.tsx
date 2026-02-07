import type { BridgeDataWithMetadata } from "@home-assistant-matter-hub/common";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

interface ControllerLimit {
  name: string;
  warnAt: number;
  maxRecommended: number;
  infoUrl: string;
}

const controllerLimits: Record<string, ControllerLimit> = {
  apple: {
    name: "Apple Home (HomePod mini)",
    warnAt: 20,
    maxRecommended: 30,
    infoUrl: "https://support.apple.com/en-us/102135",
  },
  google: {
    name: "Google Home",
    warnAt: 80,
    maxRecommended: 100,
    infoUrl: "https://support.google.com/googlenest/answer/12391458",
  },
  amazon: {
    name: "Amazon Alexa",
    warnAt: 80,
    maxRecommended: 100,
    infoUrl:
      "https://www.amazon.com/gp/help/customer/display.html?nodeId=GX3RKEYSQR4BUXDJ",
  },
};

function detectControllers(bridge: BridgeDataWithMetadata): ControllerLimit[] {
  const fabrics = bridge.commissioning?.fabrics ?? [];
  const detected: ControllerLimit[] = [];

  for (const [key, limit] of Object.entries(controllerLimits)) {
    if (fabrics.some((f) => f.label?.toLowerCase().includes(key))) {
      detected.push(limit);
    }
  }

  return detected;
}

export interface DeviceLimitWarningProps {
  bridge: BridgeDataWithMetadata;
  compact?: boolean;
}

export const DeviceLimitWarning = ({
  bridge,
  compact = false,
}: DeviceLimitWarningProps) => {
  const warnings = useMemo(() => {
    const controllers = detectControllers(bridge);
    const count = bridge.deviceCount;

    return controllers
      .filter((c) => count >= c.warnAt)
      .map((c) => ({
        ...c,
        severity:
          count >= c.maxRecommended ? ("warning" as const) : ("info" as const),
      }));
  }, [bridge]);

  if (warnings.length === 0) {
    return null;
  }

  const mostSevere = warnings.some((w) => w.severity === "warning")
    ? "warning"
    : "info";

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        <WarningAmberIcon
          sx={{
            fontSize: 16,
            color: mostSevere === "warning" ? "warning.main" : "info.main",
          }}
        />
        <Typography
          variant="caption"
          color={mostSevere === "warning" ? "warning.main" : "info.main"}
        >
          {bridge.deviceCount} devices may exceed controller limits
        </Typography>
      </Box>
    );
  }

  return (
    <Alert severity={mostSevere} icon={<WarningAmberIcon />}>
      <AlertTitle>Device Limit Warning</AlertTitle>
      <Typography variant="body2" gutterBottom>
        This bridge has <strong>{bridge.deviceCount} devices</strong>. Some
        connected controllers have recommended limits that may be exceeded:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {warnings.map((w) => (
          <li key={w.name}>
            <Typography variant="body2">
              <strong>{w.name}</strong>: recommended max{" "}
              <strong>{w.maxRecommended}</strong> devices
              {bridge.deviceCount >= w.maxRecommended
                ? ' — limit reached, may cause "No Response" or connectivity issues'
                : ` — approaching limit (warn at ${w.warnAt})`}
              {" ("}
              <Link href={w.infoUrl} target="_blank" rel="noopener noreferrer">
                Learn more
              </Link>
              {")"}
            </Typography>
          </li>
        ))}
      </Box>
      <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
        Consider splitting devices across multiple bridges to improve
        reliability. Apple TV 4K supports ~50-80 devices, while HomePod mini is
        limited to ~20-30.
      </Typography>
    </Alert>
  );
};
