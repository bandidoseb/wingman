"use client";

export default function WIcon({ size = 80 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Wingman.png"
        alt="Wingman"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}
