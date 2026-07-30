"use client";
import { useState, useEffect, useMemo } from "react";
import { useMotionValue } from "framer-motion";
import { CardPattern, generateRandomString } from "@/components/ui/evervault-card";
import type { Profile, Call } from "@/types";
import { getGreeting } from "@/lib/utils";
import { getSalesDnaStatus } from "@/lib/wingman/sales-dna-status";
import Card from "@/components/ui/wm/Card";
import OutcomeConfirm from "@/components/dashboard/home/OutcomeConfirm";
import Coach, { type CoachSession } from "@/components/dashboard/home/Coach";
import { useCoachContext } from "@/components/dashboard/coach/CoachProvider";

interface Props {
  profile: Profile;
  calls: Call[];
  onDebrief: (call: Call) => void;
  isActive: boolean;
  isPendingOutcome?: boolean;
  savedMessage: string | null;
  onDeploy: () => void;
  onEndCall: () => void;
  onPersonalize: () => void;
  // #47: Deploy phase from Electron main (pre-live). "searching" = arm-and-waiting
  // for the call, "starting" = recording spinning up. Drives the button only.
  deployPhase?: "idle" | "searching" | "starting";
  stillLooking?: boolean;   // 15s into searching → nudge copy
  onCancelSearch?: () => void;
  /** Owned by DashboardClient so the thread survives a tab switch. */
  coachSession: CoachSession;
  /** Coaching messages used today — computed once upstream, shared with the sidebar. */
  coachUsed: number;
}

/** #47: one fixed-size slot so the control never resizes between states. */
const CONTROL = "h-10 w-[200px] shrink-0 inline-flex items-center justify-center gap-2 rounded-control px-4 text-small font-semibold whitespace-nowrap transition-colors duration-2 ease-wm";

