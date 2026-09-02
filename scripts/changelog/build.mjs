#!/usr/bin/env node
// govblock's changelog: what shipped in this repository, by day, from git.
//
// The v3 page this is ported from fetched shadcn-ui/ui's GitHub releases
// through ungh.cc — somebody else's release notes on our page. This reads our
// own `git log` on main instead and writes lib/changelog/entries.json, so the
// page is about this repository and needs no network at build time.
//
//   node scripts/changelog/build.mjs
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

// A separator no commit subject will contain.
const SEP = "|@|"
const log = execFileSync(
  "git",
  ["log", "--no-merges", `--pretty=format:%H${SEP}%cI${SEP}%s`, "main"],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
)

const days = new Map()
for (const line of log.split("\n")) {
  if (!line.trim()) continue
  const [hash, iso, subject] = line.split(SEP)
  if (!hash || !iso || !subject) continue
  const day = iso.slice(0, 10)
  // "agents: the real editor" becomes section "Agents", entry "the real editor".
  const at = subject.indexOf(": ")
  const section = at > 0 && at < 24 ? subject.slice(0, at) : "Other"
  const text = at > 0 && at < 24 ? subject.slice(at + 2) : subject
  if (!days.has(day)) days.set(day, new Map())
  const sections = days.get(day)
  if (!sections.has(section)) sections.set(section, [])
  sections.get(section).push({ text, hash: hash.slice(0, 7) })
}

const title = (day) =>
  new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })

const entries = [...days.entries()]
  .sort((a, b) => (a[0] < b[0] ? 1 : -1))
  .map(([day, sections]) => ({
    tag: day,
    title: title(day),
    date: `${day}T00:00:00.000Z`,
    count: [...sections.values()].reduce((n, list) => n + list.length, 0),
    markdown: [...sections.entries()]
      .map(([section, list]) => {
        const heading = section.charAt(0).toUpperCase() + section.slice(1)
        const lines = list.map((item) => `- ${item.text} (\`${item.hash}\`)`)
        return `### ${heading}\n\n${lines.join("\n")}`
      })
      .join("\n\n"),
  }))

writeFileSync(
  new URL("../../apps/web/lib/changelog/entries.json", import.meta.url),
  JSON.stringify({ generated: new Date().toISOString(), entries }, null, 2) + "\n"
)
console.log(`${entries.length} days, ${entries.reduce((n, e) => n + e.count, 0)} commits`)
