"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Network } from "vis-network/standalone";
import { useGraph } from "@/hooks/useGraph";
import GraphControls from "@/components/graph/GraphControls";
import GraphLegend from "@/components/graph/GraphLegend";
import SemanticToggle from "@/components/graph/SemanticToggle";
import TicketSidebar from "@/components/sidebar/TicketSidebar";
import Spinner from "@/components/ui/Spinner";

const GraphCanvas = dynamic(() => import("@/components/graph/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Spinner />
    </div>
  ),
});

export default function GraphPage() {
  const networkRef = useRef<Network | null>(null);
  const [jql, setJql] = useState<string | undefined>(undefined);
  const { data, rawData, loading, error } = useGraph(jql);

  const allTicketKeys = rawData?.nodes.map((n) => n.id) ?? [];

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <GraphControls
        graphData={rawData ?? null}
        visibleData={data ?? null}
        networkRef={networkRef}
        onJqlChange={(q) => setJql(q || undefined)}
        onClear={() => setJql(undefined)}
        onMyTickets={(active) => {
          if (active) setJql(`assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser() ORDER BY updated DESC`);
        }}
      />

      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950/80">
            <div className="text-center space-y-2">
              <Spinner />
              <p className="text-sm text-slate-400">Loading graph…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg p-6 max-w-md text-sm">
              <p className="font-semibold mb-1">Failed to load graph</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <GraphCanvas data={data} networkRef={networkRef} />
        <GraphLegend />
        <SemanticToggle />

        {jql === undefined && !loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-3">
              <p className="text-slate-400 text-sm">Use the search bar to load tickets</p>
              <p className="text-slate-600 text-xs">Try "All my tickets", a project key, or any keyword</p>
            </div>
          </div>
        )}

        {data && (
          <div className="absolute bottom-4 right-4 bg-slate-800/90 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-400 shadow-sm z-10">
            {data.nodes.length} nodes · {data.edges.length} edges
          </div>
        )}
      </div>

      <TicketSidebar allTicketKeys={allTicketKeys} />
    </div>
  );
}
