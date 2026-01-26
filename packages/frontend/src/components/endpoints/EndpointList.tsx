import type { EndpointData } from "@home-assistant-matter-hub/common";
import SortIcon from "@mui/icons-material/Sort";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { EndpointState } from "./EndpointState.tsx";
import { EndpointTreeView, type SortOption } from "./EndpointTreeView.tsx";

export interface EndpointListProps {
  endpoint: EndpointData;
}

export const EndpointList = (props: EndpointListProps) => {
  const [selectedItem, setSelectedItem] = useState<EndpointData | undefined>(
    undefined,
  );
  const [sortBy, setSortBy] = useState<SortOption>("name");

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={1}
        >
          <Typography variant="h6" component="span">
            Endpoints
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="sort-label">
              <Box display="flex" alignItems="center" gap={0.5}>
                <SortIcon fontSize="small" /> Sort
              </Box>
            </InputLabel>
            <Select
              labelId="sort-label"
              value={sortBy}
              label="Sort"
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="endpoint">Endpoint ID</MenuItem>
              <MenuItem value="type">Type</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <EndpointTreeView
          endpoint={props.endpoint}
          onSelected={setSelectedItem}
          sortBy={sortBy}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {selectedItem && <EndpointState endpoint={selectedItem} />}
      </Grid>
    </Grid>
  );
};
