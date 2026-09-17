// Names as the files print them, turned into names as a sentence says them.
// The FEC prints "Cuellar, Henry", MIT prints "THOMAS R. SUOZZI", FairVote
// prints "Peltola, Mary S."; all three come out "Henry Cuellar", "Thomas
// Suozzi", "Mary Peltola".

const title = (s: string) => s.toLowerCase().replace(/(^|[\s\-'.(])\p{L}/gu, (m) => m.toUpperCase()).replace(/\b(Ii|Iii|Iv|Jr|Sr)\b/g, (m) => m.toUpperCase())

export function person(n: string) {
  const raw = String(n)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\\+"/g, '"')
    .replace(/\s*#\s*$/, "")
    .trim()
  let out = raw
  if (raw.includes(",")) {
    const [last, first] = raw.split(/,\s*/)
    out = `${first ?? ""} ${last}`
  }
  if (out === out.toUpperCase() && /[A-Z]{2}/.test(out)) out = title(out)
  out = out.replace(/\s+/g, " ").trim()
  // A middle initial is on the ballot, not in a sentence.
  const w = out.split(" ")
  if (w.length > 2) return w.filter((x, i) => i === 0 || i === w.length - 1 || !/^\p{L}\.?$/u.test(x)).join(" ")
  return out
}

/** "Peltola, Mary S." → "Peltola"; "Zohran Kwame Mamdani" → "Mamdani". */
export function surname(n: string) {
  const c = n.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*#\s*$/, "").trim()
  if (c.includes(",")) return title(c.split(",")[0])
  const w = c.split(/\s+/).filter((x) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(x))
  const last = w[w.length - 1] ?? c
  return last === last.toUpperCase() && /[A-Z]{2}/.test(last) ? title(last) : last
}