export default function HomeTab({
  profile, calls, onDebrief, isActive, isPendingOutcome = false, savedMessage,
  onDeploy, onEndCall, onPersonalize, deployPhase = "idle", stillLooking = false, onCancelSearch,
  coachSession, coachUsed,
}: Props) {
  const { greeting } = getGreeting();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [randomString, setRandomString] = useState("");
  const [cardHovered, setCardHovered] = useState(false);
  const [dnaDismissed, setDnaDismissed] = useState(false);
  // Granola pattern: engaging the Coach hands it the whole content column rather
  // than piling messages onto Home. Esc / ✕ hands it back. State lives in
  // DashboardClient so a tab switch doesn't wipe the conversation.
  const coachOpen = coachSession.open;
  const setCoachOpen = coachSession.setOpen;
  // Layout must stay in "open" mode until the panel's exit animation finishes,
  // otherwise the column resizes and Home content pops back in while the panel
  // is still fading — which reads as the composer jumping. See CoachSession.closing.
  const coachLayoutOpen = coachSession.open || coachSession.closing;

  /*
    Anything call-related pulls Home back into view. The takeover hides the live
    status strip, the ONLY web-side End Call button, "Processing call…" and the
    outcome prompt — so a rep who left the Coach open and then deployed (hotkey or
    auto-detect) would be staring at a chat with no live indicator and no way to
    end the call, with no cue that anything was behind it.
  */
  const callBusy = isActive || deployPhase !== "idle" || isPendingOutcome;
  useEffect(() => {
    if (callBusy) setCoachOpen(false);
  }, [callBusy, setCoachOpen]);

  // Session outcome confirmations now live in CoachProvider — shared with Flight Log
  // (each used to keep its own, so a ✓ in one was invisible to the other) and, from
  // PR 4, with the Coach bar. The no-router.refresh() rationale moved there too.
  const { setSessionOutcome, applySessionOutcomes } = useCoachContext();

  useEffect(() => { setRandomString(generateRandomString(1500)); }, []);

  const dnaKey = `wm.dnaBannerDismissed.${profile.id}`;
  useEffect(() => {
    try { setDnaDismissed(localStorage.getItem(dnaKey) === "1"); } catch { /* private mode */ }
  }, [dnaKey]);

  const dismissDna = () => {
    setDnaDismissed(true);
    try { localStorage.setItem(dnaKey, "1"); } catch { /* private mode — hidden for this view only */ }
  };

  function onDnaMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
    setRandomString(generateRandomString(1500));
  }

  const dna = getSalesDnaStatus(profile.sales_dna);
  const showDna = dna.state !== "complete" && !dnaDismissed;

  // Apply this session's confirmations over the server data ONCE, for every
  // consumer. Applying it only to today's rows would leave the Coach and the
  // Flight Log hand-off reading `outcome_source: "auto"` for a call the rep just
  // confirmed — so the Coach would answer "what's my close rate" ignoring the
  // click they made two seconds ago, and Flight Log would re-ask them to confirm.
  const callsWithConfirmed = useMemo(() => applySessionOutcomes(calls), [calls, applySessionOutcomes]);

  const today = new Date().toDateString();
  const todayCalls = callsWithConfirmed.filter(
    (c) => new Date(c.call_date).toDateString() === today
  );

  /** Returns false when the id isn't in the loaded list, so the caller can say so. */
  const openCall = (callId: string): boolean => {
    const c = callsWithConfirmed.find((x) => x.id === callId);
    if (!c) return false;
    onDebrief(c);
    return true;
  };


  const showStatusStrip = isActive || deployPhase !== "idle";

  return (
    /*
      h- vs min-h is load-bearing, not a style tweak.
      `min-h` leaves the column's height AUTO with a floor, so a `flex-1` child's
      content still contributes to the container's size — `min-h-0` does not bound
      it and StickToBottom's `height:100%` scroller resolves to auto and grows.
      Measured at 40 messages: body scrollHeight 2070 in a 794px viewport, with the
      composer at y=2022 — the input walks off-screen and the rep has to scroll the
      whole page to type. A DEFINITE height makes the chat scroll internally
      (composer stays at y=746, page doesn't scroll at all).
      Home keeps `min-h` so tall Home content can still grow the page normally.
    */
    <div className={`max-w-[640px] mx-auto flex flex-col ${coachLayoutOpen ? "h-[calc(100vh-96px)]" : "min-h-[calc(100vh-96px)]"}`}>
      {/* Hidden entirely while the Coach is open — that IS the takeover. When
          closed, the Coach bar is sticky but stays in flow, so nothing is
          unreachable at full scroll; content just fades under it on the way down. */}
      <div className={coachLayoutOpen ? "hidden" : "flex-1 pb-2"}>
        {/* ── Header: greeting left, Deploy right ─────────────────────────── */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <h1 className="text-h1 text-ink-1">{greeting}.</h1>

          {/* Fixed height (#47 solidity): the ⌃⇧W hint row only exists in the idle
              state, so without this the header collapses ~24px the instant Deploy
              is pressed and everything below jumps up. */}
          <div className="flex flex-col items-end gap-1.5 h-16 shrink-0">
            {isActive ? (
              <button onClick={onEndCall} className={`${CONTROL} bg-critical text-white hover:bg-critical/90`}>
                End Call
              </button>
            ) : deployPhase === "searching" ? (
              <button onClick={onCancelSearch} title="Cancel" className={`${CONTROL} bg-ink-1 text-paper hover:bg-ink-2`}>
                <span className="h-3.5 w-3.5 rounded-pill border-2 border-paper/35 border-t-paper animate-spin" />
                {stillLooking ? "Still looking…" : "Looking…"}
                <span className="text-ink-3">✕</span>
              </button>
            ) : deployPhase === "starting" ? (
              <div className={`${CONTROL} bg-ink-1 text-paper opacity-90`}>
                <span className="h-3.5 w-3.5 rounded-pill border-2 border-paper/35 border-t-paper animate-spin" />
                Starting…
              </div>
            ) : (
              <>
                <button onClick={onDeploy} className={`${CONTROL} bg-ink-1 text-paper hover:bg-ink-2`}>
                  Deploy Wingman
                </button>
                <div className="flex items-center gap-1">
                  {["⌃", "⇧", "W"].map((k) => (
                    <span key={k} className="inline-flex items-center justify-center w-[20px] h-[18px] rounded-tight bg-surface-sunken border border-line-strong text-[10px] font-semibold text-ink-2">
                      {k}
                    </span>
                  ))}
                  <span className="text-[11px] text-ink-3 ml-1">to deploy</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Live / searching status strip ───────────────────────────────────
            Carries the guidance that used to live in the big Deploy card. The
            "swipe to your call window" line is load-bearing (#47): Recall only
            detects the meeting when its window is on the current Space, so
            without it a rep just sits there wondering why nothing happens. */}
        {showStatusStrip && (
          <Card className="mb-3 px-4 py-3 flex items-center gap-3">
            {isActive ? (
              <>
                <span className="h-2 w-2 rounded-pill bg-positive shrink-0" style={{ animation: "livePulse 2s ease-in-out infinite" }} />
                <div className="flex-1">
                  <div className="text-small font-semibold text-ink-1">Wingman is live.</div>
                  <div className="text-small text-ink-3">Recording and coaching in real time.</div>
                </div>
                {savedMessage && <span className="text-small font-semibold text-positive">{savedMessage}</span>}
              </>
            ) : (
              <>
                <span className="h-3.5 w-3.5 rounded-pill border-2 border-line-strong border-t-ink-2 animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="text-small font-semibold text-ink-1">
                    {deployPhase === "starting" ? "Starting up…" : "Looking for your call…"}
                  </div>
                  {deployPhase === "searching" && (
                    <div className="text-small text-ink-3">Swipe to your call window — Wingman starts automatically.</div>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        {/* ── Sales DNA banner — pinned until the anchors are filled ───────── */}
        {showDna && (
          <div
            className="group/card relative mb-3 rounded-card overflow-hidden bg-ink-1"
            onMouseMove={onDnaMouseMove}
            onMouseEnter={() => setCardHovered(true)}
            onMouseLeave={() => setCardHovered(false)}
          >
            <CardPattern mouseX={mouseX} mouseY={mouseY} randomString={randomString} />
            <div className="absolute inset-0 z-5 pointer-events-none bg-linear-to-r from-ink-1 via-ink-1/90 to-ink-1/10" />

            <button
              onClick={dismissDna}
              aria-label="Dismiss"
              className="absolute top-2.5 right-2.5 z-20 h-6 w-6 rounded-pill grid place-items-center text-paper/40 hover:text-paper hover:bg-paper/10 transition-colors duration-2 ease-wm"
            >
              ✕
            </button>

            <div className="relative z-10 isolate px-7 py-6 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="text-h3 text-paper mb-1.5">
                  {dna.state === "empty" ? "Build your Sales DNA" : "Finish your Sales DNA"}
                </div>
                <div className="text-small text-paper/55 leading-relaxed">
                  The more Wingman knows your offer and how you sell, the sharper every card gets.
                  {dna.state === "partial" && ` ${dna.filledCount} of ${dna.totalCount} answered.`}
                </div>
              </div>
              <button
                onClick={onPersonalize}
                className={`shrink-0 px-4 py-2.5 rounded-control text-small font-semibold transition-colors duration-2 ease-wm ${
                  cardHovered ? "bg-paper text-ink-1" : "bg-paper/10 text-paper border border-paper/15"
                }`}
              >
                Go →
              </button>
            </div>
          </div>
        )}

        {/* ── Calendar — coming soon ──────────────────────────────────────────
            Schematic grey rows on purpose. Fake meeting names behind a blur read
            as either a bug or a bait-and-switch; empty labelled bars read as
            "this is the shape of a thing that isn't built yet", which is true. */}
        <Card className="mb-3 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="t-label text-ink-3">Coming up</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3 bg-surface-sunken rounded-pill px-2 py-0.5">
              Coming soon
            </span>
          </div>

          <div aria-hidden="true" className="flex flex-col gap-2.5 opacity-50">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-control bg-surface-sunken shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-2.5 rounded-pill bg-surface-sunken" style={{ width: i === 0 ? "45%" : "60%" }} />
                  <div className="h-2 rounded-pill bg-surface-sunken" style={{ width: i === 0 ? "25%" : "18%" }} />
                </div>
              </div>
            ))}
          </div>

          <p className="text-small text-ink-3 mt-3.5">
            Calendar sync — coming soon. Wingman will show your day and remind you before each call.
          </p>
        </Card>

        {/* ── Today ──────────────────────────────────────────────────────── */}
        <Card className="mb-3 px-5 py-4">
          <div className="t-label text-ink-3 mb-3">Today</div>

          {isActive && (
            <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
              <span className="h-8 w-8 rounded-pill bg-positive-weak grid place-items-center shrink-0">
                <span className="h-2 w-2 rounded-pill bg-positive" style={{ animation: "livePulse 2s ease-in-out infinite" }} />
              </span>
              <div className="flex-1">
                <div className="text-small font-semibold text-ink-1">Live call in progress…</div>
                <div className="text-[11px] font-medium text-positive">Recording now</div>
              </div>
            </div>
          )}

          {!isActive && isPendingOutcome && (
            <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
              <span className="h-8 w-8 rounded-pill bg-surface-sunken grid place-items-center shrink-0">
                <span className="h-2 w-2 rounded-pill bg-ink-3" style={{ animation: "livePulse 2s ease-in-out infinite" }} />
              </span>
              <div className="flex-1">
                <div className="text-small font-semibold text-ink-1">Processing call…</div>
                <div className="text-[11px] text-ink-3">Waiting for outcome</div>
              </div>
            </div>
          )}

          {todayCalls.length === 0 && !isActive && !isPendingOutcome && (
            <div className="text-small text-ink-3 py-1">No calls yet today.</div>
          )}

          {todayCalls.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 py-2.5 ${i < todayCalls.length - 1 ? "border-b border-line" : ""}`}
            >
              <span className="h-8 w-8 rounded-pill bg-surface-sunken grid place-items-center text-small font-semibold text-ink-2 shrink-0">
                {(c.prospect_name || "?")[0]}
              </span>
              <button onClick={() => onDebrief(c)} className="flex-1 text-left min-w-0 group/row">
                <div className="text-small font-medium text-ink-1 truncate group-hover/row:text-signal transition-colors duration-2 ease-wm">
                  {c.prospect_name}
                </div>
                {c.duration && <div className="text-[11px] text-ink-3 tabular-nums">{c.duration}</div>}
              </button>
              <OutcomeConfirm
                call={c}
                onSaved={(callId, outcome) => setSessionOutcome(callId, outcome)}
              />
            </div>
          ))}
        </Card>
      </div>

      {/* ── Coach bar, pinned bottom ─────────────────────────────────────── */}
      <Coach
        calls={callsWithConfirmed}
        used={coachUsed}
        onOpenCall={openCall}
        session={coachSession}
      />
    </div>
  );
}
