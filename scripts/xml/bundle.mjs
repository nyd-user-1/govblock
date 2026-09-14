// Runs the TypeScript under apps/web/lib/xml from a script: bundles an entry
// with esbuild into a scratch file and imports it. lib/xml is written to be
// bundled this way (no React, no server-only, no `@/` imports), so the
// front ends and converters the app uses are the ones the box runs.
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { execFileSync } from "node:child_process"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const WEB = join(ROOT, "apps/web")
const require = createRequire(join(ROOT, "package.json"))

function esbuildBin() {
  for (const p of [join(ROOT, "node_modules/.bin/esbuild"), join(WEB, "node_modules/.bin/esbuild")]) {
    try {
      require("node:fs").accessSync(p)
      return p
    } catch {}
  }
  throw new Error("esbuild not found under node_modules/.bin")
}

/** The module at `entry` (a path under apps/web, e.g. "lib/xml/frontends/index.ts"), bundled and imported. */
export async function load(entry) {
  const outDir = join(ROOT, "node_modules/.cache/govblock-xml")
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, entry.replace(/[\\/]/g, "__").replace(/\.tsx?$/, "") + ".mjs")
  execFileSync(esbuildBin(), [join(WEB, entry), "--bundle", "--platform=node", "--format=esm", "--log-level=warning", `--outfile=${out}`], { stdio: "inherit" })
  return import(pathToFileURL(out).href + `?t=${Date.now()}`)
}
