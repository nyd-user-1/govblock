import { squeeze } from "@/lib/search-match"

// Reading somebody else's contact list.
//
// The file Brendan uploads is whatever his source exported, so nothing here
// assumes a shape: the delimiter is measured, the header is detected rather
// than required, and a file with no header at all is read by what the cells
// look like — the one with an @ in it is the address, and the rest fall in
// beside it. What cannot be read is reported line by line rather than dropped,
// because a contact silently missing from an invitation list is worse than one
// that says why it did not make it.

export type ParsedContact = { name: string; email: string; org: string }
export type SkippedRow = { line: number; text: string; reason: string }
export type ParseResult = {
  contacts: ParsedContact[]
  skipped: SkippedRow[]
  /** Whether the first row named its columns, or the shape had to be guessed. */
  header: boolean
}

// Deliberately loose. A stricter address grammar rejects real deliverable
// addresses, and the send is what finds a bad one — this only has to be sure
// the cell is an address and not a name.
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/
export const looksLikeEmail = (value: string) => EMAIL.test(value.trim())

// Column names, squeezed to letters and digits, so "E-Mail", "Email Address"
// and "email_address" are all one word by the time they are compared.
const HEADERS: Record<"email" | "name" | "first" | "last" | "org", string[]> = {
  email: ["email", "emailaddress", "email1", "emails", "mail", "mailaddress", "workemail", "primaryemail", "contactemail"],
  name: ["name", "fullname", "contactname", "contact", "displayname", "person", "invitee", "recipient"],
  first: ["firstname", "first", "givenname", "forename", "fname"],
  last: ["lastname", "last", "surname", "familyname", "lname"],
  org: ["org", "orgs", "organization", "organisation", "company", "companyname", "employer", "affiliation", "agency", "business", "firm", "institution"],
}

type Row = { cells: string[]; line: number }

/**
 * The text, cell by cell. Quoted fields are honoured — including a delimiter
 * or a line break inside one, which is why this walks the whole text rather
 * than splitting on newlines first — and `line` is the line the row started
 * on, so a skipped row can be pointed at.
 */
function parseDelimited(text: string, delimiter: string): Row[] {
  const rows: Row[] = []
  let cells: string[] = []
  let cell = ""
  let quoted = false
  let line = 1
  let started = 1
  const endRow = () => {
    cells.push(cell)
    if (cells.some((c) => c.trim())) rows.push({ cells: cells.map((c) => c.trim()), line: started })
    cells = []
    cell = ""
    started = line
  }
  for (let i = 0; i < text.length; i++) {
    const character = text[i]
    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else {
        if (character === "\n") line++
        cell += character
      }
    } else if (character === '"') quoted = true
    else if (character === delimiter) {
      cells.push(cell)
      cell = ""
    } else if (character === "\n") {
      line++
      endRow()
    } else if (character !== "\r") cell += character
  }
  endRow()
  return rows
}

/** Whichever of comma, tab and semicolon the text actually uses. */
function delimiterOf(text: string) {
  const outside = text.replace(/"[^"]*"/g, "")
  const counts = [",", "\t", ";"].map((d) => [d, outside.split(d).length - 1] as const)
  const [best, count] = counts.sort((a, b) => b[1] - a[1])[0]
  return count > 0 ? best : ","
}

/** "Jane Doe <jane@acme.org>" is one cell holding two facts. */
function splitAngled(value: string): { name: string; email: string } | null {
  const match = /^(.*?)<\s*([^>]+?)\s*>$/.exec(value.trim())
  if (!match || !looksLikeEmail(match[2])) return null
  return { name: match[1].trim().replace(/^["']|["']$/g, ""), email: match[2] }
}

/**
 * A name for a row that gave none: "jane.doe@acme.org" is probably Jane Doe.
 * A local part carrying digits or a single letter is left alone — a wrong name
 * on an invitation is worse than no name, which the table can show as the
 * address itself.
 */
function nameFromEmail(email: string) {
  const local = email.split("@")[0]
  if (/\d/.test(local)) return ""
  const words = local.split(/[._-]+/).filter((w) => w.length > 1)
  if (words.length < 2) return ""
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ")
}

/** Which column is which, when the first row names them. */
function mapHeader(cells: string[]) {
  const keys = cells.map(squeeze)
  const find = (names: string[]) => keys.findIndex((key) => names.includes(key))
  const map = {
    email: find(HEADERS.email),
    name: find(HEADERS.name),
    first: find(HEADERS.first),
    last: find(HEADERS.last),
    org: find(HEADERS.org),
  }
  // A header is a header only if it names an address column and no cell in it
  // *is* an address — otherwise this is a data row that happens to say "name".
  const isHeader = map.email >= 0 && !cells.some(looksLikeEmail)
  return isHeader ? map : null
}

/** The address in a row, and the cells that are not it. */
function readByShape(cells: string[]): ParsedContact | { reason: string } {
  let name = ""
  let email = ""
  const rest: string[] = []
  for (const cell of cells) {
    const angled = splitAngled(cell)
    if (angled) {
      email ||= angled.email
      if (angled.name) name ||= angled.name
      continue
    }
    if (!email && looksLikeEmail(cell)) email = cell
    else if (cell) rest.push(cell)
  }
  if (!email) return { reason: cells.some(Boolean) ? "no email address in the row" : "empty row" }
  if (!name) name = rest.shift() ?? ""
  return { name: name || nameFromEmail(email), email, org: rest.shift() ?? "" }
}

/**
 * A pasted list or an uploaded file, as contacts. Both go through the same
 * reader: a pasted column of bare addresses is a one-column CSV, and
 * "Jane Doe <jane@acme.org>" is a one-cell row.
 */
export function parseContacts(text: string): ParseResult {
  const rows = parseDelimited(text ?? "", delimiterOf(text ?? ""))
  if (!rows.length) return { contacts: [], skipped: [], header: false }

  const map = mapHeader(rows[0].cells)
  const body = map ? rows.slice(1) : rows
  const contacts: ParsedContact[] = []
  const skipped: SkippedRow[] = []

  for (const row of body) {
    const at = (index: number) => (index >= 0 ? (row.cells[index] ?? "").trim() : "")
    let read: ParsedContact | { reason: string }
    if (map) {
      const email = at(map.email)
      const named = [at(map.first), at(map.last)].filter(Boolean).join(" ")
      const name = at(map.name) || named
      // A named email column holding "Jane <jane@acme.org>" is still two facts.
      const angled = splitAngled(email)
      const address = angled?.email ?? email
      read = looksLikeEmail(address)
        ? { name: name || angled?.name || nameFromEmail(address), email: address, org: at(map.org) }
        : { reason: address ? `"${address}" is not an email address` : "no email address in the row" }
    } else {
      read = readByShape(row.cells)
    }
    if ("reason" in read) skipped.push({ line: row.line, text: row.cells.join(", ").slice(0, 120), reason: read.reason })
    else contacts.push({ ...read, email: read.email.toLowerCase() })
  }

  return { contacts, skipped, header: !!map }
}
