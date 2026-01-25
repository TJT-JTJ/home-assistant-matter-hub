import type {
  EntityMappingConfig,
  MatterDeviceType,
} from "@home-assistant-matter-hub/common";
import {
  domainToDefaultMatterTypes,
  matterDeviceTypeLabels,
} from "@home-assistant-matter-hub/common";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useCallback, useEffect, useState } from "react";

interface EntityMappingDialogProps {
  open: boolean;
  entityId: string;
  domain: string;
  currentMapping?: EntityMappingConfig;
  onSave: (config: Partial<EntityMappingConfig>) => void;
  onClose: () => void;
}

export function EntityMappingDialog({
  open,
  entityId,
  domain,
  currentMapping,
  onSave,
  onClose,
}: EntityMappingDialogProps) {
  const [matterDeviceType, setMatterDeviceType] = useState<
    MatterDeviceType | ""
  >("");
  const [customName, setCustomName] = useState("");
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (open) {
      setMatterDeviceType(currentMapping?.matterDeviceType || "");
      setCustomName(currentMapping?.customName || "");
      setDisabled(currentMapping?.disabled || false);
    }
  }, [open, currentMapping]);

  const handleSave = useCallback(() => {
    onSave({
      entityId,
      matterDeviceType: matterDeviceType || undefined,
      customName: customName.trim() || undefined,
      disabled,
    });
  }, [entityId, matterDeviceType, customName, disabled, onSave]);

  const availableTypes = Object.entries(matterDeviceTypeLabels) as [
    MatterDeviceType,
    string,
  ][];
  const suggestedTypes =
    domainToDefaultMatterTypes[
      domain as keyof typeof domainToDefaultMatterTypes
    ] || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Entity Mapping: {entityId}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="normal">
          <InputLabel id="matter-device-type-label">
            Matter Device Type
          </InputLabel>
          <Select
            labelId="matter-device-type-label"
            value={matterDeviceType}
            label="Matter Device Type"
            onChange={(e) =>
              setMatterDeviceType(e.target.value as MatterDeviceType | "")
            }
          >
            <MenuItem value="">
              <em>Auto-detect (default)</em>
            </MenuItem>
            {suggestedTypes.length > 0 && (
              <MenuItem disabled>— Suggested for {domain} —</MenuItem>
            )}
            {suggestedTypes.map((type: MatterDeviceType) => (
              <MenuItem key={type} value={type}>
                {matterDeviceTypeLabels[type]}
              </MenuItem>
            ))}
            {suggestedTypes.length > 0 && (
              <MenuItem disabled>— All types —</MenuItem>
            )}
            {availableTypes
              .filter(([key]) => !suggestedTypes.includes(key))
              .map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          margin="normal"
          label="Custom Name"
          placeholder={entityId}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          helperText="Override the entity name shown in Matter controllers"
        />

        <FormControlLabel
          control={
            <Switch
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
            />
          }
          label="Disable this entity (exclude from bridge)"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
