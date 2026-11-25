import type { McpIssue, McpIssueLink } from "./types";
import type { JiraTicket, GraphNode, GraphEdge, GraphData, NodeType, EdgeType } from "@/types";
import { getNodeColor, getStatusBorderColor, EDGE_COLORS } from "@/lib/utils/colors";

// ── Raw MCP issue → JiraTicket ────────────────────────────────────────────────

export function rawToTicket(issue: McpIssue): JiraTicket {
  const sprintRaw = issue.sprint;
  let sprintName: string | null = null;
  if (Array.isArray(sprintRaw)) {
    sprintName = sprintRaw[sprintRaw.length - 1]?.name ?? null;
  } else if (sprintRaw && typeof sprintRaw === "object") {
    sprintName = (sprintRaw as { name: string }).name ?? null;
  }

  const links: JiraTicket["links"] = (issue.issuelinks ?? []).map(
    (l: McpIssueLink, i: number) => ({
      id: l.id ?? String(i),
      // MCP returns type as an object { name, inward, outward }; keep the name.
      type: typeof l.type === "string" ? l.type : l.type?.name ?? "relates to",
      inwardIssue: l.inward_issue?.key ?? l.inwardIssue?.key,
      outwardIssue: l.outward_issue?.key ?? l.outwardIssue?.key,
    })
  );

  return {
    id: issue.id,
    key: issue.key,
    summary: issue.summary ?? "",
    description: issue.description ?? null,
    status: issue.status?.name ?? "Unknown",
    issueType: issue.issue_type?.name ?? "Task",
    priority: issue.priority?.name ?? "Medium",
    assignee:
      issue.assignee?.display_name && issue.assignee.display_name !== "Unassigned"
        ? issue.assignee.display_name
        : null,
    reporter: issue.reporter?.display_name ?? null,
    epicKey: issue.epic?.key ?? null,
    parentKey: issue.parent?.key ?? null,
    labels: issue.labels ?? [],
    sprintName,
    created: issue.created ?? "",
    updated: issue.updated ?? "",
    links,
    subtaskKeys: (issue.subtasks ?? []).map((s) => s.key),
  };
}

// ── NodeType detection ────────────────────────────────────────────────────────

function normalizeIssueType(raw: string): NodeType {
  const lower = raw.toLowerCase();
  if (lower.includes("epic")) return "epic";
  if (lower.includes("bug") || lower.includes("defect")) return "bug";
  if (lower.includes("sub") || lower.includes("subtask")) return "subtask";
  if (lower.includes("story") || lower.includes("backlog")) return "story";
  return "task";
}

// ── Build graph ───────────────────────────────────────────────────────────────

function ticketToNode(ticket: JiraTicket): GraphNode {
  const type = normalizeIssueType(ticket.issueType);
  const shapeMap: Record<NodeType, GraphNode["shape"]> = {
    epic: "box",
    story: "ellipse",
    bug: "diamond",
    subtask: "dot",
    task: "ellipse",
  };

  const truncated =
    ticket.summary.length > 40 ? ticket.summary.slice(0, 40) + "…" : ticket.summary;

  return {
    id: ticket.key,
    label: `${ticket.key}\n${truncated}`,
    title: `${ticket.key}: ${ticket.summary}\n${ticket.status} · ${ticket.priority}${ticket.assignee ? " · " + ticket.assignee : ""}`,
    type,
    status: ticket.status,
    priority: ticket.priority,
    assignee: ticket.assignee,
    epicKey: ticket.epicKey,
    sprintName: ticket.sprintName,
    labels: ticket.labels,
    color: {
      background: getNodeColor(type),
      border: getStatusBorderColor(ticket.status),
    },
    shape: shapeMap[type],
  };
}

function edgeId(from: string, type: EdgeType, to: string): string {
  return `${from}__${type}__${to}`;
}

