'use strict';
/**
 * cleanup.js — Post-ingestion quality sweep + medium-entry polish
 *
 * Two phases per entry:
 *   Phase 1 — Haiku scores each entry against the 5-criteria definition
 *   Phase 2 — Sonnet polishes medium entries, Haiku re-scores to confirm
 *
 * Does NOT re-extract from source videos.
 * Does NOT delete any rows.
 *
 * Usage:
 *   node cleanup.js           — dry run: shows all proposed changes, no DB writes
 *   node cleanup.js --apply   — writes all changes to Supabase
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local'), override: true });

const { createClient } = require('@supabase/supabase-js');
const Anthropic        = require('@anthropic-ai/sdk');

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Models ────────────────────────────────────────────────────────────────────
const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-20250514';

// ── Prompts ───────────────────────────────────────────────────────────────────

const RESCORE_SYSTEM = `You are a quality gate for a live sales AI coaching system.

A good KB entry must meet ALL of the following criteria:
1. It is a technique used directly on a live sales call between a rep and a prospect
2. It has a clear trigger — something the prospect actually says out loud that signals this moment
3. It has a script — the verbatim words the rep says in response
4. It has a situation — a specific moment on the call when this applies
5. It is universal — it works regardless of what the rep is selling, their offer price, or their business model

Score each entry against these five criteria.

Return ONLY a valid JSON object — no markdown, no explanation:
{ "quality_score": "high" | "medium" | "low", "reason": "One sentence." }

- "high": Passes all 5 criteria. Trigger is specific, script is verbatim and natural, situation is precise. A rep could use this on a live call today without changing a word.
- "medium": Passes all 5 criteria but needs minor polish — trigger is slightly vague OR script needs a small tweak. Still usable.
- "low": Fails any one of the 5 criteria. This includes:
  - Not a live call technique (personal habits, mindset, daily routines, productivity practices)
  - Trigger is missing, vague, or written from the rep's perspective instead of the prospect's spoken words
  - Trigger is written in third person ("They want..." instead of "I want...")
  - Script contains the coach's specific business details that would be factually wrong for another rep (specific numbers, team sizes, pricing, product names)
  - Technique only works for one type of offer or industry — not universal`;

const POLISH_SYSTEM = `You are editing a single sales technique entry for a live AI sales coaching system.

The entry has been flagged as "medium" quality for a specific reason. Your job is to fix ONLY that issue — nothing else.

Rules:
- Do not change the technique itself, the approach, or invent new content
- Do not change fields that are not broken
- If triggers are vague: keep all existing ones and add more specific first-person variations of what the prospect actually says out loud
- If triggers are third-person: rewrite them in first person from the prospect's perspective ("I..." not "They...")
- If the script needs polish: tighten the language, keep the same technique and approach, make it more natural and universally applicable
- If the script has offer-specific details: replace them with universal language any rep can use

Return ONLY a valid JSON object with the fields you changed:
{
  "prospect_triggers": "updated triggers — only include if you changed this field",
  "exact_script": "updated script — only include if you changed this field"
}

Only include fields you actually changed.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseJSON(raw, context = '') {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `JSON parse failed${context ? ` (${context})` : ''}: ${e.message}. ` +
      `First 300 chars: ${cleaned.slice(0, 300)}`
    );
  }
}

function buildEntryMessage(entry) {
  return [
    `Technique: ${entry.technique_name}`,
    `Stage: ${entry.call_stage}`,
    `Situation: ${entry.situation}`,
    `Prospect triggers (first 500 chars): ${String(entry.prospect_triggers || '').slice(0, 500)}`,
    `Exact script: ${entry.exact_script}`,
    `Why it works: ${entry.why_it_works}`,
  ].join('\n');
}

async function scoreEntry(entry) {
  const result = await anthropic.messages.create({
    model:      MODEL_HAIKU,
    max_tokens: 256,
    system:     RESCORE_SYSTEM,
    messages:   [{ role: 'user', content: buildEntryMessage(entry) }],
  });
  return parseJSON(result.content[0]?.text ?? '', `score id=${entry.id}`);
}

async function polishEntry(entry, reason) {
  const userMsg = `Flagged reason: ${reason}\n\n${buildEntryMessage(entry)}`;
  const result  = await anthropic.messages.create({
    model:      MODEL_SONNET,
    max_tokens: 1500,
    system:     POLISH_SYSTEM,
    messages:   [{ role: 'user', content: userMsg }],
  });
  return parseJSON(result.content[0]?.text ?? '', `polish id=${entry.id}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const applyMode = process.argv.includes('--apply');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Wingman KB Cleanup — ${applyMode ? 'APPLY MODE' : 'DRY RUN (no writes)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // ── Fetch all high/medium entries ─────────────────────────────────────────
  console.log('Fetching entries...');
  const { data: entries, error: fetchError } = await supabase
    .from('kb_entries')
    .select('id, technique_name, call_stage, situation, prospect_triggers, exact_script, why_it_works, quality_score')
    .in('quality_score', ['high', 'medium']);

  if (fetchError) {
    console.error('Failed to fetch entries:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${entries.length} entries to review.\n`);

  // ── Result buckets ────────────────────────────────────────────────────────
  const toDowngrade  = [];  // { entry, reason }
  const toPolish     = [];  // { entry, reason, polished } — medium → high after polish
  const stillMedium  = [];  // { entry, reason } — Sonnet tried but Haiku still medium
  const errors       = [];  // { entry, phase, error }

  // ── Process each entry ────────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.technique_name.slice(0, 52).padEnd(52)} `);

    try {
      // Phase 1: score
      const scored = await scoreEntry(entry);
      await sleep(400);

      if (scored.quality_score === 'low') {
        toDowngrade.push({ entry, reason: scored.reason });
        process.stdout.write(`→ LOW    ⬇\n`);

      } else if (scored.quality_score === 'high') {
        process.stdout.write(`→ HIGH   ✓\n`);

      } else {
        // Phase 2: medium — attempt polish
        process.stdout.write(`→ MEDIUM  polishing...\n`);

        try {
          const polished = await polishEntry(entry, scored.reason);
          await sleep(400);

          // Re-score the polished version
          const mergedEntry  = { ...entry, ...polished };
          const reScored     = await scoreEntry(mergedEntry);
          await sleep(400);

          if (reScored.quality_score === 'high') {
            toPolish.push({ entry, reason: scored.reason, polished });
            process.stdout.write(`           ✓ polished → HIGH\n`);
          } else {
            stillMedium.push({ entry, reason: scored.reason });
            process.stdout.write(`           ~ still ${reScored.quality_score} after polish — needs manual review\n`);
          }

        } catch (polishErr) {
          errors.push({ entry, phase: 'polish', error: polishErr.message });
          process.stdout.write(`           ERROR during polish: ${polishErr.message.slice(0, 60)}\n`);
        }
      }

    } catch (scoreErr) {
      errors.push({ entry, phase: 'score', error: scoreErr.message });
      process.stdout.write(`→ ERROR: ${scoreErr.message.slice(0, 60)}\n`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (toDowngrade.length > 0) {
    console.log(`\n🔴  MARKED LOW — removing from search results (${toDowngrade.length}):\n`);
    for (const { entry, reason } of toDowngrade) {
      console.log(`  "${entry.technique_name}"  [was ${entry.quality_score}]`);
      console.log(`   Reason: ${reason}\n`);
    }
  }

  if (toPolish.length > 0) {
    console.log(`\n🟢  POLISHED → HIGH (${toPolish.length}):\n`);
    for (const { entry, reason, polished } of toPolish) {
      console.log(`  "${entry.technique_name}"`);
      console.log(`   Issue: ${reason}`);
      if (polished.exact_script) {
        console.log(`   BEFORE script: ${entry.exact_script}`);
        console.log(`   AFTER  script: ${polished.exact_script}`);
      }
      if (polished.prospect_triggers) {
        const before = String(entry.prospect_triggers || '').slice(0, 200);
        const after  = polished.prospect_triggers.slice(0, 200);
        console.log(`   BEFORE triggers (first 200 chars): ${before}`);
        console.log(`   AFTER  triggers (first 200 chars): ${after}`);
      }
      console.log('');
    }
  }

  if (stillMedium.length > 0) {
    console.log(`\n🟡  STILL MEDIUM after polish — manual review needed (${stillMedium.length}):\n`);
    for (const { entry, reason } of stillMedium) {
      console.log(`  "${entry.technique_name}"`);
      console.log(`   Issue: ${reason}\n`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n⚠️   ERRORS (${errors.length}):\n`);
    for (const { entry, phase, error } of errors) {
      console.log(`  "${entry.technique_name}" [${phase}]: ${error.slice(0, 100)}`);
    }
  }

  if (!applyMode) {
    console.log('\n  (Dry run — no changes written. Run with --apply to update Supabase.)\n');
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  if (applyMode) {
    console.log('\nApplying changes to Supabase...\n');

    for (const { entry, reason } of toDowngrade) {
      const { error } = await supabase
        .from('kb_entries')
        .update({ quality_score: 'low' })
        .eq('id', entry.id);
      if (error) {
        console.error(`  ERROR marking low "${entry.technique_name}": ${error.message}`);
      } else {
        console.log(`  ⬇  Marked low: "${entry.technique_name}"`);
      }
    }

    for (const { entry, polished } of toPolish) {
      const updates = { quality_score: 'high', ...polished };
      const { error } = await supabase
        .from('kb_entries')
        .update(updates)
        .eq('id', entry.id);
      if (error) {
        console.error(`  ERROR polishing "${entry.technique_name}": ${error.message}`);
      } else {
        console.log(`  ⬆  Polished to high: "${entry.technique_name}"`);
      }
    }

    console.log('');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const kept = entries.length - toDowngrade.length - errors.length;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total reviewed:          ${entries.length}`);
  console.log(`Marked low (removed):    ${toDowngrade.length}`);
  console.log(`Polished → high:         ${toPolish.length}`);
  console.log(`Still medium:            ${stillMedium.length}`);
  console.log(`Already high / kept:     ${kept - toPolish.length - stillMedium.length}`);
  console.log(`Errors:                  ${errors.length}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
