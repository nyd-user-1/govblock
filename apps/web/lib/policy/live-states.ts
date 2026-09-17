import { q } from "@/lib/policy/db"
import type { LiveEvent } from "@/lib/policy/live-stream"

// The states' own sources for /live (Brendan, 2026-09-15: LegiScan is the
// Sunday bulk and enrichment, never a live read). One adapter per state, each
// speaking to that legislature directly; a state with no adapter yet falls back
// to the stored history in lib/policy/live-stream.ts, and says so in the report
// this module returns. Portraits are the only thing read from our own tables:
// the action, its time and its sponsor come from the legislature.

export type StateFeed = { state: string; events: LiveEvent[]; source: string }

const DAYS_BACK = 14
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; GovBlock)" }

const dayBack = (offset: number) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10)

async function json<T>(url: string, revalidate: number): Promise<T | null> {
  const r = await fetch(url, { headers: HEADERS, next: { revalidate } }).catch(() => null)
  if (!r?.ok) return null
  return (await r.json().catch(() => null)) as T | null
}

// ---------------------------------------------------------------------------
// Ohio — the General Assembly's own API (search-prod.lis.state.oh.us), the one
// behind legislature.ohio.gov. A bill's actions carry the minute they happened.
// Which bills to ask about is the list's `revno`: it rises whenever a bill
// changes, so the highest are the ones that have just moved.

const OH_BASE = "https://search-prod.lis.state.oh.us/api/v2/general_assembly_136"
const OH_ASK = 60

type OhBill = { number: string; name: string; short_title: string; chamber: string; revno: number; sponsors?: { full_name: string; party: string }[] }
type OhAction = { occurred: string; action: string; description: string; chamber: string; committee: string | null }

/** "hb31" → "H.B. 31", as Ohio prints it. */
function ohLabel(number: string) {
  const m = /^([a-z]+)(\d+)$/.exec(number)
  if (!m) return number.toUpperCase()
  return `${m[1].toUpperCase().split("").join(".")}. ${m[2]}`
}

const ohParty = (party: string | undefined) => (/republican/i.test(party ?? "") ? "R" : /democrat/i.test(party ?? "") ? "D" : null)

async function ohio(since: string): Promise<StateFeed> {
  const source = "legislature.ohio.gov"
  const bills = (await json<OhBill[]>(`${OH_BASE}/legislation/?format=json`, 86_400)) ?? []
  const recent = [...bills].sort((a, b) => b.revno - a.revno).slice(0, OH_ASK)
  const events: LiveEvent[] = []
  for (let i = 0; i < recent.length; i += 10) {
    await Promise.all(
      recent.slice(i, i + 10).map(async (b) => {
        const actions = (await json<OhAction[]>(`${OH_BASE}/legislation/${b.number}/actions/`, 1_800)) ?? []
        for (const a of actions) {
          const date = a.occurred?.slice(0, 10)
          if (!date || date < since) continue
          const sponsor = b.sponsors?.[0]
          events.push({
            kind: /vote|pass|concur|adopt/i.test(a.action) ? "vote" : "action",
            state: "OH",
            date,
            at: a.occurred.slice(11, 19),
            chamber: a.chamber || b.chamber,
            seq: null,
            text: [a.description || a.action, a.committee ? `— ${a.committee}` : ""].filter(Boolean).join(" "),
            bill_id: null,
            bill_number: b.number.toUpperCase(),
            bill_label: ohLabel(b.number),
            title: b.short_title ?? null,
            yea: null,
            nay: null,
            sponsor: sponsor?.full_name ?? null,
            sponsor_party: ohParty(sponsor?.party),
            sponsor_photo: null,
            sponsor_bioguide: null,
          })
        }
      })
    )
  }
  return { state: "OH", events, source }
}

// ---------------------------------------------------------------------------
// New York — the Senate's Open Legislation API. Its updates feed names every
// bill whose status changed in a window; the bill itself carries the status,
// the date it was taken and the sponsor. Dates only: Albany publishes no time.

