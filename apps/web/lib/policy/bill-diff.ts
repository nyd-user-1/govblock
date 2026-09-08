import "server-only"

import { n, one, q } from "@/lib/policy/db"
import { lineDiff } from "@/lib/policy/line-diff"
import { cleanBillText } from "@/lib/policy/texts"

// What changed between two versions of a bill, small enough to read.
//
// The same `lineDiff` the repository view draws its commits with — CodeMirror's
// Myers diff under a 1.5 s budget, which degrades to a coarse answer rather
// than hanging on a gut-and-amend. What is different here is the answer, not
// the diff: a tool result is capped at eight thousand characters and a real
// unified diff of a bill is hundreds of kilobytes, so this reports the shape of
// the change — how many lines moved, in which sections, and a couple of lines
// from each place it happened — and leaves the reading of any one passage to
// get_bill_text, which can now open a window anywhere.
//
// Two texts of three hundred thousand characters each is the ceiling. It is the
// Data API's 1 MB result cap that sets it, and the longest bills run to six
// million; past it the diff is honest about being partial rather than failing.
const MAX_TEXT = 300_000

export type TextVersion = { document_id: number; version: string | null; chars: number; date: string | null }

/** A section heading, as the four or five drafting styles in this record write one. */
const HEADING = /^\s*(?:(?:SEC(?:TION)?\.?\s+\d+[A-Za-z]?\.)|(?:TITLE\s+[IVXLC]+\b)|(?:PART\s+[IVXLC]+\b)|(?:ARTICLE\s+[IVXLC0-9]+\b)|(?:§+\s*\d))/i

/** For each line, the heading it sits under. */
function sectionsOf(lines: string[]) {
  const at: string[] = new Array(lines.length)
  let current = "(preamble)"
  for (let i = 0; i < lines.length; i++) {
    if (HEADING.test(lines[i])) current = lines[i].trim().replace(/\s+/g, " ").slice(0, 80)
    at[i] = current
  }
  return at
}

const preview = (lines: string[], take: number) =>
  lines
    .filter((l) => l.trim())
    .slice(0, take)
    .map((l) => l.trim().replace(/\s+/g, " ").slice(0, 180))

async function versions(billId: number): Promise<TextVersion[]> {
  const rows = await q<{ document_id: number; version: string | null; chars: number; date: string | null }>(
    `select t.document_id, t.version, t.chars, (to_jsonb(d) ->> 'date') as date
       from "BillTexts" t left join "Documents" d on d.document_id = t.document_id and d.document_type = 'text'
      where t.bill_id = $1 and t.text is not null and t.source is distinct from 'govinfo-billsum'
      -- Oldest first, and getting that right is most of this reader.
      --
      -- The stage's own date where the record has one: H.R. 1's versions in
      -- plain document_id order run Reported, Placed on Calendar, Enrolled,
      -- Engrossed, which is not the order they happened in, and the "newest
      -- two" would have been the wrong pair to compare.
      --
      -- Where there is no date — every New York text — the id decides, by
      -- magnitude and not by sign. LegiScan's ids are synthesised negative
      -- here and the last digits are the version's sequence, so A07380 runs
      -- -…00 Original, -…01 Amendment A, -…02 Amendment B: ascending by the
      -- number itself would have read the bill backwards, amendment to
      -- original. Undated rows sort after dated ones, which is where an
      -- Enrolled text with no date belongs.
      order by ((to_jsonb(d) ->> 'date') is null), (to_jsonb(d) ->> 'date'), abs(t.document_id)`,
    [billId]
  )
  return rows.map((r) => ({ ...r, document_id: n(r.document_id), chars: n(r.chars) }))
}

/** By document id, or by the version's name ("Introduced", "Engrossed"). */
function pick(list: TextVersion[], want: string | null | undefined) {
  if (!want) return null
  const asId = Number(want)
  if (Number.isFinite(asId) && asId) return list.find((v) => v.document_id === asId) ?? null
  const lower = String(want).toLowerCase()
  return list.find((v) => (v.version ?? "").toLowerCase() === lower) ?? list.find((v) => (v.version ?? "").toLowerCase().includes(lower)) ?? null
}

