'use strict';
/**
 * cleanup.js — Post-ingestion quality sweep
 *
 * Re-scores all KB entries with quality_score = 'high' or 'medium'
 * using updated Pass 3 criteria. Marks bad entries as 'low'.
 *
 * Does NOT re-extract from source videos.
 * Does NOT delete any rows.
 *
 * Usage:
 *   node cleanup.js           — dry run, shows what would be marked low
 *   node cleanup.js --apply   — actually updates quality_score in Supabase
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const Anthropic        = require('@anthropic-ai/sdk');

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Model ─────────────────────────────────────────────────────────────────────
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

// ── Updated Pass 3 prompt (includes all new low-score criteria) ───────────────
const RESCORE_SYSTEM = `You are a quality gate for a live sales AI coaching system. Score this sales technique entry.

Return ONLY a valid JSON object — no markdown, no explanation:
{ "quality_score": "high" | "medium" | "low", "reason": "One sentence." }

Scoring criteria:
- "high": Clear specific trigger, verbatim exact_script, precise situation, immediately usable on a live call without modification
- "medium": Good technique but slightly vague trigger OR script needs minor polish — still usable on a live call
- "low": Too generic to be useful in the right moment, OR anecdote without clear technique, OR missing specificity that would make it actionable

Also score "low" if ANY of these are true:
- exact_script contains specific numbers, team sizes, pricing, product names, or offer details that belong to the coach's specific business and would be factually wrong for a rep with a different offer (e.g. "we have five calls a week", "I only work with 10 people", "our program is $15,000")
- any prospect_triggers are written in third person instead of first person (e.g. "They want to start a business" instead of "I want to start a business")
- the technique is about personal habits, mindset routines, daily self-review, or productivity practices rather than a technique used directly on a live call`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip markdown fences and parse JSON. Throws with context on failure. */
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

/** Call Haiku to re-score a single entry. Returns { quality_score, reason }. */
async function rescoreEntry(entry) {
  const userMsg = [
    `Technique: ${entry.technique_name}`,
    `Stage: ${entry.call_stage}`,
    `Situation: ${entry.situation}`,
    `Prospect triggers (sample — first 500 chars): ${String(entry.prospect_triggers || '').slice(0, 500)}`,
    `Exact script: ${entry.exact_script}`,
    `Why it works: ${entry.why_it_works}`,
  ].join('\n');

  const result = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 256,
    system: RESCORE_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });

  const raw = result.content[0]?.text ?? '';
  return parseJSON(raw, `entry id=${entry.id}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const applyMode = process.argv.includes('--apply');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Wingman KB Cleanup — ${applyMode ? 'APPLY MODE' : 'DRY RUN (no writes)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // ── 1. Fetch all high/medium entries ────────────────────────────────────────
  console.log('Fetching entries with quality_score high or medium...');
  const { data: entries, error: fetchError } = await supabase
    .from('kb_entries')
    .select('id, technique_name, call_stage, situation, prospect_triggers, exact_script, why_it_works, quality_score')
    .in('quality_score', ['high', 'medium']);

  if (fetchError) {
    console.error('Failed to fetch entries:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${entries.length} entries to review.\n`);

  // ── 2. Counters ──────────────────────────────────────────────────────────────
  const counts = {
    total: entries.length,
    rescored_high: 0,
    rescored_medium: 0,
    rescored_low: 0,
    errors: 0,
  };

  // Entries that would be downgraded (for dry-run table and apply)
  const toDowngrade = [];   // { id, technique_name, old_score, new_score, reason }
  const toUpgrade   = [];   // entries going from medium → high

  // ── 3. Re-score each entry ───────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.technique_name.slice(0, 55).padEnd(55)} `);

    try {
      const scored = await rescoreEntry(entry);
      const newScore = scored.quality_score;
      const oldScore = entry.quality_score;

      if (newScore === 'high')   counts.rescored_high++;
      if (newScore === 'medium') counts.rescored_medium++;
      if (newScore === 'low')    counts.rescored_low++;

      if (newScore !== oldScore) {
        if (newScore === 'low') {
          toDowngrade.push({ id: entry.id, technique_name: entry.technique_name, old_score: oldScore, new_score: newScore, reason: scored.reason });
          process.stdout.write(`→ LOW   ⬇  (was ${oldScore})\n`);
        } else if (newScore === 'high' && oldScore === 'medium') {
          toUpgrade.push({ id: entry.id, technique_name: entry.technique_name, old_score: oldScore, new_score: newScore, reason: scored.reason });
          process.stdout.write(`→ HIGH  ⬆  (was ${oldScore})\n`);
        } else {
          process.stdout.write(`→ ${newScore.toUpperCase().padEnd(6)} (unchanged effective)\n`);
        }
      } else {
        process.stdout.write(`→ ${newScore.toUpperCase().padEnd(6)} unchanged\n`);
      }

    } catch (err) {
      counts.errors++;
      process.stdout.write(`→ ERROR: ${err.message.slice(0, 60)}\n`);
      console.error(`     Full error for id=${entry.id}:`, err.message);
    }

    // Rate limit: 500ms between calls
    if (i < entries.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ── 4. Dry-run report ────────────────────────────────────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!applyMode) {
    if (toDowngrade.length > 0) {
      console.log(`\nEntries that WOULD be marked low (${toDowngrade.length}):\n`);
      for (const row of toDowngrade) {
        console.log(`  ID ${row.id} [was ${row.old_score}]  ${row.technique_name}`);
        console.log(`    Reason: ${row.reason}`);
        console.log('');
      }
    } else {
      console.log('\nNo entries would be downgraded to low.\n');
    }

    if (toUpgrade.length > 0) {
      console.log(`Entries that WOULD be upgraded to high (${toUpgrade.length}):\n`);
      for (const row of toUpgrade) {
        console.log(`  ID ${row.id} [was ${row.old_score}]  ${row.technique_name}`);
        console.log(`    Reason: ${row.reason}`);
        console.log('');
      }
    }

    console.log('  (Dry run — no changes written. Run with --apply to update Supabase.)\n');
  }

  // ── 5. Apply mode: write score changes to Supabase ───────────────────────────
  if (applyMode) {
    const allChanges = [...toDowngrade, ...toUpgrade];

    if (allChanges.length === 0) {
      console.log('\nNo score changes to apply.\n');
    } else {
      console.log(`\nApplying ${allChanges.length} score change(s) to Supabase...\n`);

      for (const row of allChanges) {
        const { error: updateError } = await supabase
          .from('kb_entries')
          .update({ quality_score: row.new_score })
          .eq('id', row.id);

        if (updateError) {
          console.error(`  ERROR updating id=${row.id}: ${updateError.message}`);
          counts.errors++;
        } else {
          console.log(`  Updated id=${row.id}  ${row.old_score} → ${row.new_score}  "${row.technique_name}"`);
        }
      }

      console.log('');
    }
  }

  // ── 6. Summary ───────────────────────────────────────────────────────────────
  const unchanged = counts.total - toDowngrade.length - toUpgrade.length - counts.errors;

  console.log('Cleanup complete.');
  console.log(`Total entries reviewed: ${counts.total}`);
  console.log(`Downgraded to low:      ${toDowngrade.length}`);
  console.log(`Upgraded to high:       ${toUpgrade.length}`);
  console.log(`Unchanged:              ${unchanged}`);
  console.log(`Errors:                 ${counts.errors}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
