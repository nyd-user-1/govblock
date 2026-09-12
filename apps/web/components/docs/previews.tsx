"use client"

import * as React from "react"

import { useLocal } from "@/lib/policy/use-local"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import { BillText } from "@/components/bill-text"
import { CodeFrame, CodeLines } from "@/components/code-block"
import { CommandBlock } from "@/components/command-block"
import { CopyButton } from "@/components/copy-button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { FileBlock } from "@/components/file-block"
import { ListPager } from "@/components/list-pager"
import { PageActions, PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/page-header"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { Timeline } from "@/components/create/timeline"
import { CardBlock } from "@/components/policy/card-block"
import { DataTable, selectColumn } from "@/components/policy/data-table"
import { MemberCard } from "@/components/policy/member-card"
import { PagedList } from "@/components/policy/paged-list"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"
import { PreviewFrame } from "@/components/preview-frame"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { Callout, H3, Table } from "@/components/typeset"
import { fmtBill } from "@/lib/format"
import type { ColumnDef } from "@tanstack/react-table"
import { AskWidget } from "@/components/chat/ask-widget"
import { MessageAnimated } from "@/components/chat/message-animated"
import { CodeEditor } from "@/components/policy/code-editor"
import { CodeView } from "@/components/policy/code-view"
import { DiffView } from "@/components/policy/diff-view"
import "@/components/policy/diff-view.css"
import { KEYS } from "@/lib/forms/keys"
import { MessageScroller, MessageScrollerContent, MessageScrollerProvider, MessageScrollerViewport } from "@govblock/ui/components/nova/message-scroller"
import { IconCoin, IconFileText, IconUsers, IconUsersGroup } from "@tabler/icons-react"
import { AdoptedCard } from "@/components/cards/adopted-card"
import { ApiCard } from "@/components/cards/api-card"
import { BillsCard } from "@/components/cards/bills-card"
import { ChambersCard } from "@/components/cards/chambers-card"
import { CommitteesCard } from "@/components/cards/committees-card"
import { ConnectCard } from "@/components/cards/connect-card"
import { MembersCard } from "@/components/cards/members-card"
import { NavigationCard } from "@/components/cards/navigation-card"
import { PartyCard } from "@/components/cards/party-card"
import { SessionsCard } from "@/components/cards/sessions-card"
import { StatsCard } from "@/components/cards/stats-card"
import { SubscribeCard } from "@/components/cards/subscribe-card"
import { TopicsCard } from "@/components/cards/topics-card"
import { TrafficCard } from "@/components/cards/traffic-card"
import { VotesCard } from "@/components/cards/votes-card"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell } from "@/components/cards/card-shell"
import { BillCompare } from "@/components/bill-compare"
import type { BillComparison } from "@/lib/policy/bill-compare-types"
import adoptedData from "@/registry/data/adopted.json"
import billStagesData from "@/registry/data/bill-stages.json"
import billsData from "@/registry/data/bills.json"
import byPartyData from "@/registry/data/bills-by-party.json"
import chambersData from "@/registry/data/chambers.json"
import committeesData from "@/registry/data/committees.json"
import membersData from "@/registry/data/members.json"
import redlineData from "@/registry/data/bill-redline.json"
import seatsData from "@/registry/data/seats.json"
import sessionsData from "@/registry/data/sessions.json"
import topicsData from "@/registry/data/topics.json"
import votesData from "@/registry/data/votes.json"

// One preview per registry item that has a picture: the component itself,
// drawn with sample data, inside the docs' preview frame. Libraries and hooks
// with nothing to draw show their usage instead (the page decides).

function SealsPreview() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <ChamberSeal state="NY" chamber="Senate" size={48} />
        NY Senate
      </span>
      <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <ChamberSeal state="NY" chamber="Assembly" size={48} />
        NY Assembly
      </span>
      <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <ChamberSeal state="US" chamber="House" size={48} />
        U.S. House
      </span>
      <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <FlagChip state="TX" width={44} />
        Texas
      </span>
      <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <span className="relative">
          <MemberPortrait name="Ann Wagner" photoUrl={null} state="US" chamber="House" size={48} />
          <PartyDot party="R" serving className="absolute -right-0.5 -bottom-0.5 size-3 ring-2 ring-background" />
        </span>
        Portrait
      </span>
    </div>
  )
}

