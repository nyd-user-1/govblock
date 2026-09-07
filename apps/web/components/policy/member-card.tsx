"use client"

import Link from "next/link"

import { MemberPortrait } from "@/components/policy/imagery"

// One member on shadcn's registry card — the markup Brendan pasted on
// 2026-09-05, class for class, with the member's portrait where a registry
// shows its logo. The bill page drew it first for sponsors; a committee's
// roster and an amendment's sponsors draw the same card (Brendan: "we are
// making reusable blocks"). The whole card links to the member's page.

export type MemberCardRow = {
  id: string
  name: string
  href: string | null
  photo: string | null
  chamber: string | null
  /** "Rep. · R–MO-8 · Sponsor" */
  line: string
  /** "Joined Dec 9, 2025 · Original", on a Congress bill. */
  detail: string | null
}

export function MemberCard({ row, state }: { row: MemberCardRow; state: string }) {
  const className = "flex w-full flex-col rounded-2xl bg-surface p-6 text-surface-foreground transition-colors hover:bg-surface/80 sm:p-10 items-start text-sm md:p-6"
  const body = (
    <>
      <MemberPortrait name={row.name} photoUrl={row.photo} state={state} chamber={row.chamber} size={40} />
      <div className="mt-4 font-medium">{row.name}</div>
      <div className="text-muted-foreground">
        <p>{row.line}</p>
        {row.detail && <p>{row.detail}</p>}
      </div>
    </>
  )
  if (!row.href)
    return (
      <div data-not-typeset="true" className={className}>
        {body}
      </div>
    )
  return (
    <Link data-not-typeset="true" className={className} href={row.href}>
      {body}
    </Link>
  )
}
