#!/usr/bin/env node
// Builds the @44gov registry from registry.json into apps/web/public/r, then
// makes the copies installable in somebody else's tree.
//
// The source files are ours: they import the design system by its workspace
// name and they name our own static assets by an absolute path. Neither
// travels. Rather than keep a hand-edited second copy of every file, the
// rewrites live here as one table and are applied to what shadcn emits.

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../..")
const out = path.join(root, "apps/web/public/r")

// The design system's four generations all resolve to the same shadcn item in
// a consumer's tree, because every primitive these files reach for is one
// shadcn ships. Anything GovBlock-specific is a registry item of its own, so
// nothing here needs to know the difference.
const REWRITES = [
  [/@govblock\/ui\/lib\/utils/g, "@/lib/utils"],
  [/@govblock\/ui\/components\/(?:nova|ny4|animate-ui|animbits)\//g, "@/components/ui/"],
  [/@govblock\/ui\/components\//g, "@/components/ui/"],
  // The seals item lands under the name the docs give it, so anything that
  // reads the site's imagery file reads the installed one.
  [/@\/components\/policy\/imagery/g, "@/components/policy/seals"],
  // Flags and seals are ours and they are public. A consumer's own tree has
  // none of them, so the copies read them from the site rather than from a
  // path that will 404.
  [/(["'`])\/(flags|chambers)\//g, "$1https://44gov.nysgpt.com/$2/"],
  // The boundary files left the site for a public bucket on 2026-09-11
  // (Amplify's output cap), so they are read from there — the same base
  // lib/map/geo-url.ts uses. An audit on 2026-09-12 caught the old rewrite
  // pointing consumers at the site, where every /geo/ path is a 404.
  [/(["'`])\/geo\//g, "$1https://govblock-geo-638175140432.s3.amazonaws.com/"],
]

fs.rmSync(out, { recursive: true, force: true })
execFileSync(
  "npx",
  ["--yes", "shadcn@latest", "build", "registry.json", "--output", out],
  { cwd: root, stdio: "inherit" }
)

let touched = 0
for (const name of fs.readdirSync(out)) {
  if (!name.endsWith(".json")) continue
  const file = path.join(out, name)
  const item = JSON.parse(fs.readFileSync(file, "utf8"))
  let changed = false
  for (const entry of item.files ?? []) {
    if (typeof entry.content !== "string") continue
    const next = REWRITES.reduce((text, [from, to]) => text.replace(from, to), entry.content)
    if (next !== entry.content) {
      entry.content = next
      changed = true
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(item, null, 2) + "\n")
    touched++
  }
}

// Nothing may reach a consumer that only resolves inside this repo.
const leaks = []
for (const name of fs.readdirSync(out)) {
  if (!name.endsWith(".json")) continue
  const text = fs.readFileSync(path.join(out, name), "utf8")
  for (const bad of ["@govblock/ui", '\\"/geo/', '\\"/flags/', '\\"/chambers/'])
    if (text.includes(bad)) leaks.push(`${name}: ${bad}`)
}
if (leaks.length) {
  console.error("registry: unrewritten references\n  " + leaks.join("\n  "))
  process.exit(1)
}

// Every "@/…" import a consumer's copy makes must land somewhere the same
// install puts a file: this item, an @44gov item it depends on (transitively),
// a shadcn primitive under components/ui, or lib/utils. Anything else is a
// path that only resolves inside this repo (2026-09-12, as the registry grew
// past what one person could check by eye).
const items = new Map()
for (const name of fs.readdirSync(out)) {
  if (!name.endsWith(".json") || name === "registry.json") continue
  items.set(name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(out, name), "utf8")))
}
const targetsOf = (name, seen = new Set()) => {
  if (seen.has(name)) return []
  seen.add(name)
  const item = items.get(name)
  if (!item) return []
  const own = (item.files ?? []).map((f) => (f.target ?? f.path).replace(/\.(tsx?|css|json)$/, ""))
  const deps = (item.registryDependencies ?? []).filter((d) => d.startsWith("@44gov/")).flatMap((d) => targetsOf(d.slice(7), seen))
  return [...own, ...deps]
}
const unresolved = []
for (const [name, item] of items) {
  const reach = new Set(targetsOf(name))
  for (const f of item.files ?? []) {
    if (typeof f.content !== "string") continue
    for (const m of f.content.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
      const spec = m[1].replace(/\.(tsx?|css|json)$/, "")
      if (spec === "lib/utils" || spec.startsWith("components/ui/")) continue
      if (!reach.has(spec)) unresolved.push(`${name}: @/${m[1]}`)
    }
  }
}
if (unresolved.length) {
  console.error("registry: imports no install would satisfy\n  " + unresolved.join("\n  "))
  process.exit(1)
}

const built = fs.readdirSync(out).filter((n) => n.endsWith(".json"))
console.log(`registry: ${built.length} items, ${touched} rewritten`)
