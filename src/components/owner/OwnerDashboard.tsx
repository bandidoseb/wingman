"use client";

import { useCallback, useEffect, useState } from "react";

// ── Report shape (from flight-recorder-core.mjs buildReport) ──────────────────
type Adoption = { slot: string; ts: string; line: string; label: string; hit: number; reply: string };
type Report = {
  callId: string;
  stats: {
    duration: string; cards: number; presses: number; drops: number; readiness: number; summaries: number; paired: boolean;
    cost: { summarizer: number; sumIn: number; sumOut: number; cardsEst: number; cardEstTok: number; total: number };
    bySlot: Record<string, number>;
  };
  film: string[];
  adoption: Adoption[];
  hallucinations: { ts: string; numbers: string[] }[];
  trajectory: Record<string, { g: string; at: string }[]>;
  markdown: string;
};

type TabId = "recorder" | "users" | "revenue" | "cost";
const TABS: { id: TabId; label: string }[] = [
  { id: "recorder", label: "Flight Recorder" },
  { id: "users", label: "Users" },
  { id: "revenue", label: "Revenue" },
  { id: "cost", label: "Cost" },
];

export function OwnerDashboard() {
  const [tab, setTab] = useState<TabId>("recorder");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
          <p className="text-sm text-muted-foreground">Founder cockpit — dev tools now, business metrics next.</p>
        </header>

        <nav className="mb-8 flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "recorder" ? <FlightRecorderTab /> : <ComingSoon tab={tab} />}
      </div>
    </div>
  );
}

// ── Business tabs (stubbed) ───────────────────────────────────────────────────
function ComingSoon({ tab }: { tab: TabId }) {
  const copy: Record<Exclude<TabId, "recorder">, string> = {
    users: "Total · active (call in 30d) · new this week · churned — from Supabase.",
    revenue: "MRR · subscriptions by plan · new vs churned MRR — from Stripe.",
    cost: "Summed Anthropic + OpenAI + Recall + Railway + Supabase → cost per call & margin per user. Needs a production cost-log first.",
  };
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm font-medium text-foreground">Coming soon</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{copy[tab as Exclude<TabId, "recorder">]}</p>
    </div>
  );
}

// ── Flight Recorder tab ───────────────────────────────────────────────────────
function FlightRecorderTab() {
  const [calls, setCalls] = useState<string[] | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [devOff, setDevOff] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  // Load the newest call's report (and the call list) on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/wingman/devlog/report");
        if (res.status === 404) { if (alive) { setDevOff(true); setLoading(false); } return; }
        const data = await res.json();
        if (!alive) return;
        setCalls(data.calls ?? []);
        setReport(data.report ?? null);
        setCallId(data.report?.callId ?? null);
        setLoading(false);
      } catch { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const loadCall = useCallback(async (id: string) => {
    setLoading(true); setNotes({});
    try {
      const res = await fetch(`/api/wingman/devlog/report?callId=${encodeURIComponent(id)}`);
      const data = await res.json();
      setReport(data.report ?? null);
      setCallId(id);
    } catch { /* leave prior report */ }
    setLoading(false);
  }, []);

  const copyAll = useCallback(() => {
    if (!report) return;
    let md = report.markdown;
    const noteLines = Object.entries(notes).filter(([, v]) => v.trim());
    if (noteLines.length) {
      md += "\n## 📝 Sebastian's notes\n" + noteLines.map(([i, v]) => {
        const a = report.adoption[+i];
        return `- ${a ? `${a.slot} @${a.ts} "${a.line}"` : `card ${i}`}: ${v.trim()}`;
      }).join("\n") + "\n";
    }
    navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }, [report, notes]);

  if (devOff) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">Local dev only</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The Flight Recorder captures local calls. Run the app locally with <code className="rounded-sm bg-muted px-1 py-0.5">WINGMAN_DEVLOG=1</code>, do a call, then reload this page.
        </p>
      </div>
    );
  }

  if (loading && !report) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!report) return <p className="text-sm text-muted-foreground">No captured calls yet. Run a local call, then reload.</p>;

  const s = report.stats;
  return (
    <div className="space-y-6">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={callId ?? ""}
          onChange={(e) => loadCall(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          {(calls ?? []).map((c) => <option key={c} value={c}>{c.slice(0, 8)}…</option>)}
        </select>
        <button
          onClick={copyAll}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copied ? "Copied ✓" : "Copy everything"}
        </button>
        {loading && <span className="text-xs text-muted-foreground">loading…</span>}
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat label="Duration" value={s.duration} />
        <Stat label="Cards" value={s.cards} />
        <Stat label="Presses" value={s.presses} />
        <Stat label="Drops" value={s.drops} />
        <Stat label="Summaries" value={s.summaries} />
        <Stat label="Cost" value={`~$${s.cost.total}`} />
      </div>

      {/* call film */}
      <Section title="🎬 Call film">
        <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
{report.film.join("\n")}
        </pre>
      </Section>

      {/* adoption + notes */}
      <Section title="🎯 Card adoption (heuristic — add your verdict)">
        {report.adoption.length === 0
          ? <Empty>No fired cards with a line.</Empty>
          : (
            <ul className="space-y-3">
              {report.adoption.map((a, i) => (
                <li key={i} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{a.slot} <span className="text-muted-foreground">@{a.ts}</span></span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{a.label} · {a.hit}%</span>
                  </div>
                  <p className="mt-1 text-sm">“{a.line}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">rep next ~30s: {a.reply}</p>
                  <input
                    value={notes[i] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [i]: e.target.value }))}
                    placeholder="your note (rides along in Copy) — e.g. 'this was the bad dig'"
                    className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </li>
              ))}
            </ul>
          )}
      </Section>

      {/* hallucination watch */}
      <Section title="🔍 Hallucination watch">
        {report.hallucinations.length === 0
          ? <Empty>Clean — no invented numbers.</Empty>
          : (
            <ul className="space-y-1 text-sm">
              {report.hallucinations.map((h, i) => (
                <li key={i} className="text-foreground">⚠️ @{h.ts}: <span className="font-mono">{h.numbers.join(", ")}</span> — not in transcript</li>
              ))}
            </ul>
          )}
      </Section>

      {/* belief trajectory */}
      <Section title="📈 Belief-ladder trajectory">
        {Object.keys(report.trajectory).length === 0
          ? <Empty>No belief data captured.</Empty>
          : (
            <ul className="space-y-1 text-sm">
              {Object.entries(report.trajectory).map(([b, arr]) => (
                <li key={b}><span className="font-medium">{b}</span>: {arr.map((x) => `${x.g}@${x.at}`).join(" → ")}</li>
              ))}
            </ul>
          )}
      </Section>
    </div>
  );
}

// ── small presentational bits ─────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-muted-foreground">{children}</p>;
}
