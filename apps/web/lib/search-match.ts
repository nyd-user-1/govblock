// How a typed query meets a row, in one place.
//
// Every list on the site used to hold its own `value.toLowerCase().includes(q)`,
// and every one of them failed the same way: a reader who types "hr 119" for
// HR119 gets nothing, because the space is in the query and not in the data.
// The database's own search already knew better — searchAll squeezes the spaces
// out of a bill number before it matches (lib/policy/db-queries.ts) — so the
// client-side filters match the same way here rather than each inventing a
// weaker rule.
//
// Two passes, in this order:
//   1. the query as typed, as a substring;
//   2. the query with every non-alphanumeric character dropped, against the
//      value with the same treatment — "hr 119", "H.R. 119" and "hr119" all
//      reduce to `hr119`, which is what "H.R. 119" reduces to as well.
//
// Multi-word queries are matched word by word, so "gilbert cisneros" finds a
// row filed as "Gilbert Ray Cisneros" and word order stops mattering.

/** Lowercased, with everything that is not a letter or a digit dropped. */
export function squeeze(value: string | number | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

/**
 * The query's words, squeezed, longest first. A word of one character is
 * dropped when the query has others — "a bill" should not light up every "a" —
 * but a query that is only short words keeps them, because "12" is a district.
 */
export function queryTerms(query: string) {
  const words = String(query ?? "")
    .trim()
    .split(/\s+/)
    .map(squeeze)
    .filter(Boolean)
    .slice(0, 6)
  const long = words.filter((word) => word.length > 1)
  return long.length ? long : words
}

/** Every word of the query, somewhere in the values. */
export function matchesQuery(query: string, ...values: (string | number | null | undefined)[]) {
  const raw = String(query ?? "").trim().toLowerCase()
  if (!raw) return true
  const terms = queryTerms(raw)
  if (!terms.length) return true
  const texts = values.map((value) => String(value ?? "").toLowerCase())
  const squeezed = texts.map((text) => text.replace(/[^a-z0-9]+/g, ""))
  // The whole phrase as typed counts as a hit on its own, so "climate change"
  // matches a title that carries it even where the words are split across two
  // of the values.
  if (texts.some((text) => text.includes(raw))) return true
  return terms.every((term) => squeezed.some((text) => text.includes(term)))
}

// The alphanumeric characters of a string, with where each one came from, so a
// match found in the squeezed form can be pointed back at the original: the
// span highlighted for "hr119" in "H.R. 119" is the whole of "H.R. 119",
// punctuation and space included.
function squeezeWithIndex(text: string) {
  let squeezed = ""
  const at: number[] = []
  for (let i = 0; i < text.length; i++) {
    const character = text[i].toLowerCase()
    if ((character >= "a" && character <= "z") || (character >= "0" && character <= "9")) {
      squeezed += character
      at.push(i)
    }
  }
  return { squeezed, at }
}

type Range = [number, number]

function findAll(haystack: string, needle: string, at: number[], text: string): Range[] {
  const found: Range[] = []
  if (!needle) return found
  let from = 0
  // Twenty is more highlights than any row can show; a query of "a" against a
  // bill title should not build a thousand ranges to draw four of them.
  while (found.length < 20) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) break
    found.push([at[index], at[index + needle.length - 1] + 1])
    from = index + needle.length
  }
  return found.filter(([start, end]) => start >= 0 && end <= text.length)
}

/** The stretches of `text` the query hit, merged and in reading order. */
export function hitRanges(text: string, query: string): Range[] {
  const source = String(text ?? "")
  const terms = queryTerms(query)
  if (!source || !terms.length) return []
  const { squeezed, at } = squeezeWithIndex(source)
  if (!squeezed) return []

  // The whole query first: "climate change" should underline one phrase, not
  // two words that happen to be adjacent. Only when the phrase is absent does
  // each word go looking for itself.
  const whole = squeeze(query)
  const found = whole.length > 1 ? findAll(squeezed, whole, at, source) : []
  const ranges = found.length ? found : terms.flatMap((term) => findAll(squeezed, term, at, source))

  const merged: Range[] = []
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

export type HighlightPart = { text: string; hit: boolean }

/** `text` cut into the pieces the query matched and the pieces it did not. */
export function highlightParts(text: string | null | undefined, query: string): HighlightPart[] {
  const source = String(text ?? "")
  const ranges = hitRanges(source, query)
  if (!ranges.length) return source ? [{ text: source, hit: false }] : []
  const parts: HighlightPart[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: source.slice(cursor, start), hit: false })
    parts.push({ text: source.slice(start, end), hit: true })
    cursor = end
  }
  if (cursor < source.length) parts.push({ text: source.slice(cursor), hit: false })
  return parts
}
