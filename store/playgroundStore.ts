import { create } from "zustand";

export type Tool = "select" | "sticky" | "connect" | "text" | "frame";

interface PlaygroundStore {
  activeTool: Tool;
  hoveredKey: string | null;
  setActiveTool: (t: Tool) => void;
  setHoveredKey: (key: string | null) => void;
}

export const usePlaygroundStore = create<PlaygroundStore>((set) => ({
  activeTool: "select",
  hoveredKey: null,
  setActiveTool: (t) => set({ activeTool: t }),
  setHoveredKey: (key) => set({ hoveredKey: key }),
}));
