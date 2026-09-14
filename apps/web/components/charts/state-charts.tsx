import { Bars, Donut, Lines, PALETTE, Seats, StackedArea } from "@/components/charts/svg"
import type { StateStats } from "@/lib/policy/state-stats"

// The charts a jurisdiction's numbers draw (2026-09-13), each one named so
// the studio and the embed route can ask for one by id.

export const CHARTS = [
  { id: "seats", title: "Seats by chamber" },
  { id: "progress", title: "Bill progress" },
  { id: "sponsors", title: "Bill sponsors" },
  { id: "types", title: "Bill types" },
  { id: "introduced", title: "Introduced legislation" },
  { id: "parties", title: "Party breakdown of legislators" },
  { id: "sponsorship", title: "Sponsorship by party" },
  { id: "enacted", title: "Sponsorship of enacted bills" },
  { id: "passed", title: "Share of sponsored bills enacted" },
  { id: "committees", title: "Bills per committee" },
  { id: "committee-series", title: "Bills per committee, by session" },
] as const
export type ChartId = (typeof CHARTS)[number]["id"]

const partyLabel = (p: string) => (p === "D" ? "Democrat" : p === "R" ? "Republican" : p === "I" ? "Independent" : "Other")

/** One chart by id, or null when the record has nothing for it. */
export function StateChart({ id, stats }: { id: ChartId; stats: StateStats }) {
  const xs = stats.sessions.map((s) => s.session)
  switch (id) {
    case "seats": {
      const chambers = [...new Set(stats.seats.map((s) => s.chamber))]
      if (!chambers.length) return null
      return (
        <div className="grid gap-6 sm:grid-cols-2">
          {chambers.map((c) => {
            const rows = stats.seats.filter((s) => s.chamber === c)
            return (
              <div key={c} className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium">{c}</p>
                <Seats seats={rows.map((r) => ({ party: r.party, n: r.n }))} />
                <p className="text-xs text-muted-foreground">{rows.map((r) => `${r.n} ${partyLabel(r.party)}`).join(" · ")}</p>
              </div>
            )
          })}
        </div>
      )
    }
    case "progress":
      return <Donut slices={stats.progress} colors={["#c4c4c4", "#5b8db8", "#3f8f5f", "#b31942", "#e08a1e"]} />
    case "sponsors":
      return <Donut slices={stats.sponsors} />
    case "types":
      return <Donut slices={stats.types} colors={PALETTE} />
    case "introduced":
      return (
        <Lines
          xs={xs}
          colors={["#0a3161", "#b31942", "#e08a1e", "#3f8f5f"]}
          series={[
            { label: "Bills", points: stats.sessions.map((s) => ({ x: s.session, y: s.bills })) },
            { label: "Resolutions", points: stats.sessions.map((s) => ({ x: s.session, y: s.resolutions })) },
            { label: "Passed bills", points: stats.sessions.map((s) => ({ x: s.session, y: s.bills_passed })) },
            { label: "Passed resolutions", points: stats.sessions.map((s) => ({ x: s.session, y: s.res_passed })) },
          ]}
        />
      )
    case "parties": {
      // Each chamber's seats by party, session by session: the districts held, from who sponsored in it.
      const roles = ["Sen", "Rep"].filter((r) => stats.roster.some((x) => x.role === r))
      if (!roles.length) return null
      const parties = ["D", "R", "I"].filter((p) => stats.roster.some((x) => x.party === p))
      const chamberName = (role: string) => stats.seats.find((s) => s.role === role)?.chamber ?? (role === "Sen" ? "Senate" : "House")
      return (
        <div className="grid gap-6 sm:grid-cols-2">
          {roles.map((role) => (
            <div key={role} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{chamberName(role)}</p>
              <StackedArea xs={xs} series={parties.map((p) => ({ label: partyLabel(p), points: xs.map((x) => ({ x, y: stats.roster.find((r) => r.session === x && r.role === role && r.party === p)?.seats ?? 0 })) }))} />
            </div>
          ))}
        </div>
      )
    }
    case "sponsorship": {
      const parties = ["D", "R"].filter((p) => stats.sponsorship.some((r) => r.party === p))
      if (!parties.length) return null
      return <StackedArea xs={xs} series={parties.map((p) => ({ label: partyLabel(p), points: xs.map((x) => ({ x, y: stats.sponsorship.find((r) => r.session === x && r.party === p)?.bills ?? 0 })) }))} />
    }
    case "enacted": {
      const parties = ["D", "R"].filter((p) => stats.sponsorship.some((r) => r.party === p))
      if (!parties.length) return null
      return <StackedArea xs={xs} series={parties.map((p) => ({ label: partyLabel(p), points: xs.map((x) => ({ x, y: stats.sponsorship.find((r) => r.session === x && r.party === p)?.enacted ?? 0 })) }))} />
    }
    case "passed": {
      const parties = ["D", "R"].filter((p) => stats.sponsorship.some((r) => r.party === p))
      if (!parties.length) return null
      return (
        <Lines
          xs={xs}
          percent
          series={parties.map((p) => ({
            label: partyLabel(p),
            points: xs.map((x) => {
              const r = stats.sponsorship.find((s) => s.session === x && s.party === p)
              return { x, y: r && r.bills ? (100 * r.enacted) / r.bills : 0 }
            }),
          }))}
        />
      )
    }
    case "committees":
      return stats.committees.length ? <Bars rows={stats.committees.map((c) => ({ label: c.committee, n: c.bills }))} /> : null
    case "committee-series": {
      const names = [...new Set(stats.committeeSeries.map((r) => r.committee))]
      if (!names.length) return null
      return <Lines xs={xs} colors={PALETTE} series={names.map((c) => ({ label: c, points: xs.map((x) => ({ x, y: stats.committeeSeries.find((r) => r.session === x && r.committee === c)?.bills ?? 0 })) }))} />
    }
  }
}
