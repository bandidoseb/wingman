import type { Config } from "tailwindcss";

/**
 * Wingman Tailwind config.
 *
 * Colors are NOT defined here — they live in src/app/globals.css as RGB-channel
 * CSS variables (the single source of truth, per Design Language §5b). This file
 * only exposes them as utilities. To change a color, edit globals.css, never here.
 *
 * The `rgb(var(--token) / <alpha-value>)` form is what makes opacity modifiers
 * work on every token: `text-ink-1/70`, `bg-signal/10`, `border-line/50`.
 *
 * NOTE: the previous `wm-*` palette (iOS colors: #007aff, #34c759, #f2f2f7 …) was
 * removed 2026-07-28 — verified 0 usages across src/ and electron/. It was a second,
 * competing color system, which is exactly what the token layer exists to end.
 */

/** Wingman token → Tailwind color, alpha-modifier aware. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Wingman neutrals (§3a/§3b) ---
        paper: token("paper"),
        surface: {
          DEFAULT: token("surface"),
          sunken: token("surface-sunken"),
        },
        ink: {
          1: token("ink-1"),
          2: token("ink-2"),
          3: token("ink-3"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },

        // --- Accent: "signal blue" (§3c) ---
        signal: {
          DEFAULT: token("signal"),
          hover: token("signal-hover"),
          weak: token("signal-weak"),
          on: token("signal-on"),
        },

        // --- State (§3d) — outcome only, never decoration ---
        positive: {
          DEFAULT: token("positive"),
          weak: token("positive-weak"),
        },
        warning: {
          DEFAULT: token("warning"),
          weak: token("warning-weak"),
        },
        critical: {
          DEFAULT: token("critical"),
          weak: token("critical-weak"),
        },

        // --- Sunset gradient (§3e) — DATA-VIZ / scoring surfaces ONLY ---
        score: {
          0: token("score-0"),
          1: token("score-1"),
          2: token("score-2"),
          3: token("score-3"),
        },

        // --- shadcn semantic bridge (values come from the tokens above) ---
        background: token("background"),
        foreground: token("foreground"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        sidebar: {
          DEFAULT: token("sidebar"),
          foreground: token("sidebar-foreground"),
          primary: token("sidebar-primary"),
          "primary-foreground": token("sidebar-primary-foreground"),
          accent: token("sidebar-accent"),
          "accent-foreground": token("sidebar-accent-foreground"),
          border: token("sidebar-border"),
          ring: token("sidebar-ring"),
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      // Type scale (§4). Also available as .t-display / .t-h1 … in globals.css.
      fontSize: {
        display: ["32px", { lineHeight: "1.15", letterSpacing: "-0.022em", fontWeight: "700" }],
        h1: ["24px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "650" }],
        h2: ["20px", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
        h3: ["17px", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["15px", { lineHeight: "1.55", letterSpacing: "-0.006em" }],
        small: ["13px", { lineHeight: "1.45" }],
        label: ["11px", { lineHeight: "1.2", letterSpacing: "0.09em", fontWeight: "600" }],
      },

      /**
       * Radii (§5) — SEMANTIC names, deliberately not sm/md/lg/xl.
       *
       * Overriding Tailwind's default radius keys would silently restyle every
       * existing `rounded-lg` in the app (8 tabs, none reviewed yet). These names
       * collide with nothing, and they say what the thing IS rather than how big
       * it is — which is the end state we want anyway, not a placeholder.
       *
       *   rounded-control → buttons, inputs   (--r-md, 10px)
       *   rounded-card    → cards, panels     (--r-lg, 14px)
       *   rounded-panel   → large surfaces    (--r-xl, 20px)
       *   rounded-tight   → chips, small tags (--r-sm, 6px)
       *   rounded-pill    → pills             (--r-full)
       */
      borderRadius: {
        tight: "var(--r-sm)",
        control: "var(--r-md)",
        card: "var(--r-lg)",
        panel: "var(--r-xl)",
        pill: "var(--r-full)",
      },

      /**
       * Elevation (§5) — same reasoning: semantic, non-colliding.
       *   shadow-raised  → resting cards      (--e-sm)
       *   shadow-float   → hover / popovers   (--e-md)
       *   shadow-overlay → modals, dialogs    (--e-lg)
       */
      boxShadow: {
        raised: "var(--e-sm)",
        float: "var(--e-md)",
        overlay: "var(--e-lg)",
      },

      /**
       * Motion (§5) — ONE easing curve, three durations.
       * `ease-wm` is additive; Tailwind's DEFAULT easing is intentionally NOT
       * overridden, so existing transitions keep their current feel until each
       * screen is rebuilt.
       */
      transitionTimingFunction: {
        wm: "var(--ease)",
      },
      transitionDuration: {
        1: "var(--dur-1)",
        2: "var(--dur-2)",
        3: "var(--dur-3)",
      },

      // 4-point spacing scale (§5) is Tailwind's default (1=4px … 16=64px);
      // no override needed — just never use arbitrary values like p-[13px].

      animation: {
        "fade-up": "fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both",
        "accordion-down": "accordionDown 0.22s cubic-bezier(0.22,1,0.36,1) both",
        "glow-blue": "glowBlue 2.4s ease-in-out infinite",
        "glow-red": "glowRed 1.6s ease-in-out infinite",
        blink: "blink 1.2s infinite",
        "typing-bounce": "typingBounce 1.2s infinite ease-in-out",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        accordionDown: {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glowBlue: {
          "0%,100%": { boxShadow: "0 2px 24px rgba(0,122,255,0.2),0 0 0 1.5px rgba(0,122,255,0.25)" },
          "50%": { boxShadow: "0 2px 36px rgba(0,122,255,0.38),0 0 0 1.5px rgba(0,122,255,0.45)" },
        },
        glowRed: {
          "0%,100%": { boxShadow: "0 2px 24px rgba(192,57,43,0.25),0 0 0 1.5px rgba(192,57,43,0.32)" },
          "50%": { boxShadow: "0 2px 36px rgba(192,57,43,0.45),0 0 0 1.5px rgba(192,57,43,0.55)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        typingBounce: {
          "0%,60%,100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-5px)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
