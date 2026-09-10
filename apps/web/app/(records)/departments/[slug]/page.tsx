import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { type Department, departmentsOf, findDepartment } from "@/lib/data/departments"
import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { agencySeal } from "@/lib/seals"
import { congressName } from "@/lib/policy/congress"
import { getSessionsWithTitles, latestSession } from "@/lib/policy/db-queries"
import { getDepartmentBills, getDepartmentBudget, getDepartmentForms, getDepartmentNominations } from "@/lib/policy/department-queries"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { Chip } from "@/components/chip"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal } from "@/components/policy/imagery"
import { RecordAvatar } from "@/components/policy/record-item"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { DepartmentBills, DepartmentBudgetBlock, DepartmentForms, DepartmentNominations, DepartmentToc } from "@/components/policy/department-page"
import { H2 } from "@/components/typeset"

// One department, agency or authority, on the member page's design: the
// seal, the name, the jurisdiction and kind as the facts; Summary; the rule;
// Record with Budget, Bills, Nominations and Forms (Brendan, 2026-09-06).

export const revalidate = 3600

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("department: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

type Props = { params: Promise<{ slug: string }> }

const jurisdiction = (d: Department) => (d.state === "US" ? "the United States" : stateName(d.state))
const kindOf = (d: Department) => (d.kind === "Authority" ? "public authority" : d.kind.toLowerCase())
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a")

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const department = findDepartment(slug)
  if (!department) return { title: "Department" }
  return {
    title: department.name,
    description: department.description ? `${department.name} exists to ${department.description}.` : `${department.name}, ${article(kindOf(department))} ${kindOf(department)} of ${jurisdiction(department)}.`,
  }
}

export default async function DepartmentRoute({ params }: Props) {
  const { slug } = await params
  const department = findDepartment(slug)
  if (!department) notFound()
  const state = department.state
  const session = await latestSession(state)
  const sessions = await safe(() => getSessionsWithTitles(state), [] as { session_id: number; title: string | null }[])
  const sessionName =
    state === "US"
      ? congressName(session)
      : (sessions.find((r) => Number(r.session_id) === session)?.title ?? "")
          .replace(/\s*(Regular|General)\s+Session$/i, "")
          .replace(/\s*Session$/i, "")
          .trim() || String(session)
  const f = { state, session }
  const [budget, bills, nominations, forms] = await Promise.all([
    safe(() => getDepartmentBudget(department), { agencies: [], appropriations: [], capital: [], spending: [] }),
    safe(() => getDepartmentBills(f, department, 25, 0), { rows: [], total: 0 }),
    safe(() => getDepartmentNominations(department, 25, 0), { rows: [], total: 0 }),
    department.forms.length ? safe(() => getDepartmentForms(department, 25, 0), null) : Promise.resolve(null),
  ])
  const siblings = departmentsOf(state)
    .filter((d) => d.kind === department.kind)
    .sort((a, b) => a.name.localeCompare(b.name))
  const at = siblings.findIndex((d) => d.slug === department.slug)
  const neighbours = { previous: at > 0 ? siblings[at - 1] : null, next: at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null }
  const seal = state === "US" ? agencySeal(department.name) : null
  const who = department.name
  const facts = [state === "US" ? "United States" : stateName(state), department.kind]
  const hasBudget = budget.appropriations.length + budget.capital.length + budget.spending.length > 0
  const parts: string[] = []
  if (hasBudget) parts.push("Budget")
  if (bills.total) parts.push("Bills")
  if (nominations.total) parts.push("Nominations")
  if (forms?.count) parts.push("Forms")
  const markdown = [`# ${who}`, "", department.description ? `${who} exists to ${department.description}.` : `${who}, ${article(kindOf(department))} ${kindOf(department)} of ${jurisdiction(department)}.`].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <RecordHeader
            media={seal ? <RecordAvatar src={seal.file} shape={seal.shape} alt="" size={RECORD_MEDIA} /> : <ChamberSeal state={state} chamber={null} size={RECORD_MEDIA} />}
            title={who}
            meta={facts}
            action={
              <>
                <DocsCopyPage page={markdown} url={`https://gov.nysgpt.com/departments/${department.slug}`} />
                {neighbours.previous ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/departments/${neighbours.previous.slug}`} title={neighbours.previous.name}>
                      <IconArrowLeft />
                      <span className="sr-only">Previous</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/departments?state=${state}`}>
                      <IconArrowLeft />
                      <span className="sr-only">All departments</span>
                    </Link>
                  </Button>
                )}
                {neighbours.next ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/departments/${neighbours.next.slug}`} title={neighbours.next.name}>
                      <IconArrowRight />
                      <span className="sr-only">Next</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} disabled>
                    <IconArrowRight />
                  </Button>
                )}
              </>
            }
          />
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
            <H2>Summary</H2>
            <p>
              <Chip>{who}</Chip> is {article(kindOf(department))} {kindOf(department)} of {jurisdiction(department)}
              {department.description ? <>, and exists to {department.description}</> : null}.
              {bills.total ? (
                <>
                  {" "}
                  {fmtNumber(bills.total)} {bills.total === 1 ? "bill" : "bills"} {state === "US" ? `of the ${sessionName}` : "this session"} name it
                  {nominations.total ? (
                    <>
                      , and the Senate has received {fmtNumber(nominations.total)} {nominations.total === 1 ? "nomination" : "nominations"} to it
                    </>
                  ) : null}
                  .
                </>
              ) : nominations.total ? (
                <>
                  {" "}
                  The Senate has received {fmtNumber(nominations.total)} {nominations.total === 1 ? "nomination" : "nominations"} to it this Congress.
                </>
              ) : null}
            </p>

            <hr />
            <H2>Record</H2>
            <p>
              {parts.length ? (
                <>
                  The record holds{" "}
                  {parts.map((p, i) => (
                    <span key={p}>
                      {i > 0 ? (i === parts.length - 1 ? " and " : ", ") : ""}
                      {p.toLowerCase() === "budget" ? "the budget" : p.toLowerCase()}
                    </span>
                  ))}{" "}
                  for <Chip>{who}</Chip>.
                </>
              ) : (
                <>
                  Nothing beyond the listing is on the record for <Chip>{who}</Chip> yet.
                </>
              )}
            </p>
            <DepartmentBudgetBlock budget={budget} who={who} />
            <DepartmentBills rows={bills.rows} total={bills.total} department={department} state={state} session={session} who={who} />
            <DepartmentNominations rows={nominations.rows} total={nominations.total} department={department} who={who} />
            {forms && <DepartmentForms rows={forms.rows} total={forms.count} inspected={forms.inspected} department={department} state={state} who={who} />}
          </div>
          {(neighbours.previous || neighbours.next) && (
            <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
              {neighbours.previous && (
                <Button variant="secondary" size="sm" className="shadow-none" asChild>
                  <Link href={`/departments/${neighbours.previous.slug}`}>
                    <IconArrowLeft /> {neighbours.previous.name}
                  </Link>
                </Button>
              )}
              {neighbours.next && (
                <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                  <Link href={`/departments/${neighbours.next.slug}`}>
                    {neighbours.next.name} <IconArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          )}
          <BackToTop />
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="scrollbar-none flex scroll-fade flex-col gap-8 overflow-y-auto px-8">
          <DepartmentToc parts={parts} />
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
