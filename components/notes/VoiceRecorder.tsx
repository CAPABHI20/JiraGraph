"use client";

import { useState, useRef } from "react";

interface Props {
  onTranscript: (text: string) => void;
}

export default function VoiceRecorder({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setLoading(true);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      try {
        const res = await fetch("/api/notes/transcribe", { method: "POST", body: form });
        const json = await res.json();
        if (json.data?.transcript) onTranscript(json.data.transcript);
      } finally {
        setLoading(false);
      }
    };

    recorder.start();
    mediaRef.current = recorder;
    setRecording(true);
  };

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <button
      onClick={recording ? stop : start}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        recording
          ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
          : "bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"
      } disabled:opacity-50`}
    >
      {loading ? "Transcribing…" : recording ? "⏹ Stop" : "🎤 Voice"}
    </button>
  );
}
