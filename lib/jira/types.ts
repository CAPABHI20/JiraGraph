// MCP Jira response shapes (flat, snake_case — different from REST API)

export interface McpIssue {
  id: string;
  key: string;
  summary: string;
  description?: string | null;
  url?: string;
  status?: { name: string; category?: string; color?: string };
  issue_type?: { name: string };
  priority?: { name: string };
  assignee?: { display_name: string; email?: string };
  reporter?: { display_name: string; email?: string };
  parent?: { key: string; summary?: string };
  subtasks?: { key: string; summary?: string }[];
  issuelinks?: McpIssueLink[];
  labels?: string[];
  created?: string;
  updated?: string;
  sprint?: { name: string } | { name: string }[];
  epic?: { key: string; summary?: string };
  // project info from search results
  project?: { key: string; name: string };
  // custom fields may appear at top level
  [key: string]: unknown;
}

export interface McpIssueLink {
  id?: string;
  // Jira returns the link type as an object; older/alternate shapes may use a string.
  type?: { id?: string; name?: string; inward?: string; outward?: string } | string;
  inward_issue?: { key: string };
  outward_issue?: { key: string };
  // alternate shapes
  inwardIssue?: { key: string };
  outwardIssue?: { key: string };
}

// Keep the old JiraIssueRaw for backward compat (unused now)
export interface JiraIssueRaw {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

export interface JiraSearchResponse {
  total: number;
  startAt: number;
  maxResults: number;
  issues: JiraIssueRaw[];
}

export interface JiraProjectRaw {
  key: string;
  name: string;
}

export interface JiraADF {
  type: string;
  content?: JiraADF[];
  text?: string;
}
