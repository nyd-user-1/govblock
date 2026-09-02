// govblock's own changelog: what shipped in this repository, by day.
//
// The v3 page this is ported from fetched shadcn-ui/ui's GitHub releases
// through ungh.cc — somebody else's release notes on our page. `scripts/
// changelog/build.mjs` writes `entries.json` from `git log` on main, so the
// page is about this repository and needs no network at build time.

import data from "@/lib/changelog/entries.json"

export const CHANGELOG_REPOSITORY = "nyd-user-1/govblock"

export interface Release {
  tag: string
  title: string
  date: string
  markdown: string
}

export async function getReleases(): Promise<Release[]> {
  const { entries } = data as { entries: (Release & { count: number })[] }
  return entries
}
