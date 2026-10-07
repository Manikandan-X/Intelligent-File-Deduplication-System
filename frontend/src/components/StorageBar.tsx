import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { formatBytes } from "../utils/format";

export interface Segment {
  label: string;
  value: number;
  color: string;
  striped?: boolean;
}

/** Segmented bar used across the app: unique vs duplicate storage, and before/after on delete. */
export default function StorageBar({
  segments, height = 14, legend = true,
}: { segments: Segment[]; height?: number; legend?: boolean }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <Box>
      <Box
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${formatBytes(s.value)}`).join(", ")}
        sx={{ display: "flex", height, borderRadius: height, overflow: "hidden", bgcolor: "#E6EDEF", gap: "2px" }}
      >
        {total > 0 &&
          segments.filter((s) => s.value > 0).map((s) => (
            <Tooltip key={s.label} title={`${s.label}: ${formatBytes(s.value)}`}>
              <Box
                sx={{
                  width: `${(s.value / total) * 100}%`,
                  minWidth: 4,
                  bgcolor: s.color,
                  transition: "width .5s ease",
                  ...(s.striped && {
                    backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 4px, transparent 4px 8px)`,
                  }),
                }}
              />
            </Tooltip>
          ))}
      </Box>
      {legend && (
        <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {segments.map((s) => (
            <Stack key={s.label} direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 10, height: 10, borderRadius: "3px", bgcolor: s.color,
                  ...(s.striped && { backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 2px, transparent 2px 4px)" }),
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {s.label} <b style={{ color: "#12262D" }}>{formatBytes(s.value)}</b>
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
