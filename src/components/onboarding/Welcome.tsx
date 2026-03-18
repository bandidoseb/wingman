"use client";
import WIcon from "@/components/ui/WIcon";

export default function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
        <WIcon size={80} />
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.04em", marginBottom: 16, lineHeight: 1.1 }}>
        Meet Wingman.
      </div>
      <div style={{ fontSize: 15, color: "#8e8e93", lineHeight: 1.7, marginBottom: 40, maxWidth: 320, margin: "0 auto 40px" }}>
        The best salespeople see patterns others miss. Wingman helps you spot them in real time — so you stay sharp, stay in flow, and never leave a deal on the table.
        <br /><br />
        <span style={{ color: "#1c1c1e", fontWeight: 500 }}>You'll never fly alone.</span>
      </div>
      <button
        onClick={onNext}
        style={{
          width: "100%", padding: 15, borderRadius: 12, border: "none",
          background: "#1c1c1e", color: "#fff", fontSize: 15, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
        }}
      >
        Let's fly
      </button>
      <div style={{ fontSize: 11, color: "#aeaeb2", marginTop: 14 }}>Takes 2 minutes to set up</div>
    </div>
  );
}
