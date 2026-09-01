"use client"

import * as React from "react"
import {
  ArrowHorizontalIcon,
  ParagraphSpacingIcon,
  TextSmallcapsIcon,
} from "@hugeicons/core-free-icons"
import { type IconSvgElement } from "@hugeicons/react"

import {
  readFilters,
  scopedFilters,
  type FilterKey,
} from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { Bill } from "@/lib/policy/types"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { useIsMobile } from "@govblock/ui/hooks/use-mobile"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@govblock/ui/components/nova/card"
import { FieldGroup, FieldSeparator } from "@govblock/ui/components/nova/field"
import {
  FilterPicker,
  LegislativeFields,
} from "@/app/(typeset)/components/legislative-pickers"
import { FontPicker } from "@/app/(typeset)/components/font-picker"
import { TypesetGetCodeDrawer } from "@/app/(typeset)/components/get-code-drawer"
import { TypesetMainMenu } from "@/app/(typeset)/components/main-menu"
import { OptionPicker } from "@/app/(typeset)/components/option-picker"
import { TypesetRandomButton } from "@/app/(typeset)/components/random-button"
import {
  TYPESET_FLOWS,
  TYPESET_LEADINGS,
  TYPESET_MEASURES,
  TYPESET_SIZES,
  useTypesetSearchParams,
} from "@/app/(typeset)/lib/search-params"

const LineHeightIcon: IconSvgElement = [
  [
    "path",
    {
      d: "M4.5 3.5H19.5",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "0",
    },
  ],
  [
    "path",
    {
      d: "M4.5 20.5H19.5",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "1",
    },
  ],
  [
    "path",
    {
      d: "M17 17L14.8905 11.4741C13.9109 8.90801 13.4211 7.625 12.625 7.625C11.8289 7.625 11.3391 8.90801 10.3595 11.4741L8.25 17",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "2",
    },
  ],
  [
    "path",
    {
      d: "M9.5 13H15.75",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "3",
    },
  ],
]

// Save = keep the bill in focus on your tracked list.
function TypesetSaveButton({
  billId,
  className,
}: {
  billId: number | undefined
  className?: string
}) {
  const [tracked, setTracked] = useLocal<number[]>(
    "livingston:tracked-bills",
    []
  )
  const saved = !!billId && tracked.includes(billId)
  return (
    <Button
      variant="secondary"
      className={className}
      disabled={!billId}
      onClick={() => {
        if (!billId) return
        setTracked((list) =>
          list.includes(billId)
            ? list.filter((id) => id !== billId)
            : [...list, billId]
        )
      }}
    >
      {saved ? "Saved" : "Save"}
    </Button>
  )
}

