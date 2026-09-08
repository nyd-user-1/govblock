"use client"

import * as React from "react"

import { ArrowRight } from "lucide-react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Field, FieldContent, FieldLabel, FieldTitle } from "@govblock/ui/components/nova/field"
import { RadioGroup, RadioGroupItem } from "@govblock/ui/components/nova/radio-group"

// The filter panel in /search's right rail (Brendan, 2026-09-05: "a real
// filter panel"). Every control narrows the results on the page: which
// sections show, whether the jurisdiction in scope stands alone, and for the
// bills, the chamber and the status. The choices live in the URL beside the
// query, so a filtered search is a link.

export type SearchFilterState = {
  /** The sections shown; empty means all. */
  show: string[]
  /** "here" keeps to the jurisdiction in scope; "all" is every jurisdiction. */
  scope: "all" | "here"
  chamber: string
  status: string[]
}

export const SECTIONS: { key: string; label: string }[] = [
  { key: "bills", label: "Bills" },
  { key: "texts", label: "Text" },
  { key: "members", label: "Members" },
  { key: "committees", label: "Committees" },
  { key: "topics", label: "Topics" },
  { key: "pages", label: "Pages" },
]

export const EMPTY_FILTERS: SearchFilterState = { show: [], scope: "all", chamber: "", status: [] }

/** The id /search hangs on a section, and the rail jumps to. */
export const sectionId = (key: string) => `results-${key}`

export function readFilters(params: URLSearchParams): SearchFilterState {
  const list = (key: string) => (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return {
    show: list("show"),
    scope: params.get("scope") === "here" ? "here" : "all",
    chamber: params.get("chamber") ?? "",
    status: list("status"),
  }
}

export function writeFilters(params: URLSearchParams, filters: SearchFilterState) {
  const set = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key))
  set("show", filters.show.join(","))
  set("scope", filters.scope === "here" ? "here" : "")
  set("chamber", filters.chamber)
  set("status", filters.status.join(","))
  return params
}

export function isFiltered(filters: SearchFilterState) {
  return filters.show.length > 0 || filters.scope === "here" || !!filters.chamber || filters.status.length > 0
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="h-6 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function Check({ id, label, count, checked, onChange, onJump }: { id: string; label: string; count?: number; checked: boolean; onChange: (next: boolean) => void; onJump?: () => void }) {
  const row = (
    // Full width on its own; sharing the row with the arrow, it yields the 20 px.
    <FieldLabel htmlFor={id} className={onJump ? "min-w-0 flex-1" : "w-full"}>
      <Field orientation="horizontal" className="items-center gap-2 py-0.5">
        <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(!!value)} />
        <FieldContent className="min-w-0">
          <FieldTitle className="flex items-center gap-2 text-[0.8rem] font-normal">
            <span className="min-w-0 truncate">{label}</span>
            {count != null && <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(count)}</span>}
          </FieldTitle>
        </FieldContent>
      </Field>
    </FieldLabel>
  )
  if (!onJump) return row
  // The tick and the jump are two things, so they are two controls. The button
  // sits outside the FieldLabel on purpose: inside it, every click on the arrow
  // would also toggle the box the label points at.
  return (
    <div className="flex w-full items-center gap-1">
      {row}
      <button
        type="button"
        onClick={onJump}
        disabled={!count}
        aria-label={`Go to ${label}`}
        className="group/jump -mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
      >
        {/* Right, until it is pointed at: then it turns up and out, which is
            the arrow the record items already use for "this goes somewhere". */}
        <ArrowRight className="size-3.5 transition-transform duration-200 group-hover/jump:-rotate-45 group-focus-visible/jump:-rotate-45 motion-reduce:transition-none" />
      </button>
    </div>
  )
}