function DirectorySearchPreview() {
  const [query, setQuery] = React.useState("")
  return (
    <div className="mx-auto w-full max-w-md">
      <SearchDirectory query={query} setQuery={(v) => setQuery(v ?? "")} placeholder="Search members by name, district or party…" />
      <p className="mt-3 text-center text-xs text-muted-foreground">{query ? `Filtering on “${query}”` : "Type to filter; the × clears."}</p>
    </div>
  )
}

function UseLocalPreview() {
  const [count, setCount] = useLocal<number>("44gov-docs:counter", 0)
  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" onClick={() => setCount(count + 1)}>
        Clicked {count} {count === 1 ? "time" : "times"}
      </Button>
      <Button variant="ghost" onClick={() => setCount(0)}>
        Reset
      </Button>
      <span className="text-xs text-muted-foreground">Reload the page; it remembers.</span>
    </div>
  )
}

// ── Sample rows, the shape the site's own lists carry ─────────────────────
const BILLS = [
  { bill_id: 2058568, bill_number: "HB6644", status: "Enrolled", date: "2026-09-03", sponsor: "Mike Flood", chamber: "House", title: "21st Century ROAD to Housing Act" },
  { bill_id: 2036128, bill_number: "HB4", status: "Enrolled", date: "2026-07-18", sponsor: "Steve Scalise", chamber: "House", title: "Rescissions Act of 2025" },
  { bill_id: 2032625, bill_number: "HB3497", status: "Reported in House", date: "2026-06-12", sponsor: "Nicole Malliotakis", chamber: "House", title: "Medal of Sacrifice Act" },
  { bill_id: 2156910, bill_number: "SB5271", status: "Placed on Calendar", date: "2026-08-08", sponsor: "John Thune", chamber: "Senate", title: "Continuing Appropriations Act, 2027" },
  { bill_id: 2008611, bill_number: "HB2159", status: "Reported in Senate", date: "2026-05-02", sponsor: "Barry Moore", chamber: "House", title: "Count the Crimes to Cut Act" },
  { bill_id: 2154287, bill_number: "HB9329", status: "Union Calendar No. 694", date: "2026-09-03", sponsor: "Ann Wagner", chamber: "House", title: "SEC Reform and Restructuring Act" },
]
const TEXT = `119 HR 6644 IH: 21st Century ROAD to Housing Act
U.S. House of Representatives
2026-01-12
text/xml
EN
I  119th CONGRESS  2d Session  H. R. 6644  IN THE HOUSE OF REPRESENTATIVES  January 12, 2026  Mr. Flood introduced the following bill; which was referred to the Committee on Financial Services  A BILL
To reform housing programs, and for other purposes.
1.
Short title; table of contents
(a)
Short title
This Act may be cited as the  21st Century ROAD to Housing Act .
(b)
Table of contents
The table of contents for this Act is as follows:
Sec. 1. Short title; table of contents.
Title I—Housing supply
Sec. 101. Housing supply frameworks.
Sec. 102. Manufactured housing.`

const PM = ["pnpm", "npm", "yarn", "bun"] as const
const ADD = (pm: (typeof PM)[number], item: string) => `${pm === "pnpm" ? "pnpm dlx" : pm === "npm" ? "npx" : pm === "yarn" ? "yarn dlx" : "bunx --bun"} shadcn@latest add @44gov/${item}`

