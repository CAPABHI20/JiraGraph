export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  issueType: string;
  priority: string;
  assignee: string | null;
  reporter: string | null;
  epicKey: string | null;
  parentKey: string | null;
  labels: string[];
  sprintName: string | null;
  created: string;
  updated: string;
  links: JiraLink[];
  subtaskKeys: string[];
}

export interface JiraLink {
  id: string;
  type: string;
  inwardIssue?: string;
  outwardIssue?: string;
}

export type NodeType = "epic" | "story" | "bug" | "subtask" | "task";
export type EdgeType =
  | "epic-child"
  | "parent-child"
  | "subtask"
  | "blocks"
  | "is-blocked-by"
  | "depends-on"
  | "follows"
  | "relates-to"
  | "clones"
  | "semantic";

export interface GraphNode {
  id: string;
  label: string;
  title: string;
  type: NodeType;
  status: string;
  priority: string;
  assignee: string | null;
  epicKey: string | null;
  sprintName: string | null;
  labels: string[];
  color: { background: string; border: string };
  shape: "box" | "ellipse" | "diamond" | "dot";
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
  dashes: boolean;
  color: { color: string };
  arrows: string;
  width: number;
  semanticScore?: number;
  semanticReason?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  projectKey: string;
  fetchedAt: string;
}

export interface Note {
  id: number;
  ticketKey: string;
  content: string;
  source: "text" | "voice";
  linkedTicketKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteCreateInput {
  ticketKey: string;
  content: string;
  source: "text" | "voice";
}

export interface PlaygroundNode {
  ticketKey: string;
  x: number;
  y: number;
  addedAt: string;
}

export interface PlaygroundEdge {
  id: number;
  fromKey: string;
  toKey: string;
  label: string;
  createdAt: string;
}

export type Urgency = "none" | "watch" | "important" | "critical";

export interface Board {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardNode {
  id: number;
  boardId: number;
  ticketKey: string;
  x: number;
  y: number;
  urgency: Urgency;
  addedAt: string;
}

export interface BoardEdge {
  id: number;
  boardId: number;
  fromKey: string;
  toKey: string;
  label: string;
  color: string;
  style: "dashed" | "solid";
  createdAt: string;
}

export interface BoardSticky {
  id: number;
  boardId: number;
  content: string;
  x: number;
  y: number;
  color: string;
  createdAt: string;
}

export type ShapeKind = "text" | "rect" | "ellipse" | "frame";

export interface BoardShape {
  id: number;
  boardId: number;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  createdAt: string;
}

export interface BoardBundle {
  board: Board;
  nodes: BoardNode[];
  edges: BoardEdge[];
  stickies: BoardSticky[];
  shapes: BoardShape[];
}

export interface SemanticAnalysisRequest {
  projectKey: string;
  tickets: Pick<JiraTicket, "key" | "summary" | "description" | "issueType" | "labels">[];
  existingEdges: GraphEdge[];
}

export interface SemanticEdgeResult {
  from: string;
  to: string;
  score: number;
  reason: string;
}
