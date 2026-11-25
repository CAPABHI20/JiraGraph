import { create } from "zustand";
import type { NodeType } from "@/types";

interface Filters {
  epic: string | null;
  sprint: string | null;
  label: string | null;
  types: NodeType[];
  statuses: string[];
  myTickets: boolean;
}

interface GraphStore {
  selectedNodeId: string | null;
  filters: Filters;
  mode: "explicit" | "semantic";
  selectMode: boolean;
  selectedIds: Set<string>;
  setSelectedNode: (id: string | null) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  setMode: (mode: "explicit" | "semantic") => void;
  resetFilters: () => void;
  setSelectMode: (on: boolean) => void;
  toggleSelectedId: (id: string) => void;
  clearSelectedIds: () => void;
}

const DEFAULT_FILTERS: Filters = {
  epic: null,
  sprint: null,
  label: null,
  types: [],
  statuses: [],
  myTickets: false,
};

export const useGraphStore = create<GraphStore>((set) => ({
  selectedNodeId: null,
  filters: DEFAULT_FILTERS,
  mode: "explicit",
  selectMode: false,
  selectedIds: new Set<string>(),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  setMode: (mode) => set({ mode }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setSelectMode: (on) => set({ selectMode: on }),
  toggleSelectedId: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clearSelectedIds: () => set({ selectedIds: new Set<string>() }),
}));
