"use client"

import * as React from "react"

import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { memberHref, STATE_CODES, STATE_NAMES, stateName } from "@/lib/filters"
import { fmtBill, truncate } from "@/lib/format"
import { chamberImage } from "@/lib/imagery"
import { geoUrl } from "@/lib/map/geo-url"
import { representationAt, type Representation, type Seat } from "@/lib/map/join"
import { chambersOfState } from "@/lib/map/state-districts"
import type { BillRow, MemberRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import type { OnboardingInitial } from "@/components/onboarding"
import { FlagChip } from "@/components/policy/imagery"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@govblock/ui/components/nova/select"
import { cn } from "@govblock/ui/lib/utils"

// The welcome flow (Brendan, 2026-09-13), on /auth after the magic link: step
// one is the name, phone, home state and address — done when the name, the
// state and the ZIP are in, and the page goes on by itself. Then the people
// who sit for that address, then the interests (two at least), then the
// desk and the alerts built from those answers, and the close, which is the
// one Finish. Role and organization live on the
// settings page. The one form on /welcome (components/onboarding.tsx) is
// untouched.

export type Profile = OnboardingInitial
export const BLANK: Profile = { name: "", email: "", home_state: null, zip: null, address: null, role: null, organization: null, phone: null, interests: [], brief_opt_in: false, bio: null }

/** Step one is complete once the name, the home state and a five-digit ZIP are in. */
export const stepOneDone = (p: Profile) => p.name.trim().length > 0 && !!p.home_state && /^\d{5}$/.test(p.zip ?? "")

/** A US number as it is typed: (555) 555-5555, never more than ten digits (Brendan, 2026-09-13). */
export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10)
  if (d.length === 0) return ""
  if (d.length < 4) return `(${d}`
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

const STATES = [...STATE_CODES, "DC"]

type StepProps = { form: Profile; set: <K extends keyof Profile>(key: K, value: Profile[K]) => void }

/** Development only (Brendan, 2026-09-13): the form arrives filled so a run through sign-up does not mean typing it again. Production starts blank. */
export const DEV_PREFILL: Partial<Profile> | null = process.env.NODE_ENV === "development" ? { name: "Brendan", phone: "(555) 555-5555", home_state: "NY", address: "111 Fischer Avenue", zip: "11752" } : null

export function WelcomeStepOne({ form, set, onSkip, onNext }: StepProps & { /** Skip, at the left: straight on without the address. */ onSkip: () => void; /** Next, at the right, once the name, state and ZIP are in; the page also goes on by itself. */ onNext: () => void }) {
  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="text-balance text-muted-foreground">You&apos;re seconds away from every bill, committee, law, member, and vote of both the U.S. Congress and your home State.</p>
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="w1-name">Name</FieldLabel>
            <Input id="w1-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="w1-phone">Phone</FieldLabel>
            <Input id="w1-phone" value={form.phone ?? ""} onChange={(e) => set("phone", formatPhone(e.target.value))} type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 555-5555" />
          </Field>
          <Field>
            <FieldLabel htmlFor="w1-state">Home state</FieldLabel>
            {/* The site's own menu, never the native one (Brendan, 2026-09-13), each state behind its flag. */}
            <Select value={form.home_state ?? ""} onValueChange={(v) => set("home_state", v ? String(v) : null)}>
              <SelectTrigger id="w1-state" aria-label="Home state" className="w-full">
                {form.home_state ? (
                  <span className="flex items-center gap-2">
                    <FlagChip state={form.home_state} width={20} />
                    {STATE_NAMES[form.home_state]}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Choose a state…</span>
                )}
              </SelectTrigger>
              <SelectContent align="start" className="max-h-80 w-max min-w-44">
                {STATES.map((code) => (
                  <SelectItem key={code} value={code} className="whitespace-nowrap">
                    <FlagChip state={code} width={20} />
                    {STATE_NAMES[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Congress is open to everyone. Your home state opens with it.</FieldDescription>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field>
              <FieldLabel htmlFor="w1-address">Street address</FieldLabel>
              <Input id="w1-address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" placeholder="Optional" />
            </Field>
            <Field>
              <FieldLabel htmlFor="w1-zip">ZIP</FieldLabel>
              <Input id="w1-zip" value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="10001" />
            </Field>
          </div>
          <p className="-mt-2 text-sm">*Your address finds your districts and the people who represent you.</p>
        </FieldGroup>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onSkip} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Skip
          </button>
          <NextLink onClick={onNext} disabled={!stepOneDone(form)} />
        </div>
      </form>
    </div>
  )
}

/** The project card's look at a smaller size, as a toggle: the bodies' seals stacked top-left, the title bottom-left, a green check in the bottom-right corner once chosen. */
function InterestCard({ title, on, onToggle, seals }: { title: string; on: boolean; onToggle: () => void; seals: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "relative flex h-[108px] flex-col justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        on && "border-emerald-500/60"
      )}
    >
      <div className="flex items-start">{seals}</div>
      {on && <CheckIcon aria-hidden className="absolute right-3 bottom-3 size-4 text-emerald-500" />}
      <span className="truncate text-sm font-medium text-foreground">{title}</span>
    </button>
  )
}

export const MIN_INTERESTS = 2

export function WelcomeStepTwo({ form, set, interests, onNext }: StepProps & { interests: readonly string[]; /** The small Next link, once at least two are chosen: on to the previews. */ onNext: () => void }) {
  const toggle = (interest: string) => set("interests", form.interests.includes(interest) ? form.interests.filter((i) => i !== interest) : [...form.interests, interest])
  const enough = form.interests.length >= MIN_INTERESTS
  // The bodies an interest is followed in: the home state's chambers, then Congress's.
  const home = form.home_state && form.home_state !== "US" ? form.home_state : null
  const seals = (
    <AvatarGroup>
      {home && chambersOfState(home).map((c) => <Seal key={c.id} state={home} chamber={c.chamber} />)}
      <Seal state="US" chamber="Senate" />
      <Seal state="US" chamber="House" />
    </AvatarGroup>
  )
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Interests</h1>
        <p className="text-balance text-muted-foreground">Please choose at least {MIN_INTERESTS}.</p>
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[...interests].sort((a, b) => a.localeCompare(b)).map((interest) => (
            <InterestCard key={interest} title={interest} on={form.interests.includes(interest)} onToggle={() => toggle(interest)} seals={seals} />
          ))}
        </div>
        <NextLink onClick={onNext} disabled={!enough} />
      </form>
    </div>
  )
}

