export type Role = "closer" | "setter";
export type Outcome = "Closed" | "Lost" | "DQ" | "Follow Up" | "Set";
export type StageStatus = "complete" | "partial" | "skipped" | "early" | "lost";
export type SignalDisplayMode = "header" | "short" | "full";
export type OnboardingStep =
  | "welcome"
  | "style"
  | "offer"
  | "objections"
  | "tutorial"
  | "vaultnudge"
  | "building"
  | "complete";

export interface Profile {
  id: string;
  email: string | null;
  phone?: string | null;        // Optional — collected via Settings, not onboarding
  role: Role | null;
  sales_style: string | null;
  call_length: string | null;
  activation_key: string | null;
  onboarding_step: OnboardingStep;
  onboarding_complete: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  alert_pitching_early: boolean;
  alert_missed_topics: boolean;
  alert_post_call_debrief: boolean;
  alert_weekly_summary: boolean;
  assist_enabled: boolean;
  signal_display_mode: SignalDisplayMode;
  ai_model_preference: AiModelPreference;
  calls_used: number;
  extra_calls_remaining: number;
  offer_url?: string | null;
  ideal_client?: string | null;
  unique_differentiator?: string | null;
  guarantee?: string | null;
  lead_source?: string | null;
  call_weakness?: string | null;
  deal_loss_stage?: string | null;
  sales_dna?: SalesDna | null;
  chat_messages_today?: number;
  chat_reset_date?: string | null;
  zoom_display_name?: string | null;
  compliance_acknowledged_at?: string | null;
  compliance_acknowledged_ip?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sales DNA ────────────────────────────────────────────────────────────────
// Per-user offer + discovery capture (the "Offer-Aware Wingman" moat). Stored as
// a single flexible jsonb blob on profiles.sales_dna so question edits need no
// migration. Every field optional — a rep can brain-dump some now, more later.
// Design: Wingman Brain/07 - North Star/Sales DNA Capture — Design.md
export type SalesSyntax = "problems" | "goals" | "unsure";

export interface SalesDna {
  // Your Offer (the anchor)
  transformation?: string | null;   // Q1 — what you sell + before→after
  root_driver?: string | null;      // Q2 ⭐ the one thing every client is chasing
  emotional_root?: string | null;   // Q3 — what they're really after underneath
  guarantee?: string | null;        // offer guarantee / risk-reversal
  // Your Discovery (how the beliefs show up — internal tags, never surfaced)
  syntax?: SalesSyntax | null;      // Q4 — open on problems or goals
  pain?: string | null;             // Q5
  desire?: string | null;           // Q6 ⭐ manifestations + chunk-down to root
  cost?: string | null;             // Q7 — several costs of staying stuck
  doubt?: string | null;            // Q8
  trust?: string | null;            // Q9 — why your way is different
  money?: string | null;            // Q10 — how you know they can afford it
  support?: string | null;          // Q11
}

// Completeness — "briefed" means EVERY question addressed (Sebastian, 2026-07-11;
// overrides the earlier 4-essentials rule). "Addressed" ≠ "has one": guarantee's
// explicit "we don't offer one" answer and syntax "unsure" both count.
// The LOGIC lives in sales-dna.mjs (single source shared with the eval gates and
// every injection site); these are typed re-exports so the dashboard and the
// Phase 1c Deploy gate can never drift from what the cards actually require.
import { salesDnaMissing, isSalesDnaComplete } from "@/lib/wingman/sales-dna.mjs";

export function salesDnaEssentialsMissing(dna: SalesDna | null | undefined): (keyof SalesDna)[] {
  return salesDnaMissing(dna) as (keyof SalesDna)[];
}

/** True when every Sales DNA question has been addressed — the 1b inject threshold AND the 1c Deploy gate. */
export function salesDnaComplete(dna: SalesDna | null | undefined): boolean {
  return isSalesDnaComplete(dna);
}

export interface Offer {
  id: string;
  user_id: string;
  name: string;
  price: string | null;
  is_main: boolean;
  display_order: number;
  created_at: string;
}

export interface QualificationCriteria {
  id: string;
  user_id: string;
  type: "green_flag" | "dq_signal";
  text: string;
  display_order: number;
  created_at: string;
}

export interface VaultObjection {
  id: string;
  user_id: string;
  objection: string;
  frequency: number;
  handle1: string | null;
  handle2: string | null;
  is_new: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaultSignal {
  id: string;
  user_id: string;
  stage: string;
  stage_color: string | null;
  header: string;
  trigger: string | null;
  text: string | null;
  is_enabled: boolean;
  is_new: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CallStage {
  id: string;
  call_id: string;
  name: string;
  status: StageStatus;
  note: string | null;
  display_order: number;
}

export interface TranscriptLine {
  id: string;
  call_id: string;
  speaker: string;
  text: string;
  sequence_order: number;
}

export interface Call {
  id: string;
  user_id: string;
  prospect_name: string | null;
  outcome: Outcome | null;
  duration: string | null;
  summary: string | null;
  missed_topics: string[];
  call_date: string;
  created_at: string;
  call_stages?: CallStage[];
  call_transcript?: TranscriptLine[];
  flight_plan_snapshot?: FlightPlan | null;
  pillar_coverage?: PillarCoverage | null;
}

// ─── Wingman Phase 2 Types ───────────────────────────────────────────────────

export type CallStageLabel =
  "Rapport" | "Discovery" | "Press" | "Confirm" | "Pitch" | "Close";

export type SignalType = "Alert" | "Nudge" | "Ready" | "Handle" | "Objection";
export type AiModelPreference = "smart" | "fast";
export type ObjectionRisk = "low" | "medium" | "high";

export interface LiveScorecard {
  current_stage: CallStageLabel;
  pain_locked: boolean;
  pain_detail: string;
  timeline_confirmed: boolean;
  finances_touched: boolean;
  decision_maker_confirmed: boolean;
  objection_risk: ObjectionRisk;
  gold_moment: string;
  predicted_next_objection: string | null;
  // Accumulated emotional anchors from this prospect — short bullet string.
  // Sonnet adds to this across polls. Haiku uses it to personalise signal cards.
  // Example: "• Been struggling for 10 years\n• Promised their kids\n• Spent $5k already"
  prospect_anchors: string;
}

export interface WingmanSignal {
  type: SignalType;
  header: string;
  text: string;
  firedAt: number; // Date.now()
  // "summoned" = rep pressed the hotkey; "poll" / "keyword" are legacy autonomous paths
  source: "poll" | "keyword" | "summoned";
}

export interface SignalLogEntry {
  id: string;
  signal: WingmanSignal;
  firedAt: number;
}

export interface WingmanPollResponse {
  current_stage: CallStageLabel;
  signal_to_fire: boolean;
  signal_type: SignalType;
  signal_header: string;
  signal_text: string;
  scorecard_update: {
    stage: CallStageLabel;
    pain_locked: boolean;
    pain_detail: string;
    timeline_confirmed: boolean;
    finances_touched: boolean;
    decision_maker_confirmed: boolean;
    objection_risk: ObjectionRisk;
    gold_moment: string;
    predicted_next_objection: string | null;
    prospect_anchors: string;
  };
}

export const DEFAULT_SCORECARD: LiveScorecard = {
  current_stage: "Rapport",
  pain_locked: false,
  pain_detail: "",
  timeline_confirmed: false,
  finances_touched: false,
  decision_maker_confirmed: false,
  objection_risk: "low",
  gold_moment: "",
  predicted_next_objection: null,
  prospect_anchors: "",
};

// ─── End Wingman Types ────────────────────────────────────────────────────────

// ─── Electron / Desktop Bridge Types ─────────────────────────────────────────
// When Wingman runs as a desktop app (Electron), window.wingman is available.
// These types prevent TypeScript errors when the web app calls window.wingman.xxx()

// Deploy phase pushed by the Electron main process (#47). Drives the Deploy
// button/HUD label + affordance only — never call routing.
export type DeployPhase = "idle" | "searching" | "starting" | "live" | "stopping";
export type DeployStatePayload = { state: DeployPhase; reason?: string };

export interface WingmanBridge {
  // Call lifecycle
  // error union (#47): "busy"/"superseded" = benign no-op (ignore), the rest surface a message.
  startCall: (token?: string) => Promise<{ success: boolean; error?: "busy" | "superseded" | "no_meeting" | "no_auth" | "recording_failed" | string }>;
  endCall:   (callId?: string, token?: string) => Promise<{ success: boolean; error?: string }>;

  // Deploy state machine (#47) — optional so a renderer against an older preload
  // (dev hot-reload skew) degrades gracefully instead of crashing.
  onDeployState?:  (callback: (payload: DeployStatePayload) => void) => void;
  offDeployState?: () => void;
  cancelSearch?:   () => Promise<void>;

  // HUD control
  showHud:       () => Promise<void>;
  hideHud:       () => Promise<void>;
  sendSignal:    (signal: { header: string; text: string; type: string; seq?: number }) => Promise<void>;
  // Streaming objection card (Step 4) — feed the HUD's constant-rate reveal loop.
  sendSignalDelta: (payload: { seq: number; phase: "start" | "delta" | "done" | "abort"; textSoFar?: string; type?: string; beliefTag?: string }) => Promise<void>;
  sendScorecard: (scorecard: Record<string, unknown>) => Promise<void>;
  sendStage:     (data: { current: string; all: string[]; completed: string[] }) => Promise<void>;

  // Real-time transcript from Recall AI audio capture
  onTranscriptChunk:  (callback: (chunk: string) => void) => void;
  offTranscriptChunk: () => void;
  // #41: partial (unfinalized) chunks — OPTIONAL: absent on packaged apps
  // older than the live-tail release, so callers must feature-guard.
  onTranscriptPartial?:  (callback: (chunk: string) => void) => void;
  offTranscriptPartial?: () => void;

  // Keyboard shortcut (Ctrl+Shift+W) → toggle call start/stop
  onToggleCall:  (callback: () => void) => void;
  offToggleCall: () => void;

  // Signal dismiss initiated from the HUD window
  onSignalDismiss:  (callback: () => void) => void;
  offSignalDismiss: () => void;

  // Recall AI auto-stopped the call (meeting ended, inactivity, 2h cap).
  // Web app patches the session WITHOUT calling endCall() again (avoids double-stop).
  onAutoEnded?:  (callback: () => void) => void;
  offAutoEnded?: () => void;

  // Zoom name status sync — tells Electron whether the user's Zoom name is set
  setZoomStatus: (hasName: boolean) => Promise<void>;

  // Navigate to Settings tab (sent by main when HUD "Open Settings" is clicked)
  onNavigateToSettings: (callback: () => void) => void;

  // Hotkey compass menu — main process tells web app which direction the rep picked
  onMenuPick:  (callback: (direction: string) => void) => void;
  offMenuPick: () => void;

  // Phase 3.5 — summoned-card progress for the HUD thinking pill.
  // "thinking" = generation started · "error" = failed/timed out (retry hint)
  // · "unsupported" = arrow not built yet. Card arrival clears the pill.
  sendSummonState: (payload: { state: "thinking" | "error" | "unsupported" | "idle"; slot?: string }) => Promise<void>;

  // Phase C — Objection Flow mode. Optional so a renderer running against an
  // older preload (dev hot-reload skew) degrades to compass-only, never crashes.
  flowOpened?:    () => void;
  flowClosed?:    () => void;
  onFlowExpired?: (callback: () => void) => void;
  offFlowExpired?: () => void;
  sendFlowState?: (payload: { active: boolean; move?: number }) => Promise<void>;

  // Design #2 — → Close readiness chip. Optional so a renderer running against an older
  // preload (Railway-first / desktop-release skew) degrades to the "coming soon" pill.
  sendReadiness?: (payload: { state: string; label: string; gap: string[]; note?: string; seq: number }) => Promise<void>;

  // Outcome saved from HUD — tells dashboard to refresh so pill appears immediately
  onOutcomeUpdated?:  (callback: () => void) => void;
  offOutcomeUpdated?: () => void;

  // true when running inside Electron desktop app, undefined in browser
  isElectron: true;
}

// Extend the global Window interface so TypeScript knows about window.wingman
declare global {
  interface Window {
    wingman?: WingmanBridge;
  }
}

export interface FlightPlan {
  id: string;
  user_id: string;
  syntax: "problems-first" | "goals-first";
  target_market: string | null;
  core_problem: string | null;
  dream_outcome: string | null;
  investment_min: number | null;
  investment_max: number | null;
  involves_partner: boolean;
  method_differentiation: string | null;
  custom_checkpoints: string[];
  created_at: string;
  updated_at: string;
}

export type PillarResult = { covered: boolean; evidence: string | null };

export interface PillarCoverage {
  core_problem: PillarResult;
  cant_diy: PillarResult;
  cost_of_waiting: PillarResult;
  dream_outcome: PillarResult;
  investment_readiness: PillarResult;
  whos_involved: PillarResult;
  why_you: PillarResult;
}

export interface OnboardingData {
  salesStyle?: string;
  callLength?: string;
  mainOfferName?: string;
  mainOfferPrice?: string;
  otherOffers?: Array<{ name: string; price: string }>;
  offerUrl?: string;
  greenFlags?: string[];
  dqSignals?: string[];
  objections?: string[];
  exitLine?: string;
  activationKey?: string;
  phone?: string;
}
