import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Avatar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Toolbar, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import FolderIcon from "@mui/icons-material/FolderOpenOutlined";
import DuplicateIcon from "@mui/icons-material/ContentCopyOutlined";
import HistoryIcon from "@mui/icons-material/DeleteSweepOutlined";
import AuditIcon from "@mui/icons-material/FactCheckOutlined";
import UsersIcon from "@mui/icons-material/GroupOutlined";
import UploadIcon from "@mui/icons-material/CloudUploadOutlined";
import { useAuth } from "../context/AuthContext";
import UploadDialog from "./UploadDialog";
import { palette } from "../theme";

const WIDTH = 252;

function Brand() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2.5, py: 2.5 }}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
        <rect x="2" y="3" width="20" height="13" rx="3.5" fill="#E39A2D" opacity=".55" />
        <rect x="7" y="9" width="20" height="13" rx="3.5" fill="#E39A2D" opacity=".8" />
        <rect x="12" y="15" width="20" height="13" rx="3.5" fill="#2E9E6B" />
      </svg>
      <Box>
        <Typography sx={{ fontFamily: "Sora", fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>Dedupe</Typography>
        <Typography variant="caption" sx={{ color: "#8FB1BA" }}>Storage optimizer</Typography>
      </Box>
    </Box>
  );
}

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);

  const nav = [
    { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
    { to: "/files", label: "My files", icon: <FolderIcon /> },
    { to: "/duplicates", label: "Duplicate groups", icon: <DuplicateIcon /> },
    { to: "/deletions", label: "Deletion history", icon: <HistoryIcon /> },
    { to: "/audit-logs", label: "Audit logs", icon: <AuditIcon /> },
    ...(isAdmin ? [{ to: "/users", label: "Users", icon: <UsersIcon /> }] : []),
  ];

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();

  const drawer = (
    <Box sx={{ bgcolor: palette.deep, height: "100%", display: "flex", flexDirection: "column" }}>
      <Brand />
      <List sx={{ px: 1.5, flex: 1 }}>
        {nav.map((item) => {
          const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2, mb: 0.5, color: active ? "#fff" : "#A9C4CB",
                bgcolor: active ? "rgba(255,255,255,.1)" : "transparent",
                borderLeft: `3px solid ${active ? palette.reclaim : "transparent"}`,
                "&:hover": { bgcolor: "rgba(255,255,255,.07)" },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 38 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Typography variant="caption" sx={{ color: "#6F95A0", px: 2.5, pb: 2 }}>
        {isAdmin ? "Administrator · system-wide view" : "Showing your files"}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100%" }}>
      {desktop ? (
        <Drawer variant="permanent" sx={{ width: WIDTH, flexShrink: 0, "& .MuiDrawer-paper": { width: WIDTH, border: 0 } }}>{drawer}</Drawer>
      ) : (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ "& .MuiDrawer-paper": { width: WIDTH, border: 0 } }}>
          {drawer}
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ bgcolor: "rgba(242,246,247,.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${palette.line}` }}>
          <Toolbar sx={{ gap: 1 }}>
            {!desktop && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><MenuIcon /></IconButton>
            )}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>Upload</Button>
            <IconButton onClick={(e) => setMenuEl(e.currentTarget)} aria-label="Account menu" sx={{ ml: 0.5 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: palette.deep, fontSize: 14, fontWeight: 700 }}>{initials}</Avatar>
            </IconButton>
            <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
              <Box sx={{ px: 2, py: 1 }}>
                <Typography fontWeight={700}>{user?.first_name} {user?.last_name}</Typography>
                <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setMenuEl(null); navigate("/profile"); }}>Profile & password</MenuItem>
              <MenuItem onClick={() => { setMenuEl(null); signOut(); navigate("/login"); }}>Sign out</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1500, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </Box>
  );
}
