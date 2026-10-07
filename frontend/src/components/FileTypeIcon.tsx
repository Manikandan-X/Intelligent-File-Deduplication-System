import ImageIcon from "@mui/icons-material/ImageOutlined";
import PdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ZipIcon from "@mui/icons-material/FolderZipOutlined";
import CodeIcon from "@mui/icons-material/CodeOutlined";
import TableIcon from "@mui/icons-material/TableChartOutlined";
import DocIcon from "@mui/icons-material/DescriptionOutlined";
import FileIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { Box } from "@mui/material";
import { extensionOf } from "../utils/format";

export function fileKind(name: string, mime: string | null): { label: string; color: string; Icon: typeof FileIcon } {
  const ext = extensionOf(name);
  const m = mime ?? "";
  if (m.startsWith("image/")) return { label: "Image", color: "#8A5CD0", Icon: ImageIcon };
  if (m === "application/pdf" || ext === "pdf") return { label: "PDF", color: "#D9484A", Icon: PdfIcon };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || m.includes("zip")) return { label: "Archive", color: "#E39A2D", Icon: ZipIcon };
  if (["csv", "xls", "xlsx"].includes(ext) || m.includes("spreadsheet") || m === "text/csv") return { label: "Spreadsheet", color: "#2E9E6B", Icon: TableIcon };
  if (["js", "ts", "tsx", "py", "json", "html", "css", "xml", "yml", "yaml"].includes(ext)) return { label: "Code", color: "#0F7C8A", Icon: CodeIcon };
  if (["doc", "docx", "txt", "md", "rtf", "ppt", "pptx"].includes(ext) || m.startsWith("text/")) return { label: "Document", color: "#4F5BD5", Icon: DocIcon };
  return { label: "File", color: "#5B7078", Icon: FileIcon };
}

export default function FileTypeIcon({ name, mime, size = 36 }: { name: string; mime: string | null; size?: number }) {
  const { color, Icon } = fileKind(name, mime);
  return (
    <Box sx={{ width: size, height: size, borderRadius: 2, bgcolor: `${color}1A`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon fontSize="small" />
    </Box>
  );
}
