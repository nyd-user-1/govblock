import { env } from "./db.mjs"

// Clears the site's read cache after a load (apps/web/lib/policy/db.ts holds
// the cache; app/api/revalidate/route.ts opens the door to the site's own
// secret). Name the tables the load wrote, or nothing for everything. Returns
// a line for the log; never throws, because a load that finished is finished
// whether or not the site heard about it.
export async function clearReadCache(tables = [], origin = env.SITE_ORIGIN || "https://policy.nysgpt.com") {
  const secret = env.AUTH_SECRET
  if (!secret) return "read cache not cleared: no AUTH_SECRET in apps/web/.env.local"
  try {
    const r = await fetch(`${origin}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(tables.length ? { tables } : { all: true }),
    })
    return `read cache ${r.ok ? "cleared" : "not cleared"}: ${r.status} ${(await r.text()).slice(0, 160)}`
  } catch (error) {
    return `read cache not cleared: ${String(error?.message ?? error)}`
  }
}
