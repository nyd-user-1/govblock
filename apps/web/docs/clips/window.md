# Clips window

Branch `feature/clips`, cut from `main` at 5a416aa. Brief:
`docs/prompts/2026-09-14-clips.md` (on `feature/legislative-xml`). Newest
milestone first.

---

## 0 · Plan, licences, and the table before it runs — 2026-09-14

> **Key takeaways**
>
> - autoclip is MIT, free with one condition (keep the notice). Its prompts
>   are Chinese and written to make titles go viral, so the cut keeps
>   autoclip's transcript, scoring and ffmpeg and replaces every prompt; a
>   cut clip's title is a sentence copied verbatim from the hearing,
>   checked against the transcript.
> - Remotion is free only for a company of three or fewer, contractors
>   counted. Above that, server rendering is **Remotion for Automators:
>   $0.01 a render, $100 a month minimum** (10,000 renders). Player
>   previews are not renders. The render server waits for the lead's word.
> - `/api/stream` has no auth check. Anyone on the internet can POST
>   `delete-video` to it today, and once reader clips are in Stream that is
>   every clip. Flagged to the lead; not changed by this window unasked.

### 1. autoclip licence

[zhouxiaoka/autoclip](https://github.com/zhouxiaoka/autoclip), 7,319 stars,
last push 2026-09-08. Licence file, verbatim:

```
MIT License

Copyright (c) 2024 AutoClip Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Cost: none. Compatible with GovBlock's AGPL-3.0: autoclip runs as a separate
program on the worker box and none of its code enters this repo; the prompts
that replace its own are GovBlock's and live under `scripts/clips/`. What it
pulls in on the box: yt-dlp (Unlicense), faster-whisper (MIT), Whisper
weights (MIT), FFmpeg (LGPL/GPL, run as a binary), FastAPI, Celery,
SQLAlchemy (MIT/BSD).

What reading it turned up:

- **Language model.** Defaults to Alibaba's Qwen through DashScope; also
  OpenAI, Gemini, SiliconFlow, or any OpenAI-compatible address. The cut
  points it at a small local shim on the worker box that forwards to Bedrock
  (Claude Sonnet 4.6) under the box's instance role, so no key is handed to
  autoclip at all. That matters: its DashScope provider logs the API key in
  plain text (`llm_providers.py`, "实际使用的API key").
- **Prompts.** Five per content category (outline, timeline, scoring,
  title, clustering), all in Chinese, and the title prompts ask for
  "爆笑吐槽", "独家揭秘" — viral hooks. None of that meets the Reporter's
  voice. They are replaced with English prompts that keep autoclip's JSON
  shapes, and the title a reader sees is a sentence from the transcript,
  rejected and replaced by the segment's first sentence if it is not found
  there word for word.
- **Headless.** `backend/cli.py` runs the whole pipe without the web app:
  `autoclip run <video> [--srt] --provider openai --base-url … --json`, then
  `autoclip export <project> --preset shorts` for 9:16 with captions burned
  in. No Redis or Celery needed on that path.
- **Download.** Hearings come from YouTube (2,292 of 2,681 committee
  meetings in Aurora carry a video). YouTube often refuses datacenter
  addresses; if the worker box is refused, the source is fetched from the
  Mac and copied up.

### 2. Remotion licence and price

[remotion-dev/remotion](https://github.com/remotion-dev/remotion), 59,197
stars, npm `remotion@4.0.524`. Source-available under its own licence
(GitHub shows NOASSERTION). Terms, verbatim from `LICENSE.md`:

> You are eligible to use Remotion for free if you are: an individual; a
> for-profit organization with up to 3 employees; a non-profit or
> not-for-profit organization; evaluating whether Remotion is a good fit,
> and are not yet using it in a commercial way.
>
> You are required to obtain a Company License to use Remotion if you are
> not within the group of entities eligible for a Free License.
>
> It is not allowed to copy or modify Remotion code for the purpose of
> selling, renting, licensing, relicensing, or sublicensing your own
> derivate of Remotion.

Remotion 5.0 (PR #3750, open) adds that **contractors count toward the
team size** and binds the Company License to remotion.pro/terms.

Prices, from remotion.pro/license:

| Plan | Price | For |
|---|---|---|
| Free | $0 | three people or fewer, non-profits, evaluation |
| Creators | $25 a seat a month | people making videos in the Studio |
| **Automators** | **$0.01 a render, $100 a month minimum** (10,000 renders) | apps and servers that render; developers on automation need no seat |
| Enterprise | from $500 a month | support, custom terms |

"1 Render is the successful generation of a video, audio, GIF, PDF or still
image. Previews in the Remotion Studio or Remotion Player do not count as
Renders."

**What GovBlock needs:** templates rendered on a server for desks and
creators is the Automators plan. If GovBlock counts three people or fewer
with contractors, it is free; if four or more, $100 a month from the first
production render, $1,200 a year, rising a cent a render past 10,000 a month.
The `<Player>` preview is built under the evaluation clause; the single
render on the worker box waits for the lead to carry this to Brendan.

### 3. Findings outside the brief

- **`/api/stream` is open.** `app/api/stream/route.ts` has no session or
  admin check, and the app has no proxy in front of it. GET lists the library and every
  live input's RTMPS key; POST copies, creates live inputs, and deletes
  videos. Recommended: admin-only (`reader_profiles.admin`) before the first
  reader clip lands in Stream. The clips routes this window adds carry
  their own checks and do not go through it.

### 4. Plan, in the brief's order

1. **Record to Stream.** `lib/policy/cloudflare-stream.ts` gains a tus
   direct creator upload (one path for a 60-second take and a two-hour
   upload), signed playback tokens, and a creator filter. New
   `app/api/clips/` routes: GET the feed (published rows, and the reader's
   own), POST a new upload (signed in only; returns the one-time Stream URL
   and the clip id), PATCH visibility and title, DELETE. `saveClip` PUTs the
   take to Stream and writes the row; `loadMine` reads the reader's rows
   back with Stream's state. A private clip is `requireSignedURLs` and plays
   through a short-lived token. Playback is Stream's MP4, so the feed's own
   `<video>` stays as it is.
2. **Remotion: a roll call as a tally.** `remotion` and `@remotion/player`
   pinned to 4.0.524. One composition, 1080×1920, fed by a roll call's id
   through `getRollCallVote`: the question, the bill, yea against nay
   filling, party by party, the result. Words come only from the vote row.
   Previewed in a Generate panel beside Record on a real roll call (House
   roll 295, 119th Congress, 2nd session, H.R. 4795, 237–169). Then, with
   the lead's go, rendered once on the worker box, uploaded to Stream, and
   filed under the GovBlock desk.
3. **Cut a hearing.** A worker box, `govblock-clips-worker` (c7i.4xlarge,
   16 vCPU, 32 GB, $0.714 an hour, instance profile `govblock-dev`, stops
   itself when the job ends): autoclip, faster-whisper, FFmpeg, the Bedrock
   shim, the English prompts. `scripts/clips/cut.mjs` takes a committee
   meeting's key, fetches its video, runs autoclip under nohup with a log,
   uploads each clip to Stream, and writes rows in `review` under the
   jurisdiction's desk, keyed to the hearing. The report shows them; they
   are published only after that. Estimate for a two-hour hearing: an hour
   of box time and about $1 of Bedrock.
4. **Upload behind the rights checkbox.** Upload beside Record. A file,
   a title, and "I have the right to post this video" (unticked, required),
   then a tus upload to Stream and a `clip_cuts` row the table refuses
   without the attestation. The mock's "Choose a video" in the camera goes
   to this path, so no upload skips it. First, Report on every clip's menu
   (copyright, privacy, harmful, other; details; an email) into
   `clip_reports`, and Take down for an admin.

Review server: `~/govblock-clips` on the dev box, port 3003.

### 5. Table, announced before it runs

`sql/020_clips.sql`, additive: `clips`, `clip_cuts`, `clip_reports`, and
their indexes; `create … if not exists` throughout, no foreign keys into
the loaders' tables, nothing altered or dropped. It runs on Aurora
(`policy`) at the start of milestone 1.

### 6. Open, for the lead

- The hearing Brendan names for the first cut. Offered: House Agriculture,
  "To Review the Implementation of Farm Safety Net, Disaster, and
  Conservation Programs", 2026-06-24, meeting 119395,
  youtube.com/watch?v=WNx8cqv3-jk, under the House Agriculture desk.
- Launching `govblock-clips-worker` (about $0.71 an hour while on, $4.80 a
  month of disk while stopped).
- The Remotion licence and GovBlock's headcount, before the render.
- `/api/stream`: admin-only, by this window or another.
- The stock Mixkit clips and committee Shorts stay in the feed beside the
  real ones until Brendan says otherwise.
