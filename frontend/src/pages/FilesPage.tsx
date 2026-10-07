import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, Collapse, IconButton, InputAdornment, LinearProgress, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterIcon from "@mui/icons-material/FilterListOutlined";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import FolderOffIcon from "@mui/icons-material/FolderOffOutlined";
import { downloadFile, listFiles, setProtection } from "../api/endpoints";
import type { FileItem, FileListResult, FileQuery } from "../types";
import { errorMessage, formatBytes, formatDate, toIsoEnd, toIsoStart } from "../utils/format";
import { palette } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import FileTypeIcon, { fileKind } from "../components/FileTypeIcon";
import DeleteFileDialog from "../components/DeleteFileDialog";
import FileDetailsDrawer from "../components/FileDetailsDrawer";
import { useDuplicateIndex, type FileKind } from "../utils/useDuplicateIndex";
import { useFilesChanged } from "../utils/useFilesChanged";

const MIME_OPTIONS = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "application/zip", "text/plain", "text/csv",
  "application/json", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const UNITS: Record<string, number> = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

export const kindStyle: Record<FileKind, { label: string; color: string }> = {
  unique: { label: "Unique", color: palette.reclaim },
  original: { label: "Original", color: palette.original },
  duplicate: { label: "Duplicate", color: palette.duplicate },
};

