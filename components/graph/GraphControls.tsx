"use client";

import { useEffect, useState, useRef } from "react";
import type { Network } from "vis-network/standalone";
import type { GraphData, NodeType } from "@/types";
import { useGraphStore } from "@/store/graphStore";
import { downloadCsv } from "@/lib/utils/csv";

interface Props {
  graphData: GraphData | null;
  visibleData: GraphData | null;
  networkRef: React.MutableRefObject<Network | null>;
  onJqlChange: (jql: string) => void;
  onClear: () => void;
  onMyTickets: (active: boolean) => void;
}

const NODE_TYPES: NodeType[] = ["epic", "story", "bug", "task", "subtask"];

const STATUS_BUCKETS = [
  { key: "open",        label: "Open",        active: "bg-slate-500 text-white border-slate-400",      inactive: "bg-slate-500/20 text-slate-300 border-slate-500 hover:border-slate-300" },
  { key: "in progress", label: "In Progress", active: "bg-amber-500 text-white border-amber-400",      inactive: "bg-amber-500/20 text-amber-300 border-amber-600 hover:border-amber-400" },
  { key: "done",        label: "Done",        active: "bg-emerald-500 text-white border-emerald-400",  inactive: "bg-emerald-500/20 text-emerald-300 border-emerald-600 hover:border-emerald-400" },
  { key: "descoped",    label: "Descoped",    active: "bg-red-500 text-white border-red-400",          inactive: "bg-red-500/20 text-red-300 border-red-600 hover:border-red-400" },
];

// Quick-access presets
const PRESETS = [
  { label: "All my tickets",      jql: `assignee = currentUser() ORDER BY updated DESC` },
  { label: "Assigned to me",      jql: `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC` },
  { label: "Reported by me",      jql: `reporter = currentUser() ORDER BY updated DESC` },
  { label: "Watching",            jql: `watcher = currentUser() ORDER BY updated DESC` },
  { label: "Recently updated",    jql: `(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) ORDER BY updated DESC` },
];

