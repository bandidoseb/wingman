"use client";

/**
 * useRecallTranscript.ts
 *
 * This hook bridges Recall AI audio capture → the Wingman poll engine.
 *
 * ─── What it does ────────────────────────────────────────────────────────────
 * When Wingman runs as a desktop app (Electron + Recall AI):
 *   1. Recall AI captures system audio in the background
 *   2. Electron transcribes it and sends chunks via IPC
 *   3. This hook receives those chunks via window.wingman.onTranscriptChunk()
 *   4. It calls addChunk() which feeds them into useWingmanPoller
 *   5. useWingmanPoller sends them to the AI and fires signals
 *
 * ─── In the browser (non-Electron) ──────────────────────────────────────────
 * window.wingman doesn't exist, so this hook does nothing.
 * The simulator manual-paste mode is used instead.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 * const isElectron = useRecallTranscript({ isActive, addChunk });
 * if (isElectron) { // hide the manual paste UI }
 */

import { useEffect, useState } from "react";

interface UseRecallTranscriptOptions {
  /** Whether a call is currently active (audio capture runs only during calls) */
  isActive: boolean;
  /** The addChunk function from useWingmanPoller — call this with each new chunk */
  addChunk: (chunk: string) => void;
}

interface UseRecallTranscriptReturn {
  /** true when running inside the Electron desktop app */
  isElectron: boolean;
  /** Total number of transcript chunks received from Recall AI this call */
  chunkCount: number;
}

export function useRecallTranscript({
  isActive,
  addChunk,
}: UseRecallTranscriptOptions): UseRecallTranscriptReturn {
  const isElectron = typeof window !== "undefined" && !!window.wingman?.isElectron;
  const [chunkCount, setChunkCount] = useState(0);

  useEffect(() => {
    // Only run inside the Electron desktop app
    if (!isElectron || !window.wingman) return;

    if (isActive) {
      // Register listener: every time Recall AI sends a chunk, feed it into Wingman
      window.wingman.onTranscriptChunk((chunk) => {
        if (!chunk.trim()) return;
        addChunk(chunk);
        setChunkCount((n) => n + 1);
      });
    } else {
      // Call ended or not started — remove listener to stop processing
      window.wingman.offTranscriptChunk();
      setChunkCount(0);
    }

    // Cleanup: remove listener when component unmounts or isActive changes
    return () => {
      window.wingman?.offTranscriptChunk();
    };
  }, [isActive, isElectron, addChunk]);

  return { isElectron, chunkCount };
}
