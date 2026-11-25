"use client";

import { useGraphStore } from "@/store/graphStore";

export default function SemanticToggle() {
  const { mode, setMode } = useGraphStore();
  return (
    <div className="absolute top-4 right-4 z-10 flex rounded-lg overflow-hidden border border-slate-600 text-sm shadow-lg">
      <button
        onClick={() => setMode("explicit")}
        className={`px-3 py-1.5 transition-colors ${
          mode === "explicit" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        }`}
      >
        Explicit
      </button>
      <button
        onClick={() => setMode("semantic")}
        className={`px-3 py-1.5 transition-colors ${
          mode === "semantic" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        }`}
      >
        ✦ AI Semantic
      </button>
    </div>
  );
}