export default function GraphControls({ graphData, visibleData, networkRef, onJqlChange, onClear, onMyTickets }: Props) {
  const { filters, setFilter, resetFilters, selectMode, setSelectMode, selectedIds, clearSelectedIds } = useGraphStore();

  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [allProjects, setAllProjects] = useState<{ key: string; name: string }[]>([]);
  const [activeLabel, setActiveLabel] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/jira/projects")
      .then((r) => r.json())
      .then((json) => setAllProjects(json.data ?? []));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProjects = allProjects.filter(
    (p) =>
      p.key.toLowerCase().includes(query.toLowerCase()) ||
      p.name.toLowerCase().includes(query.toLowerCase())
  );

  const applyJql = (jql: string, label: string) => {
    setActiveLabel(label);
    setQuery(label);
    setShowDropdown(false);
    onJqlChange(jql);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = query.trim();
      if (!q) return;
      // Single ticket key e.g. ECP-123
      if (/^[A-Z][A-Z0-9]+-\d+$/i.test(q)) {
        applyJql(`issue = "${q.toUpperCase()}"`, q.toUpperCase());
      // Project key only e.g. ECP
      } else if (/^[A-Z][A-Z0-9]+$/.test(q)) {
        applyJql(`project = "${q}" ORDER BY updated DESC`, q);
      // Multiple ticket keys e.g. ECP-1, ECP-2
      } else if (/^([A-Z][A-Z0-9]+-\d+\s*,?\s*)+$/i.test(q)) {
        const keys = q.split(/[\s,]+/).filter(Boolean).map(k => k.toUpperCase());
        applyJql(`issue in (${keys.join(",")})`, keys.join(", "));
      } else {
        // Free text search
        applyJql(`summary ~ "${q}" OR text ~ "${q}" ORDER BY updated DESC`, `"${q}"`);
      }
    }
  };

  const epics = graphData?.nodes.filter((n) => n.type === "epic") ?? [];
  const sprints = [...new Set(graphData?.nodes.map((n) => n.sprintName).filter(Boolean) as string[])];
  const labels = [...new Set((graphData?.nodes ?? []).flatMap((n) => n.labels))].sort();

  const handleExport = () => {
    const visible = visibleData?.nodes ?? [];
    const rows = selectedIds.size > 0 ? visible.filter((n) => selectedIds.has(n.id)) : visible;
    if (rows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(rows, `jiragraph-${stamp}.csv`);
  };

  const handleClear = () => {
    resetFilters();
    clearSelectedIds();
    setSelectMode(false);
    setQuery("");
    setActiveLabel("");
    onClear();
  };

  const toggleType = (type: NodeType) => {
    const next = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type];
    setFilter("types", next);
  };

  const toggleStatus = (key: string) => {
    const next = filters.statuses.includes(key) ? filters.statuses.filter((s) => s !== key) : [...filters.statuses, key];
    setFilter("statuses", next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 glass border-0 border-b text-sm" style={{ borderColor: "var(--hairline)" }}>

      {/* Smart search */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-1.5 w-64 input-dark px-2.5 py-1.5 focus-within:border-violet-500 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
          <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveLabel(""); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Project, keyword, or Enter for JQL…"
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-xs focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setActiveLabel(""); setShowDropdown(false); onJqlChange(""); }} className="text-slate-500 hover:text-slate-300 text-sm leading-none">×</button>
          )}
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-2 w-80 glass rounded-xl z-50 overflow-hidden">
            {/* Presets */}
            <div className="px-3 pt-2 pb-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-1">Quick access</p>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyJql(p.jql, p.label)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    activeLabel === p.label ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Projects */}
            {filteredProjects.length > 0 && (
              <div className="border-t border-slate-700 px-3 pt-2 pb-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-1">Projects</p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredProjects.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => applyJql(`project = "${p.key}" ORDER BY updated DESC`, `${p.name} (${p.key})`)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        activeLabel === `${p.name} (${p.key})` ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span className="font-mono text-indigo-400">{p.key}</span>
                      <span className="ml-2 text-slate-400">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query && (
              <div className="border-t border-slate-700 px-3 py-2 space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-1">Search</p>
                {/^[A-Z][A-Z0-9]+-\d+$/i.test(query) ? (
                  <button
                    onClick={() => applyJql(`issue = "${query.toUpperCase()}"`, query.toUpperCase())}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Open ticket <span className="font-mono text-indigo-400">{query.toUpperCase()}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => applyJql(`summary ~ "${query}" OR text ~ "${query}" ORDER BY updated DESC`, `"${query}"`)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Search tickets containing <span className="text-indigo-400 font-medium">"{query}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Epic filter */}
      {epics.length > 0 && (
        <select
          className="border border-slate-600 bg-slate-800 text-slate-200 rounded px-2 py-1 text-sm"
          value={filters.epic ?? ""}
          onChange={(e) => setFilter("epic", e.target.value || null)}
        >
          <option value="">All epics</option>
          {epics.map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}
        </select>
      )}

      {/* Sprint filter */}
      {sprints.length > 0 && (
        <select
          className="border border-slate-600 bg-slate-800 text-slate-200 rounded px-2 py-1 text-sm"
          value={filters.sprint ?? ""}
          onChange={(e) => setFilter("sprint", e.target.value || null)}
        >
          <option value="">All sprints</option>
          {sprints.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {/* Label filter */}
      {labels.length > 0 && (
        <select
          className="border border-slate-600 bg-slate-800 text-slate-200 rounded px-2 py-1 text-sm max-w-[12rem]"
          value={filters.label ?? ""}
          onChange={(e) => setFilter("label", e.target.value || null)}
          title="Filter by label"
        >
          <option value="">All labels</option>
          {labels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      )}

      {/* Status */}
      <div className="flex gap-1">
        {STATUS_BUCKETS.map(({ key, label, active, inactive }) => (
          <button
            key={key}
            onClick={() => toggleStatus(key)}
            className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${filters.statuses.includes(key) ? active : inactive}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* Type toggles */}
      <div className="flex gap-1">
        {NODE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`px-2 py-0.5 rounded-full border text-xs capitalize transition-colors ${
              filters.types.includes(t)
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-slate-800 text-slate-400 border-slate-600 hover:border-indigo-400 hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* My tickets */}
      <button
        onClick={() => {
          const next = !filters.myTickets;
          setFilter("myTickets", next);
          onMyTickets(next);
        }}
        className={`px-3 py-0.5 rounded-full border text-xs font-medium transition-colors ${
          filters.myTickets
            ? "bg-emerald-500 text-white border-emerald-500"
            : "bg-slate-800 text-slate-400 border-slate-600 hover:border-emerald-400 hover:text-slate-200"
        }`}
      >
        👤 My tickets
      </button>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Select mode */}
        <button
          onClick={() => {
            const next = !selectMode;
            setSelectMode(next);
            if (!next) clearSelectedIds();
          }}
          className={`px-3 py-0.5 rounded-full border text-xs font-medium transition-colors ${
            selectMode
              ? "bg-sky-500 text-white border-sky-500"
              : "bg-slate-800 text-slate-400 border-slate-600 hover:border-sky-400 hover:text-slate-200"
          }`}
          title="Click nodes to select them for export"
        >
          {selectMode ? `Selecting (${selectedIds.size})` : "Select"}
        </button>

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={!visibleData || visibleData.nodes.length === 0}
          className="btn text-emerald-300 hover:text-white hover:!bg-emerald-500/80 disabled:opacity-40"
          style={{ borderColor: "rgba(16,185,129,0.4)" }}
          title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : "Export visible tickets"}
        >
          ↓ Export CSV{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
        </button>

        {/* Clear view */}
        <button
          onClick={handleClear}
          className="btn"
          title="Clear loaded tickets and reset"
        >
          Clear
        </button>

        {/* My Board (personal playground) */}
        <a
          href="/playground"
          className="btn btn-primary"
          title="Open your personal board"
        >
          My Board
        </a>

        {/* Reset view (refit to cluster + clear filters, keep tickets) */}
        <button
          onClick={() => {
            resetFilters();
            setQuery("");
            setActiveLabel("");
            const net = networkRef.current as (Network & { fitToCluster?: () => void }) | null;
            if (net?.fitToCluster) net.fitToCluster();
            else net?.fit();
          }}
          className="btn"
          title="Reset filters and refit the view"
        >
          Reset view
        </button>
      </div>
    </div>
  );
}
