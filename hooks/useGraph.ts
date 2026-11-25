"use client";

import { useState, useEffect, useMemo } from "react";
import type { GraphData, NodeType } from "@/types";
import { useGraphStore } from "@/store/graphStore";

// jql undefined = don't fetch yet
export function useGraph(jql: string | undefined) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { filters } = useGraphStore();

  useEffect(() => {
    if (jql === undefined) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ jql });
    fetch(`/api/graph/explicit?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jql]);

  const filtered = useMemo(() => {
    if (!data) return null;
    let nodes = data.nodes;

    if (filters.epic) {
      const epicKey = filters.epic;
      const inEpic = new Set(
        data.nodes.filter((n) => n.epicKey === epicKey || n.id === epicKey).map((n) => n.id)
      );
      nodes = nodes.filter((n) => inEpic.has(n.id));
    }

    if (filters.sprint) {
      nodes = nodes.filter((n) => n.sprintName === filters.sprint);
    }

    if (filters.label) {
      const label = filters.label;
      nodes = nodes.filter((n) => n.labels.includes(label));
    }

    if (filters.types.length > 0) {
      nodes = nodes.filter((n) => (filters.types as NodeType[]).includes(n.type));
    }

    if (filters.statuses.length > 0) {
      nodes = nodes.filter((n) => {
        const s = n.status.toLowerCase();
        return filters.statuses.some((bucket) => {
          if (bucket === "open")        return ["open", "draft", "reopened", "ready for dev", "in discovery"].some(k => s.includes(k));
          if (bucket === "in progress") return ["in progress", "implement", "in testing", "in validation", "in review", "ready for code review", "ready for testing", "submitted for review", "deployed to stage", "test passed", "validation complete", "blocked"].some(k => s.includes(k));
          if (bucket === "done")        return ["done", "closed", "completed", "agreed & closed"].some(k => s.includes(k));
          if (bucket === "descoped")    return ["discontinued", "inactive", "descoped"].some(k => s.includes(k));
          return false;
        });
      });
    }

    if (filters.myTickets) {
      // The JQL query already scopes to the current user; this filter further
      // narrows the visible set to nodes that are directly assigned or adjacent.
      const assignedIds = new Set(
        data.nodes.filter((n) => n.assignee !== null).map((n) => n.id)
      );
      if (assignedIds.size > 0) {
        const neighbourIds = new Set<string>();
        for (const edge of data.edges) {
          if (assignedIds.has(edge.from)) neighbourIds.add(edge.to);
          if (assignedIds.has(edge.to)) neighbourIds.add(edge.from);
        }
        nodes = nodes.filter((n) => new Set([...assignedIds, ...neighbourIds]).has(n.id));
      }
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    return { ...data, nodes, edges };
  }, [data, filters]);

  return { data: filtered, rawData: data, loading, error };
}
