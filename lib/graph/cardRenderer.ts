import type { GraphNode } from "@/types";
import { NODE_COLORS, getStatusBorderColor } from "@/lib/utils/colors";

// ── Priority icons ──────────────────────────────────────────────────────────

const PRIORITY_ICONS: Record<string, string> = {
  highest: "⬆",
  high:    "↑",
  medium:  "→",
  low:     "↓",
  lowest:  "⬇",
};

function getPriorityIcon(priority: string): string {
  return PRIORITY_ICONS[priority.toLowerCase()] ?? "→";
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string
): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

// ── Custom node renderer ──────────────────────────────────────────────────────
// Shared by the main graph and the personal playground so ticket cards look
// identical in both views.

export function makeCtxRenderer(node: GraphNode) {
  const typeColor = NODE_COLORS[node.type] ?? "#6B7280";
  const statusColor = getStatusBorderColor(node.status);
  const priorityIcon = getPriorityIcon(node.priority);

  // Card dimensions
  const W = 180;
  const H = 56;
  const R = 10; // corner radius
  const ACCENT = 5; // left accent bar width

  return {
    drawNode(ctx: CanvasRenderingContext2D, x: number, y: number, selected: boolean, _hover: boolean) {
      const left = x - W / 2;
      const top = y - H / 2;

      // Drop shadow
      ctx.shadowColor = selected ? "rgba(99,102,241,0.4)" : "rgba(0,0,0,0.15)";
      ctx.shadowBlur = selected ? 16 : 8;
      ctx.shadowOffsetY = 3;

      // Card background
      ctx.beginPath();
      ctx.roundRect(left, top, W, H, R);
      ctx.fillStyle = selected ? "#1E1B4B" : "#1E293B";
      ctx.fill();

      // Selected glow border
      if (selected) {
        ctx.strokeStyle = "#818CF8";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Left accent bar
      ctx.beginPath();
      ctx.roundRect(left, top + R, ACCENT, H - R * 2, 0);
      ctx.fillStyle = typeColor;
      ctx.fill();

      // Full left accent with rounded top/bottom corners only on left side
      ctx.beginPath();
      ctx.moveTo(left + R, top);
      ctx.lineTo(left + ACCENT, top);
      ctx.lineTo(left + ACCENT, top + H);
      ctx.lineTo(left + R, top + H);
      ctx.quadraticCurveTo(left, top + H, left, top + H - R);
      ctx.lineTo(left, top + R);
      ctx.quadraticCurveTo(left, top, left + R, top);
      ctx.fillStyle = typeColor;
      ctx.fill();

      // Ticket key
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.fillStyle = typeColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(node.id, left + ACCENT + 10, top + 9);

      // Priority icon (right of key)
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#94A3B8";
      ctx.textAlign = "right";
      ctx.fillText(priorityIcon, left + W - 10, top + 9);

      // Summary text (truncated)
      const maxWidth = W - ACCENT - 20;
      const summary = node.title.split("\n")[0].replace(`${node.id}: `, "");
      const truncated = truncateText(ctx, summary, maxWidth, "11px Inter, system-ui, sans-serif");
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#CBD5E1";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(truncated, left + ACCENT + 10, top + 25);

      // Status dot
      ctx.beginPath();
      ctx.arc(left + ACCENT + 10 + 4, top + H - 13, 4, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();

      // Status text
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#64748B";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(node.status, left + ACCENT + 22, top + H - 13);

      // Assignee initials bubble (if assigned)
      if (node.assignee) {
        const initials = node.assignee
          .split(",")
          .map((p: string) => p.trim()[0] ?? "")
          .slice(0, 2)
          .reverse()
          .join("")
          .toUpperCase();
        const bx = left + W - 18;
        const by = top + H - 13;
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fillStyle = typeColor + "33";
        ctx.fill();
        ctx.strokeStyle = typeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "bold 7px Inter, system-ui, sans-serif";
        ctx.fillStyle = typeColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, bx, by);
      }
    },

    nodeDimensions() {
      return { width: W, height: H };
    },
  };
}
