"use client";

import { useState, useMemo } from "react";
import type { JiraTicket } from "@/types";
// @ts-expect-error — no types for jira2md
import j2m from "jira2md";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface Props {
  ticket: JiraTicket;
}

const STATUS_COLORS: Record<string, string> = {
  "done":        "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  "in progress": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  "in review":   "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  "to do":       "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  "open":        "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  "closed":      "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  "resolved":    "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  "highest": "bg-red-500/15 text-red-400 ring-red-500/30",
  "high":    "bg-orange-500/15 text-orange-400 ring-orange-500/30",
  "medium":  "bg-yellow-500/15 text-yellow-400 ring-yellow-500/30",
  "low":     "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  "lowest":  "bg-slate-500/15 text-slate-500 ring-slate-500/30",
};

const TYPE_COLORS: Record<string, string> = {
  "epic":    "bg-violet-500/15 text-violet-400 ring-violet-500/30",
  "story":   "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  "bug":     "bg-red-500/15 text-red-400 ring-red-500/30",
  "task":    "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  "subtask": "bg-slate-500/15 text-slate-400 ring-slate-500/30",
};

function Badge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const key = label.toLowerCase();
  const found = Object.entries(colorMap).find(([k]) => key.includes(k));
  const cls = found ? found[1] : "bg-slate-500/15 text-slate-400 ring-slate-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-slate-800 min-w-0">
      <span className="text-slate-500 text-xs w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-300 text-xs leading-relaxed min-w-0 break-words overflow-wrap-anywhere">{children}</span>
    </div>
  );
}

function cleanJiraMarkup(text: string): string {
  return text
    // {color:...}text{color} — strip color macros
    .replace(/\{color[^}]*\}/g, "")
    // {**}text{**} and {*}text{*} — Jira bold/emphasis macros, keep inner text
    .replace(/\{\*+\}([^{]*)\{\*+\}/g, "$1")
    // Lone {**} or {*} with no closing — just strip the token
    .replace(/\{\*+\}/g, "")
    // {panel:...} / {panel} macros
    .replace(/\{panel[^}]*\}/g, "")
    // {noformat} / {code} block markers — leave content, strip tags
    .replace(/\{(noformat|code)[^}]*\}/g, "")
    // Other {macro} tokens (anchor, quote, etc.)
    .replace(/\{[a-z][a-z0-9-]*(?::[^}]*)?\}/gi, "")
    // Trailing standalone * at start of line that aren't bullet points
    .replace(/^\* (\*\*)/gm, "$1")
    .trim();
}

function DescriptionBox({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  const html = useMemo(() => {
    try {
      const cleaned = cleanJiraMarkup(text);
      const md = j2m.to_markdown(cleaned);
      return DOMPurify.sanitize(marked(md) as string);
    } catch {
      return `<pre class="whitespace-pre-wrap break-words">${text}</pre>`;
    }
  }, [text]);

  // Count paragraphs/blocks to decide if truncation is needed
  const blockCount = (html.match(/<\/(p|li|h[1-6]|pre|blockquote)>/g) ?? []).length;
  const isLong = blockCount > 8;

  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">
        Description
      </p>
      <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
        <div
          className={`jira-description text-slate-300 text-sm leading-relaxed overflow-hidden transition-all ${
            isLong && !expanded ? "max-h-64" : ""
          }`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            {expanded ? "Show less ↑" : "Show more ↓"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function TicketDetail({ ticket }: Props) {
  return (
    <div className="p-5 space-y-5">
      <h3 className="text-slate-100 font-semibold text-base leading-snug break-words">
        {ticket.summary}
      </h3>

      <div className="flex flex-wrap gap-2">
        <Badge label={ticket.status} colorMap={STATUS_COLORS} />
        <Badge label={ticket.priority} colorMap={PRIORITY_COLORS} />
        <Badge label={ticket.issueType} colorMap={TYPE_COLORS} />
      </div>

      <div className="divide-y divide-slate-800">
        {ticket.assignee && <Field label="Assignee">{ticket.assignee}</Field>}
        {ticket.reporter && <Field label="Reporter">{ticket.reporter}</Field>}
        {ticket.epicKey && (
          <Field label="Epic">
            <span className="font-mono text-indigo-400">{ticket.epicKey}</span>
          </Field>
        )}
        {ticket.sprintName && <Field label="Sprint">{ticket.sprintName}</Field>}
        {ticket.labels.length > 0 && (
          <Field label="Labels">
            <span className="flex flex-wrap gap-1">
              {ticket.labels.map((l) => (
                <span key={l} className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-xs">
                  {l}
                </span>
              ))}
            </span>
          </Field>
        )}
      </div>

      {ticket.description && <DescriptionBox text={ticket.description} />}

      {ticket.links.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Links</p>
          <ul className="space-y-2">
            {ticket.links.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 text-xs bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 min-w-0 overflow-hidden"
              >
                <span className="text-slate-500 capitalize shrink-0">{l.type}</span>
                <span className="text-slate-600 shrink-0">→</span>
                <span className="font-mono text-indigo-400 truncate">
                  {l.outwardIssue ?? l.inwardIssue}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
