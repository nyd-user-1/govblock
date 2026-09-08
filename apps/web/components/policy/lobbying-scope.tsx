import Link from "next/link"

import { fmtNumber, truncate } from "@/lib/format"
import type { RevolvingDoorRow, ScopedLobbying } from "@/lib/policy/lobbying-queries"
import { Chip } from "@/components/chip"
import { H3, Table } from "@/components/typeset"

// Lobbying on a set of bills, for the member page and the committee page. The
// question is the same on both — who was paid to be heard on the bills this
// person wrote, or on the bills sent to this room — so it is one block.
//
// Money is deliberately absent. A filing's income covers everything its
// registrant worked that quarter, so summing it across a member's bills would
// invent a number the LDA never asked anyone to report. Filings and clients
// are counted; dollars are left to the filing's own page.

export function LobbyingScopeBlock({
  data,
  revolving,
  who,
  what,
}: {
  data: ScopedLobbying | null
  /** Named lobbyists who also appear in the congressional record. */
  revolving?: RevolvingDoorRow[]
  /** The subject of the sentence: a member's name, or a committee's. */
  who: string
  /** What the bills are to them: "sponsored", "referred to it". */
  what: string
}) {
  if (!data) return null
  return (
    <>
      <H3 id="lobbying">Lobbying</H3>
      <p>
        <code>{fmtNumber(data.clients)}</code> {data.clients === 1 ? "client" : "clients"} and{" "}
        <code>{fmtNumber(data.firms)}</code> {data.firms === 1 ? "firm" : "firms"} named{" "}
        <code>{fmtNumber(data.bills)}</code> of the bills {what} <Chip>{who}</Chip> in{" "}
        <code>{fmtNumber(data.filings)}</code> quarterly {data.filings === 1 ? "filing" : "filings"} under the Lobbying
        Disclosure Act.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[52%]">Client</th>
            <th className="w-[24%] text-right">Bills</th>
            <th className="w-[24%] pr-8 text-right">Filings</th>
          </tr>
        </thead>
        <tbody>
          {data.topClients.map((row) => (
            <tr key={row.client}>
              <td>
                <Link href={`/docs/lobbying/clients/${encodeURIComponent(row.client)}`}>{row.client}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.bills)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p>Registrants filing on those bills, and the bills they named most.</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[52%]">Registrant</th>
            <th className="w-[24%] text-right">Bills</th>
            <th className="w-[24%] pr-8 text-right">Filings</th>
          </tr>
        </thead>
        <tbody>
          {data.topFirms.map((row) => (
            <tr key={row.registrant}>
              <td>
                <Link href={`/docs/lobbying/firms/${encodeURIComponent(row.registrant)}`}>{row.registrant}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.bills)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data.topBills.length > 0 && (
        <>
          <p>The bills most often named.</p>
          <Table>
            <thead>
              <tr>
                <th className="w-[16%]">Bill</th>
                <th className="w-[64%]">Title</th>
                <th className="w-[20%] pr-8 text-right">Filings</th>
              </tr>
            </thead>
            <tbody>
              {data.topBills.map((row) => (
                <tr key={row.congress_key}>
                  <td className="whitespace-nowrap">
                    {row.bill_id ? <Link href={`/docs/bills/${row.bill_id}`}>{row.citation}</Link> : row.citation}
                  </td>
                  <td>{truncate(row.title ?? "", 100) || "—"}</td>
                  <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      {revolving && revolving.length > 0 && (
        <>
          <p>
            <code>{fmtNumber(revolving.length)}</code> of the lobbyists named on those filings share a name with someone in the
            congressional record — a former member, or a name in the House staff directory. This is a{" "}
            <strong>name match</strong>, not a verified identity: we hold today&rsquo;s House roster and no employment history at
            all, and the Senate publishes no staff directory, so the names are shown rather than only counted.
          </p>
          <Table>
            <thead>
              <tr>
                <th className="w-[52%]">Lobbyist</th>
                <th className="w-[28%]">In the record as</th>
                <th className="w-[20%] pr-8 text-right">Filings</th>
              </tr>
            </thead>
            <tbody>
              {revolving.map((row) => (
                <tr key={row.name}>
                  <td>
                    <Link href={`/docs/lobbying/lobbyists/${encodeURIComponent(row.name)}`}>{row.name}</Link>
                  </td>
                  <td>
                    {row.was}
                    {row.party ? ` (${row.party})` : ""}
                  </td>
                  <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  )
}
