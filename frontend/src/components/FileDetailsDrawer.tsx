import { Alert, Box, Button, Chip, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import LockIcon from "@mui/icons-material/LockOutlined";
import LockOpenIcon from "@mui/icons-material/LockOpenOutlined";
import type { FileItem } from "../types";
import { extensionOf, formatBytes, formatDateTime } from "../utils/format";
import FileTypeIcon, { fileKind } from "./FileTypeIcon";
import type { FileKind } from "../utils/useDuplicateIndex";
import { palette } from "../theme";

const kindChip: Record<FileKind, { label: string; color: string }> = {
  unique: { label: "Unique", color: palette.reclaim },
  original: { label: "Original", color: palette.original },
  duplicate: { label: "Duplicate", color: palette.duplicate },
};

interface Props {
  file: FileItem | null;
  kind: FileKind;
  isAdmin: boolean;
  onClose: () => void;
  onDownload: (f: FileItem) => void;
  onDelete: (f: FileItem) => void;
  onToggleProtect: (f: FileItem) => void;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1 }}>
      <Typography color="text.secondary">{k}</Typography>
      <Typography fontWeight={600} sx={{ textAlign: "right", wordBreak: "break-all" }}>{v}</Typography>
    </Stack>
  );
}

/** Shows file metadata (name, type, size, dates, owner, protection, duplicate status). */
export default function FileDetailsDrawer({ file, kind, isAdmin, onClose, onDownload, onDelete, onToggleProtect }: Props) {
  const chip = kindChip[kind];
  return (
    <Drawer anchor="right" open={!!file} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 400 } } }}>
      {file && (
        <Box sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">File details</Typography>
            <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <FileTypeIcon name={file.original_filename} mime={file.mime_type} size={52} />
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={700} sx={{ wordBreak: "break-all" }}>{file.original_filename}</Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                <Chip size="small" label={chip.label} sx={{ bgcolor: `${chip.color}22`, color: chip.color }} />
                {file.is_protected && <Chip size="small" icon={<LockIcon />} label="Protected" color="default" />}
              </Stack>
            </Box>
          </Stack>
          <Divider />
          <Row k="Type" v={fileKind(file.original_filename, file.mime_type).label} />
          <Row k="MIME type" v={file.mime_type ?? "unknown"} />
          <Row k="Extension" v={extensionOf(file.original_filename) ? `.${extensionOf(file.original_filename)}` : "none"} />
          <Row k="Size" v={`${formatBytes(file.file_size, 2)} (${file.file_size.toLocaleString()} bytes)`} />
          <Row k="Uploaded" v={formatDateTime(file.created_at)} />
          <Row k="Last updated" v={formatDateTime(file.updated_at)} />
          <Row k="Owner (user id)" v={String(file.user_id)} />
          <Row k="File id" v={String(file.id)} />
          <Row k="Stored as" v={file.stored_filename} />
          <Divider sx={{ mb: 2 }} />
          {file.is_protected && (
            <Alert severity="info" sx={{ mb: 2 }}>Protected files cannot be deleted until protection is removed.</Alert>
          )}
          <Stack spacing={1}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => onDownload(file)}>Download</Button>
            {isAdmin && (
              <Button variant="outlined" startIcon={file.is_protected ? <LockOpenIcon /> : <LockIcon />} onClick={() => onToggleProtect(file)}>
                {file.is_protected ? "Remove protection" : "Protect file"}
              </Button>
            )}
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} disabled={file.is_protected} onClick={() => onDelete(file)}>
              Delete…
            </Button>
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}
