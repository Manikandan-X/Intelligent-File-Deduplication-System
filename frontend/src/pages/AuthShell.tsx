import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import StorageBar from "../components/StorageBar";
import { palette } from "../theme";

/** Shared split layout for the sign-in and registration pages. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: "100%", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" } }}>
      <Box sx={{ display: { xs: "none", md: "flex" }, bgcolor: palette.deep, color: "#fff", p: 7, flexDirection: "column", justifyContent: "space-between" }}>
        <Typography sx={{ fontFamily: "Sora", fontWeight: 700, fontSize: 22 }}>Dedupe</Typography>
        <Box>
          <Typography variant="h3" sx={{ maxWidth: 440, lineHeight: 1.15 }}>
            Find the files you are storing twice.
          </Typography>
          <Typography sx={{ color: "#A9C4CB", mt: 2, maxWidth: 420, fontSize: 17 }}>
            Identical content is detected by hash, even when names and upload dates differ, so you can reclaim space safely.
          </Typography>
          <Box sx={{ mt: 5, maxWidth: 440, p: 2.5, borderRadius: 3, bgcolor: "rgba(255,255,255,.06)" }}>
            <StorageBar
              height={16}
              legend={false}
              segments={[
                { label: "Unique", value: 62, color: palette.tide },
                { label: "Original copies", value: 14, color: palette.original },
                { label: "Duplicates", value: 24, color: palette.duplicate },
              ]}
            />
            <Typography variant="body2" sx={{ color: "#A9C4CB", mt: 1.5 }}>Unique · originals · reclaimable duplicates</Typography>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: "#6F95A0" }}>SHA-256 hashing · background processing · full audit trail</Typography>
      </Box>
      <Box sx={{ display: "grid", placeItems: "center", p: 3 }}>
        <Box sx={{ width: "100%", maxWidth: 400 }}>
          <Typography variant="h4">{title}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3, mt: 0.5 }}>{subtitle}</Typography>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
