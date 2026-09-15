// Cuts a long video into short clips and files them. Worker box only, under
// nohup (run-cut.sh), never on the dev box or the pipeline box.
//
//   node cut.mjs --meeting 119395 --desk house-ag     # a committee meeting's own video
//   node cut.mjs --job cut_0123456789abcdef           # a reader's upload from clip_cuts
//   options: --video file.mp4 (skip the download)  --publish (skip review)  --limit 12
//
// The pipe: the video (yt-dlp, or the clips bucket for an upload) → an SRT
// (faster-whisper, transcribe.py) → autoclip, which finds, times and scores
// the exchanges on Bedrock through bedrock_shim.py with GovBlock's prompts →
// each chosen exchange rendered 9:16 with its captions burned in (FFmpeg) →
// the clips bucket → a clips row keyed to the hearing.
//
// A clip's title is a sentence copied from the transcript inside it, checked
// word for word; its caption is the meeting's title, committee and date. The
// product writes nothing of its own about what was said.

import { spawn } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { args, CLIPS_BUCKET, env, getFile, logger, newId, putFile, q } from "./lib.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const AUTOCLIP = env("AUTOCLIP_DIR") || join(process.env.HOME, "autoclip")
const PY = env("CLIPS_PYTHON") || join(process.env.HOME, "clips-venv/bin/python")
const SHIM = env("SHIM_URL") || "http://127.0.0.1:8765/v1"
const MODEL = env("SHIM_MODEL") || "us.anthropic.claude-sonnet-4-6"

const a = args()
if (!a.meeting && !a.job) {
  console.error("usage: node cut.mjs --meeting <congress_committee_meetings.key> --desk <desk> | --job <clip_cuts.id>  [--video file] [--publish] [--limit n]")
  process.exit(2)
}

/* ---- the source and its row ---- */

let cut
let meeting = null
if (a.job) {
  cut = (await q(`select * from clip_cuts where id = $1`, [a.job]))[0]
  if (!cut) throw new Error(`no clip_cuts row ${a.job}`)
  if (String(cut.source_url ?? "").startsWith("s3://") && !cut.rights_attested_at) throw new Error(`${a.job} has no rights attestation; not cutting it`)
  if (cut.hearing_key) meeting = (await q(`select key, title, meeting_date, chamber, payload from congress_committee_meetings where key = $1`, [cut.hearing_key]))[0] ?? null
} else {
  if (!a.desk) throw new Error("--desk is required with --meeting")
  meeting = (await q(`select key, title, meeting_date, chamber, payload from congress_committee_meetings where key = $1`, [String(a.meeting)]))[0]
  if (!meeting) throw new Error(`no committee meeting ${a.meeting}`)
  const videos = JSON.parse(meeting.payload || "{}").videos ?? []
  const source = videos.find((v) => /youtube\.com|youtu\.be/.test(v.url))?.url ?? videos[0]?.url
  if (!source && !a.video) throw new Error(`meeting ${a.meeting} lists no video`)
  cut = { id: newId("cut"), source_url: source ?? null, desk: a.desk, owner_id: null, hearing_key: meeting.key, jurisdiction: "us", title: clean(meeting.title) }
  await q(`insert into clip_cuts (id, status, source_url, desk, title, jurisdiction, hearing_key, started_at) values ($1, 'running', $2, $3, $4, 'us', $5, now())`, [cut.id, cut.source_url, cut.desk, cut.title, cut.hearing_key])
}

const WORK = join(HERE, "out", cut.id)
mkdirSync(WORK, { recursive: true })
const LOG = join(WORK, "cut.log")
const log = logger(LOG)
await q(`update clip_cuts set status = 'running', started_at = coalesce(started_at, now()), log = $2 where id = $1`, [cut.id, LOG])
log(`cut ${cut.id}: ${cut.title ?? ""} ${cut.source_url ?? ""}`)

function clean(title) {
  return String(title ?? "").replace(/^"|"$/g, "").trim()
}

