import "server-only"

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { stateName } from "@/lib/filters"

// The loader's own code for one jurisdiction (Brendan, 2026-09-20: "put a
// codeblock in here so I can read the applicable script"). The loaders are
// livingston's, a repo beside this one on the machine that runs the dashboard,
// so this reads them off disk and answers only there (LIVINGSTON_DIR, or
// ~/Code/livingston); anywhere else the module simply has no code to show.
//
// Two layers make a fetch, and both are shown. The driver
// (scripts/box/text-backfill.mjs) has one `if (SOURCE === "…")` branch per
// source: what is run, in what order, with what limits. The handler
// (api/bill-text.ts) has the function that does the fetching. A walked state
// whose addresses are rewritten before they are fetched (Indiana's, a dead
// host's) gets that function too.

export type ScriptSection = { file: string; title: string; start: number; end: number; code: string }

const REPO = process.env.LIVINGSTON_DIR || path.join(os.homedir(), "Code", "livingston")
const DRIVER = "scripts/box/text-backfill.mjs"
const HANDLER = "api/bill-text.ts"

/** Which source the loader uses for a jurisdiction; scripts/pipeline/launch.mjs runs the same one. */
export const loaderSource = (state: string) => ({ US: "govinfo", NY: "nysenate-bulk", CA: "ca-pubinfo", TX: "tx-ftp", MA: "ma-api", VA: "va-lis" })[state] ?? "state_link"

const OWN_FILE: Record<string, string> = { "ca-pubinfo": "api/_lib/text-sources/ca-pubinfo.ts", "tx-ftp": "api/_lib/text-sources/tx-ftp.ts", "va-lis": "api/_lib/text-sources/va-lis.ts", "ma-api": "api/_lib/text-sources/ma-api.ts" }
const FETCHER: Record<string, string> = { state_link: "runStateLink", "nysenate-bulk": "runNySenateBulk", govinfo: "runGovinfo" }

const slice = (lines: string[], from: number, to: number, file: string, title: string): ScriptSection => ({ file, title, start: from + 1, end: to, code: lines.slice(from, to).join("\n").replace(/\s+$/, "") })

/** From a line that starts the block to the line before the next top-level statement of the same kind. */
function block(lines: string[], opens: (line: string) => boolean, closes: (line: string) => boolean) {
  const from = lines.findIndex(opens)
  if (from < 0) return null
  let to = lines.findIndex((line, i) => i > from && closes(line))
  if (to < 0) to = lines.length
  // The comment that introduces the next block belongs to it, not to this one.
  while (to > from + 1 && /^\s*(\/\/|\/\*|\*)/.test(lines[to - 1])) to--
  return { from, to }
}

export async function scriptSections(state: string): Promise<ScriptSection[] | null> {
  const source = loaderSource(state)
  const [driver, handler] = await Promise.all([fs.readFile(path.join(REPO, DRIVER), "utf8").catch(() => null), fs.readFile(path.join(REPO, HANDLER), "utf8").catch(() => null)])
  if (!driver || !handler) return null
  const out: ScriptSection[] = []
  const d = driver.split("\n")
  const h = handler.split("\n")
  const topLevel = (line: string) => /^(export\s+)?(async\s+)?function\s|^export\s+(const|default)\s/.test(line)

  const branch = block(d, (l) => l.startsWith(`if (SOURCE === "${source}"`), (l) => l.startsWith('if (SOURCE === "') || l.startsWith("console.error(`text-backfill: unknown"))
  if (branch) out.push(slice(d, branch.from, branch.to, DRIVER, "The driver: what runs, in what order, with what limits"))

  const name = FETCHER[source]
  const fn = name ? block(h, (l) => new RegExp(`^(export\\s+)?(async\\s+)?function\\s+${name}\\b`).test(l), topLevel) : null
  if (fn) out.push(slice(h, fn.from, fn.to, HANDLER, `The handler: ${name}, which does the fetching`))
  else {
    // A source with no function of its own in the handler is a branch of its dispatch.
    const at = block(h, (l) => l.includes(`source === "${source}"`), (l) => /^\s*\} else if \(source === "/.test(l) || /^\s*\} else \{/.test(l))
    if (at) out.push(slice(h, at.from, at.to, HANDLER, "The handler: this source's branch"))
  }

  // A jurisdiction with a feed of its own has a file of its own: that is its script, whole.
  const own = OWN_FILE[source]
  if (own) {
    const text = await fs.readFile(path.join(REPO, own), "utf8").catch(() => null)
    if (text) out.push(slice(text.split("\n"), 0, text.split("\n").length, own, `${stateName(state)}'s own loader, whole`))
  }

  if (source === "state_link") {
    const rewrite = block(h, (l) => /^export function rewriteLink\b/.test(l), topLevel)
    const text = rewrite ? h.slice(rewrite.from, rewrite.to).join("\n") : ""
    if (rewrite && new RegExp(stateName(state).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) out.push(slice(h, rewrite.from, rewrite.to, HANDLER, `Address rewrites: ${stateName(state)} is named here`))
  }
  return out
}
