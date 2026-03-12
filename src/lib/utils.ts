import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatPrice(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (raw === "") return "";
  return Number(raw).toLocaleString();
}

export function getGreeting(): { greeting: string; sub: string } {
  const h = new Date().getHours();
  if (h < 12) return { greeting: "Good morning", sub: "Let's make today count." };
  if (h < 17) return { greeting: "Good afternoon", sub: "Wingman is standing by." };
  return { greeting: "Good evening", sub: "One more mission?" };
}

export function thermalColor(score: number): {
  solid: string;
  glow: string;
  text: string;
} {
  const stops = [
    { at: 0, r: 210, g: 35, b: 35 },
    { at: 25, r: 235, g: 110, b: 25 },
    { at: 50, r: 240, g: 195, b: 30 },
    { at: 75, r: 100, g: 200, b: 80 },
    { at: 100, r: 40, g: 170, b: 90 },
  ];
  const s = Math.max(0, Math.min(100, score));
  let lo = stops[0],
    hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (s >= stops[i].at && s <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = lo.at === hi.at ? 0 : (s - lo.at) / (hi.at - lo.at);
  const r = Math.round(lo.r + t * (hi.r - lo.r));
  const g = Math.round(lo.g + t * (hi.g - lo.g));
  const b = Math.round(lo.b + t * (hi.b - lo.b));
  return {
    solid: `rgb(${r},${g},${b})`,
    glow: `rgba(${r},${g},${b},0.35)`,
    text: g > 160 && b < 120 ? "#1a1a1e" : "#fff",
  };
}

export const DEFAULT_CLOSER_SIGNALS = [
  { stage: "Discovery", stageColor: "#007aff", header: "Dig Deeper", trigger: "Surface-level pain only, no depth yet", text: "What does that actually cost you — time, money, stress?", display_order: 1 },
  { stage: "Discovery", stageColor: "#007aff", header: "Timeline", trigger: "Timeline not established after several minutes", text: "How long has this been going on?", display_order: 2 },
  { stage: "Discovery", stageColor: "#007aff", header: "Finances", trigger: "Financial situation not touched yet", text: "What does staying where you are cost you every month?", display_order: 3 },
  { stage: "Discovery", stageColor: "#007aff", header: "More Pain", trigger: "Rep moving toward Press without enough pain excavated", text: "What's the biggest thing you want gone from your life right now?", display_order: 4 },
  { stage: "Press", stageColor: "#ff6b35", header: "Cost of Waiting", trigger: "Rep skipping Press and gearing up to pitch", text: "What would it cost you to still be in this same spot 12 months from now?", display_order: 5 },
  { stage: "Press", stageColor: "#ff6b35", header: "Make It Real", trigger: "Prospect minimizing or brushing past their problem", text: "Walk me through what a bad week actually looks like for you.", display_order: 6 },
  { stage: "Press", stageColor: "#ff6b35", header: "Emotional Cost", trigger: "Emotional consequence not established yet", text: "How is this affecting you outside of work — relationship, headspace, all of it?", display_order: 7 },
  { stage: "Confirm", stageColor: "#8b5cf6", header: "Recap Pain", trigger: "Moving toward pitch without confirming pain back", text: "So if I'm hearing you right, the biggest thing you want solved is X — is that accurate?", display_order: 8 },
  { stage: "Confirm", stageColor: "#8b5cf6", header: "Decision Maker", trigger: "Decision maker not confirmed before pitch", text: "Before I get into this — is this something you can move forward on, or is there someone else involved?", display_order: 9 },
  { stage: "Confirm", stageColor: "#8b5cf6", header: "Confirm Timeline", trigger: "Timeline not reconfirmed before pitch", text: "And this is something you're looking to solve now, not six months from now?", display_order: 10 },
  { stage: "Pitch", stageColor: "#10b981", header: "Wrap Pitch", trigger: "Pitch running long — over 10 minutes", text: "So the bottom line for someone in your situation is this…", display_order: 11 },
  { stage: "Close", stageColor: "#f59e0b", header: "Go Silent", trigger: "Rep still talking after presenting price", text: "", display_order: 12 },
  { stage: "Close", stageColor: "#f59e0b", header: "Tiedown", trigger: "Optimal moment — prospect used strong emotional language", text: "You mentioned earlier that [their words] — is that still true?", display_order: 13 },
  { stage: "Close", stageColor: "#f59e0b", header: "Think About It", trigger: "Prospect says they need to think about it", text: "What part of this do you need to think through?", display_order: 14 },
  { stage: "Close", stageColor: "#f59e0b", header: "Price Objection", trigger: "Prospect says it's too expensive", text: "Compared to what — staying where you are for another year?", display_order: 15 },
  { stage: "Close", stageColor: "#f59e0b", header: "Partner Objection", trigger: "Prospect says they need to talk to their partner", text: "What do you think they're going to say when you bring it to them?", display_order: 16 },
  { stage: "Close", stageColor: "#f59e0b", header: "Money Concern", trigger: "Prospect says they need to look at finances", text: "Is it that the money isn't there, or that you're not sure it's worth it?", display_order: 17 },
  { stage: "Close", stageColor: "#f59e0b", header: "Past Programs", trigger: "Prospect says they've tried programs before", text: "What made those not work — was it the program or the support?", display_order: 18 },
  { stage: "Close", stageColor: "#f59e0b", header: "Send More Info", trigger: "Prospect asks to be sent information", text: "What specifically would the info need to answer for you?", display_order: 19 },
  { stage: "Close", stageColor: "#f59e0b", header: "Not Ready Yet", trigger: "Prospect says they're not ready", text: "What would ready look like for you?", display_order: 20 },
  { stage: "Close", stageColor: "#f59e0b", header: "Fear of Failure", trigger: "Prospect says what if it doesn't work", text: "What would need to be in place for you to feel safe moving forward?", display_order: 21 },
  { stage: "Close", stageColor: "#f59e0b", header: "Future Event", trigger: "Prospect says they need to wait until X happens", text: "What's going to be different about your situation after that?", display_order: 22 },
];

export const DEFAULT_VAULT_OBJECTIONS = [
  { objection: "It's too expensive", frequency: 28, handle1: "Compared to what — staying where you are?", handle2: "What would it need to look like to make sense for you?" },
  { objection: "I need to think about it", frequency: 24, handle1: "What part of this do you need to think through?", handle2: "Usually when people say that there's one specific thing — what is it for you?" },
  { objection: "I need to talk to my partner", frequency: 19, handle1: "Is your partner someone who needs to be part of this conversation?", handle2: "What do you think they're going to say?" },
  { objection: "I need to look at my finances", frequency: 17, handle1: "What would need to be true financially for this to be a yes?", handle2: "Is it that the money isn't there, or that you're not sure it's worth it?" },
  { objection: "I've tried programs before", frequency: 14, handle1: "What made those not work — was it the program or the support?", handle2: "What would need to be different this time for you to actually get results?" },
  { objection: "I'm not ready yet", frequency: 12, handle1: "What would ready look like for you?", handle2: "What needs to happen before you feel ready?" },
  { objection: "Can you send me more information?", frequency: 11, handle1: "What specifically would the info need to answer for you?", handle2: "What's the one thing that would make this a clear yes?" },
  { objection: "What if it doesn't work?", frequency: 9, handle1: "What would need to be in place for you to feel safe moving forward?", handle2: "What's your biggest concern specifically?" },
  { objection: "I don't have time", frequency: 8, handle1: "What would need to free up for this to fit?", handle2: "Is it time you don't have, or is it that you're not sure it's worth the time?" },
  { objection: "I want to try it myself first", frequency: 7, handle1: "What would trying it yourself look like — and what would success look like?", handle2: "What's the part you feel like you could figure out on your own?" },
  { objection: "I need to do more research", frequency: 5, handle1: "What specifically are you trying to figure out — I might be able to help right now.", handle2: "What would the research need to tell you that would make this a yes?" },
];
