'use strict';

/**
 * backfill-coaching.js — Populate kb_coaching_entries from existing kb_signal_card_entries
 *
 * Reads every row in kb_signal_card_entries, maps the fields to the coaching
 * table schema, generates a single embedding (topic + content), and inserts
 * into kb_coaching_entries.
 *
 * This is a one-time backfill. Running it again is safe — it checks for
 * existing rows by source_id and skips sources already backfilled.
 *
 * Usage:
 *   node backfill-coaching.js          — dry run (shows what would be inserted, no DB writes)
 *   node backfill-coaching.js --apply  — writes to Supabase
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const BATCH_SIZE        = 20;   // rows inserted per Supabase call
const EMBED_BATCH_SIZE  = 20;   // texts embedded per OpenAI call

const applyMode = process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Embed a batch of strings in one OpenAI call ───────────────────────────────
async function embedBatch(texts) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embedding failed: ${err}`);
  }

  const json = await resp.json();
  // Returns embeddings in the same order as input texts
  return json.data.map(d => d.embedding);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Wingman — Backfill kb_coaching_entries from kb_signal_card_entries');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(applyMode ? '  MODE: APPLY — will write to Supabase' : '  MODE: DRY RUN — no DB writes (run with --apply to commit)');
  console.log('');

  // ── 1. Fetch all existing signal card entries ─────────────────────────────
  console.log('Fetching all rows from kb_signal_card_entries...');
  const { data: entries, error: fetchErr } = await supabase
    .from('kb_signal_card_entries')
    .select('id, source_id, technique_name, situation, why_it_works, full_detail, coach_name, call_stage, content_type');

  if (fetchErr) {
    console.error('ERROR fetching signal card entries:', fetchErr.message);
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log('No entries found in kb_signal_card_entries. Nothing to backfill.');
    return;
  }

  console.log(`Found ${entries.length} entries to backfill.\n`);

  // ── 2. Check which source_ids are already in kb_coaching_entries ──────────
  console.log('Checking for already-backfilled sources...');
  const { data: existingSources, error: existingErr } = await supabase
    .from('kb_coaching_entries')
    .select('source_id');

  if (existingErr) {
    console.error('ERROR checking existing coaching entries:', existingErr.message);
    process.exit(1);
  }

  const alreadyBackfilled = new Set((existingSources || []).map(r => r.source_id));

  const toBackfill = entries.filter(e => !alreadyBackfilled.has(e.source_id));
  const skipped    = entries.length - toBackfill.length;

  if (skipped > 0) {
    console.log(`Skipping ${skipped} entries from already-backfilled sources.`);
  }
  if (toBackfill.length === 0) {
    console.log('All sources already backfilled. Nothing to do.');
    return;
  }

  console.log(`Backfilling ${toBackfill.length} entries...\n`);

  // ── 3. Map signal card fields → coaching fields ───────────────────────────
  // topic   = technique_name (what the technique is called)
  // content = situation + why_it_works + full_detail combined
  //           (gives the chatbot rich context to explain and coach with)
  const rows = toBackfill.map(e => {
    const parts = [];
    if (e.situation)    parts.push(`Context: ${e.situation}`);
    if (e.why_it_works) parts.push(`Why it works: ${e.why_it_works}`);
    if (e.full_detail)  parts.push(`Detail: ${e.full_detail}`);

    return {
      source_id:    e.source_id,
      topic:        e.technique_name || 'Unknown technique',
      content:      parts.join('\n\n') || e.technique_name || 'No detail available',
      coach_name:   e.coach_name   || null,
      call_stage:   e.call_stage   || null,
      content_type: e.content_type || 'technique',
      tags:         null,
      // embedding added in step 4
    };
  });

  if (!applyMode) {
    // Dry run: show a sample
    console.log('── SAMPLE (first 3 rows that would be inserted) ────────────────');
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`\n[${i + 1}] topic:        ${r.topic}`);
      console.log(`     coach_name:  ${r.coach_name}`);
      console.log(`     call_stage:  ${r.call_stage}`);
      console.log(`     content_type:${r.content_type}`);
      console.log(`     content:     ${r.content.slice(0, 120)}...`);
    });
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log(`\nDry run complete. ${rows.length} rows would be inserted.`);
    console.log('Run with --apply to commit.\n');
    return;
  }

  // ── 4. Generate embeddings in batches ─────────────────────────────────────
  console.log(`Generating embeddings (${rows.length} rows, batches of ${EMBED_BATCH_SIZE})...`);
  let embedded = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
    const batch     = rows.slice(i, i + EMBED_BATCH_SIZE);
    const texts     = batch.map(r => `${r.topic}\n${r.content}`);

    try {
      const embeddings = await embedBatch(texts);
      embeddings.forEach((emb, j) => {
        rows[i + j].embedding = emb;
      });
      embedded += batch.length;
      process.stdout.write(`\r  Embedded: ${embedded}/${rows.length}`);
    } catch (err) {
      console.error(`\nERROR embedding batch starting at row ${i}: ${err.message}`);
      errors.push(`Batch ${i}–${i + batch.length}: ${err.message}`);
      // Mark these rows so we skip them at insert time
      batch.forEach((_, j) => { rows[i + j]._embedError = true; });
    }

    // Small pause between OpenAI calls to stay within rate limits
    if (i + EMBED_BATCH_SIZE < rows.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log('');

  const readyRows  = rows.filter(r => !r._embedError);
  const failedRows = rows.filter(r => r._embedError);

  if (failedRows.length > 0) {
    console.warn(`\n⚠️  ${failedRows.length} rows failed embedding and will be skipped.`);
  }

  // ── 5. Insert into kb_coaching_entries in batches ─────────────────────────
  console.log(`\nInserting ${readyRows.length} rows into kb_coaching_entries...`);
  let inserted = 0;

  for (let i = 0; i < readyRows.length; i += BATCH_SIZE) {
    const batch = readyRows.slice(i, i + BATCH_SIZE).map(r => ({
      source_id:    r.source_id,
      topic:        r.topic,
      content:      r.content,
      coach_name:   r.coach_name,
      call_stage:   r.call_stage,
      content_type: r.content_type,
      tags:         r.tags,
      embedding:    r.embedding,
    }));

    const { error: insErr } = await supabase
      .from('kb_coaching_entries')
      .insert(batch);

    if (insErr) {
      console.error(`\nERROR inserting batch at row ${i}: ${insErr.message}`);
      errors.push(`Insert batch ${i}–${i + batch.length}: ${insErr.message}`);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted: ${inserted}/${readyRows.length}`);
    }
  }

  console.log('');

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ Backfill complete`);
  console.log(`     Inserted: ${inserted}`);
  if (skipped > 0)        console.log(`     Skipped (already done): ${skipped}`);
  if (failedRows.length)  console.log(`     Failed (embed error):   ${failedRows.length}`);
  if (errors.length > 0) {
    console.log('\n  Errors:');
    errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
