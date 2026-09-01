// govblock · scripts/search/verify-search.mjs
//
// What /search actually renders, at the width the lane brief names, plus the
// timings the brief budgets. curl proves nothing here: the jurisdiction is
// client state, so the sections only exist after the page has resolved its
// scope and fetched. This drives a real browser.
//
//   node scripts/search/verify-search.mjs [origin] [outdir]
//
// Default origin is production. Each case is screenshotted and its section
// counts and wall time printed, so a regression is visible in the log without
// opening a single PNG.

import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"

// govblock does not depend on playwright and should not: it is a build-time
// dependency of nothing. Resolve it from wherever it already exists on the box
// (the livingston checkout has it) rather than adding it to a lockfile another
// lane is holding.
const ROOTS = [process.cwd(), `${homedir()}/Code/livingston`, `${homedir()}/Code/livingston-v3`]
const chromium = (() => {
  for (const root of ROOTS) {
    // require, not import(): playwright's entry is CommonJS, and a dynamic
    // import of it hands back a namespace whose `chromium` is undefined.
    try {
      return createRequire(`${root}/`)("playwright").chromium
    } catch {}
  }
  throw new Error(`playwright not found. Tried: ${ROOTS.join(", ")}. Install it, or run from a checkout that has it.`)
})()

const ORIGIN = process.argv[2] ?? "https://policy.nysgpt.com"
const OUT = process.argv[3] ?? "/tmp/search-shots"
const WIDTH = 1714
const CASES = [
  { q: "climate resiliency", state: "NY", note: "cross-jurisdiction + full text" },
  { q: "holmes", state: "NY", note: "alias: Eleanor Holmes Norton" },
  { q: "health", state: "WY", note: "the common term, from a small jurisdiction" },
  { q: "HB10", state: "TX", note: "bill number prefix, every jurisdiction" },
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: WIDTH, height: 1200 } })
let failures = 0

for (const c of CASES) {
  const url = `${ORIGIN}/search?state=${c.state}&q=${encodeURIComponent(c.q)}`
  const started = Date.now()
  await page.goto(url, { waitUntil: "domcontentloaded" })
  // The sections appear only when the fetch lands; "Searching" is the tell that
  // it has not. Wait for either a section heading or the empty-state sentence.
  await page
    .waitForFunction(() => {
      const t = document.body.innerText
      return /\((\d+)\)/.test(t) || /Nothing in any jurisdiction/.test(t)
    }, { timeout: 30000 })
    .catch(() => {})
  const elapsed = Date.now() - started

  const sections = await page.$$eval("h2", (hs) =>
    hs.map((h) => h.textContent?.trim() ?? "").filter((t) => /\(\d+\)/.test(t))
  )
  // Every flag on the page, so "across jurisdictions" is a count and not a claim.
  const flags = await page.$$eval('[data-slot="flag-chip"]', (els) =>
    [...new Set(els.map((e) => (e.getAttribute("src") ?? "").split("/").pop()))].sort()
  )
  const ok = sections.length > 0
  if (!ok) failures++
  console.log(
    `${ok ? "ok  " : "FAIL"} ${String(elapsed).padStart(5)} ms  ${c.state}/"${c.q}"  ` +
      `[${sections.join(", ") || "no sections"}]  flags=${flags.length}  — ${c.note}`
  )
  await page.screenshot({
    path: `${OUT}/${c.state}-${c.q.replace(/\W+/g, "-")}.png`,
    fullPage: true,
  })
}

await browser.close()
console.log(failures ? `${failures} case(s) rendered nothing` : "all cases rendered")
process.exit(failures ? 1 : 0)
