'use strict';

/**
 * split-triggers.js — Backfill kb_prospect_triggers from existing kb_signal_card_entries
 *
 * Reads all entries with prospect_triggers text, splits each into individual
 * trigger phrases, embeds each phrase separately, and inserts into the
 * kb_prospect_triggers junction table.
 *
 * WHY: The old architecture embedded all 30+ trigger phrases as one block, producing
 * a diluted "average" vector. Similarity scores for correct matches were 0.38 instead
 * of 0.80+. This script creates one crisp embedding per phrase.
 *
 * Safe to re-run: clears all existing rows before inserting.
 *
 * Usage:
 *   node split-triggers.js          — backfill all entries
 *   node split-triggers.js --dry-run — show what would happen, no DB writes
 *
 * Requires: migration 008_trigger_junction.sql must be run in Supabase first.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const OpenAI           = require('openai');

// ── Config ────────────────────────────────────────────────────────────────────
const EMBED_BATCH_SIZE = 100;   // OpenAI allows up to 2048 — 100 is safe headroom
const INSERT_BATCH_SIZE = 500;  // Supabase batch insert limit
const MIN_TRIGGER_LENGTH = 10;  // chars — filters out garbage lines
const MODEL_EMBEDDING = 'text-embedding-3-small';

const isDryRun = process.argv.includes('--dry-run');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits a prospect_triggers text block into clean individual phrases.
 * Handles: numbered lists (1. 2.), bullets (- * •), blank lines, whitespace.
 */
function splitTriggers(text) {
  if (!text || !text.trim()) return [];

  return text
    .split('\n')
    .map(line => line
      .trim()
      .replace(/^[\d]+[\.\)]\s+/, '')   // "1. " or "1) "
      .replace(/^[-*•–]\s+/, '')        // "- " or "* " or "• "
      .trim()
    )
    .filter(line => line.length >= MIN_TRIGGER_LENGTH)
    .filter(line => !line.startsWith('{') && !line.startsWith('['));  // skip JSON artifacts
}

