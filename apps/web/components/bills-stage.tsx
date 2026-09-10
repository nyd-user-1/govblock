"use client"

import * as React from "react"

import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { BillsList } from "@/components/bills-list"
import { LibraryTabs } from "@/components/library-tabs"
import { LawsList } from "@/components/policy/federal-lists"

// The bills page reads a stage (Brendan, 2026-09-10). Becoming law is not a
// section of the record, it is the last thing that happens to a bill, so the
// enacted list belongs here behind ?status=enacted rather than at a route of
// its own. /public-laws redirects.
//
// The two lists read different sources: the record's own bills for the
// jurisdiction in scope, and congress_laws for what the federal legislature
// enacted. LawsList says so itself when the jurisdiction is not federal.

const STAGES = [
  { value: "all", label: "All" },
  { value: "enacted", label: "Enacted" },
] as const

type Stage = (typeof STAGES)[number]["value"]

export function BillsStage() {
  const { status } = useUrlParams(["status"] as const)
  const stage: Stage = status === "enacted" ? "enacted" : "all"
  return (
    <>
      <LibraryTabs
        tabs={STAGES.map((s) => ({ value: s.value, label: s.label }))}
        value={stage}
        onChange={(next) =>
          writeUrlParams(
            { status: next === "all" ? null : next },
            { history: "replace" }
          )
        }
      />
      {stage === "enacted" ? <LawsList /> : <BillsList />}
    </>
  )
}
