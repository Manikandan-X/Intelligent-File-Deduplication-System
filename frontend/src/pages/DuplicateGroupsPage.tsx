import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, Collapse, Grid, IconButton, LinearProgress, MenuItem, Skeleton, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import ExpandIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import LockIcon from "@mui/icons-material/LockOutlined";
import CheckIcon from "@mui/icons-material/TaskAltOutlined";
import { downloadFile, getFile, getGroupFiles } from "../api/endpoints";
import type { DuplicateGroup, FileItem } from "../types";
import { errorMessage, formatBytes, formatDate, percent } from "../utils/format";
import { palette } from "../theme";
import { useNotify } from "../context/NotifyContext";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StorageBar from "../components/StorageBar";
import EmptyState from "../components/EmptyState";
import FileTypeIcon from "../components/FileTypeIcon";
import DeleteFileDialog from "../components/DeleteFileDialog";
import { useDuplicateIndex } from "../utils/useDuplicateIndex";
import { useFilesChanged } from "../utils/useFilesChanged";
import LayersIcon from "@mui/icons-material/LayersOutlined";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import GroupsIcon from "@mui/icons-material/HubOutlined";

type SortKey = "potential_savings" | "total_size" | "duplicate_count" | "created_at";

export default function DuplicateGroupsPage() {
  const notify = useNotify();
  const { isAdmin } = useAuth();
  const index = useDuplicateIndex();
  const [sortKey, setSortKey] = useState<SortKey>("potential_savings");
  const [hashQuery, setHashQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const [originals, setOriginals] = useState<Record<number, FileItem | null>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [members, setMembers] = useState<Record<number, { files: FileItem[]; partial: boolean } | undefined>>({});
  const [toDelete, setToDelete] = useState<{ file: FileItem; group: DuplicateGroup } | null>(null);

  const sorted = useMemo(() => {
    const q = hashQuery.trim().toLowerCase();
    const list = index.groups.filter((g) => !q || g.content_hash.toLowerCase().includes(q) || (originals[g.original_file_id]?.original_filename ?? "").toLowerCase().includes(q));
    return [...list].sort((a, b) =>
      sortKey === "created_at" ? b.created_at.localeCompare(a.created_at) : (b[sortKey] as number) - (a[sortKey] as number));
  }, [index.groups, sortKey, hashQuery, originals]);

  const visible = sorted.slice(page * rows, page * rows + rows);

  // Original file info for the groups on screen (works with the existing API).
  useEffect(() => {
    visible.forEach((g) => {
      if (g.original_file_id in originals) return;
      getFile(g.original_file_id)
        .then((f) => setOriginals((o) => ({ ...o, [g.original_file_id]: f })))
        .catch(() => setOriginals((o) => ({ ...o, [g.original_file_id]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((g) => g.id).join(",")]);

  const loadMembers = useCallback(async (g: DuplicateGroup) => {
    try {
      const files = await getGroupFiles(g.id);
      if (files) {
        const ordered = [...files].sort((a, b) =>
          a.id === g.original_file_id ? -1 : b.id === g.original_file_id ? 1 : a.created_at.localeCompare(b.created_at));
        setMembers((m) => ({ ...m, [g.id]: { files: ordered, partial: false } }));
      } else {
        const orig = await getFile(g.original_file_id).catch(() => null);
        setMembers((m) => ({ ...m, [g.id]: { files: orig ? [orig] : [], partial: true } }));
      }
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }, [notify]);

  const toggle = (g: DuplicateGroup) => {
    if (expanded === g.id) { setExpanded(null); return; }
    setExpanded(g.id);
    if (!members[g.id]) loadMembers(g);
  };

  // After a delete, refresh whichever group is open.
  useFilesChanged(() => {
    const open = index.groups.find((g) => g.id === expanded);
    if (open) loadMembers(open);
  });

  const totals = useMemo(() => ({
    groups: index.groups.length,
    consumed: index.groups.reduce((s, g) => s + g.total_size, 0),
    savings: index.groups.reduce((s, g) => s + g.potential_savings, 0),
  }), [index.groups]);

  return (
    <>
      <PageHeader title="Duplicate groups" subtitle="Files with identical content, grouped together. The oldest upload is kept as the original." />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><StatCard label="Duplicate groups" value={totals.groups.toLocaleString()} icon={<GroupsIcon />} color={palette.original} /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Storage used by groups" value={formatBytes(totals.consumed)} icon={<LayersIcon />} color={palette.duplicate} /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Potential savings" value={formatBytes(totals.savings)} icon={<SavingsIcon />} color={palette.reclaim} /></Grid>
      </Grid>

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField placeholder="Search by original file name or hash" value={hashQuery} onChange={(e) => { setHashQuery(e.target.value); setPage(0); }} fullWidth />
          <TextField select label="Sort by" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} sx={{ minWidth: 220 }}>
            <MenuItem value="potential_savings">Most savings</MenuItem>
            <MenuItem value="total_size">Most storage used</MenuItem>
            <MenuItem value="duplicate_count">Most duplicates</MenuItem>
            <MenuItem value="created_at">Newest group</MenuItem>
          </TextField>
        </Stack>
      </Card>

      {index.loading && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}

      <Stack spacing={1.5}>
        {visible.map((g) => {
          const orig = originals[g.original_file_id];
          const open = expanded === g.id;
          const m = members[g.id];
          return (
            <Card key={g.id} sx={{ overflow: "hidden", borderColor: open ? palette.tide : undefined }}>
              <Box
                onClick={() => toggle(g)}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(g)}
                sx={{ p: 2.25, cursor: "pointer", "&:hover": { bgcolor: "#F8FAFB" } }}
              >
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1.3, minWidth: 0 }}>
                    {orig ? <FileTypeIcon name={orig.original_filename} mime={orig.mime_type} size={44} /> : <Skeleton variant="rounded" width={44} height={44} />}
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label="Original" sx={{ bgcolor: `${palette.original}22`, color: palette.original }} />
                        <Typography fontWeight={700} noWrap title={orig?.original_filename}>
                          {orig === undefined ? <Skeleton width={160} /> : orig?.original_filename ?? (isAdmin ? `File #${g.original_file_id}` : "Original owned by another user")}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {orig ? `${formatBytes(orig.file_size)} · uploaded ${formatDate(orig.created_at)}` : "Original details are private"} · hash {g.content_hash.slice(0, 10)}…
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={3} sx={{ flex: 1.2 }} justifyContent={{ md: "flex-end" }}>
                    <Metric label="Duplicates" value={String(g.duplicate_count)} color={palette.duplicate} />
                    <Metric label="Storage consumed" value={formatBytes(g.total_size)} />
                    <Metric label="Potential savings" value={formatBytes(g.potential_savings)} color={palette.reclaim} />
                  </Stack>
                  <IconButton aria-label={open ? "Collapse group" : "Expand group"} sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", alignSelf: { xs: "flex-end", md: "center" } }}>
                    <ExpandIcon />
                  </IconButton>
                </Stack>
                <Box sx={{ mt: 1.5 }}>
                  <StorageBar
                    height={8}
                    legend={false}
                    segments={[
                      { label: "Kept (original)", value: Math.max(0, g.total_size - g.potential_savings), color: palette.original },
                      { label: "Reclaimable", value: g.potential_savings, color: palette.reclaim },
                    ]}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {percent(g.potential_savings, g.total_size).toFixed(0)}% of this group can be reclaimed
                  </Typography>
                </Box>
              </Box>

              <Collapse in={open} unmountOnExit>
                <Box sx={{ borderTop: `1px solid ${palette.line}`, overflowX: "auto" }}>
                  {!m ? <LinearProgress /> : (
                    <>
                      {m.partial && (
                        <Alert severity="info" sx={{ m: 2 }}>
                          Only the original file can be shown. Add the backend patch (GET /duplicate-groups/&#123;id&#125;/files) to list every duplicate copy here.
                        </Alert>
                      )}
                      {!m.partial && !m.files.some((f) => f.id === g.original_file_id) && (
                        <Alert severity="info" sx={{ m: 2 }}>The original copy belongs to another user, so only your own duplicates are listed.</Alert>
                      )}
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>File</TableCell><TableCell>Role</TableCell><TableCell align="right">Size</TableCell>
                            <TableCell>Upload date</TableCell><TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {m.files.map((f) => {
                            const isOriginal = f.id === g.original_file_id;
                            return (
                              <TableRow key={f.id} hover>
                                <TableCell>
                                  <Stack direction="row" spacing={1.25} alignItems="center">
                                    <FileTypeIcon name={f.original_filename} mime={f.mime_type} size={30} />
                                    <Typography noWrap sx={{ maxWidth: 300 }} title={f.original_filename}>{f.original_filename}</Typography>
                                    {f.is_protected && <Tooltip title="Protected"><LockIcon fontSize="small" color="action" /></Tooltip>}
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  {isOriginal
                                    ? <Chip size="small" icon={<CheckIcon />} label="Original — keep" sx={{ bgcolor: `${palette.original}22`, color: palette.original }} />
                                    : <Chip size="small" label="Duplicate" sx={{ bgcolor: `${palette.duplicate}22`, color: palette.duplicate }} />}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBytes(f.file_size)}</TableCell>
                                <TableCell>{formatDate(f.created_at)}</TableCell>
                                <TableCell align="right">
                                  <Tooltip title="Download"><IconButton aria-label="Download" onClick={() => downloadFile(f).catch((e) => notify(errorMessage(e), "error"))}><DownloadIcon /></IconButton></Tooltip>
                                  <Tooltip title={f.is_protected ? "Protected files cannot be deleted" : isOriginal ? "Delete original" : "Delete duplicate"}>
                                    <span><IconButton aria-label="Delete" color="error" disabled={f.is_protected} onClick={() => setToDelete({ file: f, group: g })}><DeleteIcon /></IconButton></span>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </Box>
              </Collapse>
            </Card>
          );
        })}
      </Stack>

      {!index.loading && !sorted.length && (
        <Card><EmptyState icon={<CheckIcon />} title={hashQuery ? "No groups match your search" : "No duplicates found"} message="Duplicate groups appear here once two files with identical content have been uploaded and processed." /></Card>
      )}

      {sorted.length > 0 && (
        <TablePagination component="div" count={sorted.length} page={page} rowsPerPage={rows} rowsPerPageOptions={[5, 10, 25]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      )}

      <DeleteFileDialog
        file={toDelete?.file ?? null}
        kind={toDelete ? (toDelete.file.id === toDelete.group.original_file_id ? "original" : "duplicate") : "unique"}
        group={toDelete?.group}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ textAlign: { md: "right" } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={700} sx={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );
}
