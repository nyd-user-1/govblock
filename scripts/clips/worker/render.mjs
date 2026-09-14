// Renders a /clips template once and files it under a desk. Worker box only.
//
//   curl -s 'http://127.0.0.1:3003/api/clips/templates/roll-call?chamber=house&congress=119&session=2&roll=295' > props.json
//   node render.mjs --props props.json                    # MP4 into out/, nothing filed
//   node render.mjs --props props.json --desk govblock     # and to Stream, a clips row in `review`
//   node render.mjs --props props.json --desk govblock --publish
//
// The props file is the template route's own answer, so the render and the
// Player preview are fed the same rows. The clip's title and caption are the
// vote's and the bill's words, as the template's are.

import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"

import { args, logger, newId, q, uploadFile, whenReady } from "./lib.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATES = join(HERE, "..", "..", "..", "apps/web/components/clips/templates")
const a = args()
if (!a.props) {
  console.error("usage: node render.mjs --props props.json [--out file.mp4] [--desk govblock] [--publish]")
  process.exit(2)
}
const { address, props, keys } = JSON.parse(readFileSync(a.props, "utf8"))
const slug = `${address.chamber}-${address.congress}-${address.session}-${address.roll}`
mkdirSync(join(HERE, "out"), { recursive: true })
const out = a.out ?? join(HERE, "out", `roll-call-tally-${slug}.mp4`)
const log = logger(join(HERE, "out", `render-${slug}.log`))

mkdirSync(join(HERE, "src/templates"), { recursive: true })
for (const f of readdirSync(TEMPLATES)) copyFileSync(join(TEMPLATES, f), join(HERE, "src/templates", f))

log("bundling")
const serveUrl = await bundle({ entryPoint: join(HERE, "src/index.ts") })
const composition = await selectComposition({ serveUrl, id: "roll-call-tally", inputProps: props })
log(`rendering ${composition.width}x${composition.height} ${composition.durationInFrames} frames to ${out}`)
let shown = -1
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: out,
  inputProps: props,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10
    if (pct !== shown) log(`rendered ${(shown = pct)}%`)
  },
})
log(`rendered ${out}`)

if (!a.desk) process.exit(0)

const chamber = props.chamber === "senate" ? "Senate" : "House"
const tally = `${props.counts.yea}–${props.counts.nay}`
const title = `${props.citation ?? `${chamber} roll call ${props.roll}`}: ${props.question ?? "Roll call"}${props.result ? `, ${props.result} ${tally}` : ""}`
const when = props.date ? new Date(props.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : ""
const caption = [props.billTitle, `${chamber} roll call ${props.roll}${when ? `, ${when}` : ""}.`].filter(Boolean).join(". ")

log("uploading to Stream")
const uid = await uploadFile(out, { name: title, creator: `desk:${a.desk}` })
log(`Stream ${uid}; waiting for it and its MP4`)
const video = await whenReady(uid)
const id = newId("clp")
const status = a.publish ? "published" : "review"
await q(
  `insert into clips (id, stream_uid, origin, status, visibility, desk, title, caption, duration, width, height, jurisdiction, bill_key, roll_call_chamber, roll_call_key, template, published_at)
   values ($1, $2, 'generated', $3, 'public', $4, $5, $6, $7, $8, $9, 'us', $10, $11, $12, 'roll-call-tally', case when $3 = 'published' then now() end)`,
  [id, uid, status, a.desk, title, caption, video.duration, video.width, video.height, keys.bill_key, keys.roll_call_chamber, keys.roll_call_key]
)
log(`filed ${id} under ${a.desk}, ${status}: ${title}`)