const EDGE_LABELS: Record<EdgeType, string> = {
  "parent-child": "parent of",
  "epic-child": "epic of",
  subtask: "subtask",
  blocks: "blocks",
  "is-blocked-by": "blocked by",
  "depends-on": "depends on",
  follows: "follows",
  "relates-to": "relates",
  clones: "clones",
  semantic: "",
};

function makeEdge(from: string, to: string, type: EdgeType, label?: string): GraphEdge {
  const undirected = type === "relates-to" || type === "semantic";
  return {
    id: edgeId(from, type, to),
    from,
    to,
    type,
    label: label ?? EDGE_LABELS[type],
    dashes: type === "semantic" || type === "subtask" || type === "follows",
    color: { color: EDGE_COLORS[type] },
    arrows: undirected ? "" : "to",
    width: type === "semantic" ? 1 : type === "parent-child" || type === "epic-child" ? 2.5 : 2,
  };
}

export function buildGraphData(tickets: JiraTicket[], projectKey: string): GraphData {
  const nodes: GraphNode[] = tickets.map(ticketToNode);
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const ticketKeys = new Set(tickets.map((t) => t.key));

  const addEdge = (e: GraphEdge) => {
    if (!edgeSet.has(e.id)) {
      edgeSet.add(e.id);
      edges.push(e);
    }
  };

  for (const ticket of tickets) {
    // Epic link
    if (ticket.epicKey && ticketKeys.has(ticket.epicKey)) {
      addEdge(makeEdge(ticket.epicKey, ticket.key, "epic-child"));
    }

    // Parent → this (non-epic hierarchy)
    if (ticket.parentKey && ticketKeys.has(ticket.parentKey) && ticket.parentKey !== ticket.epicKey) {
      addEdge(makeEdge(ticket.parentKey, ticket.key, "subtask"));
    }

    // Sub-tasks
    for (const subKey of ticket.subtaskKeys) {
      if (ticketKeys.has(subKey)) {
        addEdge(makeEdge(ticket.key, subKey, "subtask"));
      }
    }

    // Issue links. `link.type` is the Jira link-type NAME (e.g. "Parent-Child",
    // "Dependency", "Follow up", "Relation"). Direction: `outwardIssue` is the
    // target of the host's OUTWARD action, `inwardIssue` the source of an
    // inward action.
    for (const link of ticket.links) {
      const name = (typeof link.type === "string" ? link.type : "").toLowerCase();

      // Hierarchy: Parent-Child. outward action is "parent-of" (host is parent),
      // inward action is "child-of" (host is child). Always emit parent → child.
      if (name.includes("parent") || name.includes("child")) {
        if (link.outwardIssue && ticketKeys.has(link.outwardIssue)) {
          addEdge(makeEdge(ticket.key, link.outwardIssue, "parent-child")); // host is parent
        } else if (link.inwardIssue && ticketKeys.has(link.inwardIssue)) {
          addEdge(makeEdge(link.inwardIssue, ticket.key, "parent-child")); // host is child
        }
        continue;
      }

      // Non-hierarchy links keep host→outward / inward→host direction.
      let edgeType: EdgeType = "relates-to";
      if (name.includes("block")) {
        edgeType = link.outwardIssue ? "blocks" : "is-blocked-by";
      } else if (name.includes("clone") || name.includes("duplicate")) {
        edgeType = "clones";
      } else if (name.includes("depend")) {
        edgeType = "depends-on";
      } else if (name.includes("follow")) {
        edgeType = "follows";
      }

      if (link.outwardIssue && ticketKeys.has(link.outwardIssue)) {
        addEdge(makeEdge(ticket.key, link.outwardIssue, edgeType));
      } else if (link.inwardIssue && ticketKeys.has(link.inwardIssue)) {
        addEdge(makeEdge(link.inwardIssue, ticket.key, edgeType));
      }
    }
  }

  return { nodes, edges, projectKey, fetchedAt: new Date().toISOString() };
}
