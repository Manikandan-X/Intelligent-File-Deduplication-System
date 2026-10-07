import axios from "axios";

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

const parse = (iso: string) => new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parse(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parse(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

/** Turns FastAPI error bodies ({detail} or {detail, errors[]}) into one readable string. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Cannot reach the server. Check that the backend is running.";
    const data = error.response.data as { detail?: unknown; errors?: { field: string; message: string }[] } | undefined;
    if (data?.errors?.length) {
      return data.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join(" · ");
    }
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return (data!.detail as { msg?: string }[]).map((d) => d.msg).filter(Boolean).join(" · ") || fallback;
    }
  }
  return fallback;
}

export const toIsoStart = (date: string) => `${date}T00:00:00`;
export const toIsoEnd = (date: string) => `${date}T23:59:59`;