const NY_BASE = "https://legislation.nysenate.gov/api/3/bills"
const NY_ASK = 40

type NyUpdate = { id: { basePrintNo: string; session: number } }
type NyBill = {
  result?: {
    title?: string
    billType?: { chamber?: string }
    status?: { statusDesc?: string; actionDate?: string; committeeName?: string | null }
    sponsor?: { member?: { fullName?: string; memberId?: number } }
  }
}

async function newYork(since: string): Promise<StateFeed> {
  const source = "legislation.nysenate.gov"
  const key = process.env.NYS_LEGISLATION_API_KEY
  if (!key) return { state: "NY", events: [], source }
  const updates = await json<{ result?: { items?: NyUpdate[] } }>(
    `${NY_BASE}/updates/${since}T00:00:00/${dayBack(0)}T23:59:59?key=${key}&filter=status&limit=1000&order=DESC`,
    1_800
  )
  const wanted = new Map<string, NyUpdate["id"]>()
  for (const u of updates?.result?.items ?? []) {
    const id = u.id
    if (id?.basePrintNo) wanted.set(`${id.session}/${id.basePrintNo}`, id)
    if (wanted.size >= NY_ASK) break
  }
  const events: LiveEvent[] = []
  const asked = [...wanted.values()]
  for (let i = 0; i < asked.length; i += 8) {
    await Promise.all(
      asked.slice(i, i + 8).map(async (id) => {
        const bill = await json<NyBill>(`${NY_BASE}/${id.session}/${id.basePrintNo}?key=${key}&view=info`, 3_600)
        const s = bill?.result?.status
        if (!s?.actionDate || s.actionDate < since || !s.statusDesc) return
        events.push({
          kind: "action",
          state: "NY",
          date: s.actionDate,
          at: null,
          chamber: bill?.result?.billType?.chamber === "SENATE" ? "Senate" : "Assembly",
          seq: null,
          text: [s.statusDesc, s.committeeName ? `— ${s.committeeName}` : ""].filter(Boolean).join(" "),
          bill_id: null,
          bill_number: id.basePrintNo,
          bill_label: id.basePrintNo,
          title: bill?.result?.title ?? null,
          yea: null,
          nay: null,
          sponsor: bill?.result?.sponsor?.member?.fullName ?? null,
          sponsor_party: null,
          sponsor_photo: null,
          sponsor_bioguide: null,
        })
      })
    )
  }
  return { state: "NY", events, source }
}

// ---------------------------------------------------------------------------

const ADAPTERS = [ohio, newYork]

/** Every state that reads its own legislature, with the portraits filled in. */
export async function getStatesLive(): Promise<{ events: LiveEvent[]; states: string[] }> {
  const since = dayBack(DAYS_BACK)
  const feeds = await Promise.all(ADAPTERS.map((read) => read(since).catch(() => null)))
  const events = feeds.flatMap((f) => f?.events ?? [])

  // The one thing our own tables answer: what a sponsor looks like.
  const names = [...new Set(events.map((e) => e.sponsor).filter(Boolean))] as string[]
  if (names.length) {
    const rows = await q<{ state: string; name: string; photo_url: string | null; party: string | null }>(
      `select state, name, photo_url, party from "People" where state = any($1::text[]) and name = any($2::text[])`,
      [[...new Set(events.map((e) => e.state))].sort(), [...names].sort()]
    ).catch(() => [])
    const photos = new Map(rows.map((r) => [`${r.state}|${r.name}`, r]))
    for (const e of events) {
      const p = e.sponsor ? photos.get(`${e.state}|${e.sponsor}`) : undefined
      if (p) {
        e.sponsor_photo = p.photo_url
        e.sponsor_party = e.sponsor_party ?? p.party
      }
    }
  }
  return { events, states: feeds.filter((f) => f && f.events.length).map((f) => f!.state) }
}
