import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BugReportIcon from "@mui/icons-material/BugReport";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DevicesIcon from "@mui/icons-material/Devices";
import HubIcon from "@mui/icons-material/Hub";
import LabelIcon from "@mui/icons-material/Label";
import LightModeIcon from "@mui/icons-material/LightMode";
import LockIcon from "@mui/icons-material/Lock";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState } from "react";
import { Link } from "react-router";
import { LogViewer } from "../components/logs/LogViewer.tsx";
import { StatusIndicator } from "../components/status/StatusIndicator.tsx";
import { navigation } from "../routes.tsx";
import { AppLogo } from "./AppLogo.tsx";

export const AppTopBar = () => {
  const isLargeScreen = useMediaQuery("(min-width:600px)");
  const { mode, setMode } = useColorScheme();
  const [logViewerOpen, setLogViewerOpen] = useState(false);

  const toggleColorMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  return (
    <Box>
      <AppBar sx={{ height: "72px" }}>
        <Toolbar
          sx={{ paddingLeft: "0 !important", paddingRight: "0 !important" }}
        >
          <Container
            sx={{
              padding: 2,
              height: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppLogo large={isLargeScreen} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip title="Bridges">
                <IconButton
                  component={Link}
                  to={navigation.bridges}
                  sx={{ color: "inherit" }}
                >
                  <HubIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="All Devices">
                <IconButton
                  component={Link}
                  to={navigation.devices}
                  sx={{ color: "inherit" }}
                >
                  <DevicesIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Network Map">
                <IconButton
                  component={Link}
                  to={navigation.networkMap}
                  sx={{ color: "inherit" }}
                >
                  <AccountTreeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Startup Order">
                <IconButton
                  component={Link}
                  to={navigation.startup}
                  sx={{ color: "inherit" }}
                >
                  <RocketLaunchIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Lock Credentials">
                <IconButton
                  component={Link}
                  to={navigation.lockCredentials}
                  sx={{ color: "inherit" }}
                >
                  <LockIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Labels & Areas">
                <IconButton
                  component={Link}
                  to={navigation.labels}
                  sx={{ color: "inherit" }}
                >
                  <LabelIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={mode === "dark" ? "Light Mode" : "Dark Mode"}>
                <IconButton onClick={toggleColorMode} sx={{ color: "inherit" }}>
                  {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="System Logs">
                <IconButton
                  onClick={() => setLogViewerOpen(true)}
                  sx={{ color: "inherit" }}
                >
                  <BugReportIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Health Dashboard">
                <IconButton
                  component={Link}
                  to={navigation.health}
                  sx={{ color: "inherit" }}
                >
                  <MonitorHeartIcon />
                </IconButton>
              </Tooltip>
              <StatusIndicator />
            </Box>
          </Container>
        </Toolbar>
      </AppBar>
      <LogViewer open={logViewerOpen} onClose={() => setLogViewerOpen(false)} />
    </Box>
  );
};
