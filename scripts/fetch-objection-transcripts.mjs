/**
 * fetch-objection-transcripts.mjs — pull YouTube transcripts for the objection-
 * handling prompt build (Cole Gordon + Matthew Ryder). Auto-captions via yt-dlp
 * (free, no Whisper). Cleans the rolling-caption duplication into plain text.
 *
 *   node scripts/fetch-objection-transcripts.mjs                  # original 7 training vids
 *   node scripts/fetch-objection-transcripts.mjs <url> <url> ...  # live-call vids → live-calls/ subfolder
 *
 * Output: knowledge-base/objection-transcripts/<name>.txt (+ raw .vtt kept).
 * Pass YouTube URLs as args to pull LIVE-CALL footage into a separate live-calls/
 * subfolder (kept distinct from the training theory). If a video's auto-captions
 * are too messy, we Whisper that one later (knowledge-base/ingest.js path).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

// URLs passed as CLI args → LIVE-CALL mode (own subfolder). No args → re-fetch the
// original 7 training videos.
const argUrls = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));

function videoId(url) {
  const m = url.match(/[?&]v=([\w-]{6,})/) || url.match(/youtu\.be\/([\w-]{6,})/) || url.match(/\/shorts\/([\w-]{6,})/);
  return m ? m[1] : "vid-" + Math.abs([...url].reduce((h, c) => ((h * 31 + c.charCodeAt(0)) | 0), 7)).toString(36);
}

const OUT = argUrls.length
  ? "knowledge-base/objection-transcripts/live-calls"
  : "knowledge-base/objection-transcripts";
mkdirSync(OUT, { recursive: true });

const videos = argUrls.length
  ? argUrls.map((u) => [`live-${videoId(u)}`, u])
  : [
      ["cole-2step-handle-any",   "https://www.youtube.com/watch?v=U19e-locAvE"],
      ["cole-too-expensive",      "https://www.youtube.com/watch?v=6xHG6MUJDXY"],
      ["cole-55min",              "https://www.youtube.com/watch?v=vgZrDvLcPIQ"],
      ["cole-masterclass-GOLD",   "https://www.youtube.com/watch?v=kKKm7lEpEaE"],
      ["ryder-only-video-need",   "https://www.youtube.com/watch?v=iWMlJTPAZWo"],
      ["ryder-1hr11",             "https://www.youtube.com/watch?v=Bdop7wlNN1s"],
      ["ryder-24min",             "https://www.youtube.com/watch?v=PjA-heFxMWg"],
    ];

function cleanVtt(vtt) {
  const out = [];
  let last = "";
  for (let raw of vtt.split("\n")) {
    if (/-->/.test(raw)) continue;
    if (/^WEBVTT|^Kind:|^Language:|^\s*$|^\d+$/.test(raw)) continue;
    const ln = raw.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\[[^\]]*\]/g, "").trim();
    if (!ln || ln === last) continue;
    // YouTube auto-subs repeat each line as it scrolls — skip if the previous
    // line already ends with / contains this fragment.
    if (last && (last.endsWith(ln) || last.includes(ln))) continue;
    out.push(ln);
    last = ln;
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

for (const [name, url] of videos) {
  try {
    console.log(`\n=== ${name} ===`);
    execSync(
      `yt-dlp --write-auto-sub --write-sub --sub-lang "en.*" --sub-format vtt ` +
      `--skip-download --no-warnings -o "${OUT}/${name}.%(ext)s" "${url}"`,
      { stdio: "inherit" },
    );
    const f = readdirSync(OUT).find((x) => x.startsWith(name) && x.endsWith(".vtt"));
    if (!f) { console.log(`  ${name}: NO vtt produced`); continue; }
    const text = cleanVtt(readFileSync(join(OUT, f), "utf8"));
    writeFileSync(join(OUT, `${name}.txt`), text);
    console.log(`  ${name}: ${text.length} chars → ${name}.txt`);
  } catch (e) {
    console.log(`  ${name} FAILED: ${e.message}`);
  }
}
console.log("\nDone.");
