"use client";

import { useState } from "react";

export default function Compliance({ onNext }: { onNext: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!checked || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onNext();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>
        One quick thing.
      </div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 24 }}>
        Wingman transcribes your calls to generate real-time coaching. Call-recording laws vary by state — in some places, all parties need to know the call is being recorded. That's on you, not us.
      </div>

      <div
        style={{
          background:    "#fff",
          borderRadius:  14,
          padding:       "18px 20px",
          boxShadow:     "0 1px 4px rgba(0,0,0,0.06)",
          marginBottom:  24,
          cursor:        "pointer",
          display:       "flex",
          gap:           14,
          alignItems:    "flex-start",
        }}
        onClick={() => setChecked((c) => !c)}
      >
        {/* Custom checkbox */}
        <div
          style={{
            width:        20,
            height:       20,
            borderRadius: 6,
            border:       checked ? "none" : "2px solid #d1d1d6",
            background:   checked ? "#1c1c1e" : "transparent",
            flexShrink:   0,
            marginTop:    1,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            transition:   "all 0.15s",
          }}
        >
          {checked && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <div style={{ fontSize: 13, color: "#3a3a3c", lineHeight: 1.6 }}>
          I understand I'm responsible for complying with call-recording laws in my jurisdiction and agree to Wingman's{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "#007aff", textDecoration: "none" }}
          >
            Terms of Service
          </a>
          .
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!checked || loading}
        style={{
          width:       "100%",
          padding:     14,
          borderRadius: 12,
          border:      "none",
          background:  checked ? "#1c1c1e" : "#e5e5ea",
          color:       checked ? "#fff" : "#aeaeb2",
          fontSize:    15,
          fontWeight:  600,
          fontFamily:  "inherit",
          cursor:      checked && !loading ? "pointer" : "default",
          transition:  "background 0.2s, color 0.2s",
        }}
      >
        {loading ? "Saving…" : "I'm in"}
      </button>

      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#ff3b30", textAlign: "center" }}>
          {error}
        </div>
      )}
    </div>
  );
}