function BillTextPreview() {
  return <BillText text={TEXT} version="Introduced in House" date="2026-01-12" className="max-h-96 overflow-y-auto" />
}
function CodeFigurePreview() {
  const code = `{\n  "registries": {\n    "@44gov": "https://44gov.nysgpt.com/r/{name}.json"\n  }\n}`
  return (
    <CodeFrame title="components.json" code={code}>
      <CodeLines code={code} highlighted={new Set([3])} />
    </CodeFrame>
  )
}
function CommandBlockPreview() {
  return <CommandBlock tabs={PM.map((pm) => ({ value: pm, label: pm, lines: [ADD(pm, "seals")] }))} />
}
function CopyButtonPreview() {
  return (
    <div className="relative mx-auto max-w-md rounded-lg border bg-muted/30 p-4 pr-12 font-mono text-sm">
      npx shadcn@latest add @44gov/copy-button
      <CopyButton value="npx shadcn@latest add @44gov/copy-button" />
    </div>
  )
}
function PageActionsPreview() {
  return (
    <div className="flex justify-center">
      <DocsCopyPage page={"# H.R. 6644\n\n21st Century ROAD to Housing Act"} url="https://gov.nysgpt.com/bills/2058568" typeset="/workspace/typeset/bill/2058568" diff="/workspace/typeset/bill/2058568/comp" git="/workspace/typeset/bill/2058568/git" />
    </div>
  )
}
function DocsTocPreview() {
  return (
    <div className="mx-auto w-56">
      <DocsTableOfContents variant="list" toc={[{ title: "Installation", url: "#installation", depth: 2 }, { title: "Usage", url: "#usage", depth: 2 }, { title: "Data", url: "#data", depth: 2 }, { title: "API Reference", url: "#api-reference", depth: 2 }]} />
    </div>
  )
}
function FileBlockPreview() {
  return <FileBlock title="hr6644/introduced-in-house.txt" lines={TEXT.split("\n")} text={() => TEXT} collapsed="data-[state=closed]:max-h-64" />
}
function ListPagerPreview() {
  const [page, setPage] = React.useState(3)
  return <ListPager page={page} pages={12} onPage={setPage} />
}
function PageHeaderPreview() {
  return (
    <PageHeader>
      <PageHeaderHeading>U.S. Congress Bills</PageHeaderHeading>
      <PageHeaderDescription>The bills most recently acted on in Congress, each with its full text.</PageHeaderDescription>
      <PageActions>
        <Button size="sm">Browse bills</Button>
        <Button size="sm" variant="ghost">
          API
        </Button>
      </PageActions>
    </PageHeader>
  )
}
function PathBarPreview() {
  const [where, setWhere] = React.useState("H.R. 6644")
  return (
    <div className="mx-auto max-w-lg rounded-lg border px-2 py-1">
      <PathBar crumbs={[APP_CRUMB, { label: "Typeset" }, { label: where }]} folder={false} onGo={() => setWhere("Typeset")} />
    </div>
  )
}
function TimelinePreview() {
  return (
    <div className="max-h-96 overflow-y-auto">
      <Timeline
        noun="Actions"
        end="End of the record for this bill"
        rows={[
          { key: "1", date: "2026-06-30", title: "Ordered to be Reported (Amended) by the Yeas and Nays: 28 - 23.", meta: "House · step 4", actions: <span className="font-mono text-xs text-muted-foreground">004</span> },
          { key: "2", date: "2026-06-30", title: "Committee Consideration and Mark-up Session Held", meta: "House · step 3", actions: <span className="font-mono text-xs text-muted-foreground">003</span> },
          { key: "3", date: "2026-06-18", title: "Referred to the House Committee on Financial Services.", meta: "House · step 2", actions: <span className="font-mono text-xs text-muted-foreground">002</span> },
          { key: "4", date: "2026-06-18", title: "Introduced in House", meta: "House · step 1", actions: <span className="font-mono text-xs text-muted-foreground">001</span> },
        ]}
      />
    </div>
  )
}
function RecordListPreview() {
  return (
    <RecordList>
      {BILLS.slice(0, 4).map((b) => (
        <RecordItem key={b.bill_id} href={`/bills/${b.bill_id}`} avatar={<RecordSeal state="US" chamber={b.chamber} />} title={fmtBill(b.bill_number, "US")} lead={b.status} meta={[b.date, b.status, b.sponsor]} description={b.title} />
      ))}
    </RecordList>
  )
}
function PagedListPreview() {
  return <PagedList items={BILLS} total={BILLS.length} pageSize={3} render={(b) => <RecordItem key={b.bill_id} href={`/bills/${b.bill_id}`} avatar={<RecordSeal state="US" chamber={b.chamber} />} title={fmtBill(b.bill_number, "US")} lead={b.status} meta={[b.date, b.sponsor]} description={b.title} />} />
}
type Row = (typeof BILLS)[number]
const COLUMNS: ColumnDef<Row>[] = [
  selectColumn<Row>(),
  { accessorKey: "bill_number", header: "Bill", cell: ({ row }) => <span className="font-medium">{fmtBill(row.original.bill_number, "US")}</span> },
  { accessorKey: "title", header: "Title" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "date", header: "Date" },
]
function DataTablePreview() {
  return <DataTable columns={COLUMNS} rows={BILLS} filterColumn="title" filterPlaceholder="Filter titles…" />
}
function MemberCardPreview() {
  return (
    <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
      <MemberCard state="US" row={{ id: "W000812", name: "Ann Wagner", href: "/members/1", photo: null, chamber: "House", line: "Rep. · R–MO-2 · Sponsor", detail: "Introduced Jun 18, 2026" }} />
      <MemberCard state="US" row={{ id: "G000555", name: "Kirsten Gillibrand", href: "/members/2", photo: null, chamber: "Senate", line: "Sen. · D–NY · Cosponsor", detail: null }} />
    </div>
  )
}
function ProjectCardPreview() {
  return (
    <ProjectGrid>
      <ProjectCard href="/committees/1" media={<ChamberSeal state="NY" chamber="Assembly" size={28} />} title="Environmental Conservation" meta="NYS Assembly · 412 bills" arrow />
      <ProjectCard href="/committees/2" media={<ChamberSeal state="NY" chamber="Senate" size={28} />} title="Environmental Conservation" meta="NYS Senate · 388 bills" arrow />
    </ProjectGrid>
  )
}
function CardBlockPreview() {
  return (
    <CardBlock
      initial={4}
      cards={[
        { key: "1", href: "/committees/1", title: "Financial Services", meta: "U.S. House · 1,204 bills", media: <ChamberSeal state="US" chamber="House" size={28} /> },
        { key: "2", href: "/committees/2", title: "Judiciary", meta: "U.S. House · 2,011 bills", media: <ChamberSeal state="US" chamber="House" size={28} /> },
        { key: "3", href: "/committees/3", title: "Finance", meta: "U.S. Senate · 964 bills", media: <ChamberSeal state="US" chamber="Senate" size={28} /> },
        { key: "4", href: "/committees/4", title: "Armed Services", meta: "U.S. Senate · 712 bills", media: <ChamberSeal state="US" chamber="Senate" size={28} /> },
        { key: "5", href: "/committees/5", title: "Energy and Commerce", meta: "U.S. House · 1,532 bills", media: <ChamberSeal state="US" chamber="House" size={28} /> },
      ]}
    />
  )
}
function PreviewFramePreview() {
  return (
    <PreviewFrame>
      <p className="text-center text-sm text-muted-foreground">Anything, framed the way shadcn frames a preview.</p>
    </PreviewFrame>
  )
}
function TypographyPreview() {
  return (
    <div className="typeset mx-auto max-w-xl">
      <H3 id="preview-heading">A heading with its anchor</H3>
      <Table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>state</code>
            </td>
            <td>
              <code>string</code>
            </td>
          </tr>
        </tbody>
      </Table>
      <Callout>Every page says what it is current to.</Callout>
    </div>
  )
}
function FormatPreview() {
  return (
    <Table>
      <tbody>
        <tr>
          <td>
            <code>fmtBill(&quot;HB6644&quot;, &quot;US&quot;)</code>
          </td>
          <td>{fmtBill("HB6644", "US")}</td>
        </tr>
        <tr>
          <td>
            <code>fmtBill(&quot;A11559&quot;, &quot;NY&quot;)</code>
          </td>
          <td>{fmtBill("A11559", "NY")}</td>
        </tr>
      </tbody>
    </Table>
  )
}