/** The small Next at a section's end. */
export function NextLink({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="self-end text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground">
      Next
    </button>
  )
}

// ---------------------------------------------------------------------------
// The previews (Brendan, 2026-09-13): each section shows one thing, built from
// what the reader just gave — their address, their state, their interests —
// with one line and a Next. No buttons into the products.

const BLOCK = "flex w-full max-w-2xl flex-col gap-6"

function PreviewHeading({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-balance text-muted-foreground">{line}</p>
    </div>
  )
}

/** One body's seal as an avatar. */
function Seal({ state, chamber }: { state: string; chamber: string }) {
  return (
    <Avatar size="sm" className="bg-white">
      <AvatarImage src={chamberImage(state, chamber)} alt={`${stateName(state)} ${chamber}`} className="object-contain" />
      <AvatarFallback>{chamber[0]}</AvatarFallback>
    </Avatar>
  )
}

/** Chamber seals stacked the way avatars stack: one per body, top-left of a card. */
function Seals({ state, chambers }: { state: string; chambers: readonly string[] }) {
  return (
    <AvatarGroup>
      {chambers.map((chamber) => (
        <Seal key={chamber} state={state} chamber={chamber} />
      ))}
    </AvatarGroup>
  )
}

/** The interest card's frame, for a member or a body: the seals top-left, the title and one line bottom-left. */
function StackCard({ seals, title, meta, href }: { seals: React.ReactNode; title: string; meta: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-start">{seals}</div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </div>
    </>
  )
  const cls = "flex h-[108px] flex-col justify-between rounded-xl border bg-card p-4 text-left no-underline transition-colors hover:bg-accent/40"
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/** The people who sit for the address: the two senators, the House member, and the state chambers' members. */
export function RepresentativesPreview({ form, point, onNext }: { form: Profile; point: { lng: number; lat: number } | null; onNext: () => void }) {
  const state = form.home_state ?? "US"
  const name = stateName(state)
  // The senators are statewide: every senator, kept to this state's two.
  const { data: senate } = usePolicy<MemberRow[]>("members", { state: "US", chamber: "Senate" }, { limit: 120 })
  const senators = React.useMemo(() => (Array.isArray(senate) ? senate.filter((m) => m.district === `SD-${state}` && m.active !== false) : []), [senate, state])
  // The districts are drawn from the point: the House seat, and each state chamber's.
  const [rep, setRep] = React.useState<Representation | null>(null)
  React.useEffect(() => {
    if (!point) return
    let alive = true
    ;(async () => {
      try {
        const party = (await (await fetch(geoUrl("/geo/cd119-party.json"))).json()) as { districts: Record<string, { party: string | null; name: string | null; people_id: number | null }> }
        const found = await representationAt([point.lng, point.lat], party.districts ?? {}, () => true)
        if (alive) setRep(found)
      } catch {
        if (alive) setRep(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [point])
  const seat = (s: Seat, chamber: string, meta: string, code: string) => (
    <StackCard key={`${chamber}-${s.name}`} seals={<Seals state={code} chambers={[chamber]} />} title={s.name} meta={meta} href={s.people_id ? memberHref(s.people_id, code === "US" ? undefined : code) : undefined} />
  )
  const cards: React.ReactNode[] = [
    ...senators.map((m) => <StackCard key={m.people_id} seals={<Seals state="US" chambers={["Senate"]} />} title={m.name} meta={`U.S. Senate · ${m.party}`} href={memberHref(m.people_id)} />),
    ...(rep?.congress?.seat ? [seat(rep.congress.seat, "House", `U.S. House · ${rep.congress.district}${rep.congress.seat.party ? ` · ${rep.congress.seat.party}` : ""}`, "US")] : []),
    ...(rep?.chambers ?? []).flatMap((c) => c.seats.map((s) => seat(s, c.chamber, `${name} ${c.chamber} · ${c.district}${s.party ? ` · ${s.party}` : ""}`, state))),
  ]
  return (
    <div className={BLOCK}>
      <PreviewHeading title="Your representatives" line={point ? `The elected representatives for ${form.zip ?? "your address"}.` : `Add a street address or ZIP and they appear here.`} />
      {cards.length > 0 ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{cards}</div> : point ? <p className="text-sm text-muted-foreground">Finding them…</p> : null}
      <NextLink onClick={onNext} />
    </div>
  )
}

/** The desk: the home state's newest bills, the way /desk shows them. */
export function DeskPreview({ form, onNext }: { form: Profile; onNext: () => void }) {
  const state = form.home_state ?? "US"
  const name = stateName(state)
  const { data } = usePolicy<{ rows: BillRow[] }>("bills", { state }, { limit: 3 })
  const rows = data?.rows ?? []
  return (
    <div className={BLOCK}>
      <PreviewHeading title={`Activated: ${name} Desk`} line="Every bill, committee, member, vote and more." />
      <div className="flex flex-col divide-y rounded-xl border bg-card">
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Loading {name}…</p>}
        {rows.map((bill) => (
          <Link key={bill.bill_id} href={`/bills/${bill.bill_id}`} className="flex flex-col gap-1 p-4 no-underline hover:bg-accent/40">
            <span className="flex items-center gap-2 text-sm">
              <FlagChip state={state} width={20} />
              <span className="font-semibold">{fmtBill(bill.bill_number, state)}</span>
              {bill.last_action_date && <span className="text-muted-foreground">{bill.last_action_date}</span>}
            </span>
            <span className="text-sm text-muted-foreground">{truncate(bill.title, 120)}</span>
          </Link>
        ))}
      </div>
      <NextLink onClick={onNext} />
    </div>
  )
}

/** Alerts: one for the home state, one for Congress, each from the first interest, each body's seals stacked. */
export function AlertsPreview({ form, onNext }: { form: Profile; onNext: () => void }) {
  const state = form.home_state ?? "US"
  const name = stateName(state)
  const interest = form.interests[0]
  const what = interest ? `${interest} bills` : "New bills"
  const line = (where: string) => (interest ? `Every new ${interest.toLowerCase()} bill introduced in ${where}, and every vote on one.` : `Every bill introduced in ${where}, and every vote.`)
  const stateChambers = chambersOfState(state).map((c) => c.chamber)
  return (
    <div className={BLOCK}>
      <PreviewHeading title="Alerts" line="An alert reads the record for you and writes when something moves." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {state !== "US" && <StackCard seals={<Seals state={state} chambers={stateChambers.length ? stateChambers : ["Senate", "House"]} />} title={`${what} in ${name}`} meta={line(name)} />}
        <StackCard seals={<Seals state="US" chambers={["Senate", "House"]} />} title={`${what} in Congress`} meta={line("Congress")} />
      </div>
      <NextLink onClick={onNext} />
    </div>
  )
}

/** The close: the flag at the loader's size, and the one button that finishes the profile. */
export function WelcomeClose({ form, onFinish, busy }: { form: Profile; onFinish: () => void; busy: boolean }) {
  return (
    <div className={cn(BLOCK, "items-center text-center")}>
      <div className="flex flex-col items-center gap-4">
        {form.home_state && <FlagChip state={form.home_state} width={96} />}
        <h2 className="text-2xl font-bold">You&apos;re in.</h2>
      </div>
      <Button size="lg" onClick={onFinish} disabled={busy}>
        {busy ? "One moment…" : "Account Home"}
      </Button>
    </div>
  )
}
