import type { ReactNode } from "react";
import { Box, Card, Stack, Typography } from "@mui/material";

export default function StatCard({
  label, value, hint, icon, color,
}: { label: string; value: ReactNode; hint?: string; icon: ReactNode; color: string }) {
  return (
    <Card sx={{ p: 2.25, height: "100%", borderLeft: `4px solid ${color}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
          <Typography variant="h5" sx={{ mt: 0.5, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
          {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
        </Box>
        <Box sx={{ color, bgcolor: `${color}1A`, p: 1, borderRadius: 2, display: "grid", placeItems: "center" }}>{icon}</Box>
      </Stack>
    </Card>
  );
}
