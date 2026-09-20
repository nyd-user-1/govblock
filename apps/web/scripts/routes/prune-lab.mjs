// The lab stays out of production (Brendan, 2026-09-20). Before Amplify
// compiles, this deletes from the build machine's checkout everything that is
// development's alone, so none of it is compiled, served, or counted against
// the output cap:
//
//   app/lab            routes moved there by hand
//   lib/lab-routes.json  routes demoted by their switch on /routes
//
// A demoted route loses its page.tsx or route.ts and nothing else: the folder
// may hold components another route imports, and a folder with no page in it
// is no route. What only the deleted file imported falls out of the build on
// its own.
//
// It deletes tracked files, so it runs on Amplify alone (AWS_APP_ID is set
// there) unless forced. Run from apps/web:  node scripts/routes/prune-lab.mjs
import fs from "node:fs"
import path from "node:path"

import { APP, walkRoutes } from "./walk.mjs"

if (!process.env.AWS_APP_ID && !process.argv.includes("--force")) {
  console.log("lab: not on Amplify, nothing pruned (pass --force to prune this checkout)")
  process.exit(0)
}

const routes = walkRoutes()
const lab = path.join(APP, "lab")
const inLab = routes.filter((r) => r.file.startsWith(lab + path.sep))
fs.rmSync(lab, { recursive: true, force: true })
for (const r of inLab) console.log(`lab: pruned ${r.path}`)

const demoted = new Set(JSON.parse(fs.readFileSync(path.resolve("lib/lab-routes.json"), "utf8")))
let pruned = 0
for (const r of routes) {
  if (!demoted.has(r.path) || r.file.startsWith(lab + path.sep)) continue
  fs.rmSync(r.file)
  demoted.delete(r.path)
  pruned++
  console.log(`lab: pruned ${r.path} (demoted)`)
}
for (const p of demoted) console.log(`lab: ${p} is demoted but answers to no file`)
console.log(`lab: ${inLab.length} in app/lab and ${pruned} demoted, out of the build`)
