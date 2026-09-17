import { q } from "@/lib/policy/db"
import type { LiveEvent } from "@/lib/policy/live-stream"

// /live's Congress (Brendan, 2026-09-15): read from its own sources as they
// publish, not from the nightly copies. The House floor is the Clerk's day file
// (clerk.house.gov/floor/YYYYMMDD.xml, the file behind live.house.gov and the
// Floor Summary): every action to the second, with its bill. Everything else —
// introductions, referrals, committee and Senate actions — is congress.gov's
// latest action on each bill updated in the window. A sponsor comes from
// congress_bills where the bill is on file, else from congress.gov's bill.

const CLERK = "https://clerk.house.gov"
const API = "https://api.congress.gov/v3"
const DAYS_BACK = 14
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; GovBlock)" }

/** The date in Washington, `offset` days back, as YYYY-MM-DD. */
function washingtonDate(offset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - offset * 864e5))
}

const congressOf = (date: string) => Math.floor((Number(date.slice(0, 4)) - 1789) / 2) + 1

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }
function plain(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim()
}

const LABELS: Record<string, string> = { HR: "H.R.", HRES: "H.Res.", HJRES: "H.J.Res.", HCONRES: "H.Con.Res.", S: "S.", SRES: "S.Res.", SJRES: "S.J.Res.", SCONRES: "S.Con.Res." }
const labelOf = (bill: { type: string; number: string }) => `${LABELS[bill.type] ?? bill.type} ${bill.number}`

/** "H. Con. Res. 93" → HCONRES 93, the type and number congress.gov and congress_bills use. */
function billOf(label: string) {
  const m = /^([A-Za-z.\s]+?)\s*(\d+)$/.exec(label.trim())
  return m ? { type: m[1].replace(/[.\s]/g, "").toUpperCase(), number: m[2] } : null
}

type Draft = Omit<LiveEvent, "bill_id" | "bill_number" | "title" | "sponsor" | "sponsor_party" | "sponsor_photo" | "sponsor_bioguide"> & {
  bill: { type: string; number: string } | null
  title: string | null
}

function tally(text: string) {
  const m = /(?:yeas and nays|recorded vote)[^:]*:\s*(\d+)\s*-\s*(\d+)/i.exec(text)
  return m ? { yea: Number(m[1]), nay: Number(m[2]) } : { yea: null, nay: null }
}

async function clerkDay(date: string): Promise<Draft[]> {
  const ymd = date.replaceAll("-", "")
  const today = date === washingtonDate()
  const r = await fetch(`${CLERK}/floor/${ymd}.xml`, { headers: HEADERS, next: { revalidate: today ? 30 : 86_400 } }).catch(() => null)
  if (!r?.ok) return []
  const xml = await r.text()
  const out: Draft[] = []
  for (const m of xml.matchAll(/<floor_action\b([^>]*)>([\s\S]*?)<\/floor_action>/g)) {
    const id = /unique-id="(\d+)"/.exec(m[1])?.[1]
    const stamp = /for-search="(\d{4})(\d{2})(\d{2})T(\d{2}:\d{2}:\d{2})"/.exec(m[2])
    const text = plain(/<action_description>([\s\S]*?)<\/action_description>/.exec(m[2])?.[1] ?? "")
    if (!stamp || !text) continue
    const item = plain(/<action_item>([\s\S]*?)<\/action_item>/.exec(m[2])?.[1] ?? "")
    const vote = /\(Roll no\. \d+\)|Roll Call \d+/i.test(text)
    out.push({
      kind: vote ? "vote" : "action",
      state: "US",
      date: `${stamp[1]}-${stamp[2]}-${stamp[3]}`,
      at: stamp[4],
      chamber: "House",
      seq: id ? Number(id) : null,
      text,
      bill_label: item || null,
      bill: item ? billOf(item) : null,
      title: null,
      ...(vote ? tally(text) : { yea: null, nay: null }),
    })
  }
  return out
}

type ApiBill = { congress: number; type: string; number: string; title: string; originChamber: string; latestAction?: { actionDate: string; actionTime?: string; text: string } }

async function congressLatest(since: string, until: string): Promise<Draft[]> {
  const key = process.env.CONGRESS_API_KEY
  if (!key) return []
  const pages = await Promise.all(
    [0, 1, 2, 3].map((page) =>
      fetch(`${API}/bill?format=json&sort=updateDate+desc&limit=250&offset=${page * 250}&fromDateTime=${since}T00:00:00Z&api_key=${key}`, { next: { revalidate: 300 } })
        .then((r) => (r.ok ? (r.json() as Promise<{ bills?: ApiBill[] }>) : { bills: [] }))
        .catch(() => ({ bills: [] as ApiBill[] }))
    )
  )
  const out: Draft[] = []
  for (const b of pages.flatMap((p) => p.bills ?? [])) {
    const a = b.latestAction
    if (!a || a.actionDate < since || a.actionDate > until) continue
    out.push({
      kind: /roll no\.|record vote|yea-nay/i.test(a.text) ? "vote" : "action",
      state: "US",
      date: a.actionDate,
      at: a.actionTime ?? null,
      chamber: /\bSenate\b/.test(a.text) ? "Senate" : /\bHouse\b/.test(a.text) ? "House" : b.originChamber,
      seq: null,
      text: a.text,
      bill_label: null,
      bill: { type: b.type.toUpperCase(), number: b.number },
      title: b.title,
      yea: null,
      nay: null,
    })
  }
  return out
}

