'use strict';

/**
 * calibrate.js — KB similarity threshold calibration tool
 *
 * Runs 10 realistic prospect trigger phrases through the same embedding +
 * pgvector search used by the live signal card pipeline. Sets threshold to 0
 * so you can see ALL candidates and their raw similarity scores.
 *
 * Helps answer: Is 0.72 the right threshold? Are we missing good matches?
 * Are we returning garbage matches?
 *
 * Usage:
 *   node calibrate.js
 *   node calibrate.js --threshold 0.68   (test a different threshold)
 *
 * Output: for each phrase, shows top matches with similarity scores.
 *   ✅ above current threshold (would fire)
 *   ⚠️  just below threshold (potential miss)
 *   ❌ far below threshold (correctly filtered)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const CURRENT_THRESHOLD = 0.65;
const MATCH_COUNT       = 8;   // more than live (5) so we can see what's just below
const MODEL_EMBEDDING   = 'text-embedding-3-small';

// Parse --threshold flag
const thresholdArg = process.argv.find(a => a.startsWith('--threshold'));
const TEST_THRESHOLD = thresholdArg
  ? parseFloat(thresholdArg.split('=')[1] ?? process.argv[process.argv.indexOf(thresholdArg) + 1])
  : CURRENT_THRESHOLD;

// ── Test phrases ──────────────────────────────────────────────────────────────
// 10 real prospect trigger phrases that should map to KB techniques.
// Covers the most common signal card moments across all call stages.
const TEST_PHRASES = [
  // Price objections
  { label: "Price objection (direct)",  text: "That's way too expensive for me right now" },
  { label: "Price objection (indirect)", text: "I just don't think I can afford it at the moment" },

  // Stall / think about it
  { label: "Think about it stall",      text: "I need to think about this before I make any decision" },
  { label: "Time stall",                text: "I'm just not ready to move forward right now" },

  // Authority objection
  { label: "Partner authority",         text: "I'd need to talk to my wife about this first" },

  // Discovery moment — prospect revealing pain
  { label: "Pain admission",            text: "I've been struggling to close deals for the past year" },
  { label: "Fear of past failure",      text: "I've tried coaching programs before and they didn't really work for me" },

  // Info request / disengagement
  { label: "Send info request",         text: "Can you just send me some information and I'll take a look?" },

  // Commitment / close signal
  { label: "Close signal",             text: "This sounds really good, what would the next step be?" },

  // Competitor / shopping
  { label: "Shopping objection",        text: "I'm also looking at a few other options before I decide" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function embedText(text, openaiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL_EMBEDDING, input: text }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI embed error: ${err}`);
    }

    const data = await resp.json();
    return data.data[0].embedding;
  } finally {
    clearTimeout(timeout);
  }
}

function scoreLabel(sim) {
  if (sim >= TEST_THRESHOLD)             return '✅';
  if (sim >= TEST_THRESHOLD - 0.05)      return '⚠️ ';
  return '❌';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!openaiKey)    { console.error('Missing OPENAI_API_KEY'); process.exit(1); }
  if (!supabaseUrl)  { console.error('Missing NEXT_PUBLIC_SUPABASE_URL'); process.exit(1); }
  if (!supabaseKey)  { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  WINGMAN KB CALIBRATION');
  console.log(`  Threshold under test : ${TEST_THRESHOLD}`);
  console.log(`  Current live threshold: ${CURRENT_THRESHOLD}`);
  console.log(`  Matches requested    : ${TEST_THRESHOLD === 0 ? MATCH_COUNT + ' (no filter)' : MATCH_COUNT}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalAbove = 0;
  let totalNearMiss = 0;
  let totalBelow = 0;

  for (const phrase of TEST_PHRASES) {
    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`PHRASE: "${phrase.text}"`);
    console.log(`LABEL:  ${phrase.label}`);
    console.log('──────────────────────────────────────────────────');

    let embedding;
    try {
      const t0 = Date.now();
      embedding = await embedText(phrase.text, openaiKey);
      console.log(`  Embed time: ${Date.now() - t0}ms`);
    } catch (err) {
      console.error(`  ❌ Embed failed: ${err.message}`);
      continue;
    }

    let matches;
    try {
      const { data, error } = await supabase.rpc('search_kb_by_trigger', {
        query_embedding:      embedding,
        similarity_threshold: 0,   // always 0 here — we filter manually below for display
        match_count:          MATCH_COUNT,
      });

      if (error) throw error;
      matches = data ?? [];
    } catch (err) {
      console.error(`  ❌ Vector search failed: ${err.message}`);
      continue;
    }

    if (matches.length === 0) {
      console.log('  (no matches at all — KB may be empty or RPC misconfigured)');
      continue;
    }

    let phraseAbove = 0;
    let phraseNearMiss = 0;

    for (const m of matches) {
      const icon = scoreLabel(m.similarity);
      const simStr = m.similarity.toFixed(4);
      const willFire = m.similarity >= TEST_THRESHOLD ? ' → FIRES CARD' : '';
      console.log(`  ${icon} ${simStr}${willFire}`);
      console.log(`       Name   : ${m.technique_name}`);
      console.log(`       Stage  : ${m.call_stage}  |  Quality: ${m.quality_score}`);
      console.log(`       When   : ${m.situation}`);
      console.log(`       Trigger: "${m.matched_trigger}"`);

      if (m.similarity >= TEST_THRESHOLD) {
        phraseAbove++;
        totalAbove++;
      } else if (m.similarity >= TEST_THRESHOLD - 0.05) {
        phraseNearMiss++;
        totalNearMiss++;
      } else {
        totalBelow++;
      }
    }

    console.log(`\n  Summary for this phrase: ${phraseAbove} fire, ${phraseNearMiss} near-miss, ${matches.length - phraseAbove - phraseNearMiss} filtered`);
  }

  // ── Final recommendation ────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CALIBRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Would fire card : ${totalAbove} matches across all phrases`);
  console.log(`  ⚠️  Near misses    : ${totalNearMiss} matches within 0.05 of threshold`);
  console.log(`  ❌ Filtered out    : ${totalBelow} matches correctly below threshold`);
  console.log('');

  if (totalAbove === 0) {
    console.log('  ⚠️  RECOMMENDATION: No phrases hit the threshold. Consider lowering to 0.65–0.68.');
    console.log('     This likely means the KB entries don\'t have enough matching trigger language.');
  } else if (totalNearMiss > totalAbove) {
    console.log('  ⚠️  RECOMMENDATION: Many near-misses. Consider lowering threshold by 0.03–0.05.');
    console.log(`     Try: node calibrate.js --threshold ${(TEST_THRESHOLD - 0.04).toFixed(2)}`);
  } else if (totalAbove > TEST_PHRASES.length * 2) {
    console.log('  ⚠️  RECOMMENDATION: Very high match rate — threshold may be too loose.');
    console.log('     Review the ✅ matches above to confirm they\'re all genuinely relevant.');
    console.log(`     Try: node calibrate.js --threshold ${(TEST_THRESHOLD + 0.03).toFixed(2)}`);
  } else {
    console.log('  ✅ RECOMMENDATION: Threshold looks reasonable. Review the ✅ matches above');
    console.log('     to confirm they\'re all genuinely relevant before beta.');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