/** A child process, its output into the log; resolves with its stdout. */
function run(cmd, argv, opts = {}) {
  log(`$ ${cmd} ${argv.join(" ")}`)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { cwd: opts.cwd, env: { ...process.env, ...(opts.env ?? {}) } })
    const sink = createWriteStream(LOG, { flags: "a" })
    let stdout = ""
    child.stdout.on("data", (d) => {
      stdout += d
      if (!opts.quiet) sink.write(d)
    })
    child.stderr.on("data", (d) => sink.write(d))
    child.on("error", reject)
    child.on("close", (code) => {
      sink.end()
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}`))
    })
  })
}

try {
  /* ---- 1. the video ---- */
  const video = a.video ?? join(WORK, "source.mp4")
  if (!existsSync(video)) {
    const bucket = `s3://${CLIPS_BUCKET}/`
    if (String(cut.source_url ?? "").startsWith(bucket)) {
      log("the upload, from the clips bucket")
      await getFile(cut.source_url.slice(bucket.length), video)
    } else {
      await run("yt-dlp", ["-f", "bv*[height<=720]+ba/b[height<=720]/b", "--merge-output-format", "mp4", "-o", video, cut.source_url])
    }
  }
  log(`video ${video} ${(statSync(video).size / 1e6).toFixed(0)} MB`)

  /* ---- 2. the transcript ---- */
  const srt = join(WORK, "source.srt")
  if (!existsSync(srt)) await run(PY, [join(HERE, "cut/transcribe.py"), video, srt])
  const cues = parseSrt(readFileSync(srt, "utf8"))
  log(`${cues.length} cues`)

  /* ---- 3. autoclip: find, time and score ---- */
  const dataDir = join(WORK, "autoclip")
  const out = await run(
    PY,
    ["-m", "backend.cli", "--data-dir", dataDir, "run", video, "--srt", srt, "--name", cut.id, "--category", "speech", "--provider", "openai", "--base-url", SHIM, "--model", MODEL, "--api-key", "none", "--no-db", "--copy", "--json"],
    { cwd: AUTOCLIP, env: { GOVBLOCK_SHORTS: "1", PYTHONPATH: AUTOCLIP, AUTOCLIP_DATA_DIR: dataDir }, quiet: true }
  )
  const summary = JSON.parse(out.slice(out.indexOf("{")))
  writeFileSync(join(WORK, "autoclip-summary.json"), JSON.stringify(summary, null, 2))
  if (!summary.ok) throw new Error(`autoclip: ${summary.error ?? "failed"}`)
  const limit = Number(a.limit ?? 12)
  const chosen = [...summary.clips].sort((x, y) => (y.score_100 ?? 0) - (x.score_100 ?? 0)).slice(0, limit).sort((x, y) => sec(x.start_time) - sec(y.start_time))
  log(`autoclip chose ${summary.clips.length}; keeping ${chosen.length}`)

  /* ---- 4. each clip: title from its own words, 9:16 with captions, the bucket, a row ---- */
  const when = meeting?.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : ""
  const committee = meeting ? (JSON.parse(meeting.payload || "{}").committees ?? []).map((c) => c.name).filter(Boolean)[0] : null
  const filed = []
  for (const [i, c] of chosen.entries()) {
    const start = sec(c.start_time)
    const end = Math.min(sec(c.end_time), start + 90)
    const inside = cues.filter((cue) => cue.start >= start - 0.5 && cue.end <= end + 0.5)
    const words = inside.map((cue) => cue.text).join(" ")
    const title = await quote(words)
    const caption = [cut.title, committee, when].filter(Boolean).join(", ") + `. ${clock(start)} into the ${meeting ? "hearing" : "video"}.`
    const file = join(WORK, `clip-${String(i + 1).padStart(2, "0")}.mp4`)
    const clipSrt = join(WORK, `clip-${String(i + 1).padStart(2, "0")}.srt`)
    writeFileSync(clipSrt, inside.map((cue, n) => `${n + 1}\n${stamp(cue.start - start)} --> ${stamp(cue.end - start)}\n${cue.text}\n`).join("\n"))
    await run("ffmpeg", [
      "-y", "-ss", String(start), "-to", String(end), "-i", video,
      "-filter_complex",
      `[0:v]split[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=24[bg2];[fg]scale=1080:-2[fg2];[bg2][fg2]overlay=(W-w)/2:(H-h)/2,subtitles='${clipSrt.replace(/'/g, "\\'")}':force_style='FontName=DejaVu Sans,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=70'[v]`,
      "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", file,
    ], { quiet: true })
    const id = newId("clp")
    const posterFile = file.replace(/\.mp4$/, ".jpg")
    await run("ffmpeg", ["-y", "-ss", "1", "-i", file, "-frames:v", "1", "-q:v", "3", posterFile], { quiet: true })
    const videoKey = await putFile(file, `clips/${id}/video.mp4`, "video/mp4")
    const posterKey = await putFile(posterFile, `clips/${id}/poster.jpg`, "image/jpeg")
    const visibility = cut.owner_id ? "private" : "public"
    const status = cut.owner_id || a.publish ? "published" : "review"
    await q(
      `insert into clips (id, video_key, poster_key, origin, status, visibility, desk, owner_id, title, caption, duration, width, height, jurisdiction, hearing_key, cut_id, source_start, source_end, published_at)
       values ($1, $2, $3, 'cut', $4, $5, $6, $7, $8, $9, $10, 1080, 1920, $11, $12, $13, $14, $15, case when $4 = 'published' then now() end)`,
      [id, videoKey, posterKey, status, visibility, cut.desk ?? null, cut.owner_id ?? null, title, caption, end - start, cut.jurisdiction ?? "us", cut.hearing_key ?? null, cut.id, start, end]
    )
    filed.push({ id, videoKey, title, start: clock(start), end: clock(end), score: c.score_100 ?? null, label: c.title })
    log(`filed ${id} ${clock(start)}–${clock(end)} score ${c.score_100 ?? "-"}: ${title}`)
  }

  writeFileSync(join(WORK, "clips.json"), JSON.stringify(filed, null, 2))
  await q(`update clip_cuts set status = $2, clips = $3, finished_at = now() where id = $1`, [cut.id, a.publish || cut.owner_id ? "done" : "review", filed.length])
  log(`done: ${filed.length} clips; ${join(WORK, "clips.json")}`)
} catch (error) {
  log(`failed: ${error?.stack ?? error}`)
  await q(`update clip_cuts set status = 'failed', error = $2, finished_at = now() where id = $1`, [cut.id, String(error?.message ?? error).slice(0, 2000)])
  process.exitCode = 1
}

