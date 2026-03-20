import type { Profile, Outcome, VaultObjection, VaultSignal } from "@/types";

// ── Static label maps (defined once at module level, not per-call) ────────────
const WEAKNESS_LABELS: Record<string, string> = {
  too_much_talking: "talks too much in discovery",
  not_pressing:     "doesn't press hard enough",
  rush_pitch:       "rushes to pitch",
  fold_price:       "folds on price",
  objections:       "struggles with objections",
};
const DEAL_LOSS_LABELS: Record<string, string> = {
  discovery:      "discovery",
  pressing_pain:  "pressing pain",
  pitching:       "pitching",
  price_reveal:   "price reveal",
  partner_spouse: "partner/spouse objection",
  follow_up:      "follow-up",
};

interface RepProfileInput {
  profile: Profile;
  offerName: string | null;
  offerPrice: string | null;
  recentCalls: Array<{ outcome: Outcome | null }>;
  objections: VaultObjection[];
  signals: VaultSignal[];
}

/**
 * Builds a compressed ~700 token rep intelligence summary.
 * Sent on every poll as part of the flat payload.
 */
export function buildRepProfile(input: RepProfileInput): string {
  const { profile, offerName, offerPrice, recentCalls, objections, signals } =
    input;

  // ── Offer ──────────────────────────────────────────────────────────────────
  const offer = [offerName, offerPrice].filter(Boolean).join(" · ") || "Not set";

  // ── Call stats from last 30 calls ─────────────────────────────────────────
  const calls = recentCalls.slice(0, 30);
  const total = calls.length;
  const closed = calls.filter((c) => c.outcome === "Closed").length;
  const lost = calls.filter((c) => c.outcome === "Lost").length;
  const dq = calls.filter((c) => c.outcome === "DQ").length;
  const followUp = calls.filter((c) => c.outcome === "Follow Up").length;

  const closeRate =
    total > 0 ? Math.round((closed / Math.max(total - dq, 1)) * 100) : 0;

  // ── Most common objections hit (by frequency) ─────────────────────────────
  const topObjections = [...objections]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3)
    .map((o) => o.objection)
    .join(", ");

  // ── Active signal count by stage ──────────────────────────────────────────
  const activeSignals = signals.filter((s) => s.is_enabled);
  const signalStages = [
    ...new Set(activeSignals.map((s) => s.stage)),
  ].join(", ");

  // ── Pattern summary from recent calls ────────────────────────────────────
  const lostReasons: string[] = [];
  if (lost > 0 && total > 0) {
    const lostRate = Math.round((lost / total) * 100);
    if (lostRate > 40) lostReasons.push("high loss rate — price or press issues likely");
    if (followUp > closed) lostReasons.push("more follow-ups than closes — urgency issue");
  }
  const patternNote =
    lostReasons.length > 0
      ? `Pattern flags: ${lostReasons.join("; ")}.`
      : "No major pattern flags from recent calls.";

  // ── Call coaching fields ──────────────────────────────────────────────────
  let weaknessSummary = "";
  try {
    const parsed: string[] = JSON.parse(profile.call_weakness ?? "[]");
    if (parsed.length > 0) weaknessSummary = parsed.map(v => WEAKNESS_LABELS[v] ?? v).join(", ");
  } catch { /* ignore */ }

  let dealLossSummary = "";
  try {
    const parsed: string[] = JSON.parse(profile.deal_loss_stage ?? "[]");
    if (parsed.length > 0) dealLossSummary = parsed.map(v => DEAL_LOSS_LABELS[v] ?? v).join(", ");
  } catch { /* ignore */ }

  // ── New personalisation fields ────────────────────────────────────────────
  const idealClient     = profile.ideal_client?.trim();
  const differentiator  = profile.unique_differentiator?.trim();
  const guarantee       = profile.guarantee?.trim();
  // lead_source is stored as JSON array: '["vsl_webinar","other:Book funnel"]'
  let leadSource = "";
  try {
    const parsed: string[] = JSON.parse(profile.lead_source ?? "[]");
    leadSource = parsed
      .map((v) => v.startsWith("other:") ? v.replace("other:", "") : v.replace(/_/g, " "))
      .join(", ");
  } catch { /* ignore malformed */ }

  const extraLines = [
    idealClient    ? `Ideal client: ${idealClient}`        : null,
    differentiator ? `Offer edge: ${differentiator}`       : null,
    guarantee      ? `Guarantee: ${guarantee}`             : null,
    leadSource       ? `Lead source: ${leadSource}`              : null,
    weaknessSummary  ? `Rep weakness: ${weaknessSummary}`         : null,
    dealLossSummary  ? `Deals lost at: ${dealLossSummary}`        : null,
  ].filter(Boolean).join("\n");

  // ── Assemble ───────────────────────────────────────────────────────────────
  return `REP PROFILE:
Offer: ${offer}${extraLines ? `\n${extraLines}` : ""}
Stats (last ${total} calls): ${closed} closed / ${lost} lost / ${dq} DQ / ${followUp} follow-up | Close rate: ${closeRate}%
Top objections faced: ${topObjections || "none yet"}
Active signals covering: ${signalStages || "all stages"}
${patternNote}`.trim();
}

/**
 * Builds a compact signal vault string for the poll payload.
 * Only includes enabled signals.
 */
export function buildSignalVaultSummary(signals: VaultSignal[]): string {
  const active = signals.filter((s) => s.is_enabled);
  if (active.length === 0) return "SIGNAL VAULT: (empty)";

  const lines = active
    .slice(0, 30) // cap at 30 to control tokens
    .map((s) => `[${s.stage}] ${s.header}${s.trigger ? ` — trigger: "${s.trigger}"` : ""}${s.text ? ` | text: "${s.text}"` : ""}`)
    .join("\n");

  return `SIGNAL VAULT (${active.length} active signals):\n${lines}`;
}

/**
 * Builds a compact objection vault string for the poll payload.
 */
export function buildObjectionVaultSummary(objections: VaultObjection[]): string {
  if (objections.length === 0) return "OBJECTION VAULT: (empty)";

  const lines = objections
    .slice(0, 20)
    .map((o) => {
      const handle = o.handle1 || o.handle2 || "(no handle set)";
      return `"${o.objection}" → ${handle}`;
    })
    .join("\n");

  return `OBJECTION VAULT (${objections.length} objections):\n${lines}`;
}
