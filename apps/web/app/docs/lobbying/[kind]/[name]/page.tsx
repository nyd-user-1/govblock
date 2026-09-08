import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { fmtCompact, fmtDate, fmtNumber, truncate } from "@/lib/format"
import { type EntityKind, getLobbyingEntity } from "@/lib/policy/lobbying-queries"
import { Chip } from "@/components/chip"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, Table } from "@/components/typeset"

// One firm, one client or one lobbyist, on OpenSecrets' entity-page shape: who
// they worked with, what they worked on, what it was reported to be worth, the
// bills they named, and the filings themselves.
//
// Three kinds, one page. The three differ only in which side of a filing they
// sit on, and writing three pages for that would be three places to fix a
// column.

export const revalidate = 3600
export const dynamicParams = true

const KINDS: Record<string, EntityKind> = { firms: "firm", clients: "client", lobbyists: "lobbyist" }

// What the other side of a filing is called, for each kind.
const COUNTERPARTY: Record<EntityKind, { heading: string; column: string; sentence: string }> = {
  firm: { heading: "Clients", column: "Client", sentence: "who it filed for" },
  client: { heading: "Firms", column: "Registrant", sentence: "it has hired" },
  lobbyist: { heading: "Firms", column: "Registrant", sentence: "they have filed under" },
}

const money = (value: number | null | undefined) => (value == null ? "—" : fmtCompact(value))

export async function generateStaticParams() {
  return []
}

async function load(kindParam: string, nameParam: string) {
  const kind = KINDS[String(kindParam ?? "").toLowerCase()]
  if (!kind) return null
  const name = decodeURIComponent(nameParam ?? "")
  if (!name.trim()) return null
  const entity = await getLobbyingEntity(kind, name).catch(() => null)
  return entity
}

type Props = { params: Promise<{ kind: string; name: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, name } = await params
  const entity = await load(kind, name)
  if (!entity) return { title: "Lobbying" }
  return {
    title: entity.name,
    description: `${fmtNumber(entity.filings)} federal lobbying filings, ${entity.first_year} to ${entity.last_year}.`,
  }
}

