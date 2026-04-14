'use strict';

/**
 * ingest.js — Wingman Knowledge Base ingestion pipeline v2
 *
 * 3-Pass pipeline:
 *   Pass 1 — Content Intelligence (Haiku): understand the video before extracting
 *   Pass 2 — Deep Extraction (Sonnet):     extract all techniques with rich structure
 *   Pass 3 — Quality Gate (Haiku):         score every entry, discard low quality
 *
 * Dual-vector embedding:
 *   prospect_embedding  — embedded from 30+ prospect trigger phrases (primary search)
 *   technique_embedding — embedded from situation + name + why_it_works (fallback)
 *
 * CLI usage (batch re-ingestion):
 *   node ingest.js --force      re-ingest ALL sources including already-completed ones
 *   node ingest.js              ingest only sources with status != 'complete'
 *
 * Module usage (from server.js):
 *   const { ingestVideo } = require('./ingest');
 *   await ingestVideo(url, logCallback, { force: false });
 *
 * Requires: yt-dlp and ffmpeg installed and on PATH
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { execSync }     = require('child_process');
const fs               = require('fs');
const path             = require('path');
const os               = require('os');
const readline         = require('readline');
const { createClient } = require('@supabase/supabase-js');
const Anthropic        = require('@anthropic-ai/sdk');
const OpenAI           = require('openai');
const { toFile }       = require('openai');

// ── Clients ───────────────────────────────────────────────────────────────────
function getClients() {
  const supabase  = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return { supabase, anthropic, openai };
}

// ── Models ────────────────────────────────────────────────────────────────────
const MODEL_HAIKU     = 'claude-haiku-4-5-20251001';   // Pass 1, Pass 3
const MODEL_SONNET    = 'claude-sonnet-4-20250514';    // Pass 2
const MODEL_WHISPER   = 'whisper-1';
const MODEL_EMBEDDING = 'text-embedding-3-small';

// ── Limits ────────────────────────────────────────────────────────────────────
const MAX_FILE_MB         = 24;      // Whisper limit is 25MB — 1MB headroom
const HAIKU_TIMEOUT_MS    = 60_000;  // 1 minute per Haiku call
const SONNET_TIMEOUT_MS   = 300_000; // 5 minutes for full extraction
const MIN_TRIGGER_COUNT   = 20;      // Below this → auto-downgrade to 'low'

// ── Validation ────────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['technique_name', 'call_stage', 'situation', 'prospect_triggers', 'exact_script'];
const VALID_STAGES    = new Set(['Rapport', 'Discovery', 'Press', 'Confirm', 'Pitch', 'Close']);
const VALID_QUALITY   = new Set(['high', 'medium', 'low']);

// ── Pricing (USD) ─────────────────────────────────────────────────────────────
const COST_WHISPER_PER_MIN  = 0.006;
const COST_HAIKU_IN_PER_M   = 0.25;
const COST_HAIKU_OUT_PER_M  = 1.25;
const COST_SONNET_IN_PER_M  = 3.0;
const COST_SONNET_OUT_PER_M = 15.0;
const COST_EMBED_PER_M      = 0.02;

// ── Local transcript cache dir ────────────────────────────────────────────────
const TRANSCRIPT_CACHE_DIR = path.join(__dirname, 'transcripts');
const WARNINGS_LOG         = path.join(__dirname, 'ingest_warnings.log');

// ── Prompts ───────────────────────────────────────────────────────────────────

const PASS1_SYSTEM = `You are analyzing a sales training video transcript. Your job is to understand the content before a full extraction pass is done.

Return ONLY a valid JSON object — no markdown, no explanation, nothing else:
{
  "content_type": "role_play" | "lecture" | "objection_demo" | "coaching_call" | "short_clip" | "interview",
  "primary_focus": "objection_handling" | "discovery" | "closing" | "rapport" | "full_process",
  "call_stages_covered": [one or more of: "Rapport", "Discovery", "Press", "Confirm", "Pitch", "Close"],
  "has_role_play": true | false,
  "extraction_notes": "Specific guidance for the extraction pass. Describe the video format, what to focus on, what to skip.",
  "classification_confidence": "high" | "medium" | "low"
}

content_type definitions:
- role_play: coach and student acting out a call
- lecture: coach teaching without live demo
- objection_demo: demonstrating specific objection handling
- coaching_call: reviewing or correcting a real call recording
- short_clip: under 10 minutes, one focused concept
- interview: conversational Q&A format

classification_confidence:
- high: clear content type, confident about extraction strategy
- medium: mixed format or ambiguous structure
- low: unclear format, content type uncertain`;

const PASS2_SYSTEM = `You are a master sales knowledge extractor. Your job is to extract every teachable sales technique from a training transcript.

Return ONLY a valid JSON array of technique objects — no markdown, no explanation, nothing else.

Each object must have ALL of these fields:

{
  "technique_name": "Short memorable name, 3-6 words",
  "call_stage": "EXACTLY one of: Rapport, Discovery, Press, Confirm, Pitch, Close",
  "situation": "One sentence only. What is happening on the call right now that calls for this technique.",
  "prospect_triggers": "30+ natural variations of what the prospect says or signals that should trigger this technique. One per line. No numbering. No bullet points. Natural spoken language only. Include: direct objections, indirect hints, tone shifts, stalls, questions, and silence signals.",
  "exact_script": "The verbatim words the rep says. First person. Natural spoken language. This is the ACTUAL script — not a description of what to say.",
  "why_it_works": "The psychological or tactical principle behind this technique. Not the script — the reason it works.",
  "coach_name": "Name of the coach being quoted or demonstrated."
}

Critical rules:
- call_stage must be EXACTLY ONE word from the allowed list. Never an array. Never a combination.
- If a technique applies to multiple stages, pick the stage where it is MOST needed.
- prospect_triggers must have at least 30 variations. Be exhaustive. Think of every way a prospect could signal this moment — word-for-word statements, paraphrases, questions, deflections, and non-verbal signals described as text.
- exact_script must be verbatim — the actual words, not "the rep should say..."
- situation is ONE sentence only.
- Extract EVERY technique. Do not summarize multiple techniques into one.
- If a technique has multiple variations, extract each as a separate entry.
- Ignore: introductions, origin stories, motivational content with no tactical application, filler.
- prospect_triggers MUST be written in first person from the prospect's perspective ("I...", "We...", "My...", "It's...", "What about..."). NEVER write them in third person ("They want...", "The prospect says...", "He/she is looking for..."). These are the words the prospect speaks out loud.
- Do NOT extract techniques about personal habits, mindset routines, daily self-review, or productivity practices. Only extract techniques that are directly used ON a live sales call between a rep and a prospect.`;

const PASS3_SYSTEM = `You are a quality gate for a live sales AI coaching system. Score this sales technique entry.

Return ONLY a valid JSON object — no markdown, no explanation:
{ "quality_score": "high" | "medium" | "low", "reason": "One sentence." }

Scoring criteria:
- "high": Clear specific trigger, verbatim exact_script, precise situation, immediately usable on a live call without modification
- "medium": Good technique but slightly vague trigger OR script needs minor polish — still usable on a live call
- "low": Too generic to be useful in the right moment, OR anecdote without clear technique, OR missing specificity that would make it actionable

Also score "low" if ANY of these are true:
- exact_script contains specific numbers, team sizes, pricing, product names, or offer details that belong to the coach's specific business and would be factually wrong for a rep with a different offer (e.g. "we have five calls a week", "I only work with 10 people", "our program is $15,000")
- any prospect_triggers are written in third person instead of first person
- the technique is about personal habits, mindset routines, daily self-review, or productivity practices rather than a technique used directly on a live call`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Claude with a timeout and automatic retry on 529 (overloaded) errors.
 *
 * Retry schedule: 4 attempts total, delays of 10s → 30s → 60s between them.
 * Only 529 (overloaded) is retried — all other errors throw immediately.
 * Each attempt has its own independent timeout.
 */
