"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Network, DataSet } from "vis-network/standalone";
import type { GraphNode, BoardBundle, BoardSticky, BoardShape, Urgency } from "@/types";
import { makeCtxRenderer } from "@/lib/graph/cardRenderer";
import { useGraphStore } from "@/store/graphStore";
import { usePlaygroundStore } from "@/store/playgroundStore";

interface Props {
  boardId: number;
  bundle: BoardBundle;
  details: Record<string, GraphNode>;
  networkRef: React.MutableRefObject<Network | null>;
  onChanged: () => void;
}

const CARD_W = 180;
const CARD_H = 56;

const URGENCY_COLOR: Record<Urgency, string | null> = {
  none: null,
  watch: "#38BDF8",
  important: "#F59E0B",
  critical: "#EF4444",
};

const STICKY_COLORS = ["#FBBF24", "#F472B6", "#34D399", "#60A5FA", "#A78BFA"];

const VIS_OPTIONS = {
  physics: { enabled: false },
  edges: {
    color: { color: "#38BDF8", opacity: 1 },
    width: 2.5,
    arrows: { to: { enabled: true, scaleFactor: 0.8 } },
    font: { size: 12, color: "#7DD3FC", strokeWidth: 4, strokeColor: "#0F172A", align: "top" as const },
    smooth: { enabled: true, type: "curvedCW" as const, roundness: 0.15 },
  },
  nodes: { shape: "custom" as const, size: 110, font: { size: 1, color: "transparent" } },
  interaction: { hover: true, dragNodes: true, dragView: true, zoomView: true, keyboard: false },
  layout: { improvedLayout: false },
};

function cardNode(key: string, detail: GraphNode | undefined): GraphNode {
  if (detail) return detail;
  return {
    id: key, label: key, title: `${key}: (unavailable)`,
    type: "task", status: "Unavailable", priority: "Medium", assignee: null,
    epicKey: null, sprintName: null, labels: [],
    color: { background: "#334155", border: "#64748B" }, shape: "box",
  };
}

interface Handle { key: string; side: "left" | "right"; x: number; y: number }
interface DragState { from: string; sx: number; sy: number; cx: number; cy: number }
interface LabelEdit { id: number; x: number; y: number; value: string; color: string; style: "dashed" | "solid" }
interface StickyScreen { s: BoardSticky; x: number; y: number }
interface ShapeScreen { sh: BoardShape; x: number; y: number }
interface UrgencyMenu { nodeId: number; ticketKey: string; x: number; y: number }
interface EdgeDelBtn { id: number; x: number; y: number }

const EDGE_COLORS = ["#38BDF8", "#8B5CF6", "#F472B6", "#34D399", "#F59E0B", "#EF4444"];

