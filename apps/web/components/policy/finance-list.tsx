"use client"

import * as React from "react"

import useSWR from "@/lib/policy/swr"
import { stateName } from "@/lib/filters"
import { fmtCompact, fmtNumber } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { SearchDirectory } from "@/components/directory-search"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"

// Finance: the canon item for every candidate account we hold. What we hold
// is the FEC's candidate summaries for the 400 largest accounts of the
// 2025–2026 cycle by receipts (lib/data/fec-candidates-us.json, answered by
// lib/policy/snapshot), so the page says exactly that, and a state shows its
// share of the 400 rather than "its candidates". The bold slot is the
// candidate, the money rides beside it on row 1 where it can be read, and the
// meta line says cycle, office, seat, party and standing. Each row opens the
// candidate's own page at fec.gov.

type Row = {
  cand_id: string
  name: string
  ici: string | null
  party: string | null
  receipts: number
  disbursements: number
  cash_on_hand: number
  state: string
  district: string
  office: string
  fec_url: string
}
type Payload = { meta: { cycle: number; matched: number; cycleRows: number }; rows: Row[] }

const CYCLE = 2026
const HELD = 400
const PARTY = (party: string | null) => {
  const p = (party ?? "").toUpperCase()
  return p.startsWith("DEM") ? "Democratic" : p.startsWith("REP") ? "Republican" : p ? "Other" : null
}
const STANDING: Record<string, string> = { I: "Incumbent", C: "Challenger", O: "Open seat" }
const has = (query: string, ...values: (string | null | undefined)[]) =>
  !query || values.some((value) => (value ?? "").toLowerCase().includes(query))

// `NY-25` for a House seat, the state for a Senate seat, and the office for
// the one that belongs to no state.
function seat(row: Row) {
  if (row.office === "House") return `${row.state}-${row.district}`
  if (row.office === "Senate") return stateName(row.state)
  return null
}

export function FinanceList() {
  const { state, resolved } = useJurisdiction()
  const [query, setQuery] = React.useState("")
  const { data } = useSWR<Payload>(
    resolved ? `/api/fec/candidates?state=${state}&cycle=${CYCLE}&limit=${HELD}&sort=receipts&dir=desc` : null
  )
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.rows ?? []).filter((row) => has(q, row.name, row.office, row.state, stateName(row.state), PARTY(row.party), STANDING[row.ici ?? ""]))
  }, [data, query])

  if (!resolved || !data) return null
  const held = data.rows.length
  return (
    <>
      <p className="text-sm text-muted-foreground">
        The {fmtNumber(HELD)} largest campaign accounts of the {CYCLE - 1}–{CYCLE} cycle by receipts, from the FEC&apos;s candidate summaries
        {state === "US" ? "." : `, and ${stateName(state)}'s share of them.`}
      </p>
      {!held ? (
        <p className="py-10 text-sm text-muted-foreground">
          No candidate from {stateName(state)} is among the {fmtNumber(HELD)} largest accounts of the cycle in the extract we hold.
        </p>
      ) : (
        <>
          <SearchDirectory
            query={query}
            registriesCount={rows.length}
            setQuery={(value) => setQuery(value ?? "")}
            noun="candidate"
            placeholder="Search candidates by name, office, state or party…"
          />
          <RecordList className="my-8">
            {rows.map((row) => (
              <RecordItem
                key={row.cand_id}
                external
                href={row.fec_url}
                avatar={<RecordSeal state="US" chamber={row.office === "House" || row.office === "Senate" ? row.office : undefined} />}
                title={row.name}
                lead={`Receipts ${fmtCompact(row.receipts)} · Disbursements ${fmtCompact(row.disbursements)} · Cash on hand ${fmtCompact(row.cash_on_hand)}`}
                meta={[`${CYCLE - 1}–${CYCLE} cycle`, row.office, seat(row), PARTY(row.party), STANDING[row.ici ?? ""]]}
              />
            ))}
          </RecordList>
          <p className="text-sm text-muted-foreground">
            Showing {fmtNumber(rows.length)} of {fmtNumber(held)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        </>
      )}
    </>
  )
}
