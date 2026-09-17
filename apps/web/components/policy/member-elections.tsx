import { H2 } from "@/components/typeset"
import { lowerChamber } from "@/lib/filters"
import type { MemberElection } from "@/lib/policy/election-queries"

// A member's elections, newest first: the seat, the result, and who ran
// against them. Generals and the primaries the sources hold (Klarner's state
// primaries are 2014–2015 only; the FEC counts every congressional primary).

const number = new Intl.NumberFormat("en-US")

const person = (name: string) => {
  const [last, first] = name.split(/,\s*/)
  const full = first ? `${first} ${last}` : name
  return full === full.toUpperCase() ? full.toLowerCase().replace(/(^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase()) : full
}

const party = (p: string | null) => (!p ? "" : /^DEM/i.test(p) || p === "D" ? "D" : /^REP/i.test(p) || p === "R" ? "R" : p.length <= 4 ? p : p[0] + p.slice(1).toLowerCase())

const seat = (e: MemberElection) => {
  if (e.office === "US SENATE") return "U.S. Senate"
  if (e.office === "US HOUSE") return e.district === "0" ? "U.S. House, at large" : `U.S. House District ${e.district}`
  const chamber = e.office === "STATE SENATE" ? (e.state === "NE" ? "Legislature" : "Senate") : lowerChamber(e.state)
  return `${chamber} District ${e.district.replace("/", ", seat ")}`
}

export function MemberElections({ elections, who }: { elections: MemberElection[]; who: string }) {
  if (!elections.length) return null
  const generals = elections.filter((e) => e.stage === "GEN")
  const won = generals.filter((e) => e.won).length
  const unopposed = generals.filter((e) => e.won && e.unopposed).length
  return (
    <>
      <H2>Elections</H2>
      <p>
        {who} won {won} of {generals.length} general {generals.length === 1 ? "election" : "elections"} since {Math.min(...elections.map((e) => e.year))}
        {unopposed ? `, ${unopposed} of them with no opponent` : ""}.
      </p>
      <div data-not-typeset="true" className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm tabular-nums">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Race</th>
              <th className="px-3 py-2 text-right font-medium">Votes</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Against</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {elections.map((e) => (
              <tr key={`${e.year}-${e.office}-${e.district}-${e.stage}`}>
                <td className="px-3 py-2">{e.year}</td>
                <td className="px-3 py-2">
                  {seat(e)}
                  <span className="text-muted-foreground">{e.stage === "PRI" ? `, ${party(e.party)} primary` : ""}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {e.votes === null ? "—" : number.format(e.votes)}
                  {e.share !== null && !e.unopposed ? <span className="text-muted-foreground"> · {e.share}%</span> : null}
                </td>
                <td className="px-3 py-2">{e.stage === "PRI" ? (e.unopposed ? "Unopposed" : "") : e.won ? (e.unopposed ? "Won, unopposed" : "Won") : "Lost"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {e.opponents
                    .slice(0, 2)
                    .map((o) => `${person(o.name)}${o.party ? ` (${party(o.party)})` : ""}`)
                    .join(", ")}
                  {e.opponents.length > 2 ? ` and ${e.opponents.length - 2} more` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
