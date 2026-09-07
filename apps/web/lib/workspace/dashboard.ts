// Where the dashboards live under the workspace (Brendan, 2026-09-07): the
// Admin experience's pages, one route each — /workspace/dashboard/committee,
// /workspace/dashboard/database, /workspace/dashboard/apps/users — and the
// bare /workspace/dashboard as the menu of them all. The Admin page ids are
// the ones the rail uses (`components/admin/items.ts`); Sales is the empty
// id there, so on the route it is called by its name.

export const DASHBOARD_ROOT = "/workspace/dashboard"

/** The route for an Admin page id. */
export function dashboardHref(page: string, search = "") {
  return `${DASHBOARD_ROOT}/${page || "sales"}${search}`
}

/** The Admin page id for a route's segments. */
export function dashboardPage(segments: string[]) {
  const id = segments.join("/")
  return id === "sales" ? "" : id
}
