"use client";

import { useState, useCallback } from "react";
import type { Note, NoteCreateInput } from "@/types";

export function useNotes(ticketKey: string | null, allTicketKeys: string[] = []) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(() => {
    if (!ticketKey) return;
    setLoading(true);
    fetch(`/api/notes?ticketKey=${encodeURIComponent(ticketKey)}`)
      .then((r) => r.json())
      .then((json) => setNotes(json.data ?? []))
      .finally(() => setLoading(false));
  }, [ticketKey]);

  const addNote = useCallback(
    async (input: Omit<NoteCreateInput, "ticketKey">) => {
      if (!ticketKey) return;
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, ticketKey, allTicketKeys }),
      });
      const json = await res.json();
      if (json.data) setNotes((prev) => [json.data, ...prev]);
      return json.data as Note;
    },
    [ticketKey, allTicketKeys]
  );

  const removeNote = useCallback(async (id: number) => {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const editNote = useCallback(async (id: number, content: string) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    if (json.data) setNotes((prev) => prev.map((n) => (n.id === id ? json.data : n)));
  }, []);

  return { notes, loading, fetchNotes, addNote, removeNote, editNote };
}
