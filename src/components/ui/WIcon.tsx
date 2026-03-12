"use client";

export default function WIcon({ size = 80 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/Wingman.png"
      alt="Wingman"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.22))",
      }}
    />
  );
}
