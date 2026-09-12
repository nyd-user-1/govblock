"use client"

import { chamberFromNumber } from "@/lib/imagery"
import * as React from "react"
import { ChevronDown } from "lucide-react"

import { fmtBill, fmtDate, fmtNumber, truncate } from "@/lib/format"
import type { BillRow } from "@/lib/policy/types"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@govblock/ui/components/nova/drawer"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@govblock/ui/components/nova/field"
import { RadioGroup, RadioGroupItem } from "@govblock/ui/components/nova/radio-group"
import { useIsMobile } from "@govblock/ui/hooks/use-mobile"
import { PagedList } from "@/components/policy/paged-list"
import { RecordItem, RecordSeal } from "@/components/policy/record-item"
import { PreviewFrame } from "@/components/preview-frame"

// The bills under one subject — our version of congress.gov's search result
// (Brendan, 2026-09-05): each result is the bill row every list on the site
// draws, paged with the standard footer, and what congress.gov puts in its
// facets and its pageSort lives in a drawer: the order, and the chamber.

type Sort = "newest" | "number-desc" | "number-asc"
type Chamber = "" | "House" | "Senate"

const SORTS: { value: Sort; id: string; label: string; description: string; badge?: string }[] = [
  { value: "newest", id: "sort-newest", label: "Latest action", description: "The bill acted on most recently first", badge: "Default" },
  { value: "number-desc", id: "sort-number-desc", label: "Bill number, descending", description: "The newest numbers first, as congress.gov sorts a search" },
  { value: "number-asc", id: "sort-number-asc", label: "Bill number, ascending", description: "H.R. 1 first" },
]

const CHAMBERS: { value: Chamber; id: string; label: string; description: string }[] = [
  { value: "", id: "chamber-all", label: "Both chambers", description: "Every bill under the subject" },
  { value: "House", id: "chamber-house", label: "House", description: "House bills and resolutions only" },
  { value: "Senate", id: "chamber-senate", label: "Senate", description: "Senate bills and resolutions only" },
]

function query(state: string, session: number, subject: string, sort: Sort, chamber: Chamber, limit: number, offset: number) {
  const params = new URLSearchParams({ state, session: String(session), subject, sort, limit: String(limit), offset: String(offset) })
  if (chamber) params.set("chamber", chamber)
  return `/api/policy/bills?${params.toString()}`
}

export function SubjectBills({
  state,
  session,
  subject,
  bills,
  total,
  chambers,
}: {
  state: string
  session: number
  subject: string
  /** The first page, rendered on the server. */
  bills: BillRow[]
  total: number
  /** Which chambers the subject's bills come from, so the drawer offers only those. */
  chambers: string[]
}) {
  const isMobile = useIsMobile() ?? false
  const [open, setOpen] = React.useState(false)
  const [sort, setSort] = React.useState<Sort>("newest")
  const [chamber, setChamber] = React.useState<Chamber>("")
  const [draft, setDraft] = React.useState<{ sort: Sort; chamber: Chamber }>({ sort: "newest", chamber: "" })
  const [page, setPage] = React.useState<{ key: string; rows: BillRow[]; total: number }>({ key: "newest|", rows: bills, total })
  const [busy, setBusy] = React.useState(false)

  async function confirm() {
    setOpen(false)
    if (draft.sort === sort && draft.chamber === chamber) return
    setBusy(true)
    try {
      const res = await fetch(query(state, session, subject, draft.sort, draft.chamber, 10, 0))
      const data = (await res.json()) as { rows?: BillRow[]; total?: number }
      setSort(draft.sort)
      setChamber(draft.chamber)
      setPage({ key: `${draft.sort}|${draft.chamber}`, rows: data.rows ?? [], total: data.total ?? 0 })
    } finally {
      setBusy(false)
    }
  }

  const more = async (offset: number, limit: number) => {
    const res = await fetch(query(state, session, subject, sort, chamber, limit, offset))
    const data = (await res.json()) as { rows?: BillRow[] }
    return data.rows ?? []
  }

  const drawer = (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle={isMobile} swipeDirection={isMobile ? "down" : "right"}>
      <DrawerTrigger
        render={
          <Button variant="outline" className="ml-auto" disabled={busy}>
            Sort <ChevronDown />
          </Button>
        }
      />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Sort the bills</DrawerTitle>
          <DrawerDescription>
            {fmtNumber(page.total)} {page.total === 1 ? "bill" : "bills"} under {subject}. Choose the order, and the chamber.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 scroll-fade overflow-y-auto p-4">
          <RadioGroup value={draft.sort} onValueChange={(value) => setDraft((d) => ({ ...d, sort: value as Sort }))} className="gap-2">
            {SORTS.map((option) => (
              <FieldLabel key={option.value} htmlFor={option.id}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle className="flex items-center gap-2">{option.label}</FieldTitle>
                    <FieldDescription>{option.description}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={option.value} id={option.id} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
          {chambers.length > 1 && (
            <RadioGroup value={draft.chamber} onValueChange={(value) => setDraft((d) => ({ ...d, chamber: value as Chamber }))} className="mt-6 gap-2">
              {CHAMBERS.filter((option) => !option.value || chambers.includes(option.value)).map((option) => (
                <FieldLabel key={option.id} htmlFor={option.id}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle className="flex items-center gap-2">{option.label}</FieldTitle>
                      <FieldDescription>{option.description}</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value={option.value} id={option.id} />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          )}
        </div>
        <DrawerFooter>
          <Button onClick={confirm} className="h-[34px]">
            Show bills
          </Button>
          <DrawerClose render={<Button variant="outline">Cancel</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )

  return (
    <PreviewFrame>
      <PagedList
        key={page.key}
        items={page.rows}
        total={page.total}
        more={more}
        pageSize={10}
        menu={drawer}
        empty={`No bills under ${subject} this session.`}
        render={(bill, index) => (
          <RecordItem
            key={bill.bill_id}
            hover="rail"
            href={`/bills/${bill.bill_id}`}
            avatar={<RecordSeal state={state} chamber={bill.body ?? chamberFromNumber(bill.bill_number)} ordinal={index + 1} />}
            title={fmtBill(bill.bill_number, state)}
            lead={bill.last_action}
            meta={[
              bill.last_action_date ? fmtDate(bill.last_action_date) : null,
              bill.status_desc || "Introduced",
              bill.committee ? `${bill.committee} Committee` : null,
              bill.sponsor,
            ]}
            description={truncate(bill.title, 240)}
          />
        )}
      />
    </PreviewFrame>
  )
}
