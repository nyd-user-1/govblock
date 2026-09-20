import demoted from "@/lib/lab-routes.json"

// The lab (Brendan, 2026-09-20): routes that stay in development and are kept
// out of production, where they are neither served nor counted against
// Amplify's output cap. A route is in the lab because it lives under app/lab
// or because its switch on /routes put it in lib/lab-routes.json;
// scripts/routes/prune-lab.mjs deletes both from the build on Amplify.
const DEMOTED = new Set<string>(demoted)

export const inLab = (route: string) => route.startsWith("/lab/") || DEMOTED.has(route)

/** Routes the switch leaves alone: the root, and the page and API the switch itself runs on. */
export const PINNED = new Set(["/", "/routes", "/api/routes/lab"])
