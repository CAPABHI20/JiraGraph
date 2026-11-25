import type { GraphNode } from "@/types";

const COLUMNS: { header: string; get: (n: GraphNode) => string }[] = [
  { header: "Key", get: (n) => n.id },
  { header: "Summary", get: (n) => n.title.split("\n")[0].replace(`${n.id}: `, "") },
  { header: "Type", get: (n) => n.type },
  { header: "Status", get: (n) => n.status },
  { header: "Priority", get: (n) => n.priority },
  { header: "Assignee", get: (n) => n.assignee ?? "" },
  { header: "Epic", get: (n) => n.epicKey ?? "" },
  { header: "Sprint", get: (n) => n.sprintName ?? "" },
  { header: "Labels", get: (n) => n.labels.join("; ") },
];

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function nodesToCsv(nodes: GraphNode[]): string {
  const header = COLUMNS.map((c) => c.header).join(",");
  const rows = nodes.map((n) => COLUMNS.map((c) => escapeCell(c.get(n))).join(","));
  return [header, ...rows].join("\n");
}

export function downloadCsv(nodes: GraphNode[], filename = "jiragraph-export.csv"): void {
  const csv = nodesToCsv(nodes);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
