import type { NodeType, EdgeType } from "@/types";

// Single source of truth for all graph colors — used by the canvas renderer,
// the node color metadata, and the legend so they can never drift apart.

export const NODE_COLORS: Record<NodeType, string> = {
  epic: "#8B5CF6",
  story: "#3B82F6",
  bug: "#EF4444",
  task: "#10B981",
  subtask: "#94A3B8",
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  epic: "Epic",
  story: "Story",
  bug: "Bug",
  task: "Task",
  subtask: "Sub-task",
};

// Status border/dot color. Keyed on substrings matched against the real Jira
// statuses this instance uses (Open, Implementing, In Testing, Blocked,
// Agreed & Closed, Done, etc.). First match wins, order matters.
const STATUS_COLOR_RULES: { keys: string[]; color: string }[] = [
  { keys: ["blocked"], color: "#DC2626" },
  { keys: ["done", "closed", "completed", "resolved", "test passed", "validation complete"], color: "#22C55E" },
  { keys: ["progress", "implement", "testing", "validation", "review", "deployed", "submitted"], color: "#F59E0B" },
  { keys: ["descoped", "discontinued", "inactive"], color: "#6B7280" },
  { keys: ["open", "draft", "reopened", "ready", "discovery", "to do", "backlog"], color: "#94A3B8" },
];

export const EDGE_COLORS: Record<EdgeType, string> = {
  "epic-child": "#8B5CF6",
  "parent-child": "#94A3B8",
  subtask: "#94A3B8",
  blocks: "#EF4444",
  "is-blocked-by": "#EF4444",
  "depends-on": "#F97316",
  follows: "#EAB308",
  "relates-to": "#3B82F6",
  clones: "#F59E0B",
  semantic: "#A78BFA",
};

export function getNodeColor(type: NodeType): string {
  return NODE_COLORS[type] ?? "#6B7280";
}

export function getStatusBorderColor(status: string): string {
  const lower = status.toLowerCase();
  for (const { keys, color } of STATUS_COLOR_RULES) {
    if (keys.some((k) => lower.includes(k))) return color;
  }
  return "#94A3B8";
}