export default function PlaygroundCanvas({ boardId, bundle, details, networkRef, onChanged }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeTool, setActiveTool } = usePlaygroundStore();
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const [handles, setHandles] = useState<Handle[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [editingFrameTitle, setEditingFrameTitle] = useState<number | null>(null);
  const [labelEdit, setLabelEdit] = useState<LabelEdit | null>(null);
  const [stickyScreens, setStickyScreens] = useState<StickyScreen[]>([]);
  const [shapeScreens, setShapeScreens] = useState<ShapeScreen[]>([]);
  const [urgencyMenu, setUrgencyMenu] = useState<UrgencyMenu | null>(null);
  const [edgeDel, setEdgeDel] = useState<EdgeDelBtn | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const blurTimer = useRef<number | null>(null);
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;

  const nodeIdByKey = useCallback((key: string) => bundleRef.current.nodes.find((n) => n.ticketKey === key)?.id, []);

  const syncOverlays = useCallback(() => {
    const net = networkRef.current;
    if (!net) return;
    // stickies → screen coords
    setStickyScreens(
      bundleRef.current.stickies.map((s) => {
        const d = net.canvasToDOM({ x: s.x, y: s.y });
        return { s, x: d.x, y: d.y };
      })
    );
    // shapes → screen coords
    setShapeScreens(
      bundleRef.current.shapes.map((sh) => {
        const d = net.canvasToDOM({ x: sh.x, y: sh.y });
        return { sh, x: d.x, y: d.y };
      })
    );
    // handles for hovered card
    const key = hoverKeyRef.current;
    if (key && !dragRef.current) {
      const p = net.getPositions([key])[key];
      if (p) {
        const scale = net.getScale();
        const half = (CARD_W / 2) * scale;
        const c = net.canvasToDOM(p);
        setHandles([
          { key, side: "left", x: c.x - half, y: c.y },
          { key, side: "right", x: c.x + half, y: c.y },
        ]);
      }
    }
  }, [networkRef]);

  // Draw urgency ring on top of the ticket card via a wrapper renderer.
  const makeRenderer = useCallback((key: string) => {
    const detail = details[key];
    const card = cardNode(key, detail);
    const base = makeCtxRenderer(card);
    const node = bundleRef.current.nodes.find((n) => n.ticketKey === key);
    const ring = node ? URGENCY_COLOR[node.urgency] : null;
    return {
      drawNode(ctx: CanvasRenderingContext2D, x: number, y: number, selected: boolean, hover: boolean) {
        base.drawNode(ctx, x, y, selected, hover);
        if (ring) {
          ctx.beginPath();
          ctx.roundRect(x - CARD_W / 2 - 3, y - CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, 12);
          ctx.strokeStyle = ring;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      },
      nodeDimensions: base.nodeDimensions,
    };
  }, [details]);

  useEffect(() => {
    if (!containerRef.current) return;

    const visNodes = bundle.nodes.map((bn) => {
      const renderer = makeRenderer(bn.ticketKey);
      return {
        id: bn.ticketKey,
        x: bn.x,
        y: bn.y,
        shape: "custom" as const,
        ctxRenderer: ({ ctx, x, y, state: { selected, hover } }: {
          ctx: CanvasRenderingContext2D; x: number; y: number; state: { selected: boolean; hover: boolean };
        }) => ({
          drawNode: () => renderer.drawNode(ctx, x, y, selected, hover),
          nodeDimensions: renderer.nodeDimensions(),
        }),
      };
    });

    const visEdges = bundle.edges.map((e) => ({
      id: String(e.id),
      from: e.fromKey,
      to: e.toKey,
      label: e.label || undefined,
      color: { color: e.color },
      dashes: e.style === "dashed" ? [6, 6] : false,
    }));

    const nodesDs = new DataSet(visNodes);
    const edgesDs = new DataSet(visEdges);
    const network = new Network(containerRef.current, { nodes: nodesDs, edges: edgesDs }, VIS_OPTIONS);
    networkRef.current = network;
    if (typeof window !== "undefined") (window as unknown as { __jgBoard?: Network }).__jgBoard = network;
    network.fit();

    network.on("afterDrawing", syncOverlays);

    network.on("hoverNode", (params: { node: string }) => {
      if (blurTimer.current) { window.clearTimeout(blurTimer.current); blurTimer.current = null; }
      hoverKeyRef.current = params.node;
      syncOverlays();
    });
    network.on("blurNode", () => {
      blurTimer.current = window.setTimeout(() => {
        if (!dragRef.current) { hoverKeyRef.current = null; setHandles([]); }
      }, 120);
    });

    network.on("click", (params: { nodes: string[]; pointer: { canvas: { x: number; y: number } } }) => {
      const tool = activeToolRef.current;
      if (params.nodes.length === 0 && (tool === "sticky" || tool === "text" || tool === "frame")) {
        const { x, y } = params.pointer.canvas;
        if (tool === "sticky") {
          fetch(`/api/boards/${boardId}/stickies`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x, y }),
          }).then(() => { setActiveTool("select"); onChanged(); });
        } else {
          const kind = tool === "text" ? "text" : "frame";
          const size = kind === "text" ? { w: 200, h: 40 } : { w: 320, h: 220 };
          fetch(`/api/boards/${boardId}/shapes`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, x, y, ...size }),
          }).then(() => { setActiveTool("select"); onChanged(); });
        }
        return;
      }
      const clicked = params.nodes.length > 0 ? params.nodes[0] : null;
      useGraphStore.getState().setSelectedNode(clicked);
      setUrgencyMenu(null);
    });

    network.on("dragEnd", (params: { nodes: string[] }) => {
      if (params.nodes.length === 0) return;
      const positions = network.getPositions(params.nodes);
      for (const key of params.nodes) {
        const id = nodeIdByKey(key);
        if (id === undefined) continue;
        const p = positions[key];
        fetch(`/api/boards/${boardId}/nodes/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: p.x, y: p.y }),
        });
      }
    });

    // Right-click a ticket → urgency menu.
    network.on("oncontext", (params: { event: PointerEvent; pointer: { DOM: { x: number; y: number } } }) => {
      params.event.preventDefault();
      const key = network.getNodeAt(params.pointer.DOM) as string | undefined;
      if (!key) { setUrgencyMenu(null); return; }
      const id = nodeIdByKey(key);
      if (id === undefined) return;
      const rect = containerRef.current!.getBoundingClientRect();
      setUrgencyMenu({ nodeId: id, ticketKey: key, x: params.pointer.DOM.x + rect.left, y: params.pointer.DOM.y + rect.top });
    });

    network.on("doubleClick", (params: { edges: string[]; nodes: string[] }) => {
      if (params.nodes.length > 0 || params.edges.length === 0) return;
      const edgeId = Number(params.edges[0]);
      const edge = bundleRef.current.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const pos = network.getPositions([edge.fromKey, edge.toKey]);
      const mid = { x: (pos[edge.fromKey].x + pos[edge.toKey].x) / 2, y: (pos[edge.fromKey].y + pos[edge.toKey].y) / 2 };
      const dom = network.canvasToDOM(mid);
      setLabelEdit({ id: edgeId, x: dom.x, y: dom.y, value: edge.label, color: edge.color, style: edge.style });
    });

    // Hover an edge → show a delete × near its midpoint.
    network.on("hoverEdge", (params: { edge: string }) => {
      const edgeId = Number(params.edge);
      const edge = bundleRef.current.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const pos = network.getPositions([edge.fromKey, edge.toKey]);
      if (!pos[edge.fromKey] || !pos[edge.toKey]) return;
      const mid = { x: (pos[edge.fromKey].x + pos[edge.toKey].x) / 2, y: (pos[edge.fromKey].y + pos[edge.toKey].y) / 2 };
      const dom = network.canvasToDOM(mid);
      setEdgeDel({ id: edgeId, x: dom.x, y: dom.y });
    });

    return () => { network.destroy(); networkRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, boardId, details]);

  // ── Connection drag from a handle ─────────────────────────────────────────
  const startDrag = (h: Handle, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const net = networkRef.current;
    if (!net || !containerRef.current) return;
    net.setOptions({ interaction: { dragNodes: false } });
    const rect = containerRef.current.getBoundingClientRect();
    const state: DragState = { from: h.key, sx: h.x, sy: h.y, cx: e.clientX - rect.left, cy: e.clientY - rect.top };
    dragRef.current = state;
    setDrag(state);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = { ...dragRef.current, cx: e.clientX - rect.left, cy: e.clientY - rect.top };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = async (e: MouseEvent) => {
      const state = dragRef.current;
      const net = networkRef.current;
      if (!state || !net || !containerRef.current) return;
      dragRef.current = null;
      setDrag(null);
      net.setOptions({ interaction: { dragNodes: true } });
      const rect = containerRef.current.getBoundingClientRect();
      const target = net.getNodeAt({ x: e.clientX - rect.left, y: e.clientY - rect.top }) as string | undefined;
      if (target && target !== state.from) {
        const res = await fetch(`/api/boards/${boardId}/edges`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: state.from, to: target, label: "" }),
        });
        const json = await res.json();
        if (!json.error) onChanged();
      }
      hoverKeyRef.current = null;
      setHandles([]);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, onChanged]);

  // Delete selected node/edge.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const net = networkRef.current;
      if (!net) return;
      const sel = net.getSelection();
      if (sel.nodes.length > 0) {
        const id = nodeIdByKey(sel.nodes[0] as string);
        if (id !== undefined) { await fetch(`/api/boards/${boardId}/nodes/${id}`, { method: "DELETE" }); onChanged(); }
      } else if (sel.edges.length > 0) {
        await fetch(`/api/boards/${boardId}/edges/${sel.edges[0]}`, { method: "DELETE" });
        onChanged();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, onChanged]);

  const commitLabel = async () => {
    if (!labelEdit) return;
    await fetch(`/api/boards/${boardId}/edges/${labelEdit.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: labelEdit.value, color: labelEdit.color, style: labelEdit.style }),
    });
    setLabelEdit(null);
    onChanged();
  };

  const patchEdgeStyle = async (fields: { color?: string; style?: "dashed" | "solid" }) => {
    if (!labelEdit) return;
    setLabelEdit({ ...labelEdit, ...fields });
    await fetch(`/api/boards/${boardId}/edges/${labelEdit.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    onChanged();
  };

  const deleteEdge = async (id: number) => {
    await fetch(`/api/boards/${boardId}/edges/${id}`, { method: "DELETE" });
    setEdgeDel(null);
    onChanged();
  };

  const setUrgency = async (nodeId: number, urgency: Urgency) => {
    await fetch(`/api/boards/${boardId}/nodes/${nodeId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urgency }),
    });
    setUrgencyMenu(null);
    onChanged();
  };

  // ── Sticky drag/edit handlers ─────────────────────────────────────────────
  const stickyDrag = useRef<{ id: number; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const onStickyMouseDown = (s: BoardSticky, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return; // let text editing work
    e.stopPropagation();
    stickyDrag.current = { id: s.id, startX: e.clientX, startY: e.clientY, ox: s.x, oy: s.y };
    const net = networkRef.current!;
    const onMove = (me: MouseEvent) => {
      if (!stickyDrag.current) return;
      const scale = net.getScale();
      const nx = stickyDrag.current.ox + (me.clientX - stickyDrag.current.startX) / scale;
      const ny = stickyDrag.current.oy + (me.clientY - stickyDrag.current.startY) / scale;
      // live move: update local overlay only, persist on up
      const st = bundleRef.current.stickies.find((x) => x.id === s.id);
      if (st) { st.x = nx; st.y = ny; syncOverlays(); }
    };
    const onUp = async () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const st = bundleRef.current.stickies.find((x) => x.id === s.id);
      if (st) {
        await fetch(`/api/boards/${boardId}/stickies/${s.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: st.x, y: st.y }),
        });
      }
      stickyDrag.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const saveStickyContent = async (id: number, content: string) => {
    await fetch(`/api/boards/${boardId}/stickies/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  };
  const setStickyColor = async (id: number, color: string) => {
    await fetch(`/api/boards/${boardId}/stickies/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    onChanged();
  };
  const deleteSticky = async (id: number) => {
    await fetch(`/api/boards/${boardId}/stickies/${id}`, { method: "DELETE" });
    onChanged();
  };

  // ── Shape drag / edit ─────────────────────────────────────────────────────
  const onShapeMouseDown = (sh: BoardShape, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    e.stopPropagation();
    const net = networkRef.current!;
    const startX = e.clientX, startY = e.clientY, ox = sh.x, oy = sh.y;

    // Frame containment: capture everything whose center is inside the frame at
    // grab time, so the whole group moves together (Figma-style).
    const isFrame = sh.kind === "frame";
    const left = sh.x - sh.w / 2, right = sh.x + sh.w / 2;
    const top = sh.y - sh.h / 2, bottom = sh.y + sh.h / 2;
    const inside = (px: number, py: number) => px >= left && px <= right && py >= top && py <= bottom;

    let capTickets: { key: string; ox: number; oy: number }[] = [];
    let capStickies: { id: number; ox: number; oy: number }[] = [];
    let capShapes: { id: number; ox: number; oy: number }[] = [];
    if (isFrame) {
      const keys = bundleRef.current.nodes.map((n) => n.ticketKey);
      const positions = keys.length ? net.getPositions(keys) : {};
      capTickets = keys
        .filter((k) => positions[k] && inside(positions[k].x, positions[k].y))
        .map((k) => ({ key: k, ox: positions[k].x, oy: positions[k].y }));
      capStickies = bundleRef.current.stickies
        .filter((s) => inside(s.x, s.y))
        .map((s) => ({ id: s.id, ox: s.x, oy: s.y }));
      capShapes = bundleRef.current.shapes
        .filter((o) => o.id !== sh.id && inside(o.x, o.y))
        .map((o) => ({ id: o.id, ox: o.x, oy: o.y }));
    }

    const onMove = (me: MouseEvent) => {
      const scaleNow = net.getScale();
      const dx = (me.clientX - startX) / scaleNow;
      const dy = (me.clientY - startY) / scaleNow;
      const cur = bundleRef.current.shapes.find((x) => x.id === sh.id);
      if (cur) { cur.x = ox + dx; cur.y = oy + dy; }
      // move captured contents by the same delta
      capTickets.forEach((t) => net.moveNode(t.key, t.ox + dx, t.oy + dy));
      capStickies.forEach((c) => {
        const st = bundleRef.current.stickies.find((x) => x.id === c.id);
        if (st) { st.x = c.ox + dx; st.y = c.oy + dy; }
      });
      capShapes.forEach((c) => {
        const o = bundleRef.current.shapes.find((x) => x.id === c.id);
        if (o) { o.x = c.ox + dx; o.y = c.oy + dy; }
      });
      syncOverlays();
    };
    const onUp = async () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const cur = bundleRef.current.shapes.find((x) => x.id === sh.id);
      const jobs: Promise<unknown>[] = [];
      if (cur) jobs.push(fetch(`/api/boards/${boardId}/shapes/${sh.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: cur.x, y: cur.y }),
      }));
      if (isFrame) {
        const finalPos = capTickets.length ? net.getPositions(capTickets.map((t) => t.key)) : {};
        capTickets.forEach((t) => {
          const id = nodeIdByKey(t.key);
          const p = finalPos[t.key];
          if (id !== undefined && p) jobs.push(fetch(`/api/boards/${boardId}/nodes/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: p.x, y: p.y }),
          }));
        });
        capStickies.forEach((c) => {
          const st = bundleRef.current.stickies.find((x) => x.id === c.id);
          if (st) jobs.push(fetch(`/api/boards/${boardId}/stickies/${c.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: st.x, y: st.y }),
          }));
        });
        capShapes.forEach((c) => {
          const o = bundleRef.current.shapes.find((x) => x.id === c.id);
          if (o) jobs.push(fetch(`/api/boards/${boardId}/shapes/${c.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: o.x, y: o.y }),
          }));
        });
      }
      await Promise.all(jobs);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const saveShapeText = async (id: number, text: string) => {
    await fetch(`/api/boards/${boardId}/shapes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
  };
  const setShapeColor = async (id: number, color: string) => {
    await fetch(`/api/boards/${boardId}/shapes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }),
    });
    onChanged();
  };
  const deleteShape = async (id: number) => {
    await fetch(`/api/boards/${boardId}/shapes/${id}`, { method: "DELETE" });
    onChanged();
  };

  // Resize a frame from its bottom-right corner; keep top-left anchored by
  // shifting the (center-based) x,y by half the size delta.
  const onFrameResizeMouseDown = (sh: BoardShape, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const net = networkRef.current!;
    const startX = e.clientX, startY = e.clientY;
    const ow = sh.w, oh = sh.h, ox = sh.x, oy = sh.y;
    const onMove = (me: MouseEvent) => {
      const scaleNow = net.getScale();
      const dw = (me.clientX - startX) / scaleNow;
      const dh = (me.clientY - startY) / scaleNow;
      const w = Math.max(120, ow + dw);
      const h = Math.max(80, oh + dh);
      const cur = bundleRef.current.shapes.find((x) => x.id === sh.id);
      if (cur) {
        cur.w = w; cur.h = h;
        cur.x = ox + (w - ow) / 2;
        cur.y = oy + (h - oh) / 2;
        syncOverlays();
      }
    };
    const onUp = async () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const cur = bundleRef.current.shapes.find((x) => x.id === sh.id);
      if (cur) await fetch(`/api/boards/${boardId}/shapes/${sh.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: cur.x, y: cur.y, w: cur.w, h: cur.h }),
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const scale = networkRef.current?.getScale() ?? 1;

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={`w-full h-full ${activeTool === "sticky" || activeTool === "text" || activeTool === "frame" ? "cursor-copy" : ""}`}
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
      />

      {/* Shapes: frames (bordered regions) + text labels */}
      {shapeScreens.map(({ sh, x, y }) => {
        const w = sh.w * scale;
        const h = sh.h * scale;
        if (sh.kind === "text") {
          return (
            <div
              key={sh.id}
              onMouseDown={(e) => onShapeMouseDown(sh, e)}
              className="absolute group pointer-events-auto"
              style={{ left: x, top: y, width: w, transform: "translate(-50%,-50%)" }}
            >
              <textarea
                defaultValue={sh.text}
                onBlur={(e) => saveShapeText(sh.id, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Text…"
                className="w-full bg-transparent resize-none text-center focus:outline-none font-semibold"
                style={{ color: sh.color, fontSize: Math.max(12, 20 * scale) }}
                rows={1}
              />
              <button onClick={(e) => { e.stopPropagation(); deleteShape(sh.id); }}
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none">×</button>
            </div>
          );
        }
        // frame — body is pointer-events-none so clicks pass through to tickets
        // inside it; only the title bar (drag) and resize handle are interactive.
        return (
          <div
            key={sh.id}
            className="absolute group pointer-events-none rounded-xl"
            style={{
              left: x, top: y, width: w, height: h, transform: "translate(-50%,-50%)",
              border: `2px solid ${sh.color}`, background: `${sh.color}14`,
            }}
          >
            <div
              onMouseDown={(e) => { if (editingFrameTitle !== sh.id) onShapeMouseDown(sh, e); }}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingFrameTitle(sh.id); }}
              className="flex items-center justify-between px-2 py-1 pointer-events-auto cursor-move rounded-t-xl"
              style={{ background: `${sh.color}22` }}
            >
              {editingFrameTitle === sh.id ? (
                <input
                  autoFocus
                  defaultValue={sh.text}
                  onBlur={(e) => { saveShapeText(sh.id, e.target.value); setEditingFrameTitle(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { saveShapeText(sh.id, (e.target as HTMLInputElement).value); setEditingFrameTitle(null); } }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-text"
                  style={{ color: sh.color, width: "70%" }}
                />
              ) : (
                <span className="text-xs font-semibold truncate select-none" style={{ color: sh.color, width: "70%" }} title="Double-click to rename">
                  {sh.text || "Frame"}
                </span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                {["#8B5CF6", "#38BDF8", "#34D399", "#F59E0B", "#F472B6"].map((c) => (
                  <button key={c} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setShapeColor(sh.id, c); }}
                    className="w-2.5 h-2.5 rounded-full border border-black/30" style={{ background: c }} />
                ))}
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deleteShape(sh.id); }}
                  className="text-slate-300 hover:text-red-400 text-xs leading-none ml-1">×</button>
              </div>
            </div>
            {/* Resize handle (bottom-right) */}
            <div
              onMouseDown={(e) => onFrameResizeMouseDown(sh, e)}
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-sm opacity-0 group-hover:opacity-100 cursor-nwse-resize pointer-events-auto"
              style={{ background: sh.color, border: "1px solid rgba(0,0,0,0.4)" }}
              title="Resize frame"
            />
          </div>
        );
      })}

      {/* Rubber-band arrow */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {drag && (
          <line x1={drag.sx} y1={drag.sy} x2={drag.cx} y2={drag.cy} stroke="#38BDF8" strokeWidth={2.5} strokeDasharray="6 6" markerEnd="url(#pg-arrow)" />
        )}
        <defs>
          <marker id="pg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#38BDF8" />
          </marker>
        </defs>
      </svg>

      {/* Connection handles */}
      {!drag && activeTool !== "sticky" && activeTool !== "text" && activeTool !== "frame" && handles.map((h) => (
        <div
          key={`${h.key}-${h.side}`}
          onMouseDown={(e) => startDrag(h, e)}
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-sky-400 border-2 border-slate-900 cursor-crosshair hover:scale-125 transition-transform pointer-events-auto"
          style={{ left: h.x, top: h.y }}
          title="Drag to connect"
        />
      ))}

      {/* Sticky notes */}
      {stickyScreens.map(({ s, x, y }) => {
        const size = 150 * scale;
        return (
          <div
            key={s.id}
            onMouseDown={(e) => onStickyMouseDown(s, e)}
            className="absolute group rounded-md shadow-lg pointer-events-auto flex flex-col"
            style={{ left: x, top: y, width: size, height: size, transform: "translate(-50%,-50%)", background: s.color }}
          >
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex gap-0.5">
                {STICKY_COLORS.map((c) => (
                  <button key={c} onClick={(e) => { e.stopPropagation(); setStickyColor(s.id, c); }}
                    className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: c }} title="color" />
                ))}
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteSticky(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-black/50 hover:text-black text-xs leading-none">×</button>
            </div>
            <textarea
              defaultValue={s.content}
              onBlur={(e) => saveStickyContent(s.id, e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Note…"
              className="flex-1 bg-transparent resize-none px-2 pb-2 text-slate-900 text-xs focus:outline-none placeholder-black/30"
              style={{ fontSize: Math.max(9, 12 * scale) }}
            />
          </div>
        );
      })}

      {/* Edge hover delete × */}
      {edgeDel && !labelEdit && (
        <button
          onClick={() => deleteEdge(edgeDel.id)}
          onMouseLeave={() => setEdgeDel(null)}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-lg pointer-events-auto hover:bg-red-400"
          style={{ left: edgeDel.x, top: edgeDel.y }}
          title="Delete connection"
        >
          ×
        </button>
      )}

      {/* Inline edge label + style popover */}
      {labelEdit && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 glass rounded-xl p-2 pointer-events-auto z-30"
          style={{ left: labelEdit.x, top: labelEdit.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={labelEdit.value}
            onChange={(e) => setLabelEdit({ ...labelEdit, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") setLabelEdit(null); }}
            placeholder="label…"
            className="w-36 input-dark px-2 py-1 text-xs mb-2"
          />
          <div className="flex items-center gap-1 mb-2">
            {EDGE_COLORS.map((c) => (
              <button key={c} onClick={() => patchEdgeStyle({ color: c })}
                className={`w-4 h-4 rounded-full border-2 ${labelEdit.color === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }} title="color" />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => patchEdgeStyle({ style: "dashed" })}
              className={`flex-1 px-2 py-1 rounded text-[10px] ${labelEdit.style === "dashed" ? "btn-primary" : "btn"}`}>Dashed</button>
            <button onClick={() => patchEdgeStyle({ style: "solid" })}
              className={`flex-1 px-2 py-1 rounded text-[10px] ${labelEdit.style === "solid" ? "btn-primary" : "btn"}`}>Solid</button>
            <button onClick={commitLabel} className="btn btn-primary px-2 py-1 text-[10px]">Done</button>
          </div>
        </div>
      )}

      {/* Urgency context menu */}
      {urgencyMenu && (
        <div
          className="fixed z-30 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 text-xs"
          style={{ left: urgencyMenu.x, top: urgencyMenu.y }}
          onMouseLeave={() => setUrgencyMenu(null)}
        >
          <p className="px-3 py-1 text-slate-500 uppercase text-[10px] tracking-wide">Urgency</p>
          {(["none", "watch", "important", "critical"] as Urgency[]).map((u) => (
            <button key={u} onClick={() => setUrgency(urgencyMenu.nodeId, u)}
              className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 flex items-center gap-2 capitalize">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-500" style={{ background: URGENCY_COLOR[u] ?? "transparent" }} />
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