const CLAUDE_RETRY_DELAYS_MS = [10_000, 30_000, 60_000]; // 3 retries after initial attempt

async function callClaude(anthropic, { model, system, user, maxTokens, timeoutMs }) {
  const maxAttempts = CLAUDE_RETRY_DELAYS_MS.length + 1; // 4 total

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Claude call timed out after ${timeoutMs / 1000}s (model: ${model})`)),
        timeoutMs
      );
    });

    try {
      const result = await Promise.race([
        anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        timeoutPromise,
      ]);
      clearTimeout(timeoutId);
      return result;

    } catch (e) {
      clearTimeout(timeoutId);

      // Only retry on 529 overloaded — everything else fails immediately
      const is529 = e?.status === 529 || (e?.message && e.message.includes('529'));
      const hasRetry = attempt < maxAttempts - 1;

      if (is529 && hasRetry) {
        const delayMs = CLAUDE_RETRY_DELAYS_MS[attempt];
        console.warn(
          `  ⏳ Anthropic overloaded (529) — attempt ${attempt + 1}/${maxAttempts}. ` +
          `Retrying in ${delayMs / 1000}s...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      throw e;
    }
  }
}

/** Strip markdown fences and parse JSON. Throws with context on failure. */
function parseClaudeJSON(raw, context = '') {
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

/**
 * Count trigger variations in a newline-separated text block.
 * Strips numbering (1. 2.) and bullet characters (- • *) before counting.
 */
function countTriggers(triggersText) {
  if (!triggersText || typeof triggersText !== 'string') return 0;
  return triggersText
    .split('\n')
    .map(line => line.replace(/^\s*[\d]+\.\s*/, '').replace(/^\s*[-•*]\s*/, '').trim())
    .filter(line => line.length > 0)
    .length;
}

/**
 * Validate a single extracted entry has all required fields and a valid call_stage.
 * Returns an array of error strings. Empty array = valid.
 */
function validateEntry(entry) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!entry[field] || String(entry[field]).trim() === '') {
      errors.push(`missing required field: ${field}`);
    }
  }
  if (entry.call_stage && !VALID_STAGES.has(entry.call_stage)) {
    errors.push(
      `invalid call_stage: "${entry.call_stage}" — must be one of: ${[...VALID_STAGES].join(', ')}`
    );
  }
  return errors;
}

