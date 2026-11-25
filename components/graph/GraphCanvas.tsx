"use client";

import { useEffect, useRef } from "react";
import { Network, DataSet } from "vis-network/standalone";
import type { GraphData } from "@/types";
import { useGraphStore } from "@/store/graphStore";
import { makeCtxRenderer } from "@/lib/graph/cardRenderer";

interface Props {
  data: GraphData | null;
  networkRef: React.MutableRefObject<Network | null>;
}

// ── vis-network options ───────────────────────────────────────────────────────

const VIS_OPTIONS = {
  // Physics off: nodes are placed deterministically in left-to-right layers
  // (see computeLayeredPositions). A force sim on a hub-heavy relates-to graph
  // produced a star-burst of crossing edges; explicit columns read far cleaner.
  physics: { enabled: false },
  edges: {
    smooth: { enabled: true, type: "cubicBezier" as const, forceDirection: "horizontal" as const, roundness: 0.4 },
    color: { opacity: 1, inherit: false as const },
    width: 3,
    hoverWidth: 1.5,
    selectionWidth: 2,
    arrows: { to: { enabled: true, scaleFactor: 0.9 } },
    font: { size: 13, color: "#CBD5E1", strokeWidth: 4, strokeColor: "#0F172A", align: "middle" as const },
  },
  nodes: {
    shape: "custom" as const,
    size: 110,
    font: { size: 1, color: "transparent" },
  },
  interaction: {
    hover: true,
    tooltipDelay: 300,
    navigationButtons: false,
    keyboard: true,
    zoomView: true,
  },
  layout: {
    improvedLayout: false,
  },
};

// One layout for every search. Two hard rules:
//   1. Epics are always leftmost (column 0). Hierarchy anchors the view.
//   2. Two connected tickets never share a column — every edge runs across
//      columns, so no line can hide behind the cards stacked in its own column.
// Columns are assigned as distance OUTWARD from the roots (epics first) over the
// undirected graph of ALL edges, then a fix-up guarantees rule 2. A dependency
// pointing "back" into an epic just draws a longer line; it never drags the
// epic rightward. Fully-disconnected tickets are excluded (the caller parks them).
const HIERARCHY_TYPES = new Set(["parent-child", "epic-child", "subtask"]);

