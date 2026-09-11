// Small shared turns of phrase every adapter needs.

const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "over", "the", "to", "upon", "with"])

/**
 * A heading the source shouts, set the way New York's are.
 *
 * Most codes print their divisions in capitals — "GENERAL PROVISIONS" — and a
 * rail of those beside New York's "General Business" reads as a different site.
 * Only a heading that is entirely capitals is touched: one that is already
 * mixed is its publisher's own casing and is left alone. Tokens that carry a
 * digit or an inner full stop are left as they are, so "U.S.C." and "401(k)"
 * survive.
 */
export function titleCase(heading) {
  const text = String(heading ?? "").trim()
  if (!text || text !== text.toUpperCase() || !/[A-Z]/.test(text)) return text || null
  return text
    .toLowerCase()
    .replace(/[^\s—–-]+/g, (word, at) => {
      const original = text.slice(at, at + word.length)
      if (/\d/.test(original) || /\w\.\w/.test(original)) return original
      if (at > 0 && SMALL.has(word)) return word
      return word.replace(/^([("'“‘]*)([a-z])/, (_, lead, first) => lead + first.toUpperCase())
    })
    .replace(/^\s*[a-z]/, (c) => c.toUpperCase())
}
