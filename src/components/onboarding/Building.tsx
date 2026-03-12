"use client";
import { useState, useEffect } from "react";
import WIcon from "@/components/ui/WIcon";

const STEPS = [
  "Studying your mission…",
  "Learning your style…",
  "Loading your stage framework…",
  "Prepping your playbook…",
  "Wingman is ready. Let's go. 🎯",
];

export default function Building({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setStep(i);
          if (i === STEPS.length - 1) {
            timers.push(setTimeout(onNext, 1400));
          }
        }, i * 900)
      );
    });

    // Cancel all pending timers if the component unmounts or onNext changes reference.
    // Without this, React Strict Mode (dev) double-invokes the effect and fires onNext twice.
    return () => timers.forEach(clearTimeout);
  }, [onNext]);

  return (
    <div style={{ textAlign: "center", maxWidth: 340, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
        <WIcon size={56} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            fontSize: i === step ? 14 : 13,
            color: i < step ? "#8e8e93" : i === step ? "#1c1c1e" : "#e5e5ea",
            fontWeight: i === step ? 600 : 400,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {i < step && <span style={{ color: "#34c759", fontSize: 12 }}>✓</span>}
            {i === step && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#000" }} />}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