/** Append a warning to ingest_warnings.log with a timestamp. */
function writeWarning(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(WARNINGS_LOG, line, 'utf-8');
  } catch (_) {
    // Never crash on a logging failure
    console.warn('[ingest] Could not write to ingest_warnings.log:', msg);
  }
}

/** Prompt y/n on stdin and return the answer. */
function askYN(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: ingestVideo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ingest a single YouTube video through the 3-pass pipeline.
 *
 * @param {string}   url              YouTube URL
 * @param {Function} log              Progress callback (default: console.log)
 * @param {object}   options
 * @param {boolean}  options.force    Skip duplicate check (required for re-ingestion)
 * @returns {Promise<object>}
 */
async function ingestVideo(url, log = console.log, options = {}) {
  const { force = false } = options;
  const { supabase, anthropic, openai } = getClients();

  let sourceId = null;
  let tempDir  = null;
  let totalCost = 0;

  // Ensure transcript cache dir exists
  if (!fs.existsSync(TRANSCRIPT_CACHE_DIR)) {
    fs.mkdirSync(TRANSCRIPT_CACHE_DIR, { recursive: true });
  }

  try {
    // ── 0. Duplicate check (skipped if force) ──────────────────────────────
    if (!force) {
      log('Checking for duplicates...');
      const { data: existing } = await supabase
        .from('kb_sources')
        .select('id, video_title, status')
        .eq('youtube_url', url)
        .maybeSingle();

      if (existing?.status === 'complete') {
        return { duplicate: true, message: `Already processed — ${existing.video_title}` };
      }
    }

    // ── 1a. Fetch video metadata ────────────────────────────────────────────
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

    // ── 1b. Create / update kb_sources row ─────────────────────────────────
    const { data: source, error: srcErr } = await supabase
      .from('kb_sources')
      .upsert(
        {
          youtube_url:      url,
          video_title:      videoTitle,
          channel_name:     channelName,
          coach_name:       channelName,
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

    // ── 1c. Transcript: check cache first, then Whisper ────────────────────
    const cacheFile = path.join(TRANSCRIPT_CACHE_DIR, `${videoId}.txt`);
    let transcript;
    let whisperCost = 0;

    if (fs.existsSync(cacheFile)) {
      log('Transcript found in cache — skipping Whisper.');
      transcript = fs.readFileSync(cacheFile, 'utf-8');
    } else {
      log('No cached transcript — downloading audio for Whisper...');
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

      const files   = fs.readdirSync(tempDir);
      const mp3File = files.find(f => f.endsWith('.mp3'));
      if (!mp3File) throw new Error('No .mp3 file after download — yt-dlp may have failed silently');

      const audioPath  = path.join(tempDir, mp3File);
      const fileSizeMb = fs.statSync(audioPath).size / (1024 * 1024);
      if (fileSizeMb > MAX_FILE_MB) {
        throw new Error(
          `Audio file is ${fileSizeMb.toFixed(1)}MB — exceeds Whisper's 25MB limit. ` +
          `Video may be longer than ~2 hours. Manual chunking required.`
        );
      }

      log(`Audio downloaded (${fileSizeMb.toFixed(1)}MB). Transcribing with Whisper...`);

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

      // Cache for future re-ingestion runs
      fs.writeFileSync(cacheFile, transcript, 'utf-8');

      whisperCost = (durationSeconds / 60) * COST_WHISPER_PER_MIN;
      totalCost += whisperCost;
      log(`Transcribed (${transcript.length.toLocaleString()} chars · $${whisperCost.toFixed(4)})`);
    }

    // ── 2. Pass 1 — Content Intelligence (Haiku) ───────────────────────────
    log('Pass 1: Content Intelligence (Haiku)...');

    const pass1Resp = await callClaude(anthropic, {
      model:      MODEL_HAIKU,
      system:     PASS1_SYSTEM,
      user:       `Video title: ${videoTitle}\nChannel: ${channelName}\nDuration: ${Math.round(durationSeconds / 60)} minutes\n\nTranscript:\n${transcript}`,
      maxTokens:  512,
      timeoutMs:  HAIKU_TIMEOUT_MS,
    });

    const pass1Cost =
      (pass1Resp.usage.input_tokens  / 1_000_000 * COST_HAIKU_IN_PER_M) +
      (pass1Resp.usage.output_tokens / 1_000_000 * COST_HAIKU_OUT_PER_M);
    totalCost += pass1Cost;

    let contentIntelligence;
    try {
      contentIntelligence = parseClaudeJSON(pass1Resp.content[0]?.text ?? '{}', 'Pass 1');
    } catch (e) {
      writeWarning(`[${videoTitle}] Pass 1 JSON parse failed: ${e.message}`);
      // Proceed with defaults — don't skip the video
      contentIntelligence = {
        content_type: 'lecture',
        extraction_notes: 'Pass 1 classification failed — extract all teachable moments.',
        classification_confidence: 'low',
      };
    }

    log(`  Content type: ${contentIntelligence.content_type} · Confidence: ${contentIntelligence.classification_confidence}`);

    if (contentIntelligence.classification_confidence === 'low') {
      const warning = `[${videoTitle}] Pass 1 classification confidence is LOW — manual review recommended. Notes: ${contentIntelligence.extraction_notes}`;
      writeWarning(warning);
      await supabase
        .from('kb_sources')
        .update({ error_message: 'Pass 1 classification confidence low — review recommended' })
        .eq('id', sourceId);
    }

    // IMPORTANT: extraction_notes guides Pass 2 but estimated_technique_count is
    // intentionally NOT passed — it must never cap the extraction.
    const extractionGuidance = contentIntelligence.extraction_notes || '';

    // ── 3. Pass 2 — Deep Extraction (Sonnet) ──────────────────────────────
    log('Pass 2: Deep Extraction (Sonnet — up to 5 minutes)...');

    const pass2Resp = await callClaude(anthropic, {
      model:     MODEL_SONNET,
      system:    PASS2_SYSTEM,
      user:      [
        `Video: "${videoTitle}" by ${channelName}`,
        extractionGuidance ? `\nExtraction guidance: ${extractionGuidance}` : '',
        `\nTranscript:\n${transcript}`,
      ].join(''),
      maxTokens: 16000,
      timeoutMs: SONNET_TIMEOUT_MS,
    });

    const pass2Cost =
      (pass2Resp.usage.input_tokens  / 1_000_000 * COST_SONNET_IN_PER_M) +
      (pass2Resp.usage.output_tokens / 1_000_000 * COST_SONNET_OUT_PER_M);
    totalCost += pass2Cost;

    let rawEntries;
    try {
      rawEntries = parseClaudeJSON(pass2Resp.content[0]?.text ?? '[]', 'Pass 2');
      if (!Array.isArray(rawEntries)) throw new Error('Response is not a JSON array');
    } catch (e) {
      throw new Error(`Pass 2 extraction failed: ${e.message}`);
    }

    log(`  Extracted ${rawEntries.length} raw entries ($${pass2Cost.toFixed(4)})`);

    // ── 4. Validate required fields ────────────────────────────────────────
    const validatedEntries = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const entry  = rawEntries[i];
      const errors = validateEntry(entry);
      if (errors.length > 0) {
        const msg = `[${videoTitle}] Entry ${i + 1} ("${entry.technique_name || 'unnamed'}") skipped — ${errors.join('; ')}`;
        writeWarning(msg);
        log(`  ⚠️  Skipped entry ${i + 1}: ${errors.join('; ')}`);
      } else {
        validatedEntries.push(entry);
      }
    }

    log(`  ${validatedEntries.length}/${rawEntries.length} entries passed validation`);

    // ── 5. Pass 3 — Quality Gate (Haiku) ──────────────────────────────────
    log(`Pass 3: Quality Gate (${validatedEntries.length} entries)...`);

    const qualifiedEntries = [];
    let pass3InputTokens  = 0;
    let pass3OutputTokens = 0;

    for (let i = 0; i < validatedEntries.length; i++) {
      const entry = validatedEntries[i];

      // Trigger count floor — auto-discard before even calling Haiku
      const triggerCount = countTriggers(entry.prospect_triggers);
      if (triggerCount < MIN_TRIGGER_COUNT) {
        const msg = `[${videoTitle}] Entry "${entry.technique_name}" auto-discarded — only ${triggerCount} triggers (minimum ${MIN_TRIGGER_COUNT})`;
        writeWarning(msg);
        log(`  ⚠️  Auto-discarded "${entry.technique_name}" — ${triggerCount} triggers < ${MIN_TRIGGER_COUNT}`);
        continue;
      }

      // Haiku quality score
      let scoreResp;
      try {
        scoreResp = await callClaude(anthropic, {
          model:    MODEL_HAIKU,
          system:   PASS3_SYSTEM,
          user:     JSON.stringify({
            technique_name:    entry.technique_name,
            call_stage:        entry.call_stage,
            situation:         entry.situation,
            prospect_triggers: entry.prospect_triggers,
            exact_script:      entry.exact_script,
            why_it_works:      entry.why_it_works,
          }),
          maxTokens: 128,
          timeoutMs: HAIKU_TIMEOUT_MS,
        });
      } catch (e) {
        writeWarning(`[${videoTitle}] Pass 3 call failed for "${entry.technique_name}": ${e.message} — defaulting to medium`);
        qualifiedEntries.push({ ...entry, quality_score: 'medium' });
        continue;
      }

      pass3InputTokens  += scoreResp.usage.input_tokens;
      pass3OutputTokens += scoreResp.usage.output_tokens;

      let scoreResult;
      try {
        scoreResult = parseClaudeJSON(scoreResp.content[0]?.text ?? '{}', 'Pass 3');
      } catch (_) {
        // Parse failure → default to medium, don't discard
        qualifiedEntries.push({ ...entry, quality_score: 'medium' });
        continue;
      }

      const quality = scoreResult.quality_score;
      if (!VALID_QUALITY.has(quality)) {
        qualifiedEntries.push({ ...entry, quality_score: 'medium' });
        continue;
      }

      if (quality === 'low') {
        const msg = `[${videoTitle}] Entry "${entry.technique_name}" scored low — discarded. Reason: ${scoreResult.reason}`;
        writeWarning(msg);
      } else {
        qualifiedEntries.push({ ...entry, quality_score: quality });
      }

      if ((i + 1) % 10 === 0) log(`  Scored ${i + 1}/${validatedEntries.length}...`);
    }

    const pass3Cost =
      (pass3InputTokens  / 1_000_000 * COST_HAIKU_IN_PER_M) +
      (pass3OutputTokens / 1_000_000 * COST_HAIKU_OUT_PER_M);
    totalCost += pass3Cost;

    log(`  ${qualifiedEntries.length}/${validatedEntries.length} entries passed quality gate ($${pass3Cost.toFixed(4)})`);

    // Warn loudly if everything was discarded
    if (qualifiedEntries.length === 0 && rawEntries.length > 0) {
      const warning = `[${videoTitle}] ALL entries discarded — review video quality or extraction prompt`;
      writeWarning(warning);
      log(`  ⚠️  WARNING: All entries discarded for this video`);
      await supabase
        .from('kb_sources')
        .update({ error_message: 'All entries discarded — review video or prompts' })
        .eq('id', sourceId);
    }

    // ── 6. Dual-vector embeddings (batched) ────────────────────────────────
    log(`Generating dual embeddings (${qualifiedEntries.length * 2} vectors in one API call)...`);

    const rows = [];

    if (qualifiedEntries.length > 0) {
      // Build parallel arrays: [prospectText0, techniqueText0, prospectText1, techniqueText1, ...]
      // Index mapping: entry i → prospectTexts[i*2], techniqueTexts[i*2+1]
      const embeddingInputs = [];
      for (const entry of qualifiedEntries) {
        embeddingInputs.push(entry.prospect_triggers);                                               // [i*2]
        embeddingInputs.push(`${entry.situation} ${entry.technique_name} ${entry.why_it_works}`);   // [i*2+1]
      }

      let embedResp;
      try {
        embedResp = await openai.embeddings.create({
          model: MODEL_EMBEDDING,
          input: embeddingInputs,
        });
      } catch (e) {
        throw new Error(`Embedding API call failed: ${e.message}`);
      }

      // embedResp.data is ordered by input index (OpenAI guarantee)
      const embedData = embedResp.data;
      const embedCost = (embedResp.usage?.total_tokens ?? 0) / 1_000_000 * COST_EMBED_PER_M;
      totalCost += embedCost;

      log(`  Embeddings complete ($${embedCost.toFixed(5)})`);

      for (let i = 0; i < qualifiedEntries.length; i++) {
        const entry              = qualifiedEntries[i];
        const prospectEmbedding  = embedData[i * 2]?.embedding;
        const techniqueEmbedding = embedData[i * 2 + 1]?.embedding;

        // Atomic: both must succeed — skip entry if either is missing
        if (!prospectEmbedding || !techniqueEmbedding) {
          const msg = `[${videoTitle}] Entry "${entry.technique_name}" skipped — missing embedding (index ${i})`;
          writeWarning(msg);
          log(`  ⚠️  Skipped "${entry.technique_name}" — embedding missing`);
          continue;
        }

        rows.push({
          source_id:           sourceId,
          // Legacy columns (kept for backward compat with existing queries)
          category:            entry.call_stage || 'Uncategorized',
          trigger_phrase:      (entry.prospect_triggers || '').split('\n').filter(Boolean)[0] || '',
          full_detail:         entry.exact_script || '',
          // New v2 columns
          technique_name:      entry.technique_name,
          call_stage:          entry.call_stage,
          situation:           entry.situation,
          prospect_triggers:   entry.prospect_triggers,
          exact_script:        entry.exact_script,
          why_it_works:        entry.why_it_works || null,
          content_type:        contentIntelligence.content_type || null,
          quality_score:       entry.quality_score,
          coach_name:          entry.coach_name || channelName,
          trigger_speaker:     'prospect',
          // Embeddings
          technique_embedding: techniqueEmbedding,
          prospect_embedding:  prospectEmbedding,
        });
      }
    }

    // ── 7. Delete existing entries for this source ─────────────────────────
    // Delete happens HERE (after successful extraction) — not at the start.
    // If extraction failed earlier, old entries are still alive. Only delete
    // when we know we have good replacement data (or intentionally zero).
    log(`Replacing existing entries for this source...`);
    const { error: delErr } = await supabase
      .from('kb_entries')
      .delete()
      .eq('source_id', sourceId);

    if (delErr) throw new Error(`Failed to delete existing entries: ${delErr.message}`);

    // ── 8. Insert new entries ──────────────────────────────────────────────
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('kb_entries').insert(rows);
      if (insErr) throw new Error(`Entry insert failed: ${insErr.message}`);
    }

    // ── 9. Update source record ────────────────────────────────────────────
    const { error: upErr } = await supabase
      .from('kb_sources')
      .update({
        status:          'complete',
        entry_count:     rows.length,
        processing_cost: totalCost,
        processed_at:    new Date().toISOString(),
        // Preserve any existing error_message warnings from Pass 1/3 — don't clear them
      })
      .eq('id', sourceId);

    if (upErr) throw new Error(`Source update failed: ${upErr.message}`);

    log(`✅ Done — ${rows.length} entries stored. Total cost: $${totalCost.toFixed(4)}`);

    return {
      success:         true,
      videoTitle,
      entryCount:      rows.length,
      durationSeconds,
      cost:            totalCost,
    };

  } catch (err) {
    console.error(`[ingestVideo] Error (${url}):`, err.message);
    writeWarning(`[FAILED] ${url} — ${err.message}`);

    if (sourceId) {
      try {
        await supabase
          .from('kb_sources')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', sourceId);
      } catch (_) {}
    }

    throw err;

  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch: runBatchIngest (CLI only)
// ─────────────────────────────────────────────────────────────────────────────

async function runBatchIngest({ force = false } = {}) {
  const { supabase, anthropic, openai } = getClients();

  console.log('\n🛠  Wingman KB Ingestion v2');
  console.log('─────────────────────────────────────────');

  // ── Step 1: Reset any stuck 'processing' sources ──────────────────────────
  const { data: stuckSources } = await supabase
    .from('kb_sources')
    .select('id, video_title')
    .eq('status', 'processing');

  if (stuckSources?.length > 0) {
    console.log(`⚠️  Found ${stuckSources.length} source(s) stuck in 'processing' — resetting to 'failed'`);
    await supabase
      .from('kb_sources')
      .update({ status: 'failed', error_message: 'Reset on startup — previous run likely crashed' })
      .eq('status', 'processing');
  }

  // ── Step 2: Validate API keys before spending anything ────────────────────
  console.log('\n🔑 Validating API keys...');
  try {
    await openai.embeddings.create({ model: MODEL_EMBEDDING, input: 'test' });
    console.log('  ✅ OpenAI');
  } catch (e) {
    console.error('  ❌ OpenAI API key invalid or unavailable:', e.message);
    process.exit(1);
  }
  try {
    await anthropic.messages.create({
      model: MODEL_HAIKU, max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    });
    console.log('  ✅ Anthropic');
  } catch (e) {
    console.error('  ❌ Anthropic API key invalid or unavailable:', e.message);
    process.exit(1);
  }

  // ── Step 3: Fetch sources ─────────────────────────────────────────────────
  let query = supabase.from('kb_sources').select('*').order('created_at', { ascending: true });
  if (!force) query = query.neq('status', 'complete');

  const { data: sources, error: srcErr } = await query;
  if (srcErr) { console.error('Failed to fetch sources:', srcErr.message); process.exit(1); }
  if (!sources || sources.length === 0) {
    console.log('\nNo sources to process. Use --force to re-ingest completed sources.');
    process.exit(0);
  }

  // ── Step 4: Cost estimate + y/n confirmation ──────────────────────────────
  // Check which sources have cached transcripts
  if (!fs.existsSync(TRANSCRIPT_CACHE_DIR)) fs.mkdirSync(TRANSCRIPT_CACHE_DIR, { recursive: true });
  const cachedIds = new Set(
    fs.readdirSync(TRANSCRIPT_CACHE_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace('.txt', ''))
  );

  // Estimate Whisper cost only for sources without cached transcripts
  // (video ID isn't directly on kb_sources, so we check by matching youtube_url patterns)
  const uncachedCount = sources.filter(s => {
    const match = s.youtube_url.match(/[?&]v=([^&]+)|youtu\.be\/([^?]+)/);
    const videoId = match ? (match[1] || match[2]) : null;
    return videoId ? !cachedIds.has(videoId) : true;
  }).length;

  const totalDurationMins = sources.reduce((sum, s) => sum + (s.duration_seconds || 0) / 60, 0);
  const estWhisper  = uncachedCount > 0 ? (totalDurationMins * COST_WHISPER_PER_MIN) : 0;
  const estPass1    = sources.length * 0.008;  // Haiku is cheap
  const estPass2    = sources.length * 0.35;   // Sonnet — biggest cost
  const estPass3    = sources.length * 0.015;
  const estEmbed    = sources.length * 0.001;
  const estTotal    = estWhisper + estPass1 + estPass2 + estPass3 + estEmbed;

  console.log(`\n📦 ${sources.length} sources to process (${uncachedCount} need Whisper, ${sources.length - uncachedCount} use cached transcripts)`);
  console.log('\n💰 Estimated cost:');
  console.log(`   Whisper transcription:   $${estWhisper.toFixed(2)}  (${uncachedCount} uncached sources)`);
  console.log(`   Pass 1 — Haiku classify: $${estPass1.toFixed(2)}`);
  console.log(`   Pass 2 — Sonnet extract: ~$${estPass2.toFixed(2)}`);
  console.log(`   Pass 3 — Haiku quality:  $${estPass3.toFixed(2)}`);
  console.log(`   Embeddings (OpenAI):     $${estEmbed.toFixed(2)}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   Total estimate:          ~$${estTotal.toFixed(2)}`);
  console.log(`   (Actual cost logged per source in Supabase)\n`);

  const answer = await askYN('Proceed? (y/n): ');
  if (answer !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  // ── Step 5: Process each source sequentially ──────────────────────────────
  console.log('\n🚀 Starting ingestion...\n');
  let succeeded = 0;
  let failed    = 0;

  for (const source of sources) {
    const label = source.video_title || source.youtube_url;
    console.log(`\n[${ succeeded + failed + 1 }/${ sources.length }] ${label}`);

    try {
      const result = await ingestVideo(source.youtube_url, (msg) => console.log(`  ${msg}`), { force: true });
      if (result.duplicate) {
        console.log(`  ⏭  Skipped (duplicate)`);
      } else {
        console.log(`  ✅ ${result.entryCount} entries · $${result.cost.toFixed(4)}`);
        succeeded++;
      }
    } catch (e) {
      console.error(`  ❌ Failed: ${e.message}`);
      failed++;
    }
  }

  // ── Step 6: Summary + ivfflat index instructions ──────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Ingestion complete: ${succeeded} succeeded, ${failed} failed`);
  if (failed > 0) {
    console.log(`   Failed sources remain at status='failed' — re-run to retry them`);
  }
  console.log(`\n📋 FINAL STEP — Run this SQL in Supabase SQL Editor:`);
  console.log(`\n   CREATE INDEX ON public.kb_entries`);
  console.log(`     USING ivfflat (prospect_embedding vector_cosine_ops)`);
  console.log(`     WITH (lists = 20);\n`);
  if (fs.existsSync(WARNINGS_LOG)) {
    console.log(`⚠️  Warnings written to: ${WARNINGS_LOG}`);
    console.log(`   Review this file for entries that were skipped or need attention.\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entrypoint
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const force = process.argv.includes('--force');
  runBatchIngest({ force }).catch(e => {
    console.error('\n❌ Fatal error:', e.message);
    process.exit(1);
  });
}

module.exports = { ingestVideo };
