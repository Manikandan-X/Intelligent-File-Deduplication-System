import { useCallback, useEffect, useState } from "react";
import {
  Alert, Card, Chip, FormControlLabel, LinearProgress, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import AuditIcon from "@mui/icons-material/FactCheckOutlined";
import { listAuditLogs } from "../api/endpoints";
import type { AuditLog, Paginated } from "../types";
import { errorMessage, formatDateTime, toIsoEnd, toIsoStart } from "../utils/format";
import { palette } from "../theme";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const ACTIONS = [
  "FILE_UPLOADED", "FILE_DOWNLOADED", "FILE_DELETED", "FILE_PROTECTED", "FILE_UNPROTECTED",
  "DUPLICATE_DETECTED", "DUPLICATE_GROUP_CREATED", "DUPLICATE_GROUP_UPDATED",
  "USER_CREATED", "USER_UPDATED", "USER_ROLE_CHANGED", "USER_ACTIVATED", "USER_DEACTIVATED", "USER_DELETED", "USER_PASSWORD_CHANGED",
];

function actionColor(a: string): string {
  if (a.includes("DELETED")) return palette.danger;
  if (a.startsWith("DUPLICATE")) return palette.duplicate;
  if (a.includes("PROTECT")) return palette.original;
  if (a.includes("UPLOAD") || a.includes("CREATED") || a.includes("ACTIVATED")) return palette.reclaim;
  return palette.tide;
}

export default function AuditLogsPage() {
  const { isAdmin } = useAuth();
  const [allUsers, setAllUsers] = useState(false);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<Paginated<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listAuditLogs({
        action: action || undefined, entity_type: entity || undefined, page, page_size: pageSize, sort_order: order,
        from_date: from ? toIsoStart(from) : undefined, to_date: to ? toIsoEnd(to) : undefined,
      }, isAdmin && allUsers));
      setError(null);
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [action, entity, from, to, order, page, pageSize, isAdmin, allUsers]);

  useEffect(() => { load(); }, [load]);
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Every upload, download, deletion and protection change." />
      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} alignItems="center">
          <TextField select label="Action" value={action} onChange={(e) => reset(() => setAction(e.target.value))} sx={{ minWidth: 230 }}>
            <MenuItem value="">All actions</MenuItem>
            {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a.replaceAll("_", " ").toLowerCase()}</MenuItem>)}
          </TextField>
          <TextField select label="Entity" value={entity} onChange={(e) => reset(() => setEntity(e.target.value))} sx={{ minWidth: 170 }}>
            <MenuItem value="">All entities</MenuItem>
            <MenuItem value="FILE">File</MenuItem>
            <MenuItem value="USER">User</MenuItem>
            <MenuItem value="DUPLICATE_GROUP">Duplicate group</MenuItem>
          </TextField>
          <TextField label="From" type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} InputLabelProps={{ shrink: true }} />
          <TextField select label="Order" value={order} onChange={(e) => reset(() => setOrder(e.target.value as "asc" | "desc"))} sx={{ width: 150 }}>
            <MenuItem value="desc">Newest first</MenuItem>
            <MenuItem value="asc">Oldest first</MenuItem>
          </TextField>
          {isAdmin && <FormControlLabel control={<Switch checked={allUsers} onChange={(e) => reset(() => setAllUsers(e.target.checked))} />} label="All users" />}
        </Stack>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Details</TableCell>
                {isAdmin && allUsers && <TableCell>User id</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(l.created_at)}</TableCell>
                  <TableCell><Chip size="small" label={l.action.replaceAll("_", " ").toLowerCase()} sx={{ bgcolor: `${actionColor(l.action)}22`, color: actionColor(l.action) }} /></TableCell>
                  <TableCell>{l.entity_type.toLowerCase()} {l.entity_id && `#${l.entity_id}`}</TableCell>
                  <TableCell><Typography variant="body2" sx={{ wordBreak: "break-word" }}>{l.details ?? "—"}</Typography></TableCell>
                  {isAdmin && allUsers && <TableCell>{l.user_id ?? "—"}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && !data?.items.length && <EmptyState icon={<AuditIcon />} title="No audit entries" message="Nothing matches these filters yet." />}
        <TablePagination component="div" count={data?.total ?? 0} page={page - 1} rowsPerPage={pageSize} rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, p) => setPage(p + 1)} onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} />
      </Card>
    </>
  );
}
