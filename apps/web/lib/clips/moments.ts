import "server-only"

import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime"

import { bedrock } from "@/lib/agents/bedrock"
import { MODELS } from "@/lib/agents/models"
import type { Segment, Transcript } from "@/lib/clips/youtube"

// The cut without a machine (2026-09-14): a video's transcript goes to Claude
// Haiku on Bedrock, on the site's own account, which picks the moments that
// stand on their own; each comes back as a start, an end, a title and a
// caption, snapped to where the captions begin and end. Haiku because the
// host cuts a request off at thirty seconds and a three-hour hearing is still
// only about forty thousand tokens to read.

export type Moment = { start: number; end: number; title: string; caption: string }

const MAX_CHARS = 160_000

/** Cut at a word, not through one. */
const clip = (text: string, max: number) => {
  const t = String(text).trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).replace(/[\s,;:–—-]+$/, "")
}

const SYSTEM = `You cut long public videos (congressional hearings, floor speeches, press conferences, interviews) into short clips for a civic video feed.

Read the transcript and pick the moments that stand on their own for a viewer who has not seen the rest: a pointed question and its answer, a clear claim with a number in it, a sharp exchange, a vote or a decision announced, a plain explanation of what a bill does.

Rules:
- Pick between 3 and 6 moments; fewer if the video is short or has little that stands alone.
- Each moment runs 20 to 90 seconds, starts at the beginning of a sentence and ends at the end of one. Moments never overlap.
- Times are seconds from the start, taken from the [seconds] marks in the transcript.
- The title (at most 80 characters) says what is said or done, naming the speaker when the transcript makes it clear. It is not an opinion about it, and it adds nothing the transcript does not say.
- The caption (at most 200 characters) is one sentence of context drawn only from the transcript.
- Write in the third person. Never write "I" or "we".

Answer only by calling the clips tool.`

/** The transcript as lines of about fifteen seconds, each led by its start in whole seconds. */
function lines(segments: Segment[]) {
  const out: string[] = []
  let at = -1
  let buf: string[] = []
  for (const s of segments) {
    if (at < 0) at = s.start
    buf.push(s.text)
    if (s.end - at >= 15) {
      out.push(`[${Math.floor(at)}] ${buf.join(" ")}`)
      at = -1
      buf = []
    }
  }
  if (buf.length) out.push(`[${Math.floor(at)}] ${buf.join(" ")}`)
  let text = out.join("\n")
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n[the transcript continues past this point]`
  return text
}

/** A time moved to the nearest caption boundary: a start back to where a caption begins, an end on to where one ends. */
function snap(segments: Segment[], start: number, end: number) {
  const begins = segments.filter((s) => s.start <= start + 0.5)
  const s = begins.length ? begins[begins.length - 1].start : segments[0].start
  const ends = segments.find((x) => x.end >= end - 0.5)
  const e = ends ? ends.end : segments[segments.length - 1].end
  return { start: Math.max(0, Math.round(s * 10) / 10), end: Math.round(e * 10) / 10 }
}

export async function pickMoments(transcript: Transcript): Promise<Moment[]> {
  const res = await bedrock().send(
    new ConverseCommand({
      modelId: MODELS.routing.id,
      system: [{ text: SYSTEM }],
      messages: [{ role: "user", content: [{ text: `Title: ${transcript.title ?? "unknown"}\nChannel: ${transcript.channel ?? "unknown"}\nLength: ${Math.round(transcript.duration)} seconds\n\nTranscript:\n${lines(transcript.segments)}` }] }],
      inferenceConfig: { maxTokens: 1500, temperature: 0.2 },
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "clips",
              description: "The moments to cut, in order.",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    clips: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { start: { type: "number" }, end: { type: "number" }, title: { type: "string" }, caption: { type: "string" } },
                        required: ["start", "end", "title", "caption"],
                      },
                    },
                  },
                  required: ["clips"],
                },
              },
            },
          },
        ],
        toolChoice: { tool: { name: "clips" } },
      },
    })
  )
  const block = res.output?.message?.content?.find((c) => c.toolUse)
  const picked = ((block?.toolUse?.input as { clips?: Moment[] } | undefined)?.clips ?? []).filter((m) => Number.isFinite(m.start) && Number.isFinite(m.end) && m.end > m.start)
  const moments: Moment[] = []
  for (const m of picked.sort((a, b) => a.start - b.start)) {
    const t = snap(transcript.segments, m.start, m.end)
    if (t.end - t.start < 8 || t.end - t.start > 150) continue
    if (moments.length && t.start < moments[moments.length - 1].end) continue
    moments.push({ ...t, title: clip(m.title, 80), caption: clip(m.caption, 200) })
  }
  return moments
}
