'use strict';

/**
 * Wingman Knowledge Base — Ingestion Server
 * Runs locally at http://localhost:3333/
 * Auto-started on Mac boot via launchd (see launchd/com.wingman.knowledgebase.plist)
 *
 * Routes:
 *   GET  /              — Ingestion dashboard (static HTML)
 *   GET  /api/stats     — Stats for the dashboard (totals + cost)
 *   GET  /api/videos    — All processed videos
 *   POST /api/ingest    — Submit a URL, returns { jobId }
 *   GET  /api/ingest/stream/:jobId  — SSE progress stream for a job
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const express  = require('express');
const path     = require('path');
const { v4: uuidv4 }  = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { ingestVideo }  = require('./ingest');

const app  = express();
const PORT = process.env.KB_SERVER_PORT || 3333;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory job queue ───────────────────────────────────────────────────────
// Multiple URLs can be submitted back-to-back. Each gets a jobId.
// One job processes at a time; the rest wait in the queue.

const queue      = [];    // { jobId, url }[]
const streams    = {};    // jobId → active SSE response object
const jobHistory = {};    // jobId → { url, status, events: [] }
let processing   = false;

/** Send an SSE event to a connected stream and cache it in history. */
function sse(jobId, event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  if (streams[jobId]) streams[jobId].write(line);
  if (jobHistory[jobId]) jobHistory[jobId].events.push(event);
}

/** Pull the next job from the queue and process it. */
async function runNext() {
  if (processing || queue.length === 0) return;
  processing = true;

  const { jobId, url } = queue.shift();
  console.log(`[Queue] Processing job ${jobId.slice(0, 8)} — ${url}`);

  try {
    const result = await ingestVideo(url, (msg) => {
      console.log(`  [${jobId.slice(0, 8)}] ${msg}`);
      sse(jobId, { type: 'progress', message: msg });
    });

    if (result.duplicate) {
      sse(jobId, { type: 'duplicate', message: result.message });
      jobHistory[jobId].status = 'duplicate';
    } else {
      sse(jobId, {
        type:    'complete',
        message: `Done! ${result.entryCount} entries extracted. Cost: $${result.cost.toFixed(4)}`,
      });
      jobHistory[jobId].status = 'complete';
    }
  } catch (err) {
    console.error(`[Queue] Job ${jobId.slice(0, 8)} failed:`, err.message);
    sse(jobId, { type: 'error', message: err.message });
    jobHistory[jobId].status = 'failed';
  } finally {
    processing = false;
    // Close the SSE stream after a short delay so the client receives the final event
    setTimeout(() => {
      if (streams[jobId]) { streams[jobId].end(); delete streams[jobId]; }
    }, 2000);
    setImmediate(runNext);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Stats dashboard numbers
app.get('/api/stats', async (_req, res) => {
  try {
    const { data: sources } = await supabase
      .from('kb_sources')
      .select('duration_seconds, processing_cost')
      .eq('status', 'complete');

    const { count: entryCount } = await supabase
      .from('kb_entries')
      .select('*', { count: 'exact', head: true });

    const totalVideos  = sources?.length ?? 0;
    const totalHours   = (sources?.reduce((s, r) => s + (r.duration_seconds || 0), 0) ?? 0) / 3600;
    const totalCost    = sources?.reduce((s, r) => s + Number(r.processing_cost || 0), 0) ?? 0;

    res.json({
      totalVideos,
      totalHours:   totalHours.toFixed(1),
      totalEntries: entryCount ?? 0,
      totalCost:    totalCost.toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All processed videos for the table
app.get('/api/videos', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('kb_sources')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a YouTube URL for ingestion
app.post('/api/ingest', (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' });

  const jobId = uuidv4();
  jobHistory[jobId] = { url: url.trim(), status: 'queued', events: [] };
  queue.push({ jobId, url: url.trim() });

  res.json({ jobId, queuePosition: queue.length });
  runNext();
});

// SSE stream — client subscribes to this immediately after posting a URL
app.get('/api/ingest/stream/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const history = jobHistory[jobId];
  if (history) {
    // Replay any events that already fired (handles slow SSE connections)
    for (const evt of history.events) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    }
    if (['complete', 'failed', 'duplicate'].includes(history.status)) {
      return res.end();
    }
  }

  streams[jobId] = res;
  req.on('close', () => delete streams[jobId]);
});

app.listen(PORT, () => {
  console.log(`\nWingman Knowledge Base\n→ http://localhost:${PORT}/\n`);
});