// ── Cards, each drawn from the data set that ships beside it ─────────────
const CARD = "mx-auto w-full max-w-sm"
function VotesCardPreview() { return <div className={CARD}><VotesCard rows={votesData} state="US" /></div> }
function CommitteesCardPreview() { return <div className={CARD}><CommitteesCard rows={committeesData} state="US" /></div> }
function SessionsCardPreview() { return <div className={CARD}><SessionsCard rows={sessionsData} current={2025} state="US" /></div> }
function TopicsCardPreview() { return <div className={CARD}><TopicsCard rows={topicsData} state="US" /></div> }
function PartyCardPreview() { return <div className={CARD}><PartyCard rows={seatsData} state="US" /></div> }
function ChambersCardPreview() { return <div className={CARD}><ChambersCard rows={chambersData} state="US" /></div> }
function BillsCardPreview() { return <div className={CARD}><BillsCard statuses={billStagesData.statuses} total={billStagesData.total ?? undefined} chambers={billStagesData.chambers} state="US" /></div> }
function MembersCardPreview() { return <div className={CARD}><MembersCard rows={membersData} state="US" /></div> }
function TrafficCardPreview() { return <div className={CARD}><TrafficCard rows={byPartyData} state="US" /></div> }
function AdoptedCardPreview() { return <div className={CARD}><AdoptedCard rows={adoptedData} state="US" /></div> }
function StatsCardPreview() {
  return (
    <div className={CARD}>
      <StatsCard title="Lobbying" stats={[{ label: "Registrations", value: "12,940" }, { label: "Clients", value: "5,312" }, { label: "Reported spend", value: "$4.4B" }]} list={["U.S. Chamber of Commerce", "National Association of Realtors", "Pharmaceutical Research & Manufacturers"].map((name, i) => <div key={name} className="flex gap-3"><span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>{name}</div>)} href="https://gov.nysgpt.com/lobbying" footLabel="Lobbying" />
    </div>
  )
}
function ConnectCardPreview() {
  return <div className={CARD}><ConnectCard marks={[{ name: "Slack", src: "/logos/slack.png" }, { name: "Discord", src: "/logos/discord.svg" }, { name: "Google Drive", src: "/logos/google-drive.svg" }]} description="Send bills, votes and hearings where your team already works." cta="Connect" href="https://gov.nysgpt.com/connectors" /></div>
}
function ApiCardPreview() { return <div className={CARD}><ApiCard path="/api/policy/bills?state=US&limit=5" /></div> }
function NavigationCardPreview() {
  return <div className={CARD}><NavigationCard groups={[{ label: "ArXiv", items: [{ name: "Bills", href: "https://gov.nysgpt.com/bills", icon: IconFileText }, { name: "Committees", href: "https://gov.nysgpt.com/committees", icon: IconUsersGroup }, { name: "Members", href: "https://gov.nysgpt.com/members", icon: IconUsers }, { name: "Finance", href: "https://gov.nysgpt.com/money", icon: IconCoin }] }]} /></div>
}
function SubscribeCardPreview() { return <div className={CARD}><SubscribeCard onSubscribe={async () => { await new Promise((r) => setTimeout(r, 600)) }} /></div> }
function CardShellPreview() {
  return (
    <div className={CARD}>
      <CardShell>
        <CardHead title="A card" action={<Button size="sm" variant="ghost">Action</Button>} />
        <p className="px-6 pb-2 text-sm text-muted-foreground">Whatever the card holds.</p>
        <CardFoot href="https://gov.nysgpt.com" label="Open" />
      </CardShell>
    </div>
  )
}
function CardFootPreview() {
  const [chamber, setChamber] = React.useState("")
  return (
    <div className={CARD}>
      <CardShell>
        <CardHead title="With pills" />
        <CardFoot chamber={chamber} onChamber={setChamber} state="NY" href="https://gov.nysgpt.com/bills/ny" label="All bills" />
      </CardShell>
    </div>
  )
}
function BillRedlinePreview() {
  return (
    <div className="max-h-[32rem] overflow-y-auto">
      <BillCompare {...(redlineData as BillComparison)} width="full" locked contained />
    </div>
  )
}
function RecordListDataPreview() {
  return (
    <RecordList>
      {billsData.slice(0, 5).map((b) => (
        <RecordItem key={b.bill_id} href={`https://gov.nysgpt.com/bills/${b.bill_id}`} avatar={<RecordSeal state="US" chamber={b.body ?? chamberOf(b.bill_number)} />} title={fmtBill(b.bill_number, "US")} lead={b.status_desc ?? undefined} meta={[b.last_action_date, b.status_desc, b.sponsor]} description={b.title} />
      ))}
    </RecordList>
  )
}
const chamberOf = (n: string) => (n.startsWith("S") ? "Senate" : "House")

