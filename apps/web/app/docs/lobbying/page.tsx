import Link from "next/link"

import { fmtCompact, fmtNumber, truncate } from "@/lib/format"
import { getLobbyingOverview, searchLobbying } from "@/lib/policy/lobbying-queries"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { LobbyingSearch } from "@/components/policy/lobbying-search"
import { TableBlock } from "@/components/policy/table-block"
import { H2, Table } from "@/components/typeset"

// The federal lobbying register, on the Bulk Datasets page's shape: what the
// register holds, then the firms, the clients, the lobbyists and the sectors,
// each row opening its own page. Search reads the same three lists by name.
//
// Every figure is the filings' own. A quarterly LDA filing reports one
// registrant's income from one client for everything they worked that quarter;
// the statute asks for no breakdown by issue or by bill, so nothing here is
// apportioned and the page says so rather than implying a precision the law
// does not require.

const title = "Lobbying"
const description = "Who is paid to be heard in Washington, on whose behalf, on what, and what it was reported to be worth."

export const metadata = { title, description }
export const revalidate = 3600

const money = (value: number | null | undefined) => (value == null ? "—" : fmtCompact(value))
const href = (kind: string, name: string) => `/docs/lobbying/${kind}s/${encodeURIComponent(name)}`

type Props = { searchParams: Promise<{ q?: string }> }

export default async function LobbyingPage({ searchParams }: Props) {
  const term = String((await searchParams).q ?? "").trim()
  const [{ totals, firms, clients, lobbyists, sectors }, hits] = await Promise.all([
    getLobbyingOverview().catch(() => ({ totals: null, firms: [], clients: [], lobbyists: [], sectors: [] })),
    term ? searchLobbying(term).catch(() => []) : Promise.resolve([]),
  ])
  const toc = [
    { title: "Firms", url: "#firms", depth: 2 },
    { title: "Clients", url: "#clients", depth: 2 },
    { title: "Lobbyists", url: "#lobbyists", depth: 2 },
    { title: "Sectors", url: "#sectors", depth: 2 },
  ]

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/docs/lobbying"
      previous={{ name: "Finance", url: "/docs/money" }}
      next={{ name: "Roll call votes", url: "/docs/roll-call-votes" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <p>
        Every firm that lobbies Congress files quarterly under the Lobbying Disclosure Act, naming the client, the issues, the
        lobbyists and the bills. The register holds{" "}
        <code>{fmtNumber(totals?.filings ?? 0)}</code> filings from <code>{fmtNumber(totals?.registrants ?? 0)}</code> registrants
        for <code>{fmtNumber(totals?.clients ?? 0)}</code> clients, naming{" "}
        <code>{fmtNumber(totals?.lobbyists ?? 0)}</code> lobbyists and <code>{fmtNumber(totals?.bills ?? 0)}</code> bills
        {totals?.first_year ? `, ${totals.first_year} to ${totals.last_year}` : ""}.
      </p>
      <p>
        A filing&rsquo;s income is what one registrant reported from one client for everything they worked that quarter. The LDA
        asks for no breakdown by issue or by bill, so no figure here is divided between them: a total under a firm is the sum of
        its filings, not a price for any one thing it did.
      </p>

      <LobbyingSearch term={term} />
      {term && (
        <>
          <p>
            {hits.length ? (
              <>
                <code>{fmtNumber(hits.length)}</code> {hits.length === 1 ? "match" : "matches"} for &ldquo;{term}&rdquo;.
              </>
            ) : (
              <>Nothing in the register matches &ldquo;{term}&rdquo;.</>
            )}
          </p>
          {hits.length > 0 && (
            <TableBlock rows={hits.length}>
            <Table>
              <thead>
                <tr>
                  <th className="w-[44%]">Name</th>
                  <th className="w-[14%]">Kind</th>
                  <th className="w-[28%]">Business</th>
                  <th className="w-[14%] pr-8 text-right">Filings</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit) => (
                  <tr key={`${hit.kind}-${hit.name}`}>
                    <td>
                      <Link href={href(hit.kind, hit.name)}>{hit.name}</Link>
                    </td>
                    <td className="capitalize">{hit.kind}</td>
                    <td>{truncate(hit.detail ?? "", 70) || "—"}</td>
                    <td className="pr-8 text-right tabular-nums">{fmtNumber(hit.filings)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </TableBlock>
          )}
        </>
      )}

      <hr />
      <H2 id="firms">Firms</H2>
      <p>Registrants by reported income across every filing they have made.</p>
      <TableBlock rows={firms.length}>
      <Table>
        <thead>
          <tr>
            <th className="w-[52%]">Registrant</th>
            <th className="w-[14%] text-right">Clients</th>
            <th className="w-[16%] text-right">Filings</th>
            <th className="w-[18%] pr-8 text-right">Reported</th>
          </tr>
        </thead>
        <tbody>
          {firms.map((row) => (
            <tr key={row.registrant}>
              <td>
                <Link href={href("firm", row.registrant)}>{row.registrant}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.clients)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.filings)}</td>
              <td className="pr-8 text-right tabular-nums">{money(row.income)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>

      <H2 id="clients">Clients</H2>
      <p>Who is paying, by what their filings report.</p>
      <TableBlock rows={clients.length}>
      <Table>
        <thead>
          <tr>
            <th className="w-[34%]">Client</th>
            <th className="w-[30%]">Business</th>
            <th className="w-[10%] text-right">Firms</th>
            <th className="w-[10%] text-right">Filings</th>
            <th className="w-[16%] pr-8 text-right">Reported</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((row) => (
            <tr key={row.client}>
              <td>
                <Link href={href("client", row.client)}>{row.client}</Link>
              </td>
              <td>{truncate(row.description ?? "", 80) || "—"}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.firms)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.filings)}</td>
              <td className="pr-8 text-right tabular-nums">{money(row.income)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>

      <H2 id="lobbyists">Lobbyists</H2>
      <p>Named on the filings themselves, by how many name them.</p>
      <TableBlock rows={lobbyists.length}>
      <Table>
        <thead>
          <tr>
            <th className="w-[54%]">Lobbyist</th>
            <th className="w-[14%] text-right">Firms</th>
            <th className="w-[14%] text-right">Clients</th>
            <th className="w-[18%] pr-8 text-right">Filings</th>
          </tr>
        </thead>
        <tbody>
          {lobbyists.map((row) => (
            <tr key={row.lobbyist}>
              <td>
                <Link href={href("lobbyist", row.lobbyist)}>{row.lobbyist}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.firms)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.clients)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>

      <H2 id="sectors">Sectors</H2>
      <p>
        The LDA&rsquo;s own issue codes, which is the only sector a filing declares: <code>{sectors.length}</code> of them in use.
      </p>
      <TableBlock rows={sectors.length}>
      <Table>
        <thead>
          <tr>
            <th className="w-[14%]">Code</th>
            <th className="w-[42%]">Issue</th>
            <th className="w-[14%] text-right">Clients</th>
            <th className="w-[14%] text-right">Firms</th>
            <th className="w-[16%] pr-8 text-right">Filings</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((row) => (
            <tr key={row.issue_code}>
              <td>
                <code>{row.issue_code}</code>
              </td>
              <td>{row.issue ?? "—"}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.clients)}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.registrants)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>
    </DocsPage>
  )
}