export default function FilesPage() {
  const { isAdmin } = useAuth();
  const notify = useNotify();
  const index = useDuplicateIndex();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [mime, setMime] = useState<string>("");
  const [duplicate, setDuplicate] = useState<"" | "true" | "false">("");
  const [protectedFilter, setProtectedFilter] = useState<"" | "true" | "false">("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [unit, setUnit] = useState("MB");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<FileQuery["sort_by"]>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [result, setResult] = useState<FileListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [toDelete, setToDelete] = useState<FileItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const query: FileQuery = useMemo(() => ({
    filename: debounced || undefined,
    mime_type: mime || undefined,
    min_size: minSize ? Math.round(Number(minSize) * UNITS[unit]) : undefined,
    max_size: maxSize ? Math.round(Number(maxSize) * UNITS[unit]) : undefined,
    is_duplicate: duplicate === "" ? undefined : duplicate === "true",
    is_protected: protectedFilter === "" ? undefined : protectedFilter === "true",
    from_date: fromDate ? toIsoStart(fromDate) : undefined,
    to_date: toDate ? toIsoEnd(toDate) : undefined,
    page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder,
  }), [debounced, mime, minSize, maxSize, unit, duplicate, protectedFilter, fromDate, toDate, page, pageSize, sortBy, sortOrder]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listFiles(query));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useFilesChanged(load);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const activeFilters = [mime, duplicate, protectedFilter, minSize, maxSize, fromDate, toDate].filter(Boolean).length;
  const clearAll = () => {
    setSearch(""); setMime(""); setDuplicate(""); setProtectedFilter(""); setMinSize(""); setMaxSize(""); setFromDate(""); setToDate(""); setPage(1);
  };

  const toggleSort = (key: FileQuery["sort_by"]) => {
    if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortOrder(key === "original_filename" ? "asc" : "desc"); }
    setPage(1);
  };

  const onDownload = async (f: FileItem) => {
    try { await downloadFile(f); } catch (e) { notify(errorMessage(e), "error"); }
  };

  const onToggleProtect = async (f: FileItem) => {
    try {
      const updated = await setProtection(f.id, !f.is_protected);
      notify(updated.is_protected ? "File protected" : "Protection removed");
      setSelected(updated);
      load();
    } catch (e) { notify(errorMessage(e), "error"); }
  };

  const sortHead = (key: FileQuery["sort_by"], label: string, align: "left" | "right" = "left") => (
    <TableCell align={align} sortDirection={sortBy === key ? sortOrder : false}>
      <TableSortLabel active={sortBy === key} direction={sortBy === key ? sortOrder : "asc"} onClick={() => toggleSort(key)}>{label}</TableSortLabel>
    </TableCell>
  );

  const items = result?.items ?? [];

  return (
    <>
      <PageHeader title="My files" subtitle="Search, filter, download and clean up everything you have uploaded." />

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            placeholder="Search by file name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField select label="Duplicates" value={duplicate} onChange={(e) => resetPage(setDuplicate)(e.target.value as "" | "true" | "false")} sx={{ minWidth: 170 }}>
            <MenuItem value="">All files</MenuItem>
            <MenuItem value="true">Duplicates only</MenuItem>
            <MenuItem value="false">Not duplicates</MenuItem>
          </TextField>
          <Button variant={activeFilters ? "contained" : "outlined"} startIcon={<FilterIcon />} onClick={() => setShowFilters(!showFilters)} sx={{ whiteSpace: "nowrap" }}>
            Filters{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
        </Stack>

        <Collapse in={showFilters}>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mt: 2 }}>
            <Autocomplete
              freeSolo
              options={MIME_OPTIONS}
              value={mime}
              onInputChange={(_, v) => resetPage(setMime)(v)}
              sx={{ minWidth: 260 }}
              renderInput={(p) => <TextField {...p} label="File type (MIME)" placeholder="e.g. application/pdf" />}
            />
            <TextField select label="Protection" value={protectedFilter} onChange={(e) => resetPage(setProtectedFilter)(e.target.value as "" | "true" | "false")} sx={{ minWidth: 150 }}>
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="true">Protected</MenuItem>
              <MenuItem value="false">Not protected</MenuItem>
            </TextField>
            <TextField label="Min size" type="number" value={minSize} onChange={(e) => resetPage(setMinSize)(e.target.value)} sx={{ width: 110 }} inputProps={{ min: 0 }} />
            <TextField label="Max size" type="number" value={maxSize} onChange={(e) => resetPage(setMaxSize)(e.target.value)} sx={{ width: 110 }} inputProps={{ min: 0 }} />
            <TextField select label="Unit" value={unit} onChange={(e) => resetPage(setUnit)(e.target.value)} sx={{ width: 90 }}>
              {Object.keys(UNITS).map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
            <TextField label="Uploaded from" type="date" value={fromDate} onChange={(e) => resetPage(setFromDate)(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Uploaded to" type="date" value={toDate} onChange={(e) => resetPage(setToDate)(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button onClick={clearAll} color="inherit">Clear all</Button>
          </Stack>
        </Collapse>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>}

      <Card sx={{ overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {sortHead("original_filename", "Name")}
                <TableCell>Type</TableCell>
                {sortHead("file_size", "Size", "right")}
                {sortHead("created_at", "Uploaded")}
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((f) => {
                const kind = index.kindOf(f.id);
                const ks = kindStyle[kind];
                return (
                  <TableRow key={f.id} hover sx={{ cursor: "pointer" }} onClick={() => setSelected(f)}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <FileTypeIcon name={f.original_filename} mime={f.mime_type} />
                        <Typography fontWeight={600} noWrap sx={{ maxWidth: 320 }} title={f.original_filename}>{f.original_filename}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{fileKind(f.original_filename, f.mime_type).label}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBytes(f.file_size)}</TableCell>
                    <TableCell>{formatDate(f.created_at)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75}>
                        {!index.loading && <Chip size="small" label={ks.label} sx={{ bgcolor: `${ks.color}22`, color: ks.color }} />}
                        {f.is_protected && <Chip size="small" icon={<LockIcon />} label="Protected" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Details"><IconButton aria-label="View details" onClick={() => setSelected(f)}><InfoIcon /></IconButton></Tooltip>
                      <Tooltip title="Download"><IconButton aria-label="Download" onClick={() => onDownload(f)}><DownloadIcon /></IconButton></Tooltip>
                      <Tooltip title={f.is_protected ? "Protected files cannot be deleted" : "Delete"}>
                        <span>
                          <IconButton aria-label="Delete" color="error" disabled={f.is_protected} onClick={() => setToDelete(f)}><DeleteIcon /></IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {!loading && !items.length && (
          <EmptyState
            icon={<FolderOffIcon />}
            title={activeFilters || debounced ? "No files match these filters" : "No files uploaded yet"}
            message={activeFilters || debounced ? "Try removing a filter or searching for a different name." : "Use the Upload button to add your first file."}
            action={(activeFilters || debounced) ? <Button onClick={clearAll}>Clear filters</Button> : undefined}
          />
        )}

        <TablePagination
          component="div"
          count={result?.total ?? -1}
          page={page - 1}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, p) => setPage(p + 1)}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          labelDisplayedRows={({ from, to, count }) => (count === -1 ? `${from}–${from + items.length - 1 < from ? from : from + items.length - 1} · page ${page}` : `${from}–${to} of ${count}`)}
          slotProps={{ actions: { nextButton: { disabled: !result?.hasNext } } }}
        />
      </Card>

      <FileDetailsDrawer
        file={selected}
        kind={selected ? index.kindOf(selected.id) : "unique"}
        isAdmin={isAdmin}
        onClose={() => setSelected(null)}
        onDownload={onDownload}
        onDelete={(f) => { setSelected(null); setToDelete(f); }}
        onToggleProtect={onToggleProtect}
      />
      <DeleteFileDialog
        file={toDelete}
        kind={toDelete ? index.kindOf(toDelete.id) : "unique"}
        group={toDelete ? index.groupByOriginal.get(toDelete.id) : undefined}
        onClose={() => setToDelete(null)}
        onDeleted={() => load()}
      />
    </>
  );
}