function computeLayeredPositions(
  nodeIds: string[],
  edges: { from: string; to: string; type: string }[],
  nodeType: Record<string, string> = {}
): Record<string, { x: number; y: number }> {
  const COL_GAP = 560;
  const ROW_GAP = 120;

  const idSet = new Set(nodeIds);
  const usable = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to);

  // Undirected adjacency over ALL edge types (direction ignored for columns so
  // an inbound dependency can't push an epic right). Track hierarchy parents to
  // pick roots.
  const adj: Record<string, string[]> = {};
  const hierParentCount: Record<string, number> = {};
  nodeIds.forEach((id) => {
    adj[id] = [];
    hierParentCount[id] = 0;
  });
  for (const e of usable) {
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
    if (HIERARCHY_TYPES.has(e.type)) hierParentCount[e.to]++;
  }

  // Roots (column 0), in priority order: epics first, then hierarchy roots
  // (no hierarchy parent), so every component is anchored from its top.
  const isEpic = (id: string) => nodeType[id] === "epic";
  const rootScore = (id: string) => (isEpic(id) ? 0 : hierParentCount[id] === 0 ? 1 : 2);
  const ordered = nodeIds.slice().sort((a, b) => rootScore(a) - rootScore(b) || a.localeCompare(b));

  // BFS distance from roots over the undirected graph. Seeds are chosen greedily:
  // walk nodes in priority order; the first unseen node in each component becomes
  // that component's root at column 0.
  const col: Record<string, number> = {};
  for (const seed of ordered) {
    if (col[seed] !== undefined) continue;
    col[seed] = 0;
    const q = [seed];
    while (q.length) {
      const cur = q.shift()!;
      for (const n of adj[cur]) {
        if (col[n] === undefined) {
          col[n] = col[cur] + 1;
          q.push(n);
        }
      }
    }
  }

  // Rule-2 fix-up: while any edge connects two same-column nodes, push the one
  // farther from its root (higher-key tiebreak) one column right. Iterate to a
  // fixed point (bounded: each pass strictly increases some column).
  let changed = true;
  let guard = 0;
  while (changed && guard++ < nodeIds.length + 5) {
    changed = false;
    for (const e of usable) {
      if (col[e.from] === col[e.to]) {
        // Push the endpoint that is NOT an epic (epics stay put), else the
        // higher-key one, to a column to the right.
        const pushTo =
          isEpic(e.from) && !isEpic(e.to) ? e.to
          : isEpic(e.to) && !isEpic(e.from) ? e.from
          : e.from.localeCompare(e.to) > 0 ? e.from : e.to;
        col[pushTo] = col[pushTo] + 1;
        changed = true;
      }
    }
  }

  // Group into columns.
  const cols: Record<number, string[]> = {};
  nodeIds.forEach((id) => {
    const c = col[id] ?? 0;
    (cols[c] = cols[c] || []).push(id);
  });
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b);

  // Row ordering: leftmost column stable by key; each next column ordered by the
  // average row of its neighbours in earlier columns (barycenter) to keep lines short.
  const rowIndex: Record<string, number> = {};
  if (colKeys.length > 0) {
    cols[colKeys[0]].sort((a, b) => a.localeCompare(b));
    cols[colKeys[0]].forEach((id, i) => (rowIndex[id] = i));
  }
  const predsOf: Record<string, string[]> = {};
  nodeIds.forEach((id) => (predsOf[id] = []));
  for (const e of usable) {
    if (col[e.from] < col[e.to]) predsOf[e.to].push(e.from);
    else if (col[e.to] < col[e.from]) predsOf[e.from].push(e.to);
  }

  for (let i = 1; i < colKeys.length; i++) {
    const c = colKeys[i];
    const withKey = cols[c].map((id, idx) => {
      const ps = predsOf[id].filter((p) => rowIndex[p] !== undefined);
      const key = ps.length ? ps.reduce((s, p) => s + rowIndex[p], 0) / ps.length : Number.MAX_SAFE_INTEGER;
      return { id, key, tie: idx };
    });
    withKey.sort((a, b) => a.key - b.key || a.tie - b.tie);
    cols[c] = withKey.map((w) => w.id);
    cols[c].forEach((id, idx) => (rowIndex[id] = idx));
  }

  // Coordinates: each column vertically centered.
  const pos: Record<string, { x: number; y: number }> = {};
  colKeys.forEach((c) => {
    const members = cols[c];
    const h = (members.length - 1) * ROW_GAP;
    members.forEach((id, i) => {
      pos[id] = { x: c * COL_GAP, y: Math.round(i * ROW_GAP - h / 2) };
    });
  });
  return pos;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphCanvas({ data, networkRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedNode, selectMode, selectedIds, toggleSelectedId } = useGraphStore();

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Two groups only:
    //  • connected  — has at least one edge of any kind → placed in the hierarchy
    //                  view (columns by issue type: epic → story/task/bug → subtask).
    //  • disconnected — no edges at all → parked in a grid below, out of the way.
    const hasAnyEdge = new Set<string>();
    for (const e of data.edges) {
      hasAnyEdge.add(e.from);
      hasAnyEdge.add(e.to);
    }
    const connectedNodeIdList = data.nodes.filter((n) => hasAnyEdge.has(n.id)).map((n) => n.id);
    const disconnectedIds = data.nodes.filter((n) => !hasAnyEdge.has(n.id)).map((n) => n.id);

    // Hierarchy positions for every connected node.
    const nodeTypeMap: Record<string, string> = {};
    data.nodes.forEach((n) => (nodeTypeMap[n.id] = n.type));
    const layered = computeLayeredPositions(connectedNodeIdList, data.edges, nodeTypeMap);
    const treeNodeIds = Object.keys(layered);

    const layeredYs = Object.values(layered).map((p) => p.y);
    const clusterBottom = layeredYs.length > 0 ? Math.max(...layeredYs) : 0;

    // Grid-park the fully-disconnected tickets below the hierarchy.
    const ORPHAN_COLS = 6;
    const ORPHAN_X_GAP = 210;
    const ORPHAN_Y_GAP = 80;
    const orphanY0 = clusterBottom + 200;
    const orphanPos: Record<string, { x: number; y: number }> = {};
    disconnectedIds.forEach((id, i) => {
      orphanPos[id] = {
        x: (i % ORPHAN_COLS) * ORPHAN_X_GAP,
        y: orphanY0 + Math.floor(i / ORPHAN_COLS) * ORPHAN_Y_GAP,
      };
    });

    // Attach custom renderer + fixed position to each node
    const nodesWithRenderer = data.nodes.map((node) => {
      const renderer = makeCtxRenderer(node);
      const picked = selectMode && selectedIds.has(node.id);
      const p = layered[node.id] ?? orphanPos[node.id] ?? { x: 0, y: 0 };
      return {
        ...node,
        shape: "custom" as const,
        x: p.x,
        y: p.y,
        ctxRenderer: ({
          ctx,
          x,
          y,
          state: { selected, hover },
        }: {
          ctx: CanvasRenderingContext2D;
          x: number;
          y: number;
          state: { selected: boolean; hover: boolean };
          style: Record<string, unknown>;
          label: string | undefined;
        }) => ({
          drawNode: () => renderer.drawNode(ctx, x, y, selected || picked, hover),
          nodeDimensions: renderer.nodeDimensions(),
        }),
      };
    });

    const nodesDs = new DataSet(nodesWithRenderer);
    const edgesDs = new DataSet(data.edges);

    const network = new Network(
      containerRef.current,
      { nodes: nodesDs, edges: edgesDs },
      VIS_OPTIONS
    );

    networkRef.current = network;
    if (typeof window !== "undefined") {
      (window as unknown as { __jgNet?: Network }).__jgNet = network;
    }

    // Adjacency for click-to-highlight: clicking a node keeps its own edges
    // bright and fades every other edge, so you can trace one ticket's web.
    const edgeNeighbors = new Map<string, string[]>(); // nodeId -> edgeIds
    data.edges.forEach((e) => {
      (edgeNeighbors.get(e.from) ?? edgeNeighbors.set(e.from, []).get(e.from)!).push(e.id);
      (edgeNeighbors.get(e.to) ?? edgeNeighbors.set(e.to, []).get(e.to)!).push(e.id);
    });
    const DIM = "#1E293B";
    const restoreEdges = () => {
      edgesDs.update(
        data.edges.map((e) => ({ id: e.id, color: { color: e.color.color, opacity: 1 }, width: e.width, font: { color: "#CBD5E1" } }))
      );
    };
    const highlightFrom = (nodeId: string) => {
      const keep = new Set(edgeNeighbors.get(nodeId) ?? []);
      edgesDs.update(
        data.edges.map((e) =>
          keep.has(e.id)
            ? { id: e.id, color: { color: e.color.color, opacity: 1 }, width: Math.max(e.width, 4), font: { color: "#F1F5F9" } }
            : { id: e.id, color: { color: DIM, opacity: 0.25 }, width: 1, font: { color: DIM } }
        )
      );
    };

    network.on("click", (params) => {
      const clickedId = params.nodes.length > 0 ? (params.nodes[0] as string) : null;
      if (selectMode && clickedId) {
        toggleSelectedId(clickedId);
        return;
      }
      if (clickedId) highlightFrom(clickedId);
      else restoreEdges();
      setSelectedNode(clickedId);
    });

    // Intercept Cmd+/Ctrl+ zoom keys so the browser doesn't zoom the whole page
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== "=" && e.key !== "-" && e.key !== "0") return;
      e.preventDefault();
      const scale = network.getScale();
      if (e.key === "=") network.moveTo({ scale: scale * 1.2, animation: { duration: 150, easingFunction: "easeInOutQuad" } });
      if (e.key === "-") network.moveTo({ scale: scale * 0.8, animation: { duration: 150, easingFunction: "easeInOutQuad" } });
      if (e.key === "0") network.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
    };

    window.addEventListener("keydown", handleKeyDown);

    // Fit tightly to the connected columns (never the parked orphan grid), then
    // cap zoom so cards stay readable. Shared by initial layout and the "Reset
    // view" button so a reset never zooms out to include orphans.
    const fitToCluster = () => {
      network.fit({
        nodes: treeNodeIds.length > 0 ? treeNodeIds : undefined,
        animation: { duration: 400, easingFunction: "easeInOutQuad" },
      });
      window.setTimeout(() => {
        // Only cap the MAX zoom so a tiny graph doesn't blow up. Never force a
        // minimum: a wide flow graph must be allowed to zoom out enough to show
        // the whole left-to-right structure (the user reads detail by zooming
        // in / clicking a ticket to highlight its chain).
        const scale = network.getScale();
        if (scale > 1.1) {
          const center = network.getViewPosition();
          network.moveTo({ scale: 1.1, position: center });
        }
      }, 450);
    };
    (network as unknown as { fitToCluster?: () => void }).fitToCluster = fitToCluster;

    // Positions are already assigned (physics is off), so just fit once the
    // network has drawn its first frame.
    const fitTimer = window.setTimeout(fitToCluster, 100);

    return () => {
      window.clearTimeout(fitTimer);
      window.removeEventListener("keydown", handleKeyDown);
      network.destroy();
      networkRef.current = null;
    };
  }, [data, networkRef, setSelectedNode, selectMode, selectedIds, toggleSelectedId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Select a project to load the graph
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
    />
  );
}