export function SearchFilters({
  filters,
  onChange,
  here,
  counts,
  chambers,
  statuses,
}: {
  filters: SearchFilterState
  onChange: (next: SearchFilterState) => void
  /** The jurisdiction in scope. */
  here: string
  /** Rows per section, before the filters. */
  counts: Record<string, number>
  /** The chambers and statuses the bills on the page carry, with their counts. */
  chambers: { value: string; count: number }[]
  statuses: { value: string; count: number }[]
}) {
  const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value))
  const showing = (key: string) => filters.show.length === 0 || filters.show.includes(key)

  // Jumping to a section the reader has hidden means showing it again — the
  // ask was to go there, and there is nothing there to go to otherwise. The
  // scroll waits a frame for that section to render.
  const jump = (key: string) => {
    if (!showing(key)) {
      const current = filters.show.length ? filters.show : SECTIONS.map((s) => s.key)
      const next = toggle(current, key, true)
      onChange({ ...filters, show: next.length === SECTIONS.length ? [] : next })
    }
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    requestAnimationFrame(() =>
      document.getElementById(sectionId(key))?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })
    )
  }
  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex items-center">
        <p className="h-6 text-xs font-medium text-muted-foreground">Filters</p>
        {isFiltered(filters) && (
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs text-muted-foreground" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear
          </Button>
        )}
      </div>

      <Group title="Show">
        {SECTIONS.map((section) => (
          <Check
            key={section.key}
            id={`show-${section.key}`}
            label={section.label}
            count={counts[section.key]}
            checked={showing(section.key)}
            onJump={() => jump(section.key)}
            onChange={(on) => {
              // Unticking the only unticked box empties the list, which means all.
              const current = filters.show.length ? filters.show : SECTIONS.map((s) => s.key)
              const next = toggle(current, section.key, on)
              onChange({ ...filters, show: next.length === SECTIONS.length ? [] : next })
            }}
          />
        ))}
      </Group>

      <Group title="Jurisdiction">
        <RadioGroup value={filters.scope} onValueChange={(value) => onChange({ ...filters, scope: value === "here" ? "here" : "all" })} className="gap-1">
          {[
            { value: "all", label: "Every jurisdiction" },
            { value: "here", label: `${stateName(here) || here} only` },
          ].map((option) => (
            <FieldLabel key={option.value} htmlFor={`scope-${option.value}`} className="w-full">
              <Field orientation="horizontal" className="items-center gap-2 py-0.5">
                <RadioGroupItem value={option.value} id={`scope-${option.value}`} />
                <FieldContent>
                  <FieldTitle className="text-[0.8rem] font-normal">{option.label}</FieldTitle>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </Group>

      {chambers.length > 1 && (
        <Group title="Chamber">
          <RadioGroup value={filters.chamber} onValueChange={(value) => onChange({ ...filters, chamber: value })} className="gap-1">
            {[{ value: "", count: chambers.reduce((sum, c) => sum + c.count, 0), label: "Any chamber" }, ...chambers.map((c) => ({ ...c, label: c.value }))].map((option) => (
              <FieldLabel key={option.value || "any"} htmlFor={`chamber-${option.value || "any"}`} className="w-full">
                <Field orientation="horizontal" className="items-center gap-2 py-0.5">
                  <RadioGroupItem value={option.value} id={`chamber-${option.value || "any"}`} />
                  <FieldContent className="min-w-0">
                    <FieldTitle className="flex items-center gap-2 text-[0.8rem] font-normal">
                      <span className="min-w-0 truncate">{option.label}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(option.count)}</span>
                    </FieldTitle>
                  </FieldContent>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </Group>
      )}

      {statuses.length > 1 && (
        <Group title="Status">
          {statuses.map((status) => (
            <Check
              key={status.value}
              id={`status-${status.value.replace(/\W+/g, "-").toLowerCase()}`}
              label={status.value}
              count={status.count}
              checked={filters.status.length === 0 || filters.status.includes(status.value)}
              onChange={(on) => {
                const current = filters.status.length ? filters.status : statuses.map((s) => s.value)
                const next = toggle(current, status.value, on)
                onChange({ ...filters, status: next.length === statuses.length ? [] : next })
              }}
            />
          ))}
        </Group>
      )}
    </div>
  )
}
