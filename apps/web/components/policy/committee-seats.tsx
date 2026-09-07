"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { memberHref } from "@/lib/filters"
import { PARTY_GREY, partyColor } from "@/lib/imagery"
import { honorific, shortDistrict } from "@/lib/format"
import type { RosterRow } from "@/lib/policy/committee-queries"
import { PreviewFrame } from "@/components/preview-frame"

// paceui's seat-booking widget (dashboard-widget-2), repurposed as the
// committee's dais and then cut down to the seats alone (Brendan,
// 2026-09-06: "rearranged the seats and removed a lot of the extra,
// unnecessary copy"). What is left of theirs is the hover line and the grid;
// the card, the stage line, the legend and the figures went. A seat is a
// member, drawn as a circle in the party's colour: the majority to the left
// of the aisle, the minority to the right, each side in rank order from the
// front, the Chair and the Ranking Member at the aisle of the front row,
// drawn full. A seat with no one in it is grey. Hover a seat to see who sits
// there; click it to open their page.

const COLS = 14
const SIDE = COLS / 2

type Seat = { row: number; col: number; member: RosterRow | null; side: "majority" | "minority" | null }

/** Each side laid front to back, aisle outward: rank 1 at the aisle of the front row. */
export function seatLayout(roster: RosterRow[]) {
  const majority = roster.filter((r) => r.side === "majority" || (!r.side && r.party === roster[0]?.party))
  const minority = roster.filter((r) => !majority.includes(r))
  const rows = Math.max(1, Math.ceil(majority.length / SIDE), Math.ceil(minority.length / SIDE))
  const seats: Seat[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const left = col < SIDE
      // Distance from the aisle: 0 at the two middle columns.
      const fromAisle = left ? SIDE - 1 - col : col - SIDE
      const index = row * SIDE + fromAisle
      const member = (left ? majority : minority)[index] ?? null
      seats.push({ row, col, member, side: member ? (left ? "majority" : "minority") : null })
    }
  }
  return { seats, rows, majority, minority }
}

const who = (r: RosterRow) => `${honorific(r.role, r.chamber)} ${r.name}`.trim()
const seatLine = (r: RosterRow) => [r.party ? [r.party, shortDistrict(r.district)].filter(Boolean).join("–") : null, r.title ?? (r.side ? r.side.charAt(0).toUpperCase() + r.side.slice(1) : null)].filter(Boolean).join(" · ")

export function CommitteeSeats({ roster, state }: { roster: RosterRow[]; state: string }) {
  const router = useRouter()
  const [hovered, setHovered] = React.useState<Seat | null>(null)
  const { seats, majority, minority } = React.useMemo(() => seatLayout(roster), [roster])
  if (roster.length < 2) return null
  const majorityColor = partyColor(majority[0]?.party)
  const minorityColor = partyColor(minority[0]?.party)
  const colorOf = (seat: Seat) => (seat.side === "majority" ? majorityColor : seat.side === "minority" ? minorityColor : PARTY_GREY)
  const seatStyle = (seat: Seat): React.CSSProperties => {
    const color = colorOf(seat)
    if (!seat.member) return { borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }
    return { borderColor: color, background: `color-mix(in oklab, ${color} ${seat.member.title ? 80 : 18}%, transparent)` }
  }

  return (
    <PreviewFrame>
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="flex h-4 items-center justify-center">
          {hovered?.member ? (
            <span className="text-sm">
              {who(hovered.member)} • <span style={{ color: colorOf(hovered) }}>{seatLine(hovered.member)}</span>
            </span>
          ) : hovered ? (
            <span className="text-sm text-muted-foreground">Vacant</span>
          ) : (
            <span className="text-sm">Hover seats to view details</span>
          )}
        </div>

        <div className="grid w-fit grid-cols-14 gap-2">
          {seats.map((seat) => {
            const member = seat.member
            const hot = hovered?.row === seat.row && hovered?.col === seat.col
            return (
              <button
                key={`${seat.row}-${seat.col}`}
                type="button"
                aria-label={member ? `${who(member)}, ${seatLine(member)}` : "Vacant seat"}
                disabled={!member}
                onClick={() => member?.people_id && router.push(memberHref(member.people_id, state))}
                onMouseEnter={() => setHovered(seat)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(seat)}
                onBlur={() => setHovered(null)}
                style={seatStyle(seat)}
                className={`size-6 rounded-full border-2 transition-all duration-200 focus:outline-none ${member ? "cursor-pointer hover:scale-110" : "cursor-not-allowed"} ${hot ? "scale-110" : ""}`}
              />
            )
          })}
        </div>
      </div>
    </PreviewFrame>
  )
}
