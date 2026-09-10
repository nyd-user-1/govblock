#!/usr/bin/env node
// Builds the @nysgpt registry from registry.json into apps/web/public/r, then
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
  // Flags, seals and the boundary files are ours and they are public. A
  // consumer's own tree has none of them, so the copies read them from the
  // site rather than from a path that will 404.
  [/(["'`])\/(geo|flags|chambers)\//g, "$1https://gov.nysgpt.com/$2/"],
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

const built = fs.readdirSync(out).filter((n) => n.endsWith(".json"))
console.log(`registry: ${built.length} items, ${touched} rewritten`)