export function TypesetCustomizer() {
  const [params, setParams] = useTypesetSearchParams()
  const isMobile = useIsMobile()
  const anchorRef = React.useRef<HTMLDivElement | null>(null)

  // /typeset keeps its own params bag; the scope is still the header's.
  const { state, session, isDefaultSession, setState, setSession } =
    useJurisdiction()
  const filters = React.useMemo(
    () =>
      scopedFilters(
        readFilters(params as unknown as Record<string, unknown>),
        state,
        session,
        isDefaultSession
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state,
      session,
      isDefaultSession,
      params.state,
      params.session,
      params.chamber,
      params.committee,
      params.member,
      params.party,
      params.status,
      params.subject,
      params.vote,
      params.bill,
    ]
  )
  const setFilters = React.useCallback(
    (updates: Partial<Record<FilterKey, string>>) => {
      // The rail's State and Session fields are the header control in another
      // position: they write the shared scope, not a typeset-only copy.
      if (updates.state !== undefined) setState(updates.state)
      if (updates.session !== undefined) setSession(updates.session)
      // A different bill means a different set of versions and relatives.
      const next =
        "bill" in updates || "state" in updates || "session" in updates
          ? { ...updates, version: "", related: "" }
          : updates
      void setParams(next, { history: "push" })
    },
    [setParams, setState, setSession]
  )
  const { data: bill } = usePolicy<Bill>("bill", filters)

  // Resolve the rhythm to px off the current size: leading is a multiple,
  // flow is an em value.
  const sizePx = Number(params.scale)
  const leadingPx = Math.round(sizePx * Number(params.leading))
  const flowPx = Math.round(sizePx * parseFloat(params.flow))

  return (
    <Card
      className="dark isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)"
      ref={anchorRef}
      size="sm"
    >
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <TypesetMainMenu />
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto max-md:px-3 md:flex-col md:gap-3.25">
          {params.mode === "design" ? (
            <>
              {/* Below ~60ch the viewport already constrains width, so measure
                  does nothing: hide it. */}
              <OptionPicker
                label="Measure"
                className="max-[28rem]:hidden"
                isMobile={isMobile}
                anchorRef={anchorRef}
                param="measure"
                icon={ArrowHorizontalIcon}
                options={TYPESET_MEASURES}
                value={params.measure}
                onChange={(measure) => setParams({ measure })}
              />
              <FieldSeparator className="hidden md:block" />
              <FontPicker
                label="Heading"
                param="heading"
                isMobile={isMobile}
                anchorRef={anchorRef}
              />
              <FontPicker
                label="Body"
                param="body"
                isMobile={isMobile}
                anchorRef={anchorRef}
              />
              <FontPicker
                label="Mono"
                param="mono"
                isMobile={isMobile}
                anchorRef={anchorRef}
              />
              <FieldSeparator className="hidden md:block" />
              <OptionPicker
                label="Size"
                isMobile={isMobile}
                anchorRef={anchorRef}
                param="scale"
                icon={TextSmallcapsIcon}
                options={TYPESET_SIZES}
                value={params.scale}
                onChange={(scale) => setParams({ scale })}
              />
              <OptionPicker
                label="Leading"
                isMobile={isMobile}
                anchorRef={anchorRef}
                param="leading"
                icon={LineHeightIcon}
                options={TYPESET_LEADINGS}
                value={params.leading}
                onChange={(leading) => setParams({ leading })}
              />
              <OptionPicker
                label="Flow"
                isMobile={isMobile}
                anchorRef={anchorRef}
                param="flow"
                icon={ParagraphSpacingIcon}
                options={TYPESET_FLOWS}
                value={params.flow}
                onChange={(flow) => setParams({ flow })}
              />
              {process.env.NODE_ENV === "development" && (
                <div className="hidden px-1 pt-0.5 text-center font-mono text-xs text-muted-foreground tabular-nums md:block">
                  {sizePx}px / {leadingPx}px / {flowPx}px
                </div>
              )}
            </>
          ) : (
            <LegislativeFields
              filters={filters}
              setFilters={setFilters}
              isMobile={isMobile}
              anchorRef={anchorRef}
            >
              <FilterPicker
                label="Version"
                value={params.version}
                display={
                  params.version
                    ? (bill?.texts.find(
                        (t) => String(t.document_id) === params.version
                      )?.version ?? params.version)
                    : (bill?.texts[0]?.version ?? (bill ? "Latest" : undefined))
                }
                options={(bill?.texts ?? []).map((t) => ({
                  value: String(t.document_id),
                  label: t.version || "Text",
                  hint: fmtNumber(t.chars),
                }))}
                allLabel="Latest"
                loading={!bill}
                isMobile={isMobile}
                anchorRef={anchorRef}
                onChange={(next) => void setParams({ version: next })}
              />
              <FilterPicker
                label="Related"
                value={params.related}
                display={
                  params.related
                    ? undefined
                    : bill?.sameAs.length
                      ? `${bill.sameAs.length} bills`
                      : bill
                        ? "None"
                        : undefined
                }
                options={(bill?.sameAs ?? []).map((s) => ({
                  value: String(s.sast_bill_id),
                  label: s.sast_bill_number,
                  sub: s.sast_type,
                }))}
                allLabel={bill?.sameAs.length ? "This bill" : "None"}
                loading={!bill}
                isMobile={isMobile}
                anchorRef={anchorRef}
                onChange={(next) =>
                  void setParams(
                    next
                      ? { bill: next, related: next, version: "" }
                      : { related: "" }
                  )
                }
              />
            </LegislativeFields>
          )}
          {/* Scroll-end spacer: the group is a CQ container (inline-size
              containment), so trailing padding cannot grow it. */}
          <div aria-hidden className="w-0.5 shrink-0 md:hidden" />
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex min-w-0 flex-row-reverse gap-2 border-t md:flex-col md:**:[button]:w-full">
        {params.mode !== "design" && (
          <TypesetSaveButton
            billId={bill?.bill_id}
            className="min-w-0 flex-1 md:flex-none"
          />
        )}
        <TypesetRandomButton className="min-w-0 flex-1 md:flex-none" />
        <TypesetGetCodeDrawer className="min-w-0 flex-1 touch-manipulation bg-transparent! px-2! py-0! text-sm! transition-none select-none hover:bg-muted! md:flex-none xl:hidden pointer-coarse:h-10!" />
      </CardFooter>
    </Card>
  )
}
