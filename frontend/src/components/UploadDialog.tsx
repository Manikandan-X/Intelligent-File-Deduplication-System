import { useCallback, useRef, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUploadOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CloseIcon from "@mui/icons-material/Close";
import { uploadFile } from "../api/endpoints";
import { errorMessage, formatBytes } from "../utils/format";
import { palette } from "../theme";
import { notifyFilesChanged } from "../utils/useFilesChanged";
import { useNotify } from "../context/NotifyContext";

const MAX_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE ?? 92274688);

interface Item {
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

/** Client-side mirror of the backend rules (no audio/video, size cap). The server still validates. */
function precheck(file: File): string | undefined {
  if (file.type.startsWith("video/")) return "Video files are not allowed";
  if (file.type.startsWith("audio/")) return "Audio files are not allowed";
  if (file.size > MAX_SIZE) return `File exceeds the ${formatBytes(MAX_SIZE, 0)} limit`;
  if (file.name.length > 255) return "Filename cannot exceed 255 characters";
  return undefined;
}

export default function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);

  const patch = (index: number, change: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...change } : it)));

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const next: Item[] = Array.from(list).map((file) => {
      const problem = precheck(file);
      return { file, status: problem ? "error" : "queued", progress: 0, error: problem };
    });
    setItems((prev) => [...prev, ...next]);
  }, []);

  const startUpload = async () => {
    setRunning(true);
    let uploaded = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== "queued") continue;
      patch(i, { status: "uploading", progress: 0 });
      try {
        await uploadFile(items[i].file, (p) => patch(i, { progress: p }));
        patch(i, { status: "done", progress: 100 });
        uploaded++;
      } catch (e) {
        patch(i, { status: "error", error: errorMessage(e) });
      }
    }
    setRunning(false);
    if (uploaded) {
      notify(`${uploaded} file${uploaded === 1 ? "" : "s"} uploaded — duplicate check is running in the background`, "info");
      notifyFilesChanged();
      // Hashing runs in Celery, so refresh again shortly to pick up duplicate results.
      setTimeout(notifyFilesChanged, 4000);
    }
  };

  const close = () => {
    if (running) return;
    setItems([]);
    onClose();
  };

  const queued = items.filter((i) => i.status === "queued").length;

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Upload files</DialogTitle>
      <DialogContent>
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          sx={{
            border: `2px dashed ${dragging ? palette.tide : "#B7C8CE"}`,
            bgcolor: dragging ? `${palette.tide}0F` : "#F8FAFB",
            borderRadius: 3, p: 4, textAlign: "center", cursor: "pointer", transition: "all .15s",
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 44, color: palette.tide }} />
          <Typography fontWeight={700} sx={{ mt: 1 }}>Drop files here or click to browse</Typography>
          <Typography variant="body2" color="text.secondary">
            Up to {formatBytes(MAX_SIZE, 0)} each · audio and video files are not accepted
          </Typography>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </Box>

        {items.length > 0 && (
          <Stack spacing={1.25} sx={{ mt: 2, maxHeight: 260, overflowY: "auto" }}>
            {items.map((it, i) => (
              <Box key={i} sx={{ p: 1.25, border: `1px solid ${palette.line}`, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {it.status === "done" && <CheckCircleIcon fontSize="small" color="success" />}
                  {it.status === "error" && <ErrorIcon fontSize="small" color="error" />}
                  <Typography noWrap sx={{ flex: 1 }} title={it.file.name}>{it.file.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{formatBytes(it.file.size)}</Typography>
                  {(it.status === "queued" || it.status === "error") && !running && (
                    <IconButton size="small" aria-label="Remove" onClick={() => setItems((p) => p.filter((_, x) => x !== i))}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                {it.status === "uploading" && <LinearProgress variant="determinate" value={it.progress} sx={{ mt: 1, borderRadius: 4 }} />}
                {it.status === "error" && <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>{it.error}</Typography>}
              </Box>
            ))}
          </Stack>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          Duplicate detection runs in the background after upload, so large files never block you.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close} color="inherit" disabled={running}>{items.some((i) => i.status === "done") ? "Done" : "Cancel"}</Button>
        <Button variant="contained" onClick={startUpload} disabled={running || queued === 0} startIcon={<CloudUploadIcon />}>
          {running ? "Uploading…" : `Upload ${queued || ""} file${queued === 1 ? "" : "s"}`.replace("  ", " ")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
