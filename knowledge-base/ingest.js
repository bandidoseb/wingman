'use strict';

/**
 * ingestVideo(url, log) — Wingman Knowledge Base ingestion pipeline
 *
 * Step 1  Download audio via yt-dlp (mp3, low-quality mono 16kHz — enough for Whisper)
 * Step 2  Transcribe with OpenAI Whisper (whisper-1)
 * Step 3  Extract knowledge entries with Claude Sonnet
 * Step 4  Embed each entry with text-embedding-3-small
 * Step 5  Store everything in Supabase, record cost
 *
 * Requires: yt-dlp and ffmpeg installed and on PATH
 */

const { execSync }   = require('child_process');
const fs             = require('fs');
const path           = require('path');
const os             = require('os');
const { createClient } = require('@supabase/supabase-js');
const Anthropic      = require('@anthropic-ai/sdk');
const OpenAI         = require('openai');
const { toFile }     = require('openai');

// ── Clients (initialized lazily from env so the module is importable before env loads) ──
function getClients() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return { supabase, anthropic, openai };
}

// ── Models ────────────────────────────────────────────────────────────────────
const MODEL_SONNET    = 'claude-sonnet-4-20250514';
const MODEL_WHISPER   = 'whisper-1';
const MODEL_EMBEDDING = 'text-embedding-3-small';
const MAX_FILE_MB     = 24; // Whisper API limit is 25MB — leave 1MB headroom

// ── Pricing (USD) ─────────────────────────────────────────────────────────────
const COST_WHISPER_PER_MIN    = 0.006;   // $0.006 / minute
const COST_SONNET_IN_PER_M    = 3.0;    // $3.00 / million input tokens
const COST_SONNET_OUT_PER_M   = 15.0;   // $15.00 / million output tokens
const COST_EMBEDDING_PER_M    = 0.02;   // $0.02 / million tokens

// ── Extraction prompt (exact — do not modify) ─────────────────────────────────
const EXTRACTION_SYSTEM_PROMPT = `You are a master sales trainer with 20 years of experience coaching high-ticket closers. You are analyzing a sales training transcript.

Your job is to extract every single teachable moment — every technique, handle, reframe, script, tonality tip, pattern interrupt, closing method, or mindset shift that a rep could directly apply on a live sales call.

For each moment output a JSON object with these exact fields:
* category: name this freely based on what it actually is — be specific and preserve nuance, never force it into a broad bucket
* trigger_phrase: the exact words a prospect says, or the exact situation on the call that calls for this technique
* technique_name: a short memorable name for this technique
* full_detail: the complete technique in full richness — include the exact words, the framework, the reasoning, the nuance, any variations. Do not summarize. Do not strip nuance. This is the knowledge base entry that will power a live AI coaching system — completeness is everything.
* coach_name: the coach being quoted

Rules:
* Only extract moments directly applicable on a live call
* Ignore all introductions, origin stories, and filler content
* If a technique has multiple variations, extract each variation as its own separate entry
* Preserve the coach's exact language in full_detail wherever possible
* Return a valid JSON array only — no other text, no markdown, no explanation

Quality bar: every entry must pass this test — if a rep read this on a live call, would it make them better in that exact moment? If no, do not include it.`;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} url           YouTube URL
 * @param {(msg: string) => void} log  Progress callback
 * @returns {Promise<object>}
 */
