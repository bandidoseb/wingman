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
  created_at: string;
  updated_at: string;
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
}

// ─── Wingman Phase 2 Types ───────────────────────────────────────────────────

export type CallStageLabel =
  "Rapport" | "Discovery" | "Press" | "Confirm" | "Pitch" | "Close";

export type SignalType = "Alert" | "Nudge" | "Ready" | "Handle";
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
  source: "poll" | "keyword";
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

export interface WingmanBridge {
  // Call lifecycle
  startCall: () => Promise<{ success: boolean }>;
  endCall:   () => Promise<{ success: boolean }>;

  // HUD control
  showHud:       () => Promise<void>;
  hideHud:       () => Promise<void>;
  sendSignal:    (signal: { header: string; text: string; type: string }) => Promise<void>;
  sendScorecard: (scorecard: Record<string, unknown>) => Promise<void>;
  sendStage:     (data: { current: string; all: string[]; completed: string[] }) => Promise<void>;

  // Real-time transcript from Recall AI audio capture
  onTranscriptChunk:  (callback: (chunk: string) => void) => void;
  offTranscriptChunk: () => void;

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

  // true when running inside Electron desktop app, undefined in browser
  isElectron: true;
}

// Extend the global Window interface so TypeScript knows about window.wingman
declare global {
  interface Window {
    wingman?: WingmanBridge;
  }
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
