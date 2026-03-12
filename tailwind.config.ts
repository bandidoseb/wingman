import type { Config } from "tailwindcss";

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
        // Wingman design system
        "wm-bg-light": "#f2f2f7",
        "wm-bg-dark": "#0a0a0f",
        "wm-card-light": "#ffffff",
        "wm-card-dark": "#1c1c1e",
        "wm-green": "#34c759",
        "wm-green-dark": "#30d158",
        "wm-red": "#ff3b30",
        "wm-red-dark": "#ff453a",
        "wm-amber": "#ff9f0a",
        "wm-blue": "#007aff",
        "wm-muted": "#8e8e93",
        "wm-label": "#aeaeb2",
        "wm-subtle-light": "#e5e5ea",
        "wm-subtle-dark": "#2c2c2e",
      },
      fontFamily: {
        sans: ["-apple-system", "SF Pro Display", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "wm": "18px",
        "wm-sm": "12px",
      },
      animation: {
        "fade-up": "fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both",
        "accordion-down": "accordionDown 0.22s cubic-bezier(0.22,1,0.36,1) both",
        "glow-blue": "glowBlue 2.4s ease-in-out infinite",
        "glow-red": "glowRed 1.6s ease-in-out infinite",
        "blink": "blink 1.2s infinite",
        "typing-bounce": "typingBounce 1.2s infinite ease-in-out",
      },
      keyframes: {
        fadeUp: {
          "from": { opacity: "0", transform: "translateY(8px)" },
          "to": { opacity: "1", transform: "translateY(0)" },
        },
        accordionDown: {
          "from": { opacity: "0", transform: "translateY(-6px)" },
          "to": { opacity: "1", transform: "translateY(0)" },
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