async function embedBatch(texts, openai) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await openai.embeddings.create(
      { model: MODEL_EMBEDDING, input: texts },
      { signal: controller.signal }
    );
    return resp.data.map(d => d.embedding);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey   = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase env vars'); process.exit(1); }
  if (!openaiKey)                   { console.error('Missing OPENAI_API_KEY');     process.exit(1); }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai   = new OpenAI({ apiKey: openaiKey });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  WINGMAN — Split Triggers Backfill');
  console.log(isDryRun ? '  MODE: DRY RUN (no DB writes)' : '  MODE: LIVE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. Read all entries with prospect_triggers ───────────────────────────
  console.log('Reading kb_signal_card_entries...');
  const { data: entries, error: readErr } = await supabase
    .from('kb_signal_card_entries')
    .select('id, technique_name, prospect_triggers, quality_score')
    .not('prospect_triggers', 'is', null)
    .in('quality_score', ['high', 'medium']);

  if (readErr) { console.error('Failed to read entries:', readErr.message); process.exit(1); }
  console.log(`Found ${entries.length} entries with prospect_triggers\n`);

  // ── 2. Split all trigger texts ───────────────────────────────────────────
  const allPairs = [];   // { entry_id, trigger_text }
  let skipped = 0;

  for (const entry of entries) {
    const triggers = splitTriggers(entry.prospect_triggers);
    if (triggers.length === 0) {
      console.warn(`  ⚠️  No usable triggers found for: "${entry.technique_name}" — skipping`);
      skipped++;
      continue;
    }
    for (const trigger of triggers) {
      allPairs.push({ entry_id: entry.id, trigger_text: trigger });
    }
  }

  console.log(`Entries processed : ${entries.length}`);
  console.log(`Entries skipped   : ${skipped}`);
  console.log(`Total trigger rows: ${allPairs.length}`);

  // Cost estimate
  const estimatedTokens = allPairs.reduce(
    (sum, p) => sum + Math.ceil(p.trigger_text.split(/\s+/).length * 1.3), 0
  );
  const estimatedCost = estimatedTokens / 1_000_000 * 0.02;
  console.log(`Estimated cost    : $${estimatedCost.toFixed(4)} (${estimatedTokens} tokens)\n`);

  if (isDryRun) {
    console.log('DRY RUN — sample of triggers that would be inserted:');
    for (let i = 0; i < Math.min(10, allPairs.length); i++) {
      console.log(`  [${allPairs[i].entry_id.slice(0, 8)}...] "${allPairs[i].trigger_text}"`);
    }
    console.log('\nDry run complete. Run without --dry-run to execute.');
    return;
  }

  // ── 3. Embed all triggers in batches ─────────────────────────────────────
  console.log('Embedding trigger phrases...');
  const embeddedPairs = [];
  const totalBatches  = Math.ceil(allPairs.length / EMBED_BATCH_SIZE);

  for (let i = 0; i < allPairs.length; i += EMBED_BATCH_SIZE) {
    const batch = allPairs.slice(i, i + EMBED_BATCH_SIZE);
    const batchNum = Math.floor(i / EMBED_BATCH_SIZE) + 1;

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} phrases)... `);
    const t0 = Date.now();

    let embeddings;
    try {
      embeddings = await embedBatch(batch.map(p => p.trigger_text), openai);
    } catch (err) {
      console.error(`\n  ❌ Embed batch ${batchNum} failed: ${err.message}`);
      process.exit(1);
    }

    for (let j = 0; j < batch.length; j++) {
      embeddedPairs.push({
        entry_id:     batch[j].entry_id,
        trigger_text: batch[j].trigger_text,
        embedding:    embeddings[j],
      });
    }

    console.log(`done (${Date.now() - t0}ms)`);

    // Brief pause between batches to avoid rate limits
    if (i + EMBED_BATCH_SIZE < allPairs.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log(`\nAll ${embeddedPairs.length} triggers embedded.\n`);

  // ── 4. Clear existing rows (idempotent re-run) ────────────────────────────
  console.log('Clearing existing kb_prospect_triggers rows...');
  const { error: delErr } = await supabase
    .from('kb_prospect_triggers')
    .delete()
    .gt('created_at', '1970-01-01T00:00:00Z');  // delete all rows

  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
  console.log('Cleared.\n');

  // ── 5. Insert in batches ──────────────────────────────────────────────────
  console.log('Inserting trigger rows...');
  const totalInsertBatches = Math.ceil(embeddedPairs.length / INSERT_BATCH_SIZE);

  for (let i = 0; i < embeddedPairs.length; i += INSERT_BATCH_SIZE) {
    const batch    = embeddedPairs.slice(i, i + INSERT_BATCH_SIZE);
    const batchNum = Math.floor(i / INSERT_BATCH_SIZE) + 1;

    const { error: insErr } = await supabase
      .from('kb_prospect_triggers')
      .insert(batch);

    if (insErr) { console.error(`Insert batch ${batchNum} failed:`, insErr.message); process.exit(1); }
    console.log(`  Batch ${batchNum}/${totalInsertBatches} — inserted rows ${i + 1}–${Math.min(i + INSERT_BATCH_SIZE, embeddedPairs.length)}`);
  }

  // ── 6. Verify ─────────────────────────────────────────────────────────────
  const { count, error: countErr } = await supabase
    .from('kb_prospect_triggers')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.warn('\n⚠️  Could not verify row count:', countErr.message);
  } else {
    console.log(`\n✅ Verified: ${count} rows in kb_prospect_triggers`);
  }

  // ── 7. Print IVFFlat index SQL ────────────────────────────────────────────
  const lists = Math.max(10, Math.round(Math.sqrt(embeddedPairs.length)));
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  NEXT STEP — Run this SQL in Supabase SQL Editor:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
  CREATE INDEX ON public.kb_prospect_triggers
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = ${lists});
`);
  console.log('This index makes vector search fast as the table grows.\n');
  console.log('Then run: node calibrate.js — scores should now be 0.72+\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