export default async function LobbyingEntityPage({ params }: Props) {
  const { kind: kindParam, name: nameParam } = await params
  const entity = await load(kindParam, nameParam)
  if (!entity) notFound()
  const words = COUNTERPARTY[entity.kind]
  const years = entity.first_year === entity.last_year ? String(entity.last_year ?? "") : `${entity.first_year} to ${entity.last_year}`
  const otherHref = (name: string) => `/docs/lobbying/${entity.kind === "firm" ? "clients" : "firms"}/${encodeURIComponent(name)}`

  return (
    <DocsPage
      title={entity.name}
      description={`${fmtNumber(entity.filings)} federal lobbying ${entity.filings === 1 ? "filing" : "filings"}${years ? `, ${years}` : ""}.`}
      slug={`/docs/lobbying/${kindParam}/${nameParam}`}
      previous={{ name: "Lobbying", url: "/docs/lobbying" }}
      next={{ name: "Finance", url: "/docs/money" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: words.heading, url: "#counterparties", depth: 2 },
            { title: "By year", url: "#years", depth: 2 },
            { title: "Issues", url: "#issues", depth: 2 },
            { title: "Bills", url: "#bills", depth: 2 },
            { title: "Lobbyists", url: "#lobbyists", depth: 2 },
            { title: "Filings", url: "#filings", depth: 2 },
          ]}
        />
      }
    >
      <p>
        <Chip>{entity.name}</Chip> is {entity.kind === "lobbyist" ? "a registered lobbyist named on" : entity.kind === "firm" ? "a registrant on" : "a client on"}{" "}
        <code>{fmtNumber(entity.filings)}</code> federal lobbying {entity.filings === 1 ? "filing" : "filings"}
        {years ? `, ${years}` : ""}
        {entity.income != null ? (
          <>
            , reporting <code>{money(entity.income)}</code> across them
          </>
        ) : null}
        .{entity.description ? ` ${entity.description}` : ""}
        {entity.state ? ` Based in ${entity.state}.` : ""}
      </p>
      <p>
        An LDA filing reports one registrant&rsquo;s income from one client for everything they worked that quarter, so a total
        here is the sum of whole filings and never a price for one issue or one bill.
      </p>

      <hr />
      <H2 id="counterparties">{words.heading}</H2>
      <p>
        <code>{fmtNumber(entity.counterparties.length)}</code> {words.sentence}, by filings.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[60%]">{words.column}</th>
            <th className="w-[20%] text-right">Filings</th>
            <th className="w-[20%] pr-8 text-right">Reported</th>
          </tr>
        </thead>
        <tbody>
          {entity.counterparties.map((row) => (
            <tr key={row.name}>
              <td>
                <Link href={otherHref(row.name)}>{row.name}</Link>
              </td>
              <td className="text-right tabular-nums">{fmtNumber(row.filings)}</td>
              <td className="pr-8 text-right tabular-nums">{money(row.income)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="years">By year</H2>
      <p>Filings and what they reported, newest year first.</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[34%]">Year</th>
            <th className="w-[22%] text-right">Filings</th>
            <th className="w-[22%] text-right">Income</th>
            <th className="w-[22%] pr-8 text-right">Expenses</th>
          </tr>
        </thead>
        <tbody>
          {entity.years.map((row) => (
            <tr key={row.filing_year}>
              <td className="tabular-nums">{row.filing_year}</td>
              <td className="text-right tabular-nums">{fmtNumber(row.filings)}</td>
              <td className="text-right tabular-nums">{money(row.income)}</td>
              <td className="pr-8 text-right tabular-nums">{money(row.expenses)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      {entity.issues.length > 0 && (
        <>
          <H2 id="issues">Issues</H2>
          <p>The LDA issue codes the filings were filed under.</p>
          <Table>
            <thead>
              <tr>
                <th className="w-[16%]">Code</th>
                <th className="w-[64%]">Issue</th>
                <th className="w-[20%] pr-8 text-right">Filings</th>
              </tr>
            </thead>
            <tbody>
              {entity.issues.map((row) => (
                <tr key={row.issue_code}>
                  <td>
                    <code>{row.issue_code}</code>
                  </td>
                  <td>{row.issue ?? "—"}</td>
                  <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {entity.bills.length > 0 && (
        <>
          <H2 id="bills">Bills</H2>
          <p>The bills the filings name, by how many name them.</p>
          <Table>
            <thead>
              <tr>
                <th className="w-[18%]">Bill</th>
                <th className="w-[62%]">Title</th>
                <th className="w-[20%] pr-8 text-right">Filings</th>
              </tr>
            </thead>
            <tbody>
              {entity.bills.map((row) => (
                <tr key={row.congress_key}>
                  <td className="whitespace-nowrap">
                    {row.bill_id ? <Link href={`/docs/bills/${row.bill_id}`}>{row.citation}</Link> : row.citation}
                  </td>
                  <td>{truncate(row.title ?? "", 110) || "—"}</td>
                  <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {entity.kind !== "lobbyist" && entity.lobbyists.length > 0 && (
        <>
          <H2 id="lobbyists">Lobbyists</H2>
          <p>Named on the filings.</p>
          <Table>
            <thead>
              <tr>
                <th className="w-[60%]">Lobbyist</th>
                <th className="w-[20%] text-right">Clients</th>
                <th className="w-[20%] pr-8 text-right">Filings</th>
              </tr>
            </thead>
            <tbody>
              {entity.lobbyists.map((row) => (
                <tr key={row.lobbyist}>
                  <td>
                    <Link href={`/docs/lobbying/lobbyists/${encodeURIComponent(row.lobbyist)}`}>{row.lobbyist}</Link>
                  </td>
                  <td className="text-right tabular-nums">{fmtNumber(row.clients)}</td>
                  <td className="pr-8 text-right tabular-nums">{fmtNumber(row.filings)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      <H2 id="filings">Filings</H2>
      <p>The documents themselves, on the Senate&rsquo;s Lobbying Disclosure site, newest first.</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[28%]">Client</th>
            <th className="w-[28%]">Registrant</th>
            <th className="w-[14%]">Period</th>
            <th className="w-[14%] text-right">Reported</th>
            <th className="w-[16%] pr-8 text-right">Posted</th>
          </tr>
        </thead>
        <tbody>
          {entity.documents.map((row) => (
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
                    {row.posted ? fmtDate(row.posted) : "Filing"}
                  </a>
                ) : row.posted ? (
                  fmtDate(row.posted)
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </DocsPage>
  )
}