type Sponsor = { bill_id: number | null; bill_number: string | null; title: string | null; sponsor: string | null; sponsor_party: string | null; sponsor_photo: string | null; sponsor_bioguide: string | null }

async function sponsorsOf(congress: number, keys: string[]): Promise<Map<string, Sponsor>> {
  const found = new Map<string, Sponsor>()
  if (!keys.length) return found
  const rows = await q<Sponsor & { key: string }>(
    `select c.bill_type || c.number as key, c.bill_id, c.bill_number, left(c.display_title, 240) as title, coalesce(p.name, c.sponsor_name) as sponsor, p.party as sponsor_party, p.photo_url as sponsor_photo, coalesce(p.bioguide_id, c.sponsor_bioguide) as sponsor_bioguide
     from congress_bills c left join "People" p on p.people_id = c.sponsor_people_id
     where c.congress = $1 and c.bill_type || c.number = any($2::text[])`,
    [congress, [...keys].sort()]
  ).catch(() => [])
  for (const r of rows) found.set(r.key, { ...r, bill_id: r.bill_id == null ? null : Number(r.bill_id) })

  // Bills newer than the copy on file: congress.gov's own record, a day at a time.
  const key = process.env.CONGRESS_API_KEY
  const missing = keys.filter((k) => !found.get(k)?.sponsor).slice(0, 120)
  if (!key) return found
  for (let i = 0; i < missing.length; i += 10) {
    await Promise.all(
      missing.slice(i, i + 10).map(async (k) => {
        const m = /^([A-Z]+)(\d+)$/.exec(k)
        if (!m) return
        const r = await fetch(`${API}/bill/${congress}/${m[1].toLowerCase()}/${m[2]}?format=json&api_key=${key}`, { next: { revalidate: 86_400 } }).catch(() => null)
        if (!r?.ok) return
        const bill = ((await r.json()) as { bill?: { title?: string; sponsors?: { bioguideId?: string; firstName?: string; lastName?: string; party?: string }[] } }).bill
        const s = bill?.sponsors?.[0]
        const prior = found.get(k)
        found.set(k, {
          bill_id: prior?.bill_id ?? null,
          bill_number: prior?.bill_number ?? null,
          title: prior?.title ?? bill?.title ?? null,
          sponsor: s ? [s.firstName, s.lastName].filter(Boolean).join(" ") : null,
          sponsor_party: s?.party ?? null,
          sponsor_photo: null,
          sponsor_bioguide: s?.bioguideId ?? null,
        })
      })
    )
  }
  return found
}

/** Congress's events from the last DAYS_BACK days, newest first. */
export async function getCongressLive(): Promise<LiveEvent[]> {
  const until = washingtonDate()
  const since = washingtonDate(DAYS_BACK)
  const days = Array.from({ length: DAYS_BACK + 1 }, (_, i) => washingtonDate(i))
  const [floor, latest] = await Promise.all([Promise.all(days.map(clerkDay)).then((d) => d.flat()), congressLatest(since, until)])

  // congress.gov repeats the House floor a day later and without the time; the Clerk's line stands.
  const onFloor = new Set(floor.filter((e) => e.bill).map((e) => `${e.bill!.type}${e.bill!.number}|${e.date}`))
  const drafts = [...floor, ...latest.filter((e) => !onFloor.has(`${e.bill!.type}${e.bill!.number}|${e.date}`))]

  const sponsors = await sponsorsOf(congressOf(until), [...new Set(drafts.filter((e) => e.bill).map((e) => `${e.bill!.type}${e.bill!.number}`))])
  return drafts
    .map(({ bill, title, ...e }): LiveEvent => {
      const s = bill ? sponsors.get(`${bill.type}${bill.number}`) : undefined
      return {
        ...e,
        bill_label: bill ? labelOf(bill) : e.bill_label,
        bill_id: s?.bill_id ?? null,
        bill_number: s?.bill_number ?? null,
        title: s?.title ?? title,
        sponsor: s?.sponsor ?? null,
        sponsor_party: s?.sponsor_party ?? null,
        sponsor_photo: s?.sponsor_photo ?? null,
        sponsor_bioguide: s?.sponsor_bioguide ?? null,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.at ?? "").localeCompare(a.at ?? "") || (b.seq ?? 0) - (a.seq ?? 0))
}
