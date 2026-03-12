"use client";
import Tutorial from "@/components/onboarding/Tutorial";

export default function TutorialPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f2f2f7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
    }}>
      <Tutorial onNext={() => alert("onNext fired!")} />
    </div>
  );
}
