# Clips window

Branch `feature/clips`, cut from `main` at 5a416aa. Brief:
`docs/prompts/2026-09-14-clips.md` (on `feature/legislative-xml`). Newest
milestone first.

---

## 7 · Studio as the customizer, a gallery of eight, the GovBlock mark — 2026-09-14 night

Brendan: open Studio on a 2 × 4 gallery of prepared templates; drop the
source line and the GovBlock wordmark for the animated mark; the create
customizer's colours and card, with Save, Post and New where preset, Open
Preset and Shuffle were and Get Code giving the embed, share and collaborate
links; no download anywhere.

### 1. Built

- **Gallery**: roll call tally, bill history, member scorecard, committee at a
  glance, party unity, chamber by the numbers, bill cosponsors, state session.
  Each tile shows a frame of the template on a real link and plays on hover.
- **The card**: Template, Link, Shape, Mode, Base Color, Theme, Chart Color,
  Heading, Font, Motion, Pace, Radius. Lists are the customizer's own
  (`lib/create/preset.ts`), faces are the site's. Hovering a colour, a face or
  a motion previews it in the player. Keys: S save, N gallery, R shuffle the
  look, D light or dark. The icon library row was left out.
- **Links Studio reads**: a roll call, a session's roll calls
  (`house-119-2`), a bill, a member, a committee, a party (`/party/r-house`),
  a state.
