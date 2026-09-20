// The app directory read as routes: each page.tsx and route.ts with the URL
// it answers and the file that answers it. Shared by generate.mjs, which
// draws /routes from it, and prune-lab.mjs, which takes the lab out of a
// production build. Run from apps/web.
import fs from "node:fs"
import path from "node:path"

export const APP = path.resolve("app")

export function walkRoutes() {
  const routes = []
  const walk = (dir, segs) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        // A route group is invisible in the URL.
        walk(p, /^\(.*\)$/.test(e.name) ? segs : [...segs, e.name])
      } else if (e.name === "page.tsx") routes.push({ path: "/" + segs.join("/"), kind: "page", file: p })
      else if (e.name === "route.ts") routes.push({ path: "/" + segs.join("/"), kind: "api", file: p })
    }
  }
  walk(APP, [])
  return routes.sort((a, b) => a.path.localeCompare(b.path))
}
