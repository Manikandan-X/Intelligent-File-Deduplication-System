import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Card, FormControlLabel, Grid, LinearProgress, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweepOutlined";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import { listAuditLogs } from "../api/endpoints";
import type { AuditLog, Paginated } from "../types";
import { errorMessage, formatBytes, formatDateTime, toIsoEnd, toIsoStart } from "../utils/format";
import { palette } from "../theme";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { useFilesChanged } from "../utils/useFilesChanged";

/** Audit details look like: "File deleted: report.pdf, size=1234" */
function parseDeletion(details: string | null): { name: string; size: number | null } {
  const m = details?.match(/^File deleted:\s*(.*),\s*size=(\d+)\s*$/s);
  return m ? { name: m[1], size: Number(m[2]) } : { name: details ?? "Unknown file", size: null };
}

export default function DeletionHistoryPage() {
  const { isAdmin } = useAuth();
  const [allUsers, setAllUsers] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<Paginated<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listAuditLogs({
        action: "FILE_DELETED", entity_type: "FILE", page, page_size: pageSize, sort_order: "desc",
        from_date: from ? toIsoStart(from) : undefined, to_date: to ? toIsoEnd(to) : undefined,
      }, isAdmin && allUsers));
      setError(null);
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [page, pageSize, from, to, isAdmin, allUsers]);

  useEffect(() => { load(); }, [load]);
  useFilesChanged(load);

  const rows = useMemo(() => (data?.items ?? []).map((l) => ({ log: l, ...parseDeletion(l.details) })), [data]);
  const freed = rows.reduce((s, r) => s + (r.size ?? 0), 0);

  return (
    <>
      <PageHeader title="Deletion history" subtitle="A permanent record of every file removed, who removed it and how much space it freed." />
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}><StatCard label="Files deleted" value={(data?.total ?? 0).toLocaleString()} icon={<DeleteSweepIcon />} color={palette.danger} /></Grid>
        <Grid item xs={12} sm={6}><StatCard label="Space freed on this page" value={formatBytes(freed)} icon={<SavingsIcon />} color={palette.reclaim} /></Grid>
      </Grid>

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <TextField label="Deleted from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
          <TextField label="Deleted to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
          {isAdmin && <FormControlLabel control={<Switch checked={allUsers} onChange={(e) => { setAllUsers(e.target.checked); setPage(1); }} />} label="All users" />}
        </Stack>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>File</TableCell><TableCell align="right">Size freed</TableCell><TableCell>Deleted on</TableCell>
                {isAdmin && allUsers && <TableCell>Deleted by (user id)</TableCell>}
                <TableCell>File id</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ log, name, size }) => (
                <TableRow key={log.id} hover>
                  <TableCell><Typography fontWeight={600} sx={{ wordBreak: "break-all" }}>{name}</Typography></TableCell>
                  <TableCell align="right" sx={{ color: palette.reclaim, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{size !== null ? `−${formatBytes(size)}` : "—"}</TableCell>
                  <TableCell>{formatDateTime(log.created_at)}</TableCell>
                  {isAdmin && allUsers && <TableCell>{log.user_id ?? "—"}</TableCell>}
                  <TableCell>#{log.entity_id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && !rows.length && <EmptyState icon={<DeleteSweepIcon />} title="No deletions recorded" message="Deleted files will be listed here." />}
        <TablePagination component="div" count={data?.total ?? 0} page={page - 1} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p + 1)} onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} />
      </Card>
      <Box sx={{ mt: 1.5 }}><Typography variant="caption" color="text.secondary">Built from the audit trail (FILE_DELETED events).</Typography></Box>
    </>
  );
}
