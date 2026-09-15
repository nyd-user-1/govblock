// The amendment engine (apps/web/lib/typeset/amend.ts) on published law read
// from its stored Expressions: New York Agriculture and Markets Law § 16, H.R.
// 6644 § 102 as enrolled, and 10 U.S.C. 130i. Each fork is the base edited as
// JSON, the way the editor hands a fork back.
//
//   node --test scripts/typeset/amend.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { load } from "../xml/bundle.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFileSync(join(HERE, "fixtures", name), "utf8")
const E = await load("../../scripts/typeset/amend-entry.ts")
const S = E.xmlSchema

const nyBase = E.uslmToDoc(E.parseXml(fixture("us-ny-code-agm-s16@2026-02-20.xml")), { identifier: "/us-ny/code/agm/s16", dialect: "ny-statute" }).doc
const billBase = S.nodeFromJSON(JSON.parse(fixture("us-bill-119-hr-6644-tI-s102@2026-06-25_enr.json")))
const uscBase = E.uslmToDoc(E.parseXml(fixture("us-usc-t10-s130i@2026-04-17.xml")), { identifier: "/us/usc/t10/s130i", dialect: "uslm" }).doc

const NY = { jurisdiction: "us-ny", kind: "code", work: "/us-ny/code/agm/s16" }
const BILL = { jurisdiction: "us", kind: "bill", work: "/us/bill/119/hr/6644" }
const USC = { jurisdiction: "us", kind: "usc", work: "/us/usc/t10/s130i" }

// ------------------------------------------------------------------ edits ---

function edit(base, change) {
  const json = structuredClone(base.toJSON())
  change(json)
  return S.nodeFromJSON(json)
}

/** The JSON node with this identifier, its parent and its index. */
function at(json, identifier) {
  const visit = (node, parent, index) => {
    if (node.attrs?.identifier === identifier) return { node, parent, index }
    for (let i = 0; i < (node.content ?? []).length; i++) {
      const found = visit(node.content[i], node, i)
      if (found) return found
    }
    return null
  }
  const found = visit(json, null, -1)
  if (!found) throw new Error(`no ${identifier}`)
  return found
}

/** Replace the first run of words under a node. */
function replace(json, identifier, from, to) {
  const visit = (node) => {
    if (node.type === "text" && node.text.includes(from)) {
      node.text = node.text.replace(from, to)
      return true
    }
    return (node.content ?? []).some(visit)
  }
  if (!visit(at(json, identifier).node)) throw new Error(`no "${from}" under ${identifier}`)
}

const remove = (json, identifier) => {
  const { parent, index } = at(json, identifier)
  parent.content.splice(index, 1)
}

const level = (type, num, text, attrs = {}, heading = null) => ({
  type,
  attrs,
  content: [{ type: "num", content: [{ type: "text", text: num }] }, ...(heading ? [{ type: "heading", content: [{ type: "text", text: heading }] }] : []), { type: "content", content: [{ type: "p", content: [{ type: "text", text }] }] }],
})

const amend = (base, fork, cite) => E.instructions(E.diffDocs(base, fork), cite)
const texts = (amendment) => amendment.instructions.map((i) => i.text)

// -------------------------------------------------------------- New York ---

test("an unchanged fork amends nothing", () => {
  const diff = E.diffDocs(nyBase, edit(nyBase, () => {}))
  assert.equal(diff.status, "same")
  assert.deepEqual(E.instructions(diff, NY).instructions, [])
  assert.deepEqual(E.marked(diff), [])
})

test("New York: words changed in a subdivision restate it, new matter and omitted matter marked", () => {
  const fork = edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", "and the rules of the department", "and the rules and regulations of the department"))
  const a = amend(nyBase, fork, NY)
  assert.deepEqual(texts(a), ["Section 1. Subdivision 1 of section 16 of the agriculture and markets law is amended to read as follows:"])
  const body = a.instructions[0].body
  assert.match(E.linesText(body), /^1\. Execute and carry into effect the laws of the state and the rules and regulations of the department/)
  assert.deepEqual(body.flatMap((l) => l.runs.filter((r) => r.op !== "equal")).map((r) => [r.op, r.text.trim()]), [["insert", "and regulations"]])
})

test("New York: a struck phrase is bracketed in the restated text", () => {
  const fork = edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", ", aquaculture,", ","))
  const [ins] = amend(nyBase, fork, NY).instructions
  assert.match(E.linesText(ins.body), /dairy products, \[aquaculture, \]and the production/)
})

