"use client";

import { useState, useEffect } from "react";
import type { JiraTicket } from "@/types";

export function useTicketDetail(ticketKey: string | null) {
  const [ticket, setTicket] = useState<JiraTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketKey) {
      setTicket(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/jira/ticket/${encodeURIComponent(ticketKey)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setTicket(json.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticketKey]);

  return { ticket, loading, error };
}
