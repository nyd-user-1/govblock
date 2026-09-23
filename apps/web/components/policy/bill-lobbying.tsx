import Link from "next/link"

import { fmtCompact, fmtNumber, truncate } from "@/lib/format"
import type { BillLobbying } from "@/lib/policy/lobbying-queries"
import { TableBlock } from "@/components/policy/table-block"
import { H3, Table } from "@/components/typeset"

// What was spent to be heard on a bill, as OpenSecrets' bill-lobbying page
// shows it: who hired whom, who they named, what they filed it under, and the
// filings themselves. Federal only — the LDA is a federal statute, and the
// rows join on congress.gov's own bill key.
//
// Money is the filing's, not the bill's. A quarterly LDA filing reports one
// registrant's income from one client for everything they worked that quarter,
// across every issue and every bill the filing names; the statute asks for no
// breakdown. So the column is labelled for what it is and never summed as
// though it were the price of this bill.
//
// Four sections rather than one holding four (Brendan, 2026-09-22): the
// "Lobbying" heading and the paragraph counting the clients, firms, lobbyists
// and filings said what the four tables under it say row by row, so Clients and
// Firms carry the word instead.

const money = (value: number | null | undefined) => (value == null ? "—" : fmtCompact(value))

/** Five rows before See more, not the ten a table gets elsewhere: four of these stand one after another (Brendan, 2026-09-22). */
const SHOWN = 5

const lobbyistHref = (name: string) => `/lobbying/lobbyists/${encodeURIComponent(name)}`
const firmHref = (name: string) => `/lobbying/firms/${encodeURIComponent(name)}`
const clientHref = (name: string) => `/lobbying/clients/${encodeURIComponent(name)}`

export function BillLobbyingBlock({ data }: { data: BillLobbying | null }) {
  if (!data || !data.summary.filings) return null
  const { clients, firms, lobbyists, documents } = data

  return (
    <>
      <H3 id="clients">Lobbying Clients</H3>
      <TableBlock rows={clients.length} shown={SHOWN}>
      <Table>
        <thead>
          <tr>
            <th className="w-[34%]">Client</th>
            <th className="w-[30%]">Business</th>
            <th className="w-[8%]">State</th>
            <th className="w-[10%] text-right">Firms</th>
            <th className="w-[9%] text-right">Filings</th>
            <th className="w-[9%] pr-8 text-right">Reported</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((row) => (
            <tr key={row.client}>
              <td>
                <Link href={clientHref(row.client)}>{row.client}</Link>
              </td>
              <td>{truncate(row.description ?? "", 90) || "—"}</td>
              <td>{row.client_state ?? "—"}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.firms)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.filings)}</td>
              <td className="pr-8 text-right tabular-nums">{money(row.income)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>

      <H3 id="firms">Lobbying Firms</H3>
      <TableBlock rows={firms.length} shown={SHOWN}>
      <Table>
        <thead>
          <tr>
            <th className="w-[56%]">Registrant</th>
            <th className="w-[14%] text-right">Clients</th>
            <th className="w-[14%] text-right">Filings</th>
            <th className="w-[16%] pr-8 text-right">Reported</th>
          </tr>
        </thead>
        <tbody>
          {firms.map((row) => (
            <tr key={row.registrant}>
              <td>
                <Link href={firmHref(row.registrant)}>{row.registrant}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.clients)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.filings)}</td>
              <td className="pr-8 text-right tabular-nums">{money(row.income)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>

      <H3 id="lobbyists">Lobbyists</H3>
      <TableBlock rows={lobbyists.length} shown={SHOWN}>
      <Table>
        <thead>
          <tr>
            <th className="w-[56%]">Lobbyist</th>
            <th className="w-[14%] text-right">Firms</th>
            <th className="w-[14%] text-right">Clients</th>
            <th className="w-[16%] pr-8 text-right">Filings</th>
          </tr>
        </thead>
        <tbody>
          {lobbyists.map((row) => (
            <tr key={row.lobbyist}>
              <td>
                <Link href={lobbyistHref(row.lobbyist)}>{row.lobbyist}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.firms)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.clients)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>

      <H3 id="filings">Filings</H3>
      <TableBlock rows={documents.length} shown={SHOWN}>
      <Table>
        <thead>
          <tr>
            <th className="w-[30%]">Client</th>
            <th className="w-[30%]">Registrant</th>
            <th className="w-[14%]">Period</th>
            <th className="w-[12%] text-right">Reported</th>
            <th className="w-[14%] pr-8 text-right">Document</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((row) => (
            <tr key={row.filing_uuid}>
              <td>{row.client}</td>
              <td>{row.registrant}</td>
              <td className="whitespace-nowrap">
                {row.filing_year} {row.filing_period ?? ""}
              </td>
              <td className="text-right tabular-nums">{money(row.income ?? row.expenses)}</td>
              <td className="pr-8 text-right whitespace-nowrap">
                {row.document_url || row.url ? (
                  <a href={(row.document_url || row.url) as string} target="_blank" rel="noopener noreferrer">
                    {row.filing_type ? truncate(row.filing_type, 22) : "Filing"}
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>
    </>
  )
}
