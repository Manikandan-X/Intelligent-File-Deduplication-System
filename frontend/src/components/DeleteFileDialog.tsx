import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Skeleton, Stack, TextField, Typography,
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForeverOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import { deleteFile, getOverview } from "../api/endpoints";
import type { AnalyticsOverview, DuplicateGroup, FileItem } from "../types";
import { errorMessage, formatBytes, formatDateTime, percent } from "../utils/format";
import { palette } from "../theme";
import { useNotify } from "../context/NotifyContext";
import type { FileKind } from "../utils/useDuplicateIndex";
import FileTypeIcon from "./FileTypeIcon";
import StorageBar from "./StorageBar";
import { notifyFilesChanged } from "../utils/useFilesChanged";

interface Props {
  file: FileItem | null;
  kind: FileKind;
  group?: DuplicateGroup;
  onClose: () => void;
  onDeleted?: (file: FileItem) => void;
}

/** Confirmation pop-up that shows the storage impact before a file is deleted. */
export default function DeleteFileDialog({ file, kind, group, onClose, onDeleted }: Props) {
  const notify = useNotify();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    setReason("");
    setError(null);
    setOverview(null);
    getOverview().then(setOverview).catch(() => setOverview(null));
  }, [file]);

  if (!file) return null;

  const total = overview?.total_storage ?? 0;
  const freed = file.file_size;
  const after = Math.max(0, total - freed);
  const share = percent(freed, total);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteFile(file.id, reason.trim() || undefined);
      notify(`Deleted ${file.original_filename} — ${formatBytes(freed)} freed`);
      notifyFilesChanged();
      onDeleted?.(file);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="delete-title">
      <DialogTitle id="delete-title" sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <Box sx={{ bgcolor: `${palette.danger}1A`, color: palette.danger, p: 1, borderRadius: 2, display: "grid" }}>
          <DeleteForeverIcon />
        </Box>
        Delete this file?
      </DialogTitle>

      <DialogContent>
        {/* Selected file */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5, border: `1px solid ${palette.line}`, borderRadius: 2, mb: 2 }}>
          <FileTypeIcon name={file.original_filename} mime={file.mime_type} size={42} />
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700} noWrap title={file.original_filename}>{file.original_filename}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatBytes(file.file_size)} · uploaded {formatDateTime(file.created_at)}
            </Typography>
          </Box>
        </Stack>

        {file.is_protected ? (
          <Alert severity="error" icon={<LockIcon />} sx={{ mb: 2 }}>
            This file is protected and cannot be deleted. An administrator must remove its protection first.
          </Alert>
        ) : (
          <>
            {/* Storage impact */}
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Storage impact</Typography>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#F8FAFB", border: `1px solid ${palette.line}` }}>
              {overview ? (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
                    <Typography variant="h5" sx={{ color: palette.reclaim }}>−{formatBytes(freed)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {share < 0.1 ? "<0.1" : share.toFixed(1)}% of your storage
                    </Typography>
                  </Stack>
                  <StorageBar
                    segments={[
                      { label: "Remaining", value: after, color: palette.tide },
                      { label: "Freed by deleting", value: freed, color: palette.danger, striped: true },
                    ]}
                  />
                  <Divider sx={{ my: 1.5 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Used now</Typography>
                    <Typography variant="body2" fontWeight={700}>{formatBytes(total)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Used after deleting</Typography>
                    <Typography variant="body2" fontWeight={700}>{formatBytes(after)}</Typography>
                  </Stack>
                </>
              ) : (
                <>
                  <Typography variant="h5" sx={{ color: palette.reclaim }}>−{formatBytes(freed)}</Typography>
                  <Skeleton height={22} sx={{ mt: 1 }} />
                </>
              )}
            </Box>

            {/* What kind of copy is this? */}
            <Box sx={{ mt: 2 }}>
              {kind === "duplicate" && (
                <Alert severity="success">
                  This is a duplicate copy. The original is kept, so no unique content is lost.
                </Alert>
              )}
              {kind === "original" && (
                <Alert severity="warning">
                  This is the original copy of a duplicate group
                  {group ? ` with ${group.duplicate_count} duplicate${group.duplicate_count === 1 ? "" : "s"}` : ""}.
                  Consider deleting a duplicate instead.
                </Alert>
              )}
              {kind === "unique" && (
                <Alert severity="warning">
                  No other copy of this content was found. Deleting it removes the content from your library.
                </Alert>
              )}
            </Box>

            <TextField
              label="Reason (optional)"
              placeholder="e.g. Duplicate of the Q3 report"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 255))}
              helperText={`Saved in deletion history · ${reason.length}/255`}
              fullWidth
              sx={{ mt: 2 }}
            />
          </>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">Keep file</Button>
        <Button
          onClick={confirm}
          variant="contained"
          color="error"
          disabled={busy || file.is_protected}
          startIcon={<DeleteForeverIcon />}
        >
          {busy ? "Deleting…" : "Delete file"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