// ── The editors and the chat ─────────────────────────────────────────────
const AFTER = TEXT.replace("To reform housing programs, and for other purposes.", "To reform housing programs, to expand the supply of housing, and for other purposes.").replace("Sec. 102. Manufactured housing.", "Sec. 102. Manufactured housing.\nSec. 103. Housing on federal land.")
function CodeViewPreview() {
  return (
    <div className="h-80 overflow-hidden rounded-lg border">
      <CodeView text={TEXT} wrap fold />
    </div>
  )
}
function CodeEditorPreview() {
  const [text, setText] = React.useState(TEXT)
  return (
    <div className="flex flex-col gap-2">
      <div className="h-72 overflow-hidden rounded-lg border">
        <CodeEditor initial={TEXT} onChange={setText} />
      </div>
      <p className="text-xs text-muted-foreground">{text.split("\n").length} lines</p>
    </div>
  )
}
function DiffViewPreview() {
  return (
    <div className="max-h-96 overflow-y-auto rounded-lg border">
      <DiffView before={TEXT} after={AFTER} reflow />
    </div>
  )
}
function FormChatPreview() {
  const fields = React.useMemo(
    () =>
      KEYS.filter((k) => !k.key.includes("[n]") && !k.always && (k.kind === "text" || k.kind === "date" || k.kind === "tel" || k.kind === "select" || k.kind === "yesno"))
        .slice(0, 4)
        .map((k) => ({ key: k.key, label: k.label, kind: k.kind, options: k.options, multi: k.multi })),
    []
  )
  const [result, setResult] = React.useState<string | null>(null)
  return (
    <div className="mx-auto w-full max-w-lg">
      <AskWidget input={{ section: "about-you", title: "About you", intro: "The Filer asks in the chat; the answer is a form.", fields }} form={null} onSubmit={(r) => setResult(JSON.stringify(r))} />
      {result && <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">{result}</pre>}
    </div>
  )
}
function ChatMessagesPreview() {
  type Turn = { id: string; role: "user" | "assistant"; text: string; reasoning?: string }
  const [turns, setTurns] = React.useState<Turn[]>([
    { id: "1", role: "user", text: "Help me apply for SNAP in New York." },
    { id: "2", role: "assistant", text: "I can. I will ask a few questions, one section at a time, and fill LDSS-2921 as we go.", reasoning: "The reader named a program and a state; the Filer opens the New York application." },
  ])
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <MessageScrollerProvider>
        <MessageScroller className="h-64 rounded-lg border">
          <MessageScrollerViewport className="p-4">
            <MessageScrollerContent>
              {turns.map((m) => (
                <MessageAnimated key={m.id} message={m} />
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
      <Button variant="outline" size="sm" className="self-center" onClick={() => setTurns((t) => [...t, { id: String(t.length + 1), role: t.length % 2 ? "assistant" : "user", text: t.length % 2 ? "Noted. Who lives with you?" : "Just me and my daughter." }])}>
        Add a turn
      </Button>
    </div>
  )
}

export const PREVIEWS: Record<string, React.ComponentType> = {
  seals: SealsPreview,
  "directory-search": DirectorySearchPreview,
  "use-local": UseLocalPreview,
  format: FormatPreview,
  "bill-text": BillTextPreview,
  "code-figure": CodeFigurePreview,
  "command-block": CommandBlockPreview,
  "copy-button": CopyButtonPreview,
  "page-actions": PageActionsPreview,
  "docs-toc": DocsTocPreview,
  "file-block": FileBlockPreview,
  "list-pager": ListPagerPreview,
  "page-header": PageHeaderPreview,
  "path-bar": PathBarPreview,
  timeline: TimelinePreview,
  "record-list": RecordListDataPreview,
  "paged-list": PagedListPreview,
  "data-table": DataTablePreview,
  "member-card": MemberCardPreview,
  "project-card": ProjectCardPreview,
  "card-block": CardBlockPreview,
  "preview-frame": PreviewFramePreview,
  "typeset-typography": TypographyPreview,
  "card-shell": CardShellPreview,
  "card-foot": CardFootPreview,
  "votes-card": VotesCardPreview,
  "committees-card": CommitteesCardPreview,
  "sessions-card": SessionsCardPreview,
  "topics-card": TopicsCardPreview,
  "party-card": PartyCardPreview,
  "chambers-card": ChambersCardPreview,
  "bills-card": BillsCardPreview,
  "members-card": MembersCardPreview,
  "bills-by-party-card": TrafficCardPreview,
  "adopted-card": AdoptedCardPreview,
  "stats-card": StatsCardPreview,
  "connect-card": ConnectCardPreview,
  "api-card": ApiCardPreview,
  "navigation-card": NavigationCardPreview,
  "subscribe-card": SubscribeCardPreview,
  "bill-redline": BillRedlinePreview,
  "code-view": CodeViewPreview,
  "code-editor": CodeEditorPreview,
  "diff-view": DiffViewPreview,
  "form-chat": FormChatPreview,
  "chat-messages": ChatMessagesPreview,
}

/**
 * The item's preview in the docs frame, or `fallback` (the usage, set on the
 * server) when it has none. Decided here, on the client: PREVIEWS is a client
 * module, and a server component that reads `name in PREVIEWS` sees only a
 * reference to it, which is how every page came up without its picture on
 * 2026-09-12.
 */
export function ComponentPreview({ name, fallback }: { name: string; fallback?: React.ReactNode }) {
  const Preview = PREVIEWS[name]
  if (!Preview) return <>{fallback ?? null}</>
  return (
    <PreviewFrame>
      <Preview />
    </PreviewFrame>
  )
}
