import { api } from "./client";
import type {
  AnalyticsOverview, AuditLog, DuplicateGroup, FileItem, FileListResult, FileQuery, Paginated, User,
} from "../types";

/* ---------- Auth ---------- */
export const login = async (email: string, password: string) =>
  (await api.post<{ access_token: string; token_type: string }>("/auth/login", { email, password })).data;

export const register = async (data: { first_name: string; last_name: string; email: string; password: string }) =>
  (await api.post<User>("/auth/register", data)).data;

export const getMe = async () => (await api.get<User>("/auth/me")).data;

export const updateMe = async (data: { first_name?: string; last_name?: string; email?: string }) =>
  (await api.put<User>("/auth/me", data)).data;

export const changePassword = async (current_password: string, new_password: string) =>
  (await api.put<User>("/auth/me/password", { current_password, new_password })).data;

/* ---------- Files ---------- */
// NOTE: list routes are declared with "/" on the backend, so the trailing slash is required
// (without it FastAPI answers with a 307 redirect that drops the Authorization header).
export async function listFiles(query: FileQuery): Promise<FileListResult> {
  const params: Record<string, unknown> = {};
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) params[k] = v;
  });
  const res = await api.get<FileItem[]>("/files/", { params });
  const header = res.headers["x-total-count"];
  const total = header !== undefined ? Number(header) : null;
  return {
    items: res.data,
    total: Number.isFinite(total) ? total : null,
    hasNext: total !== null && Number.isFinite(total)
      ? query.page * query.page_size < total
      : res.data.length === query.page_size,
  };
}

export const getFile = async (id: number) => (await api.get<FileItem>(`/files/${id}`)).data;

export async function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<FileItem> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<FileItem>("/files/upload", form, {
    timeout: 0, // large files: no client-side timeout
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

export async function downloadFile(file: FileItem): Promise<void> {
  const res = await api.get<Blob>(`/files/${file.id}/download`, { responseType: "blob", timeout: 0 });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.original_filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const deleteFile = async (id: number, deletion_reason?: string) =>
  (await api.delete<FileItem>(`/files/${id}`, { params: deletion_reason ? { deletion_reason } : {} })).data;

export const setProtection = async (id: number, is_protected: boolean) =>
  (await api.patch<FileItem>(`/files/${id}/protection`, null, { params: { is_protected } })).data;

/* ---------- Duplicate groups ---------- */
export const listGroups = async () => (await api.get<DuplicateGroup[]>("/duplicate-groups/")).data;

/** Needs backend-patch (GET /duplicate-groups/{id}/files). Returns null when the route does not exist yet. */
export async function getGroupFiles(groupId: number): Promise<FileItem[] | null> {
  try {
    return (await api.get<FileItem[]>(`/duplicate-groups/${groupId}/files`)).data;
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.response?.status === 405) return null;
    throw e;
  }
}

/* ---------- Analytics ---------- */
export const getOverview = async () => (await api.get<AnalyticsOverview>("/analytics/overview")).data;
export const getLargestFiles = async (limit = 8) =>
  (await api.get<{ files: FileItem[]; count: number }>("/analytics/largest-files", { params: { limit } })).data.files;
export const getRecentUploads = async (limit = 8) =>
  (await api.get<{ files: FileItem[]; count: number }>("/analytics/recent-uploads", { params: { limit } })).data.files;
export const getGroupCount = async () =>
  (await api.get<{ duplicate_groups: number }>("/analytics/duplicate-groups/count")).data.duplicate_groups;

/* ---------- Audit logs ---------- */
export interface AuditQuery {
  action?: string; entity_type?: string; from_date?: string; to_date?: string;
  page: number; page_size: number; sort_order: "asc" | "desc";
}
export async function listAuditLogs(query: AuditQuery, all: boolean) {
  const params: Record<string, unknown> = {};
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== "") params[k] = v; });
  return (await api.get<Paginated<AuditLog>>(all ? "/audit-logs/all" : "/audit-logs", { params })).data;
}

/* ---------- Users (admin) ---------- */
export const listUsers = async (params: { page: number; page_size: number; search?: string; is_active?: boolean }) =>
  (await api.get<Paginated<User>>("/users", { params })).data;
export const createUser = async (data: {
  first_name: string; last_name: string; email: string; password: string; role_id: number;
}) => (await api.post<User>("/users", data)).data;
export const updateUser = async (id: number, data: { first_name?: string; last_name?: string; email?: string }) =>
  (await api.put<User>(`/users/${id}`, data)).data;
export const changeUserRole = async (id: number, role_id: number) =>
  (await api.patch<User>(`/users/${id}/role`, { role_id })).data;
export const setUserActive = async (id: number, active: boolean) =>
  (await api.patch<User>(`/users/${id}/${active ? "activate" : "deactivate"}`)).data;
export const deleteUser = async (id: number) => { await api.delete(`/users/${id}`); };