test("New York: a subdivision repealed and the next renumbered", () => {
  const fork = edit(nyBase, (j) => {
    remove(j, "/us-ny/code/agm/s16/2-c")
    replace(j, "/us-ny/code/agm/s16/2-d", "2-d", "2-c")
  })
  assert.deepEqual(texts(amend(nyBase, fork, NY)), ["Section 1. Subdivision 2-c of section 16 of the agriculture and markets law is REPEALED and subdivision 2-d is renumbered subdivision 2-c."])
})

test("New York: a new subdivision added, all of it new matter", () => {
  const fork = edit(nyBase, (j) => {
    const { parent, index } = at(j, "/us-ny/code/agm/s16/2-g")
    parent.content.splice(index + 1, 0, level("subsection", "2-h", "Aid in the promotion of urban agriculture.", { role: "subdivision" }))
  })
  const a = amend(nyBase, fork, NY)
  assert.deepEqual(texts(a), ["Section 1. Section 16 of the agriculture and markets law is amended by adding a new subdivision 2-h to read as follows:"])
  assert.equal(E.linesText(a.instructions[0].body), "2-h. Aid in the promotion of urban agriculture.")
  assert.ok(a.instructions[0].body.every((l) => l.runs.every((r) => r.op === "insert" || !r.text.trim())))
})

test("New York: two changes are two bill sections, in the order of the law", () => {
  const fork = edit(nyBase, (j) => {
    replace(j, "/us-ny/code/agm/s16/1", "and the rules of the department", "and the rules and regulations of the department")
    remove(j, "/us-ny/code/agm/s16/2-c")
  })
  assert.deepEqual(texts(amend(nyBase, fork, NY)), [
    "Section 1. Subdivision 1 of section 16 of the agriculture and markets law is amended to read as follows:",
    "§ 2. Subdivision 2-c of section 16 of the agriculture and markets law is REPEALED.",
  ])
})

test("New York: a paragraph deep in a subdivision is named from the bottom up", () => {
  const fork = edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/2-e/ii", "and", "or"))
  assert.deepEqual(texts(amend(nyBase, fork, NY)), ["Section 1. Subparagraph (ii) of subdivision 2-e of section 16 of the agriculture and markets law is amended to read as follows:"])
})

test("the redline in place strikes and inserts at the base's own positions", () => {
  const fork = edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", "and the rules of the department", "and the regulations of the department"))
  const specs = E.marked(E.diffDocs(nyBase, fork))
  const strikes = specs.filter((s) => s.kind === "strike").map((s) => nyBase.textBetween(s.from, s.to))
  const inserts = specs.filter((s) => s.kind === "insert")
  assert.deepEqual(strikes, ["rules"])
  assert.deepEqual(inserts.map((s) => s.text), ["regulations"])
  // The insertion stands right after the words it replaces.
  assert.equal(nyBase.textBetween(inserts[0].at - 9, inserts[0].at), "the rules")
  assert.equal(E.clean(E.diffDocs(nyBase, fork)), fork)
})

