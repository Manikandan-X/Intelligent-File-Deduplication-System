import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

export default function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: "center", py: 7, px: 2, color: "text.secondary" }}>
      <Box sx={{ "& svg": { fontSize: 48, color: "#9DB2B9" } }}>{icon}</Box>
      <Typography variant="h6" color="text.primary" sx={{ mt: 1 }}>{title}</Typography>
      {message && <Typography sx={{ mt: 0.5, maxWidth: 420, mx: "auto" }}>{message}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