- **Get Code**: share link and `<iframe>` embed once posted
  (`/clips/embed/[id]`, public published clips only); collaborate link once
  saved (`/clips/studio?template=…&link=…`; opening it and saving makes the
  opener's own copy).
- **The mark**: the roll call tally and bill history lose "Source: …" and
  "GovBlock"; the animated mark sits bottom right on every scene and fills
  the end card.
- **Templates saved before tonight** used the first spec and no longer open.

### 2. Not built yet

- Pasted YouTube links still produce no clips; the transcript page and the
  clips dashboard are next.

---

## 6 · Clip by link, a bill's history, and generated clips saved without a render — 2026-09-14 evening

Brendan: no file uploads and no rights box, paste a link only; a bill link in
Generate; save and share a generated video without a render machine.

### 1. Table change, announced before it runs

`sql/022_clips_composition.sql`, additive: `clips.composition` (jsonb), the
template id and the props a generated clip plays from. Nothing else changes.

`sql/023_clip_templates.sql`, additive: a new table `clip_templates` (id,
owner, name, the template as JSON, times) for templates readers build in
/clips/studio. Both ran.

### 2. Built

- **Clip** (was Upload): paste a link, Get clips; no file, no rights box.
  The link is queued in `clip_cuts`; nothing cuts it yet.
- **Generate** reads a pasted roll call or bill link and picks its template.
  **Bill history** is the second template: a bill's milestones from its
  actions (introduced, referred, reported, passed each chamber, resolving,
  presented, signed or vetoed, law), the law's number stamped last.
- **Post** keeps a generated clip as its template and data
  (`clips.composition`); the feed and grid play it live with Remotion's
  Player; its link is shareable. No render, no machine.
- **Studio** at /clips/studio: scenes (title card, big number, tally,
  timeline, bars, text, end card), each with its knobs and `{field}` slots;
  shape, colors and font; a live preview; save per reader; post.
- **/state** and **/state/[state]** wear both site rails; **Map** beside
  Charts opens `/map?state=xx` flown to the state.
- **/research** and its first study, **/research/party-line-votes**, counted
  from every 119th Congress House roll call: 463 of 657 split the parties.

### 3. Verified

Bounded typecheck clean on every touched file. On 3003 with a minted
session: bill and roll call links load data (8 milestones; 237 yea, 3
parties); a template saves, renames in place, lists and deletes; a Studio
clip, a bill history and a tally post, show in the anonymous feed with their
data, and delete. `/state`, `/state/ny`, `/map?state=ny`, `/research`,
`/research/party-line-votes`, `/clips/studio` answer 200. Not driven in a
browser.

### 4. Found

autoclip.dev publishes no repository that could be found; its site links
none. The closest open-source match to its features is
github.com/artbyjazi/autoclip (MIT: paste a YouTube link or a file,
Whisper, an LLM picks moments, speaker-tracked 9:16, burned captions).

---

## 5 · Clips on S3, and the Stream route admin-only — 2026-09-14 evening

Brendan's rulings on milestone 0's open list: no Stream minutes (storage
moves to S3); the hearing is House Agriculture meeting 119395; the Remotion
Free License applies (three people or fewer); `/api/stream` admin-only, done
here. The worker box waits on his question of why a box is needed.

### 1. Table change, announced before it runs

`sql/021_clips_s3.sql`, additive: `clips.video_key` and `clips.poster_key`
(text), and one new check on `clip_cuts`: a source held in the bucket
(`source_url like 's3://%'`) needs `rights_attested_at`. Nothing dropped or
altered; `stream_uid` stays, unused.

### 2. Storage

- Bucket `govblock-clips-638175140432`, us-east-1, all public access
  blocked, CORS for GET, PUT and HEAD from localhost:3000–3003 and the four
  production hosts.
- IAM, additive: `ClipsReadWrite` (Get, Put, Delete, List on the bucket) on
  `govblock-amplify-compute`'s `govblock-data-access`; `ClipsDelete` on
  `govblock-dev`, which already had Get, Put and List on `govblock-*`.
- The browser PUTs the take and its poster to signed addresses from
  `/api/clips`; `/api/clips/[id]/complete` looks in the bucket and publishes
  the row. Every play address is signed for an hour and minted afresh on each
  feed read. An upload is one signed PUT, 5 GB at most.
- The Stream code this window added to `lib/policy/cloudflare-stream.ts` is
  removed; the file is `main`'s again. The worker's cut and render write the
  video and a poster frame to the bucket.

### 3. Ran and verified

`sql/021` ran: 3 statements. Bounded typecheck of 14 files: 0 diagnostics.
Driven on 3003 against the real bucket, minted reader and admin sessions,
a 1.1 MB MP4:

| Step | Result |
|---|---|
| POST a recording | 200, `processing`, a signed PUT address |
| CORS preflight from localhost:3003 | 200, origin allowed |
| PUT to the address, then complete | 200; `published` |
| the reader's feed | the clip, with a signed src; a range request on it 206 `video/mp4` |
| anonymous feed while private / after PATCH public | absent / present |
| DELETE | 200; the object is gone from the bucket |
| complete with nothing uploaded | 409 |
| upload without / with the rights box | 400 / 200; PUT 200; listed in the library |
| withdraw the upload | 200; the object is gone |
| `/api/stream` signed out, as a reader (GET and delete-video), as an admin | 403, 403, 403, 200 |

No test rows or objects left. Not verified: a take recorded in a browser
(WebM from Chrome) and its poster, which Brendan reviews on 3003.

### 4. Open

- `/api/stream` is admin-only on `feature/clips`; `main`, and so
  production, stays open until this ships.
- The worker box: Brendan asked why one is needed.

---

## 3, prepared · The cut and the render, written and not yet run — 2026-09-14

> **Key takeaways**
>
> - The worker box's kit is in `scripts/clips/worker/`: setup, the render,
>   the cut, the Bedrock shim, and GovBlock's prompts and patch for
>   autoclip. **None of it has run**, and nothing has been launched: the
>   box, the hearing and the licence are the lead's to settle, and Stream
>   has no minutes.
> - Reading autoclip's pipeline turned up two faults in its `speech`
>   category, the one that fits hearings: the outline prompt asks for JSON,
>   but the parser reads only `1. **Title**` / `- point` lines; and the
>   scoring prompt returns an object with no `final_score` where the
>   aligner expects a list, so every clip would fall back to a score of
>   0.5. Its default prompts do not have either fault. GovBlock's prompts
>   are written to the parsers.
> - For a video over thirty minutes autoclip makes two- to six-minute
>   clips with a ninety-second floor. A one-file patch
>   (`cut/patch_autoclip.py`) makes them 35 to 75 seconds, cut at 90, when
>   `GOVBLOCK_SHORTS` is set. It was run against autoclip's `quality.py` at
>   the pinned commit: a two-hour video profiles to 25/35–75/90 seconds,
>   and with the variable unset nothing changes.

### 1. What is there

- **`setup.sh`**: Amazon Linux 2023 x86_64. FFmpeg static, Node 22,
  Python 3.11, autoclip pinned at aaf863b with the patch and the prompts,
  a venv with faster-whisper and boto3, Chrome's libraries for the render,
  `npm install` of the worker package.
- **`cut/bedrock_shim.py`**: OpenAI-compatible chat completions on
  127.0.0.1:8765 answered by Bedrock Converse under the instance role.
  autoclip never holds a key.
- **`cut/transcribe.py`**: faster-whisper `medium.en`, int8 on CPU, to
  SRT. autoclip gets `--srt`, so its own Whisper (default `base`) is never
  installed.
- **`cut/prompts/`**: the five prompts, in English, keeping autoclip's file
  names and input and output shapes. Exchanges that stand alone, scored on
  standing alone, substance, completeness, not procedure; nothing rewards
  tone or shareability.
- **`cut.mjs`** (`run-cut.sh` wraps it in nohup and stops the box after):
  a meeting's video by yt-dlp, or a reader's upload from Stream; the SRT;
  autoclip `run --category speech --no-db --json` through the shim; the
  top twelve by score, in time order; each clip's **title a sentence
  copied from its own transcript** (the model picks, the script keeps it
  only if found word for word, else the first full sentence); caption the
  meeting's title, committee and date and the time into the hearing;
  FFmpeg to 1080×1920 with the frame over a blurred copy of itself and the
  captions burned in; Stream; a `clips` row with `origin = 'cut'`,
  `hearing_key`, `cut_id`, `source_start`, `source_end`, in `review` for a
  desk (published only after the report shows them) or private in the
  reader's library for an upload. `clips.json` in the work folder lists
  them for the report.
- **`render.mjs`**: bundles `src/` with the template files copied in from
  `apps/web`, renders `roll-call-tally` to H.264 with Geist, and with
  `--desk` uploads it and files a `generated` row keyed to the roll call
  and the bill. Title and caption are the vote's and the bill's words.

autoclip's own 9:16 export is not used: its Shorts preset crops a 16:9
hearing to the middle third and stops at sixty seconds, and its title card
is the model's words.

### 2. Verified

`node --check` on the three scripts, `bash -n` on setup, `py_compile` on
the Python, and the patch run twice (patched, then "already patched") and
exercised as above. Nothing else.

### 3. Waiting on

The hearing, `govblock-clips-worker`, the Remotion licence, Stream minutes.

---

## 4 · Upload behind the rights box, and Report and Take down on every clip — 2026-09-14

Built ahead of milestone 3, which waits on the hearing, the worker box and
Stream minutes. Brief's rule: no upload before both the rights box and the
takedown path exist. Both ship in this commit.

> **Key takeaways**
>
> - Upload cannot be sent until "I have the right to post this video." is
>   ticked. The server refuses it without the box (400), and so does the
>   table: a `clip_cuts` row with an upload and no attestation fails its
>   check constraint. Verified all three ways.
> - Report is on every clip that is not the reader's own, signed in or
>   out. A copyright report needs an email address and details. Take down
>   is an admin's alone (403 for anyone else). It removes the clip from
>   the feed, locks its video behind a token, and closes the clip's open
>   reports as `removed`.
> - An upload goes to Stream private and into `clip_cuts` as `queued`, to
>   be cut the way a hearing is. Until Stream has minutes it gets the same
>   503 as Record.

### 1. What was built

- **`components/clips/upload.tsx`** (the phone frame, like Record): choose a
  video, preview it, title it, tick the box ("Own work, the owner's
  permission, or the public domain. A clip that breaks this comes down on
  report."), send with a percentage. Opened from Upload in the rail,
  between Record and Generate, and from the camera's upload button, which
  is back and now goes here.
- **`/api/clips/uploads`** POST: signed in, `rights: true`, up to four
  hours and 30 GB; tus upload to Stream, `requireSignedURLs`; a
  `clip_cuts` row with `rights_attested_at`. **`/api/clips/uploads/[id]`**
  DELETE: the reader's own, before it is cut. A failed send withdraws its
  row.
- **`components/clips/report.tsx`** and **`/api/clips/reports`**: reason
  (Copyright, Privacy, Harmful or misleading, Something else), details, an
  email address (the reader's own filled in when signed in) into
  `clip_reports`. No foreign key, so a stock clip can be reported too.
- **`/api/clips/[id]/takedown`** POST, admin only (`reader_profiles.admin`
  through the session): `status = 'removed'`, `removed_at`, Stream
  `requireSignedURLs`, reports resolved. Nothing is deleted. In the menu it
  shows only to an admin and only on a clip that lives in Aurora.
- The library ("Your library") lists the reader's uploads above its clips:
  waiting to be cut, being cut, could not be cut, or how many clips came of
  it.

### 2. How it was verified

Bounded typecheck of the thirteen files, brackets included: 0 diagnostics.
`/clips` 200. Driven on 3003 with a minted reader session and a minted
admin session, against a test clip filed under GovBlock:

| Step | Result |
|---|---|
| report with no reason | 400 "Pick a reason." |
| copyright report with no address | 400 |
| report signed out, "other" | 201 |
| copyright report signed in, with address | 201; two open reports |
| take down signed out / as a reader | 403 / 403 |
| take down as admin | 200; clip `removed`; both reports `removed`; gone from the anonymous feed |
| upload signed out | 401 |
| upload without the box | 400 "Confirm the right to post this video first." |
| upload with the box | 503 (Stream quota) |
| withdraw an upload that is not there | 404 |
| insert an upload with no attestation, by hand | refused by `clip_cuts_check1` |
| feed | carries `uploads` |

Test rows deleted afterwards.

### 3. Open

- Nobody is told of a new report yet. It waits in `clip_reports` (the index
  `clip_reports_open` lists them) until an admin looks. Mail to Brendan on
  a copyright report is the natural next step.
- An upload of a short clip is still queued for the cut rather than posted
  as it is; the brief sends every upload through the cut.
- The report route has no rate limit, signed out included. A flood of
  reports would fill the table, not take anything down: only an admin
  takes a clip down.

---

## 2 · A roll call as a tally, previewed in the browser — 2026-09-14

> **Key takeaways**
>
> - Generate, beside Record in the rail, opens Remotion's `<Player>` on the
>   newest House roll call: roll 295, H.R. 4795, "Protect Economic and
>   Academic Freedom Act of 2026", On Passage, 237–169, 27 not voting.
>   Passed. Any roll call loads by its page's address (`senate-119-2/231`).
> - The render is not done. It waits on three things: the lead's word on
>   the Remotion licence, the worker box, and Stream minutes.
> - The dev box stopped itself mid-milestone (its idle timer counts only
>   port 3000's requests). It was started again with `govblock-dev-up`,
>   the idle timer was stopped for this window's work, and the 3003 server
>   restarted. The XML window's 3002 server went down with the box and was
>   not restarted by this window.

### 1. What was built

- **`components/clips/templates/roll-call-tally.tsx`**: the composition,
  1080×1920, 30 fps, 15 seconds. Heading (chamber, roll, date), the
  citation, the bill's title, the question; a seat per member lighting yea,
  nay, present, not voting in order while the counters run; the parties at
  8 s; the result stamped at 11 s; "Source: clerk.house.gov via
  congress.gov" (or senate.gov) and GovBlock at the foot. Every word is a
  field of the vote row or the bill row. React and Remotion only, inline
  styles, so the render bundles the same file.
- **`lib/clips/templates.ts`** and **`/api/clips/templates/roll-call`**:
  the props from `getRollCallVote`, counted from the member positions
  (Yea/Aye, Nay/No, Present, Not Voting) and grouped by party, with the
  bill's `display_title` and the ids a clip of it is keyed to
  (`roll_call_key` 11922026295, `bill_key` 119-HR-4795).
- **`components/clips/generate.tsx`**: the panel, in the same phone frame
  as Record. Template select (one entry), the Player with its controls
  looping, and the roll call's address with Preview. Loaded on demand, so
  Remotion stays out of `/clips` until Generate is opened.
- `remotion` and `@remotion/player` pinned at 4.0.524 in `apps/web`.
  `acknowledgeRemotionLicense` is not set: the Player's licence notice
  stays in the console until the licence is settled.

### 2. How it was verified

- Bounded typecheck of the six files: 0 diagnostics.
- `/api/clips/templates/roll-call` 200, props as above; named Senate roll
  231 200. `/clips` 200 in 16.6 s cold; the Generate chunk, Remotion
  included, compiled with no error in `logs/dev-3003.log`.
- The Player itself is for review on localhost:3003 (tunnel
  `-L 3003:127.0.0.1:3003 govblock-dev-direct`); this window did not drive
  a browser against it.

### 3. Open

- The render (`scripts/clips/render`, next), once the lead carries the
  licence to Brendan.
- The box's idle timer is stopped. It re-arms at the box's next boot; the
  daily 09:00 UTC stop still stands.

---

## 1 · Record wired to Stream, and Stream has no minutes — 2026-09-14

> **Key takeaways**
>
> - Record now writes a row in Aurora and sends the take to Cloudflare
>   Stream by tus; the feed reads every clip back from Aurora. Every route
>   was driven on port 3003 with a signed-in session and passed.
> - **Stream refuses every upload: the account has no storage.**
>   `storage-usage` reads `totalStorageMinutesLimit: 0`, and a tus create
>   answers `10011: Storage capacity exceeded`. Stream minutes are bought
>   in the Cloudflare dashboard (Stream → Plans: $5 a month per 1,000
>   minutes stored, $1 per 1,000 minutes delivered). That is Brendan's
>   purchase. Until then Record says "Clips cannot take new video right
>   now." and nothing is written.
> - `sql/020_clips.sql` ran on Aurora: 12 statements, three tables, no
>   existing table touched.

### 1. What was built

- **`lib/policy/cloudflare-stream.ts`**: `createUpload` (a tus direct
  creator upload with `Upload-Creator` set to the reader's id,
  `maxDurationSeconds` 65, and `requiresignedurls` for a private take),
  `getVideo`, `setSignedUrls`, `enableDownload`, `playbackToken` (four
  hours, `downloadable`), `playbackUrls`.
- **`lib/clips/server.ts`**: the feed query. Each row's links are joined
  from the record's own tables by its ids: `congress_committee_meetings`
  for the hearing, `congress_bills` for the bill, the House or Senate vote
  table for the roll call. A processing clip is settled on read: Stream
  ready, then the MP4 asked for, then `published`. A private clip's MP4 and
  poster go out under a token, to its owner only.
- **`app/api/clips`**: GET the feed (anyone); POST a recording (signed in;
  401 otherwise; 503 while Stream has no room). **`app/api/clips/[id]`**:
  PATCH visibility, title, caption, with Stream's signed-URL setting
  changed first; DELETE from Stream and Aurora. Someone else's clip
  answers 404.
- **`components/clips/store.ts`**: IndexedDB is gone. `saveClip` posts
  the row, then PATCHes the take to Stream in 50 MiB chunks with progress;
  a failed upload deletes its row. `loadFeed` and `loadMine` read
  `/api/clips`. `updateClip`, `deleteClip`. The desks moved to
  `components/clips/desks.ts` so the server can file under them (a
  `"use client"` module cannot be read on the server); `store.ts`
  re-exports them.
- **Page**: published Aurora clips join the feed between the reader's own
  and the stock. A take plays from the browser's copy while Stream
  transcodes, wearing a "Processing" badge; the feed is re-read every eight
  seconds until it is ready. The save button counts "Sending… 42%" and
  shows the refusal if there is one. A clip's record links sit under its
  caption in the right rail.
- **Capture's file picker is gone.** It sent a device file with no rights
  question. The upload button comes back in milestone 4, through Upload.

Playback is Stream's MP4 (`downloads/default.mp4`), so the feed's
`<video>` did not change and no HLS library was added. Stream bills an
MP4 download as the video's full duration each time it loads; for clips of
a minute or less that is close to streaming it.

### 2. How it was verified

Branch server: `~/govblock-clips` on the dev box, port 3003
(`logs/dev-3003.log`). `/clips` 200 in 15.6 s cold; `/api/clips` 200.
Bounded typecheck of the ten touched files: 0 diagnostics.

A script minted an Auth.js session for a test reader and drove the routes:

| Step | Result |
|---|---|
| session | `u-clips-window-test` |
| POST a recording | 503, "Clips cannot take new video right now." (Stream quota) |
| row inserted by hand, House roll 295, H.R. 4795 | GET `mine` returns it, links `/bills/2040899` and `/roll-call-votes/house-119-2/295` |
| PATCH to public, new title | 200; `mine` shows it public |
| anonymous GET | the clip is in `published` |
| PATCH a clip not the reader's | 404 |
| DELETE | 200; `mine` empty |

The test row is deleted. Upload bytes, the transcode, the MP4 and the
token are not verified: they wait on Stream minutes.

### 3. Open

- **Stream minutes** (above). Nothing video-bearing can be proven until
  they exist: not a recording, not the render, not the cut's clips.
- Likes, saves, follows and comments are still localStorage, keyed by clip
  id, so they already work on an Aurora clip the same as a stock one.
- Sign-in by email link from port 3003: `main` allowed only 3000 and 3001,
  so this branch carries the same one-line change as c974e70 on
  `feature/legislative-xml` (3002 and 3003 added).

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
