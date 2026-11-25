# JiraGraph

An interactive knowledge graph for Jira — visualize ticket dependencies, epics, blockers, and relationships as a navigable graph with AI-powered semantic edge detection.


## What it does

Jira's native UI shows tickets as flat lists. JiraGraph renders them as a live dependency graph — epics anchor the left column, stories and tasks fan out rightward, blockers and links draw edges between nodes. Click a node to highlight its chain; use the search bar to load any project, ticket, or JQL query.

**Features:**
- Interactive graph canvas (vis-network) with custom card renderers for each node type
- BFS-based layered layout algorithm — epics always leftmost, no crossing hierarchy edges
- AI semantic edge detection (Claude / OpenAI) to surface hidden relationships between tickets
- Playground boards — freeform Miro-like canvas: drag tickets, add sticky notes, draw custom edges, mark urgency
- Per-ticket rich-text notes with voice input, stored locally in SQLite
- Real-time filtering by epic, sprint, label, type, and status bucket
- Export visible or selected tickets to CSV
- OAuth PKCE bridge to any MCP-compatible Jira server

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **vis-network** — graph canvas with custom ctxRenderer nodes
- **better-sqlite3** — local persistence for notes and boards
- **Anthropic Claude SDK** + **OpenAI** — semantic relationship analysis
- **Zustand** — client state
- **Tailwind CSS v4**

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local` and fill in your values:

```bash
# MCP server URL (Jira MCP bridge)
MCP_URL=https://your-jira-mcp-server/mcp

# Your Jira username — used for "My tickets" queries
JIRA_USER=your-username

# AI keys (optional — only needed for semantic edge detection)
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 3. Authenticate with Jira

```bash
npm run bridge:auth   # OAuth PKCE flow — opens browser once
```

### 4. Start

```bash
# Terminal 1 — MCP bridge (proxies Jira requests)
npm run bridge

# Terminal 2 — Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- **Search bar** — type a project key (`ECP`), a ticket key (`ECP-123`), or any keyword. Press Enter to run as free-text, or choose a Quick Access preset.
- **My tickets** — loads tickets where you are assignee, reporter, or watcher.
- **Click a node** — highlights that ticket's direct edges; opens detail sidebar.
- **Semantic toggle** — runs AI analysis to add dashed edges between thematically related tickets.
- **My Board** — opens the Playground canvas for freeform planning.

## Architecture

```
browser (Next.js)
  └── /api/graph/explicit   ← fetches + transforms tickets into GraphData
  └── /api/jira/*           ← thin proxies to bridge

bridge/server.js (localhost:3002)
  └── POST https://your-jira-mcp-server/mcp   ← Jira MCP protocol

data/jiragraph.db (SQLite)
  └── notes, boards, board nodes/edges/stickies/shapes
```

## License

MIT
