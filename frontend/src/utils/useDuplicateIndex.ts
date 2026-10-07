import { useCallback, useEffect, useState } from "react";
import { listFiles, listGroups } from "../api/endpoints";
import type { DuplicateGroup } from "../types";
import { useFilesChanged } from "./useFilesChanged";

export type FileKind = "unique" | "original" | "duplicate";

export interface DuplicateIndex {
  loading: boolean;
  groups: DuplicateGroup[];
  originalIds: Set<number>;
  duplicateIds: Set<number>;
  groupByOriginal: Map<number, DuplicateGroup>;
  kindOf: (fileId: number) => FileKind;
  reload: () => void;
}

/** Works out which files are originals / duplicates using the existing endpoints only. */
export function useDuplicateIndex(): DuplicateIndex {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateIds, setDuplicateIds] = useState<Set<number>>(new Set());

  const reload = useCallback(async () => {
    try {
      const g = await listGroups();
      const ids = new Set<number>();
      for (let page = 1; page <= 10; page++) {
        const res = await listFiles({ page, page_size: 100, sort_by: "created_at", sort_order: "desc", is_duplicate: true });
        res.items.forEach((f) => ids.add(f.id));
        if (!res.hasNext) break;
      }
      setGroups(g);
      setDuplicateIds(ids);
    } catch {
      /* the index is a progressive enhancement; pages still work without it */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useFilesChanged(reload);

  const originalIds = new Set(groups.map((g) => g.original_file_id));
  const groupByOriginal = new Map(groups.map((g) => [g.original_file_id, g]));
  const kindOf = (id: number): FileKind =>
    duplicateIds.has(id) ? "duplicate" : originalIds.has(id) ? "original" : "unique";

  return { loading, groups, originalIds, duplicateIds, groupByOriginal, kindOf, reload };
}