test("competing amendments to one subdivision are refused; to different subdivisions they stand", () => {
  const a = E.diffDocs(nyBase, edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", "rules of the department", "regulations of the department")))
  const b = E.diffDocs(nyBase, edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", "weights and measures", "weights, measures and scales")))
  const c = E.diffDocs(nyBase, edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/2", "rural life", "rural and suburban life")))
  const clash = E.conflicts(a, b, "read-as-follows")
  assert.equal(clash.length, 1)
  assert.equal(clash[0].unit, "/us-ny/code/agm/s16/1")
  assert.match(clash[0].reason, /restate/)
  assert.deepEqual(E.conflicts(a, c, "read-as-follows"), [])
  // Under strike and insert the same two change different words, so both stand.
  assert.deepEqual(E.conflicts(a, b, "strike-insert"), [])
  assert.equal(E.conflicts(a, a, "strike-insert").length, 1)
})

// ---------------------------------------------------------- H.R. 6644 ---

test("H.R. 6644: words in a subsection, in the bill's own strike-and-insert form", () => {
  const fork = edit(billBase, (j) => replace(j, "/us/bill/119/hr/6644/tI/s102/a", "18 months", "12 months"))
  const diff = E.diffDocs(billBase, fork)
  assert.deepEqual(texts(E.instructions(diff, BILL)), ["In section 102(a), strike “18” and insert “12”."])
  const [strike] = E.marked(diff).filter((s) => s.kind === "strike")
  assert.equal(billBase.textBetween(strike.from, strike.to), "18")
})

test("H.R. 6644: a paragraph struck and those after it redesignated", () => {
  const fork = edit(billBase, (j) => {
    remove(j, "/us/bill/119/hr/6644/tI/s102/b/5")
    for (const n of [6, 7, 8]) replace(j, `/us/bill/119/hr/6644/tI/s102/b/${n}`, `(${n})`, `(${n - 1})`)
  })
  assert.deepEqual(texts(amend(billBase, fork, BILL)), ["In section 102(b)—\n(1) strike paragraph (5); and\n(2) redesignate paragraphs (6), (7), and (8) as paragraphs (5), (6), and (7), respectively."])
})

test("H.R. 6644: a subsection added at the end, quoted", () => {
  const fork = edit(billBase, (j) => at(j, "/us/bill/119/hr/6644/tI/s102").node.content.push(level("subsection", "(h)", "The Secretary shall report to Congress on the guidelines each year.", {}, "Report")))
  const a = amend(billBase, fork, BILL)
  assert.deepEqual(texts(a), ["In section 102, add at the end the following:"])
  assert.equal(E.linesText(a.instructions[0].body), "“(h) Report The Secretary shall report to Congress on the guidelines each year.”.")
})

test("H.R. 6644: a subsection mostly rewritten is struck and replaced whole", () => {
  const fork = edit(billBase, (j) => replace(j, "/us/bill/119/hr/6644/tI/s102/f", "Nothing in this section may be construed to preempt a State or local building code.", "A State may adopt the guidelines by reference."))
  const a = amend(billBase, fork, BILL)
  assert.deepEqual(texts(a), ["Strike section 102(f) and insert the following:"])
  assert.equal(E.linesText(a.instructions[0].body), "“(f) Rule of construction A State may adopt the guidelines by reference.”.")
})

// ------------------------------------------------------ 10 U.S.C. 130i ---

test("10 U.S.C. 130i: the codified form, is amended by striking and inserting", () => {
  const fork = edit(uscBase, (j) => replace(j, "/us/usc/t10/s130i/b/1/D", "exercise control", "assume control"))
  assert.deepEqual(texts(amend(uscBase, fork, USC)), ["Section 130i(b)(1)(D) of title 10, United States Code, is amended by striking “exercise” and inserting “assume”."])
})

test("10 U.S.C. 130i: in the heading", () => {
  const fork = edit(uscBase, (j) => replace(j, "/us/usc/t10/s130i/a", "Authority", "Authorization"))
  assert.deepEqual(texts(amend(uscBase, fork, USC)), ["Section 130i(a) of title 10, United States Code, is amended, in the heading, by striking “Authority” and inserting “Authorization”."])
})

test("10 U.S.C. 130i: an insertion is placed after words that appear once", () => {
  const fork = edit(uscBase, (j) => replace(j, "/us/usc/t10/s130i/a", "Secretary of Defense may take", "Secretary of Defense may promptly take"))
  assert.deepEqual(texts(amend(uscBase, fork, USC)), ["Section 130i(a) of title 10, United States Code, is amended by inserting “promptly” after “Defense may”."])
})

test("10 U.S.C. 130i: a fork of a portion is cited through the levels above it", () => {
  let portion = null
  uscBase.descendants((n) => {
    if (n.attrs?.identifier === "/us/usc/t10/s130i/b/1") portion = n
    return !portion
  })
  const base = S.nodes.doc.create({ identifier: "/us/usc/t10/s130i" }, [portion])
  const fork = edit(base, (j) => replace(j, "/us/usc/t10/s130i/b/1/D", "exercise control", "assume control"))
  assert.deepEqual(texts(amend(base, fork, USC)), ["Section 130i(b)(1)(D) of title 10, United States Code, is amended by striking “exercise” and inserting “assume”."])
})

test("words: a replaced run is one strike and one insertion", () => {
  assert.deepEqual(E.diffText("the red car stops", "the blue truck stops"), [
    { op: "equal", text: "the " },
    { op: "delete", text: "red car" },
    { op: "insert", text: "blue truck" },
    { op: "equal", text: " stops" },
  ])
})
