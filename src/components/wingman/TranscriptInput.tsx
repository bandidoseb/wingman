"use client";

import { useState } from "react";
import type { CallStageLabel } from "@/types";

interface Props {
  stages: CallStageLabel[];
  currentStage: CallStageLabel;
  isActive: boolean;
  isPolling: boolean;
  onStageChange: (stage: CallStageLabel) => void;
  onSendChunk: (chunk: string) => void;
  onStartCall: (prospectName: string) => void;
  onEndCall: () => void;
}

export default function TranscriptInput({
  stages,
  currentStage,
  isActive,
  isPolling,
  onStageChange,
  onSendChunk,
  onStartCall,
  onEndCall,
}: Props) {
  const [text, setText] = useState("");
  const [prospectName, setProspectName] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f7",
    border: "1.5px solid transparent",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#1c1c1e",
    outline: "none",
  };

  function handleSend() {
    const chunk = text.trim();
    if (!chunk) return;
    onSendChunk(chunk);
    setText("");
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "20px",
        border: "1px solid #e5e5ea",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1c1e" }}>Transcript Input</div>

      {!isActive ? (
        <>
          {/* Prospect name */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Prospect Name (optional)
            </div>
            <input
              type="text"
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="e.g. John Smith"
              style={inputStyle}
            />
          </div>

          {/* Stage selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Starting Stage
            </div>
            <select
              value={currentStage}
              onChange={(e) => onStageChange(e.target.value as CallStageLabel)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Start button */}
          <button
            onClick={() => onStartCall(prospectName)}
            style={{
              width: "100%",
              padding: "12px",
              background: "#34c759",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ▶ Start Call
          </button>
        </>
      ) : (
        <>
          {/* Stage selector (during call) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Current Stage
            </div>
            <select
              value={currentStage}
              onChange={(e) => onStageChange(e.target.value as CallStageLabel)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Transcript textarea */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              New Transcript Chunk
            </div>
            <div style={{ fontSize: 11, color: "#aeaeb2", marginBottom: 6 }}>
              Format: <code style={{ background: "#f2f2f7", padding: "1px 4px", borderRadius: 3 }}>Rep: [text]</code> or <code style={{ background: "#f2f2f7", padding: "1px 4px", borderRadius: 3 }}>Prospect: [text]</code>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
              placeholder={`Rep: So tell me, what's been the biggest challenge for you lately?\nProspect: Honestly, I just haven't been sleeping. Revenue is way down.`}
              rows={8}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.6,
                minHeight: 160,
              }}
            />
          </div>

          {/* Send chunk button */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || isPolling}
            style={{
              width: "100%",
              padding: "12px",
              background: !text.trim() || isPolling ? "#e5e5ea" : "#1c1c1e",
              color: !text.trim() || isPolling ? "#8e8e93" : "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: !text.trim() || isPolling ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {isPolling ? "Sending…" : "Send Chunk ⌘↵"}
          </button>

          {/* End call */}
          <button
            onClick={onEndCall}
            style={{
              width: "100%",
              padding: "10px",
              background: "#fff0f0",
              color: "#ff3b30",
              border: "1px solid #ffd5d5",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ■ End Call & Save
          </button>
        </>
      )}
    </div>
  );
}
