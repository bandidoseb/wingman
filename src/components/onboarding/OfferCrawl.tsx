"use client";
import { useState } from "react";

const CRAWL_SEQUENCE = [
  "Fetching your page…",
  "Reading your offer…",
  "Extracting key promises…",
  "Scanning testimonials…",
  "Building your playbook context…",
  "Done. Wingman knows your offer. ✓",
];

export default function OfferCrawl({ onNext }: { onNext: (url?: string) => void }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "crawling" | "done">("idle");
  const [crawlSteps, setCrawlSteps] = useState<string[]>([]);

  const handleCrawl = () => {
    const trimmed = url.trim();
    if (!trimmed || !trimmed.includes(".")) return;
    setStatus("crawling");
    setCrawlSteps([]);
    CRAWL_SEQUENCE.forEach((step, i) => {
      setTimeout(() => {
        setCrawlSteps((prev) => [...prev, step]);
        if (i === CRAWL_SEQUENCE.length - 1) {
          setStatus("done");
          setTimeout(() => onNext(trimmed), 1400);
        }
      }, i * 700);
    });
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>Show Wingman your offer.</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>
        Paste your landing page or sales page URL. Wingman will read it and extract your offer, promises, and testimonials — so every signal and handle is tailored to exactly what you sell.
      </div>

      {status === "idle" && (
        <>
          <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your offer URL</div>
          <input
            type="url"
            placeholder="https://yourlandingpage.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 12, fontSize: 14,
              border: "1.5px solid rgba(0,0,0,0.06)", background: "#fff", color: "#1c1c1e",
              outline: "none", fontFamily: "inherit", marginBottom: 10,
            }}
          />
          <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 28, lineHeight: 1.5 }}>
            🔍 Wingman will extract: offer name, what's included, pricing, who it's for, testimonial language, and FAQs.
          </div>
          <button
            onClick={handleCrawl}
            style={{
              width: "100%", padding: 14, borderRadius: 12, border: "none",
              background: "#000", color: "#fff", fontSize: 15, fontWeight: 600,
              fontFamily: "inherit", cursor: url.trim() && url.includes(".") ? "pointer" : "not-allowed",
              opacity: url.trim() && url.includes(".") ? 1 : 0.35,
            }}
          >
            Read my offer page
          </button>
          <div onClick={() => onNext()} style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#8e8e93", cursor: "pointer" }}>
            Skip — I'll add this later
          </div>
        </>
      )}

      {(status === "crawling" || status === "done") && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reading your page</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CRAWL_SEQUENCE.map((step, i) => {
              const isDone = crawlSteps.includes(step);
              const isActive = crawlSteps.length === i;
              return (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isDone || isActive ? 1 : 0.3, transition: "opacity 0.3s" }}>
                  <div style={{ width: 18, height: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isDone ? (
                      <span style={{ color: "#34c759", fontSize: 13 }}>✓</span>
                    ) : isActive ? (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#007aff" }} />
                    ) : (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e5e5ea" }} />
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: isDone ? "#1c1c1e" : isActive ? "#1c1c1e" : "#8e8e93", fontWeight: isDone || isActive ? 500 : 400 }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
