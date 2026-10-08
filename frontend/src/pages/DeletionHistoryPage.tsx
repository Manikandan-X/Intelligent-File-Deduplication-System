import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Card, Grid, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweepOutlined";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import { listDeletionHistory } from "../api/endpoints";
import type { DeletionRecord } from "../types";
import { errorMessage, formatBytes, formatDateTime } from "../utils/format";
import { palette } from "../theme";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { useFilesChanged } from "../utils/useFilesChanged";

type SortKey = "created_at" | "file_size" | "original_filename";

export default function DeletionHistoryPage() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<DeletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRecords(await listDeletionHistory()); setError(null); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFilesChanged(load);

  // The endpoint returns the full list, so filtering, sorting and paging happen here.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const day = (iso: string) => iso.slice(0, 10);
    const list = records.filter((r) =>
      (!q || r.original_filename.toLowerCase().includes(q) || (r.deletion_reason ?? "").toLowerCase().includes(q)) &&
      (!from || day(r.created_at) >= from) && (!to || day(r.created_at) <= to));
    const dir = order === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "file_size") return (a.file_size - b.file_size) * dir;
      if (sortKey === "original_filename") return a.original_filename.localeCompare(b.original_filename) * dir;
      return a.created_at.localeCompare(b.created_at) * dir;
    });
  }, [records, search, from, to, sortKey, order]);

  const freed = filtered.reduce((s, r) => s + r.file_size, 0);
  const visible = filtered.slice(page * rows, page * rows + rows);
  const resetPage = (fn: () => void) => { fn(); setPage(0); };
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setOrder(order === "asc" ? "desc" : "asc");
    else { setSortKey(key); setOrder(key === "original_filename" ? "asc" : "desc"); }
    setPage(0);
  };
  const head = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <TableCell align={align} sortDirection={sortKey === key ? order : false}>
      <TableSortLabel active={sortKey === key} direction={sortKey === key ? order : "asc"} onClick={() => toggleSort(key)}>{label}</TableSortLabel>
    </TableCell>
  );

  return (
    <>
      <PageHeader title="Deletion history" subtitle={isAdmin ? "Every file deleted by any user, with the reason and the space it freed." : "Every file you have deleted, with the reason and the space it freed."} />
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}><StatCard label="Files deleted" value={filtered.length.toLocaleString()} icon={<DeleteSweepIcon />} color={palette.danger} /></Grid>
        <Grid item xs={12} sm={6}><StatCard label="Space freed" value={formatBytes(freed)} icon={<SavingsIcon />} color={palette.reclaim} hint="Matches the filters below" /></Grid>
      </Grid>

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            placeholder="Search by file name or reason" value={search} onChange={(e) => resetPage(() => setSearch(e.target.value))} fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField label="Deleted from" type="date" value={from} onChange={(e) => resetPage(() => setFrom(e.target.value))} InputLabelProps={{ shrink: true }} />
          <TextField label="Deleted to" type="date" value={to} onChange={(e) => resetPage(() => setTo(e.target.value))} InputLabelProps={{ shrink: true }} />
        </Stack>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {head("original_filename", "File")}
                {head("file_size", "Size freed", "right")}
                <TableCell>Reason</TableCell>
                {head("created_at", "Deleted on")}
                {isAdmin && <TableCell sx={{ whiteSpace: "nowrap" }}>Deleted by</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} sx={{ wordBreak: "break-all" }}>{r.original_filename}</Typography>
                    <Typography variant="caption" color="text.secondary">File #{r.file_id}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ color: palette.reclaim, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>−{formatBytes(r.file_size)}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    {r.deletion_reason ? <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{r.deletion_reason}</Typography> : <Typography variant="body2" color="text.secondary">No reason given</Typography>}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</TableCell>
                  {isAdmin && <TableCell>{r.user_id !== null ? `User #${r.user_id}` : "Deleted user"}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && !visible.length && (
          <EmptyState icon={<DeleteSweepIcon />} title={records.length ? "No deletions match these filters" : "No deletions recorded"} message={records.length ? "Try a different name or date range." : "Files you delete will be listed here."} />
        )}
        <TablePagination component="div" count={filtered.length} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      </Card>
    </>
  );
}
