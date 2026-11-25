import type { JiraIssueRaw, JiraSearchResponse, JiraProjectRaw } from "./types";

const BASE_URL = process.env.JIRA_BASE_URL!;
const AUTH = process.env.JIRA_AUTH!;
const EPIC_LINK_FIELD = process.env.JIRA_EPIC_LINK_FIELD ?? "customfield_10014";
const SPRINT_FIELD = process.env.JIRA_SPRINT_FIELD ?? "customfield_10020";

const FIELDS = [
  "summary",
  "description",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "reporter",
  "parent",
  "subtasks",
  "issuelinks",
  "labels",
  "created",
  "updated",
  EPIC_LINK_FIELD,
  SPRINT_FIELD,
].join(",");

async function jiraFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProjects(): Promise<JiraProjectRaw[]> {
  return jiraFetch<JiraProjectRaw[]>("/rest/api/2/project");
}

export async function fetchAllTickets(projectKey: string): Promise<JiraIssueRaw[]> {
  const all: JiraIssueRaw[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const jql = encodeURIComponent(`project = "${projectKey}" ORDER BY updated DESC`);
    const url = `/rest/api/2/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=${FIELDS}`;
    const page = await jiraFetch<JiraSearchResponse>(url);

    all.push(...page.issues);

    if (all.length >= page.total || page.issues.length === 0) break;
    startAt += page.issues.length;

    // avoid rate limiting
    await new Promise((r) => setTimeout(r, 100));
  }

  return all;
}

export async function fetchTicket(key: string): Promise<JiraIssueRaw> {
  return jiraFetch<JiraIssueRaw>(`/rest/api/2/issue/${key}?fields=${FIELDS}`);
}

export { EPIC_LINK_FIELD, SPRINT_FIELD };
