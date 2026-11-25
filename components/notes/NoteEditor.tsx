"use client";

import { useState } from "react";
import VoiceRecorder from "./VoiceRecorder";

interface Props {
  onSave: (content: string, source: "text" | "voice") => Promise<void>;
}

export default function NoteEditor({ onSave }: Props) {
  const [content, setContent] = useState("");
  const [source, setSource] = useState<"text" | "voice">("text");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await onSave(content.trim(), source);
    setContent("");
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a note…"
        rows={3}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
      />
      <div className="flex items-center justify-between">
        <VoiceRecorder
          onTranscript={(text) => {
            setContent(text);
            setSource("voice");
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}