async function ingestVideo(url, log = console.log) {
  const { supabase, anthropic, openai } = getClients();
  let sourceId = null;
  let tempDir  = null;

  try {
    // ── 0. Duplicate check ─────────────────────────────────────────────────
    log('Checking for duplicates...');
    const { data: existing } = await supabase
      .from('kb_sources')
      .select('id, video_title, status')
      .eq('youtube_url', url)
      .maybeSingle();

    if (existing?.status === 'complete') {
      return {
        duplicate: true,
        message:   `Already processed — ${existing.video_title}`,
      };
    }

    // ── 1a. Fetch video metadata ───────────────────────────────────────────
    log('Fetching video metadata...');
    let metadata;
    try {
      const raw = execSync(
        `yt-dlp --dump-single-json --no-playlist "${url}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30_000 }
      );
      metadata = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Metadata fetch failed: ${e.message}`);
    }

    const videoTitle      = metadata.title    || 'Unknown Title';
    const channelName     = metadata.channel  || metadata.uploader || 'Unknown Channel';
    const durationSeconds = metadata.duration || 0;
    const videoId         = metadata.id;

    log(`Video: "${videoTitle}" · ${Math.round(durationSeconds / 60)} min · ${channelName}`);

    // ── 1b. Create / update kb_sources row ───────────────────────────────
    const { data: source, error: srcErr } = await supabase
      .from('kb_sources')
      .upsert(
        {
          youtube_url:      url,
          video_title:      videoTitle,
          channel_name:     channelName,
          coach_name:       channelName, // default; Claude may refine in full_detail
          duration_seconds: durationSeconds,
          status:           'processing',
          error_message:    null,
        },
        { onConflict: 'youtube_url' }
      )
      .select()
      .single();

    if (srcErr) throw new Error(`DB upsert failed: ${srcErr.message}`);
    sourceId = source.id;

    // ── 1c. Download audio ─────────────────────────────────────────────────
    log(`Downloading audio...`);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wingman-kb-'));
    const outputTemplate = path.join(tempDir, `${videoId}.%(ext)s`);

    try {
      execSync(
        `yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 9 ` +
        `--postprocessor-args "ffmpeg:-ar 16000 -ac 1 -b:a 32k" ` +
        `--no-playlist -o "${outputTemplate}" "${url}"`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 600_000 }
      );
    } catch (e) {
      throw new Error(`Audio download failed: ${e.message}`);
    }

    // Find the downloaded mp3 (yt-dlp occasionally changes the filename slightly)
    const files    = fs.readdirSync(tempDir);
    const mp3File  = files.find(f => f.endsWith('.mp3'));
    if (!mp3File) throw new Error('No .mp3 file found after download — yt-dlp may have failed silently');

    const audioPath  = path.join(tempDir, mp3File);
    const fileSizeMb = fs.statSync(audioPath).size / (1024 * 1024);

    if (fileSizeMb > MAX_FILE_MB) {
      throw new Error(
        `Audio file is ${fileSizeMb.toFixed(1)}MB — exceeds Whisper's 25MB limit. ` +
        `Video is likely longer than ~2 hours. Chunked transcription is not yet supported.`
      );
    }

    log(`Downloaded (${fileSizeMb.toFixed(1)}MB). Transcribing...`);

    // ── 2. Transcribe with Whisper ─────────────────────────────────────────
    let transcript;
    try {
      const resp = await openai.audio.transcriptions.create({
        file:            await toFile(fs.createReadStream(audioPath), path.basename(audioPath), { type: 'audio/mpeg' }),
        model:           MODEL_WHISPER,
        response_format: 'text',
      });
      transcript = typeof resp === 'string' ? resp : resp.text;
    } catch (e) {
      throw new Error(`Whisper transcription failed: ${e.message}`);
    }

    const whisperCost = (durationSeconds / 60) * COST_WHISPER_PER_MIN;
    log(`Transcribed (${transcript.length.toLocaleString()} chars · whisper cost $${whisperCost.toFixed(4)}). Extracting entries...`);

    // ── 3. Extract knowledge entries with Claude ──────────────────────────
    let claudeResp;
    try {
      claudeResp = await anthropic.messages.create({
        model:      MODEL_SONNET,
        max_tokens: 8192,
        system:     EXTRACTION_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: transcript }],
      });
    } catch (e) {
      throw new Error(`Claude extraction failed: ${e.message}`);
    }

    const claudeCost =
      (claudeResp.usage.input_tokens  / 1_000_000 * COST_SONNET_IN_PER_M) +
      (claudeResp.usage.output_tokens / 1_000_000 * COST_SONNET_OUT_PER_M);

    const rawJson = claudeResp.content[0]?.text ?? '[]';
    let entries;
    try {
      const cleaned = rawJson
        .replace(/^```json?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      entries = JSON.parse(cleaned);
      if (!Array.isArray(entries)) throw new Error('Response is not a JSON array');
    } catch (e) {
      throw new Error(
        `JSON parse failed: ${e.message}. First 500 chars of response: ${rawJson.slice(0, 500)}`
      );
    }

    log(`Extracted ${entries.length} entries (claude cost $${claudeCost.toFixed(4)}). Embedding...`);

    // ── 4. Embed each entry ────────────────────────────────────────────────
    let totalEmbedTokens = 0;
    const rows = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const embeddingInput = `${e.trigger_phrase} ${e.technique_name} ${e.full_detail}`;

      let embedResp;
      try {
        embedResp = await openai.embeddings.create({
          model: MODEL_EMBEDDING,
          input: embeddingInput,
        });
      } catch (err) {
        throw new Error(`Embedding failed for entry ${i} ("${e.technique_name}"): ${err.message}`);
      }

      totalEmbedTokens += embedResp.usage?.total_tokens ?? 0;

      rows.push({
        source_id:      sourceId,
        category:       e.category       || 'Uncategorized',
        trigger_phrase: e.trigger_phrase || '',
        technique_name: e.technique_name || '',
        full_detail:    e.full_detail    || '',
        coach_name:     e.coach_name     || channelName,
        embedding:      embedResp.data[0].embedding,
      });

      if ((i + 1) % 10 === 0) {
        log(`  Embedded ${i + 1}/${entries.length}...`);
      }
    }

    const embedCost = (totalEmbedTokens / 1_000_000) * COST_EMBEDDING_PER_M;
    const totalCost = whisperCost + claudeCost + embedCost;

    log(`Embeddings done (cost $${embedCost.toFixed(5)}). Storing ${rows.length} entries...`);

    // ── 5. Store everything ────────────────────────────────────────────────
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('kb_entries').insert(rows);
      if (insErr) throw new Error(`Entry insert failed: ${insErr.message}`);
    }

    const { error: upErr } = await supabase
      .from('kb_sources')
      .update({
        status:          'complete',
        entry_count:     rows.length,
        processing_cost: totalCost,
        processed_at:    new Date().toISOString(),
      })
      .eq('id', sourceId);

    if (upErr) throw new Error(`Source update failed: ${upErr.message}`);

    log(`Done! ${rows.length} entries stored. Total cost: $${totalCost.toFixed(4)}`);

    return {
      success:         true,
      videoTitle,
      entryCount:      rows.length,
      durationSeconds,
      cost:            totalCost,
    };

  } catch (err) {
    console.error('[ingestVideo] Error:', err.message);

    // Mark source as failed — don't insert partial data
    if (sourceId) {
      try {
        await supabase
          .from('kb_sources')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', sourceId);
      } catch (_) {} // don't throw on cleanup failure
    }

    throw err;

  } finally {
    // Always clean up temp audio files
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

module.exports = { ingestVideo };