/* ---- helpers ---- */

function sec(t) {
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(String(t))
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000 : Number(t) || 0
}
function stamp(s) {
  s = Math.max(0, s)
  const ms = Math.round(s * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`
}
function clock(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  const r = String(Math.floor(s % 60)).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`
}
function parseSrt(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.trim().split(/\r?\n/)
      const times = lines.find((l) => l.includes("-->"))
      if (!times) return null
      const [s, e] = times.split("-->").map((x) => sec(x.trim()))
      return { start: s, end: e, text: lines.slice(lines.indexOf(times) + 1).join(" ").trim() }
    })
    .filter((c) => c && c.text)
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * One sentence from the clip's own transcript to stand as its title. The
 * model only chooses; the choice is kept only if it is found in the
 * transcript word for word, else the first full sentence of six words or
 * more is used.
 */
async function quote(words) {
  const sentences = (words.match(/[^.!?]+[.!?]+/g) ?? [words]).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 6)
  const fallback = (sentences[0] ?? words.split(/\s+/).slice(0, 18).join(" ")).slice(0, 150)
  try {
    const res = await fetch(`${SHIM}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0,
        messages: [
          { role: "system", content: "You pick one sentence from a hearing transcript to label a short clip. Copy it exactly, character for character. Add nothing, remove nothing, no quotation marks, no commentary." },
          { role: "user", content: `Transcript of the clip:\n\n${words}\n\nReturn the single sentence, copied exactly, that best says what this clip is about on its own. Prefer a sentence with a specific figure, bill, commitment or answer. Under 150 characters.` },
        ],
      }),
    }).then((r) => r.json())
    const pick = String(res.choices?.[0]?.message?.content ?? "").trim().replace(/^["“]|["”]$/g, "")
    if (pick && pick.length <= 150 && norm(words).includes(norm(pick)) && norm(pick).split(" ").length >= 5) return pick
    log(`title not found verbatim, using the first sentence: ${pick.slice(0, 80)}`)
  } catch (error) {
    log(`title pick failed (${error.message}); using the first sentence`)
  }
  return fallback
}
