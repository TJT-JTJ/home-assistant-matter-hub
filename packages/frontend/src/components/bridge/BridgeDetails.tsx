import type { BridgeDataWithMetadata } from "@home-assistant-matter-hub/common";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import RemoveIcon from "@mui/icons-material/Remove";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { navigation } from "../../routes.tsx";
import { FabricList } from "../fabric/FabricList.tsx";

export interface BridgeDetailsProps {
  readonly bridge: BridgeDataWithMetadata;
}

export const BridgeDetails = ({ bridge }: BridgeDetailsProps) => {
  return (
    <Paper sx={{ padding: 2 }}>
      <Stack spacing={2}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: "auto" }}>
            <Pairing bridge={bridge} />
          </Grid>
          <Grid size={{ xs: 12, md: "grow" }}>
            <BasicInfo bridge={bridge} />
          </Grid>
          <Grid size={{ xs: 12, md: "grow" }}>
            <CommissioningInfo bridge={bridge} />
          </Grid>
        </Grid>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {bridge.filter.include.map((filter, idx) => (
            <Chip
              key={idx.toString()}
              size="small"
              icon={<AddIcon />}
              label={
                <span>
                  <strong>{filter.type}</strong>: {filter.value}
                </span>
              }
              color="success"
            />
          ))}
          {bridge.filter.exclude.map((filter, idx) => (
            <Chip
              key={idx.toString()}
              size="small"
              icon={<RemoveIcon />}
              label={
                <span>
                  <strong>{filter.type}</strong>: {filter.value}
                </span>
              }
              color="error"
            />
          ))}
        </Stack>
        <FailedEntities bridge={bridge} />
      </Stack>
    </Paper>
  );
};

const Pairing = (props: { bridge: BridgeDataWithMetadata }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!props.bridge.commissioning) {
    return "";
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
        <Box position="relative" maxWidth="160px">
          {props.bridge.commissioning.isCommissioned && (
            <Box
              position="absolute"
              top="50%"
              left="50%"
              sx={{ transform: "translate(-50%, -50%) rotate(-45deg)" }}
            >
              <Alert color="success" variant="filled">
                <Typography
                  variant="body2"
                  component="a"
                  sx={{
                    textDecoration: "underline",
                    textDecorationStyle: "dashed",
                    cursor: "help",
                    color: "inherit",
                  }}
                  href={navigation.faq.multiFabric}
                  target="_blank"
                >
                  Commissioned
                </Typography>
              </Alert>
            </Box>
          )}
          <Box
            style={{
              background: "white",
              padding: "9px",
              paddingBottom: "2.6px",
            }}
          >
            <QRCodeSVG
              value={props.bridge.commissioning.qrPairingCode}
              style={{ width: "100%", height: "100%" }}
            />
          </Box>
        </Box>
        {props.bridge.commissioning.isCommissioned && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<QrCode2Icon />}
            onClick={() => setDialogOpen(true)}
          >
            Add Controller
          </Button>
        )}
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <QrCode2Icon />
            Add Another Controller
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Scan this QR code with your Matter controller (Apple Home, Google
            Home, Alexa, etc.) to add this bridge to another ecosystem.
          </Typography>

          <Box display="flex" justifyContent="center" my={3}>
            <Box
              style={{
                background: "white",
                padding: "16px",
                borderRadius: "8px",
              }}
            >
              <QRCodeSVG
                value={props.bridge.commissioning.qrPairingCode}
                size={200}
              />
            </Box>
          </Box>

          <Stack spacing={1}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2">
                <strong>Manual Code:</strong>{" "}
                {props.bridge.commissioning.manualPairingCode}
              </Typography>
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() =>
                    copyToClipboard(
                      props.bridge.commissioning!.manualPairingCode,
                    )
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2">
                <strong>Passcode:</strong> {props.bridge.commissioning.passcode}
              </Typography>
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() =>
                    copyToClipboard(
                      props.bridge.commissioning!.passcode.toString(),
                    )
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2">
                <strong>Discriminator:</strong>{" "}
                {props.bridge.commissioning.discriminator}
              </Typography>
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() =>
                    copyToClipboard(
                      props.bridge.commissioning!.discriminator.toString(),
                    )
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Matter supports connecting the same bridge to multiple controllers
              simultaneously. Each controller will have independent control.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const BasicInfo = (props: { bridge: BridgeDataWithMetadata }) => {
  return (
    <Typography variant="subtitle2" component="div">
      <div>ID: {props.bridge.id}</div>
      <div>Name: {props.bridge.name}</div>
      <div>Port: {props.bridge.port}</div>
      <div>
        <div>Fabrics:</div>
        <div style={{ fontSize: "1.5em" }}>
          {props.bridge.commissioning?.fabrics && (
            <FabricList fabrics={props.bridge.commissioning.fabrics} />
          )}
        </div>
      </div>
    </Typography>
  );
};

const CommissioningInfo = (props: { bridge: BridgeDataWithMetadata }) => {
  if (!props.bridge.commissioning) {
    return "";
  }
  return (
    <Typography variant="subtitle2" component="div">
      <div>Passcode: {props.bridge.commissioning.passcode}</div>
      <div>Discriminator: {props.bridge.commissioning.discriminator}</div>
      <div>
        Manual Pairing Code: {props.bridge.commissioning.manualPairingCode}
      </div>
      <div>QR Pairing Code: {props.bridge.commissioning.qrPairingCode}</div>
    </Typography>
  );
};

const FailedEntities = (props: { bridge: BridgeDataWithMetadata }) => {
  const failedEntities = props.bridge.failedEntities;
  if (!failedEntities || failedEntities.length === 0) {
    return null;
  }

  return (
    <Alert severity="warning" icon={<ErrorOutlineIcon />}>
      <AlertTitle>Failed Entities ({failedEntities.length})</AlertTitle>
      <Typography variant="body2" component="div">
        The following entities could not be added to the bridge:
      </Typography>
      <Box sx={{ mt: 1, maxHeight: 200, overflow: "auto" }}>
        {failedEntities.map((entity) => (
          <Box key={entity.entityId} sx={{ mb: 0.5 }}>
            <Typography variant="body2" component="span" fontWeight="bold">
              {entity.entityId}
            </Typography>
            <Typography variant="body2" component="span" color="text.secondary">
              {" — "}
              {entity.reason}
            </Typography>
          </Box>
        ))}
      </Box>
    </Alert>
  );
};
