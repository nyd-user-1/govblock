import Link from "next/link"

import { fmtCompact, fmtNumber, truncate } from "@/lib/format"
import type { BillLobbying } from "@/lib/policy/lobbying-queries"
import { Chip } from "@/components/chip"
import { TableBlock } from "@/components/policy/table-block"
import { H2, H3, Table } from "@/components/typeset"

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

const money = (value: number | null | undefined) => (value == null ? "—" : fmtCompact(value))

const lobbyistHref = (name: string) => `/docs/lobbying/lobbyists/${encodeURIComponent(name)}`
const firmHref = (name: string) => `/docs/lobbying/firms/${encodeURIComponent(name)}`
const clientHref = (name: string) => `/docs/lobbying/clients/${encodeURIComponent(name)}`

export function BillLobbyingBlock({ bill, data }: { bill: string; data: BillLobbying | null }) {
  if (!data || !data.summary.filings) return null
  const { summary, clients, firms, lobbyists, issues, documents } = data
  const years = summary.first_year && summary.last_year && summary.first_year !== summary.last_year ? `${summary.first_year} to ${summary.last_year}` : String(summary.last_year ?? "")

  return (
    <>
      <hr />
      <H2 id="lobbying">Lobbying</H2>
      <p>
        <code>{fmtNumber(summary.clients)}</code> {summary.clients === 1 ? "client" : "clients"} hired{" "}
        <code>{fmtNumber(summary.firms)}</code> {summary.firms === 1 ? "firm" : "firms"} and{" "}
        <code>{fmtNumber(summary.lobbyists)}</code> registered {summary.lobbyists === 1 ? "lobbyist" : "lobbyists"} who named{" "}
        <Chip>{bill}</Chip> in <code>{fmtNumber(summary.filings)}</code> quarterly {summary.filings === 1 ? "filing" : "filings"}
        {years ? `, ${years}` : ""}. Reported under the Lobbying Disclosure Act; a filing&rsquo;s income covers everything its
        registrant worked that quarter, so the amounts below are the filings&rsquo;, not this bill&rsquo;s.
      </p>

      {issues.length > 0 && (
        <p>
          Filed under{" "}
          {issues.slice(0, 8).map((row, index) => (
            <span key={row.issue_code}>
              {index > 0 && ", "}
              {row.issue ?? row.issue_code}
            </span>
          ))}
          .
        </p>
      )}

      <H3 id="clients">Clients</H3>
      <p>
        Who paid to be heard, by how many filings named the bill. {clients.length < summary.clients ? `The ${fmtNumber(clients.length)} that filed most often, of ${fmtNumber(summary.clients)}.` : ""}
      </p>
      <TableBlock rows={clients.length}>
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

      <H3 id="firms">Firms</H3>
      <p>Registrants who filed on the bill, by filings.</p>
      <TableBlock rows={firms.length}>
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
      <p>
        Named on the filings that cite the bill. {lobbyists.length < summary.lobbyists ? `The ${fmtNumber(lobbyists.length)} named most often, of ${fmtNumber(summary.lobbyists)}.` : ""}
      </p>
      <TableBlock rows={lobbyists.length}>
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
      <p>The documents themselves, on the Senate&rsquo;s Lobbying Disclosure site, largest reported first.</p>
      <TableBlock rows={documents.length}>
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
