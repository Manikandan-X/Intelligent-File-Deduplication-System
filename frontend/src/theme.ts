import { createTheme } from "@mui/material/styles";

export const palette = {
  tide: "#0F7C8A",       // primary actions
  tideDark: "#0A5A66",
  deep: "#0E2F3A",       // sidebar / headings
  mist: "#F2F6F7",       // page canvas
  line: "#DCE5E8",       // borders
  ink: "#12262D",        // body text
  muted: "#5B7078",
  reclaim: "#2E9E6B",    // savings, safe, unique data
  duplicate: "#E39A2D",  // duplicate storage
  original: "#4F5BD5",   // original copies
  danger: "#D9484A",     // delete, destructive
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: palette.tide, dark: palette.tideDark, contrastText: "#fff" },
    secondary: { main: palette.original },
    success: { main: palette.reclaim },
    warning: { main: palette.duplicate },
    error: { main: palette.danger },
    info: { main: palette.original },
    background: { default: palette.mist, paper: "#FFFFFF" },
    text: { primary: palette.ink, secondary: palette.muted },
    divider: palette.line,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 15,
    h1: { fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "-0.015em" },
    h4: { fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "1.65rem", letterSpacing: "-0.015em" },
    h5: { fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.25rem" },
    h6: { fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.05rem" },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: palette.mist },
        "*:focus-visible": { outline: `2px solid ${palette.tide}`, outlineOffset: 2 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, paddingInline: 16 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { outlined: { borderColor: palette.line } },
    },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, color: palette.muted, backgroundColor: "#F8FAFB", borderBottomColor: palette.line },
        root: { borderBottomColor: palette.line },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: "#fff" } } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
