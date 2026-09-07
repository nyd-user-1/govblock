// Where the dashboards live under the workspace (Brendan, 2026-09-07): the
// Admin experience's pages, one route each — /workspace/dashboard/committee,
// /workspace/dashboard/database, /workspace/dashboard/roster — and the
// bare /workspace/dashboard as the menu of them all. The Admin page ids are
// the ones the rail uses (`components/admin/items.ts`); Session is the empty
// id there, so on the route it is called by its name (it was /sales until
// Brendan renamed it on 2026-09-07; the old name still resolves).

export const DASHBOARD_ROOT = "/workspace/dashboard"

/** The route for an Admin page id. */
export function dashboardHref(page: string, search = "") {
  return `${DASHBOARD_ROOT}/${page || "session"}${search}`
}

/** The Admin page id for a route's segments. */
export function dashboardPage(segments: string[]) {
  const id = segments.join("/")
  if (id === "session" || id === "sales") return ""
  // The roster was apps/users until 2026-09-07.
  if (id === "apps/users") return "roster"
  return id
}
