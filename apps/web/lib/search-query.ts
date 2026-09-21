import { STATE_NAMES } from "@/lib/filters"

// The search's grammar (Brendan, 2026-09-21: "allow / to act as the scoping
// agent"). What is typed is words and tokens, in any order:
//
//   artificial intelligence       words: every jurisdiction, as it always was
//   artificial /ny                words, in New York
//   /public safety /bills         words, bills only
//   /809 /nj                      a bill number, in New Jersey
//   @martinez /ny                 a person or a committee, in New York
//   artificial @committee         words, among the bills that sit in a committee
//   /ny                           a place by itself: its doors, then its codes
//   /bills                        a kind by itself: every jurisdiction's
//   /us/usc/t26, /agricultural-law, /119   what `/` always read: the law library
//
// A token starts at a `/` or an `@` that opens the box or follows a space, and
// runs to the next one. `/` narrows where (a jurisdiction, by its two letters,
// its address or its name) or what kind; a `/` that is neither, beside other
// tokens, is just more words — so "/public safety /bills" reads as a reader
// means it. `@` narrows who. A lone token that is none of these goes to the
// library and the citation resolver exactly as before.

// A kind is an index (Brendan, 2026-09-21: "a `/` is the index: if it's an index page and has entries then it should
// be able to be a `/` that becomes a chip"). Beside a place it lists that index's entries: `/ny /members`, `/ak /sessions`.
export type SearchKind = "bills" | "laws" | "members" | "committees" | "sessions"

export const KIND_LABELS: Record<SearchKind, string> = { bills: "Bills", laws: "Laws", members: "Members", committees: "Committees", sessions: "Sessions" }

const KIND_WORDS: Record<string, SearchKind> = {
  bill: "bills", bills: "bills",
  law: "laws", laws: "laws", code: "laws", codes: "laws",
  member: "members", members: "members", legislator: "members", legislators: "members",
  committee: "committees", committees: "committees",
  session: "sessions", sessions: "sessions",
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
const PLACES = Object.entries(STATE_NAMES).filter(([code]) => code !== "PR")
const BY_SLUG = new Map<string, string>([...PLACES.map(([code, name]) => [slug(name), code] as [string, string]), ["united-states", "US"], ["congress", "US"], ["federal", "US"]])

/** A jurisdiction's code from its two letters (`ny`), its address (`us-ny`) or its name (`new york`); null for anything else. */
export function placeOf(text: string): string | null {
  const s = slug(text)
  if (!s || s.includes("/")) return null
  const code = (s.startsWith("us-") && s.length === 5 ? s.slice(3) : s).toUpperCase()
  if (code.length === 2 && PLACES.some(([c]) => c === code)) return code
  return BY_SLUG.get(s) ?? null
}

export type Chip = { key: "where" | "kind" | "in-committee"; label: string; state?: string; /** The stretch of the typed text the chip stands for, to take it out again. */ start: number; end: number }

export type ParsedQuery = {
  /** words: the site search. number: bills by number. who: members and committees by name. place / kind: a scope by itself. library / at: the lone `/` or `@` lookups, as they were. */
  mode: "empty" | "words" | "number" | "who" | "place" | "kind" | "library" | "at"
  words: string
  where: string | null
  kind: SearchKind | null
  inCommittee: boolean
  number: string | null
  who: string | null
  chips: Chip[]
}

const NUMBER = /^([a-z]{1,7}\.?\s*)?\d+$/i

export function parseQuery(term: string): ParsedQuery {
  const starts: number[] = []
  for (const m of term.matchAll(/(^|\s)([/@])/g)) starts.push(m.index + m[1].length)
  const lead = (starts.length ? term.slice(0, starts[0]) : term).trim()
  const out: ParsedQuery = { mode: "empty", words: lead, where: null, kind: null, inCommittee: false, number: null, who: null, chips: [] }
  const loose: string[] = []
  starts.forEach((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : term.length
    const sigil = term[start]
    const text = term.slice(start + 1, end).trim()
    if (!text) return
    const place = sigil === "/" && !text.includes("/") ? placeOf(text) : null
    const kind = KIND_WORDS[text.toLowerCase()]
    if (place && !out.where) {
      out.where = place
      out.chips.push({ key: "where", label: place === "US" ? "U.S. Congress" : STATE_NAMES[place], state: place, start, end })
    } else if (sigil === "@" && /^(in[- ])?committees?$/i.test(text) && (lead || starts.length > 1)) {
      // "artificial @committee": not committees named artificial, but the bills about it that sit in one.
      out.inCommittee = true
      out.chips.push({ key: "in-committee", label: "In committee", start, end })
    } else if (kind && !out.kind) {
      out.kind = kind
      out.chips.push({ key: "kind", label: KIND_LABELS[kind], start, end })
    } else if (sigil === "/" && NUMBER.test(text) && !out.number) out.number = text
    else if (sigil === "@" && !out.who) out.who = text
    else loose.push(sigil === "/" ? text : `@${text}`)
  })
  const scoped = !!(out.where || out.kind || out.inCommittee || out.number || out.who || lead)
  // A lone token that named nothing above is the library's, or the citation resolver's, as it was.
  if (loose.length === 1 && !scoped && starts.length === 1) return { ...out, mode: term[starts[0]] === "/" ? "library" : "at", words: loose[0].replace(/^@/, "") }
  // An address is never words: "/us/usc/t26 /ny" still opens the address.
  const address = loose.find((t) => t.includes("/") && !t.startsWith("@"))
  if (address && !lead) return { ...out, mode: "library", words: address }
  out.words = [lead, ...loose].filter(Boolean).join(" ").trim()
  if (out.inCommittee) out.kind = "bills"
  out.mode = out.number ? "number" : out.who && !out.words ? "who" : out.words || out.who ? "words" : out.where ? "place" : out.kind ? "kind" : "empty"
  if (out.mode === "words" && out.who) out.words = `${out.words} ${out.who}`.trim()
  return out
}

/** The typed text with one chip's token taken out. */
export const withoutChip = (term: string, chip: Chip) => `${term.slice(0, chip.start)}${term.slice(chip.end)}`.replace(/\s+/g, " ").trimStart()

/** Where a kind lives for a jurisdiction: the page a scope by itself opens. */
export function kindHref(kind: SearchKind, code: string): string {
  const c = code.toLowerCase()
  if (kind === "bills") return `/bills/${c}`
  if (kind === "laws") return `/laws/${c}`
  // Sessions have no index page of their own; the jurisdiction's page lists them.
  if (kind === "sessions") return `/state/${c}`
  return `/${kind}?state=${code}`
}
