import { NODE_COLORS, NODE_TYPE_LABELS, EDGE_COLORS } from "@/lib/utils/colors";
import type { NodeType, EdgeType } from "@/types";

const NODE_ORDER: NodeType[] = ["epic", "story", "bug", "task", "subtask"];

const EDGE_LEGEND: { type: EdgeType; label: string; dashed: boolean }[] = [
  { type: "parent-child", label: "Parent / child", dashed: false },
  { type: "epic-child", label: "Epic child", dashed: false },
  { type: "subtask", label: "Sub-task", dashed: true },
  { type: "blocks", label: "Blocks / blocked by", dashed: false },
  { type: "depends-on", label: "Depends on", dashed: false },
  { type: "follows", label: "Follows", dashed: true },
  { type: "relates-to", label: "Relates to", dashed: false },
  { type: "clones", label: "Clones", dashed: false },
  { type: "semantic", label: "Semantic AI", dashed: true },
];

const STATUS_LEGEND = [
  { label: "Open / to do", color: "#94A3B8" },
  { label: "In progress", color: "#F59E0B" },
  { label: "Done", color: "#22C55E" },
  { label: "Blocked", color: "#DC2626" },
];

export default function GraphLegend() {
  return (
    <div className="absolute bottom-4 left-4 glass rounded-xl p-3 text-xs space-y-2 z-10">
      <p className="font-semibold text-slate-300 tracking-wide uppercase text-[10px]">Node type</p>
      <div className="space-y-1">
        {NODE_ORDER.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: NODE_COLORS[type] }} />
            <span className="text-slate-400">{NODE_TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      <p className="font-semibold text-slate-300 tracking-wide uppercase text-[10px] pt-1">Status (border)</p>
      <div className="space-y-1">
        {STATUS_LEGEND.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: "#1E293B", border: `2px solid ${color}` }}
            />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      <p className="font-semibold text-slate-300 tracking-wide uppercase text-[10px] pt-1">Edge</p>
      <div className="space-y-1">
        {EDGE_LEGEND.map(({ type, label, dashed }) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="w-6 inline-block"
              style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${EDGE_COLORS[type]}`, marginTop: 6 }}
            />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