async function textOf(billId: number, documentId: number) {
  const row = await one<{ text: string; full: number }>(
    `select left(text, $2::int) as text, length(text) as full from "BillTexts" where bill_id = $1 and document_id = $3`,
    [billId, MAX_TEXT, documentId]
  )
  return { text: cleanBillText(row?.text ?? ""), full: n(row?.full) }
}

export async function getBillDiff(billId: number, { from, to, limit = 12 }: { from?: string | null; to?: string | null; limit?: number } = {}) {
  const bill = await one<{ bill_number: string; title: string; state: string }>(`select bill_number, title, state from "Bills" where bill_id = $1`, [billId])
  const list = await versions(billId)
  if (list.length < 2) {
    return {
      bill_id: billId,
      bill_number: bill?.bill_number ?? null,
      versions: list,
      note: list.length
        ? `Only one text version is on file for this bill (${list[0].version ?? "unnamed"}), so there is nothing to compare it with.`
        : "No text is on file for this bill, so there is nothing to compare.",
    }
  }
  // Newest against the one before it, which is the question "what changed" —
  // but a sponsor's memo is not a version of the bill, and New York files six
  // of them, so the default pair is drawn from the texts unless those are all
  // there is. Either can still be asked for by name.
  const texts = list.filter((v) => !/memo|summary|digest/i.test(v.version ?? ""))
  const pool = texts.length >= 2 ? texts : list
  const after = pick(list, to) ?? pool[pool.length - 1]
  const before = pick(list, from) ?? pool.filter((v) => v.document_id !== after.document_id).slice(-1)[0]
  const [a, b] = await Promise.all([textOf(billId, before.document_id), textOf(billId, after.document_id)])

  const diff = lineDiff(a.text, b.text, { ignoreWhitespace: true })
  const aSections = sectionsOf(diff.aLines)
  const bSections = sectionsOf(diff.bLines)

  const rollup = new Map<string, { added: number; deleted: number }>()
  const changes: { section: string; line: number; removed: string[]; added: string[] }[] = []
  for (const block of diff.blocks) {
    if (block.kind !== "change") continue
    const section = bSections[block.b] ?? aSections[block.a] ?? "(unsectioned)"
    const tally = rollup.get(section) ?? { added: 0, deleted: 0 }
    tally.added += block.add.length
    tally.deleted += block.del.length
    rollup.set(section, tally)
    if (changes.length < Math.min(Math.max(1, limit), 40)) {
      changes.push({ section, line: block.b + 1, removed: preview(block.del, 2), added: preview(block.add, 2) })
    }
  }

  const blocks = diff.blocks.filter((x) => x.kind === "change").length
  return {
    bill_id: billId,
    bill_number: bill?.bill_number ?? null,
    title: bill?.title ?? null,
    from: { ...before, truncated: a.full > MAX_TEXT },
    to: { ...after, truncated: b.full > MAX_TEXT },
    versions: list.map((v) => ({ document_id: v.document_id, version: v.version, chars: v.chars })),
    lines: { added: diff.added, deleted: diff.deleted, before: diff.aLines.length, after: diff.bLines.length },
    places: blocks,
    // The rollup is the answer when the change is large: which sections moved,
    // and by how much, without any of the text.
    sections: [...rollup]
      .map(([section, tally]) => ({ section, ...tally }))
      .sort((x, y) => y.added + y.deleted - (x.added + x.deleted))
      .slice(0, 20),
    changes,
    note:
      a.full > MAX_TEXT || b.full > MAX_TEXT
        ? `One of these versions is longer than ${MAX_TEXT.toLocaleString()} characters and was compared up to that point only.`
        : blocks > changes.length
          ? `${blocks} places changed; the first ${changes.length} are shown. The section rollup covers all of them.`
          : null,
  }
}
