import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import useMediaQuery from "@mui/material/useMediaQuery";
import { StatusIndicator } from "../components/status/StatusIndicator.tsx";
import { AppLogo } from "./AppLogo.tsx";

export const AppTopBar = () => {
  const isLargeScreen = useMediaQuery("(min-width:600px)");

  return (
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
            <StatusIndicator />
          </Box>
        </Container>
      </Toolbar>
    </AppBar>
  );
};
