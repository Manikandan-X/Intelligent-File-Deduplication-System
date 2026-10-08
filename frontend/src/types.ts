export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  role_id: number;
  created_at: string;
  updated_at: string;
}

export interface FileItem {
  id: number;
  user_id: number;
  original_filename: string;
  stored_filename: string;
  mime_type: string | null;
  file_size: number;
  is_deleted: boolean;
  is_protected: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileListResult {
  items: FileItem[];
  /** Present only when the backend sends the X-Total-Count header (see backend-patch). */
  total: number | null;
  hasNext: boolean;
}

export interface FileQuery {
  filename?: string;
  mime_type?: string;
  min_size?: number;
  max_size?: number;
  is_duplicate?: boolean;
  is_protected?: boolean;
  from_date?: string;
  to_date?: string;
  page: number;
  page_size: number;
  sort_by: "created_at" | "updated_at" | "file_size" | "original_filename";
  sort_order: "asc" | "desc";
}

export interface DuplicateGroup {
  id: number;
  content_hash: string;
  original_file_id: number;
  duplicate_count: number;
  total_size: number;
  potential_savings: number;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsOverview {
  total_files: number;
  total_storage: number;
  duplicate_files: number;
  duplicate_storage: number;
  potential_savings: number;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeletionRecord {
  id: number;
  file_id: number;
  user_id: number | null;
  original_filename: string;
  file_size: number;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
