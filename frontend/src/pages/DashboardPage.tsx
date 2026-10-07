import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, Grid, LinearProgress, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import FilesIcon from "@mui/icons-material/InsertDriveFileOutlined";
import StorageIcon from "@mui/icons-material/StorageOutlined";
import CopyIcon from "@mui/icons-material/ContentCopyOutlined";
import LayersIcon from "@mui/icons-material/LayersOutlined";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import GroupsIcon from "@mui/icons-material/HubOutlined";
import FolderOffIcon from "@mui/icons-material/FolderOffOutlined";
import { getGroupCount, getLargestFiles, getOverview, getRecentUploads } from "../api/endpoints";
import type { AnalyticsOverview, FileItem } from "../types";
import { errorMessage, formatBytes, formatDate, percent } from "../utils/format";
import { palette } from "../theme";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StorageBar from "../components/StorageBar";
import FileTypeIcon from "../components/FileTypeIcon";
import EmptyState from "../components/EmptyState";
import { useFilesChanged } from "../utils/useFilesChanged";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function DashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [groups, setGroups] = useState<number | null>(null);
  const [largest, setLargest] = useState<FileItem[]>([]);
  const [recent, setRecent] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, g, l, r] = await Promise.all([getOverview(), getGroupCount(), getLargestFiles(8), getRecentUploads(8)]);
      setOverview(o); setGroups(g); setLargest(l); setRecent(r); setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFilesChanged(load);

  const o = overview;
  const unique = o ? Math.max(0, o.total_storage - o.duplicate_storage) : 0;
  const dupShare = o ? percent(o.duplicate_storage, o.total_storage) : 0;

  return (
    <>
      <PageHeader title="Storage overview" subtitle="How much of your storage is holding the same content twice." />
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}

      {/* Reclaimable storage — the headline of the product */}
      <Card sx={{ p: { xs: 2.5, md: 3.5 }, mb: 3, bgcolor: palette.deep, color: "#fff", border: 0 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <Typography sx={{ color: "#A9C4CB" }} fontWeight={600}>You can reclaim</Typography>
            <Typography variant="h3" sx={{ color: "#6FD6A4", fontVariantNumeric: "tabular-nums" }}>
              {o ? formatBytes(o.potential_savings) : <Skeleton width={160} sx={{ bgcolor: "rgba(255,255,255,.15)" }} />}
            </Typography>
            <Typography sx={{ color: "#A9C4CB", mt: 0.5 }}>
              {o ? `${dupShare.toFixed(1)}% of your storage is duplicate content` : " "}
            </Typography>
            <Button component={RouterLink} to="/duplicates" variant="contained" color="success" sx={{ mt: 2 }}>Review duplicate groups</Button>
          </Grid>
          <Grid item xs={12} md={8}>
            {o && (
              <Box sx={{ "& .MuiTypography-root": { color: "#C9DDE2" }, "& b": { color: "#fff !important" } }}>
                <StorageBar
                  height={22}
                  segments={[
                    { label: "Unique & original content", value: unique, color: palette.tide },
                    { label: "Duplicate copies", value: o.duplicate_storage, color: palette.duplicate },
                  ]}
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </Card>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { label: "Total files", value: o?.total_files.toLocaleString(), icon: <FilesIcon />, color: palette.tide },
          { label: "Total storage", value: o && formatBytes(o.total_storage), icon: <StorageIcon />, color: palette.deep },
          { label: "Duplicate files", value: o?.duplicate_files.toLocaleString(), icon: <CopyIcon />, color: palette.duplicate },
          { label: "Duplicate storage", value: o && formatBytes(o.duplicate_storage), icon: <LayersIcon />, color: palette.duplicate },
          { label: "Potential savings", value: o && formatBytes(o.potential_savings), icon: <SavingsIcon />, color: palette.reclaim },
          { label: "Duplicate groups", value: groups?.toLocaleString(), icon: <GroupsIcon />, color: palette.original, hint: "System-wide" },
        ].map((s) => (
          <Grid item xs={12} sm={6} lg={4} key={s.label}>
            <StatCard label={s.label} value={s.value ?? <Skeleton width={90} />} icon={s.icon} color={s.color} hint={s.hint} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <Card sx={{ p: 2.5, height: "100%" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Unique vs duplicate storage</Typography>
            {o && o.total_storage > 0 ? (
              <Box sx={{ maxWidth: 280, mx: "auto" }}>
                <Doughnut
                  data={{
                    labels: ["Unique & original", "Duplicate copies"],
                    datasets: [{ data: [unique, o.duplicate_storage], backgroundColor: [palette.tide, palette.duplicate], borderWidth: 0 }],
                  }}
                  options={{
                    cutout: "68%",
                    plugins: {
                      legend: { position: "bottom" },
                      tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatBytes(c.parsed as number)}` } },
                    },
                  }}
                />
              </Box>
            ) : (
              <EmptyState icon={<FolderOffIcon />} title="No data yet" message="Upload files to see how much storage is duplicated." />
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card sx={{ p: 2.5, height: "100%" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Largest files</Typography>
            {largest.length ? (
              <Bar
                data={{
                  labels: largest.map((f) => (f.original_filename.length > 22 ? `${f.original_filename.slice(0, 20)}…` : f.original_filename)),
                  datasets: [{ data: largest.map((f) => f.file_size), backgroundColor: palette.tide, borderRadius: 6, maxBarThickness: 22 }],
                }}
                options={{
                  indexAxis: "y",
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${formatBytes(c.parsed.x as number)}` } } },
                  scales: {
                    x: { ticks: { callback: (v) => formatBytes(Number(v), 0) }, grid: { color: palette.line } },
                    y: { grid: { display: false } },
                  },
                }}
              />
            ) : (
              <EmptyState icon={<FolderOffIcon />} title="No files yet" />
            )}
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <FileTable title="Recent uploads" files={recent} dateLabel="Uploaded" />
        </Grid>
        <Grid item xs={12} md={6}>
          <FileTable title="Largest files" files={largest} dateLabel="Uploaded" />
        </Grid>
      </Grid>
    </>
  );
}

function FileTable({ title, files, dateLabel }: { title: string; files: FileItem[]; dateLabel: string }) {
  return (
    <Card sx={{ overflow: "hidden" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5, pb: 1.5 }}>
        <Typography variant="h6">{title}</Typography>
        <Button component={RouterLink} to="/files" size="small">View all files</Button>
      </Stack>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Name</TableCell><TableCell align="right">Size</TableCell><TableCell>{dateLabel}</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {files.map((f) => (
              <TableRow key={f.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <FileTypeIcon name={f.original_filename} mime={f.mime_type} size={30} />
                    <Typography noWrap sx={{ maxWidth: 220 }} title={f.original_filename}>{f.original_filename}</Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBytes(f.file_size)}</TableCell>
                <TableCell>{formatDate(f.created_at)}</TableCell>
              </TableRow>
            ))}
            {!files.length && (
              <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.secondary" }}>Nothing here yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Card>
  );
}
