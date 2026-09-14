// A bill's amendment instructions read and carried out (apps/web/lib/typeset/instruct.ts):
// H.R. 6644 § 101 as enrolled, amending 12 U.S.C. 1701x, whose stored release point
// (2026-07-23) already carries the amendment.
//
//   node --test scripts/typeset/instruct.test.mjs
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

const s101 = S.nodeFromJSON(JSON.parse(fixture("us-bill-119-hr-6644-tI-s101@2026-06-25_enr.json")))
const usc = E.uslmToDoc(E.parseXml(fixture("us-usc-t12-s1701x@2026-07-23.xml")), { identifier: "/us/usc/t12/s1701x", dialect: "uslm" }).doc
const INSERTED = "that the recipients are geographically diverse and include organizations that serve urban or rural areas"

test("the forms an instruction takes", () => {
  const strike = E.parseInstruction("in subsection (a)(4)(C), by striking “adequate distribution” and all that follows through “foreclosure rates” and inserting “that the recipients are diverse”;")
  assert.deepEqual(strike, { portion: ["a", "4", "C"], part: null, action: { kind: "strike-insert", strike: "adequate distribution", through: "foreclosure rates", insert: "that the recipients are diverse" } })
  assert.deepEqual(E.parseInstruction("in the heading, by striking “Authority” and inserting “Authorization”").part, "in the heading")
  assert.deepEqual(E.parseAction("by striking paragraph (3); and"), { kind: "strike-unit", unit: { element: "paragraph", value: "3" } })
  assert.deepEqual(E.parseAction("by redesignating paragraphs (3) and (4) as paragraphs (4) and (5), respectively"), { kind: "redesignate", from: [{ element: "paragraph", value: "3" }, { element: "paragraph", value: "4" }], to: [{ element: "paragraph", value: "4" }, { element: "paragraph", value: "5" }] })
  assert.deepEqual(E.parseAction("by inserting “promptly” after “Defense may”"), { kind: "insert-after", insert: "promptly", anchor: "Defense may" })
  assert.equal(E.parseAction("by adding at the end the following:").kind, "add-end")
  assert.equal(E.parseAction("by inserting after paragraph (2) the following:").kind, "insert-unit-after")
  assert.equal(E.parseAction("by moving the paragraph somewhere").kind, "unread")
})

test("H.R. 6644 § 101: five instructions to 12 U.S.C. 1701x, nested lists narrowing the portion", () => {
  const list = E.instructionsOf(s101, { jurisdiction: "us", work: "/us/bill/119/hr/6644" })
  assert.deepEqual(
    list.map((i) => [i.work, i.portion.join("/"), i.action.kind]),
    [
      ["/us/usc/t12/s1701x", "a/4/C", "strike-insert"],
      ["/us/usc/t12/s1701x", "e", "add-end"],
      ["/us/usc/t12/s1701x", "i", "redesignate"],
      ["/us/usc/t12/s1701x", "i", "insert-unit-after"],
      ["/us/usc/t12/s1701x", "", "add-end"],
    ]
  )
  assert.equal(list[0].action.insert, INSERTED)
  assert.match(s101.textBetween(list[0].from, list[0].to, "", "￼"), /^in subsection \(a\)\(4\)\(C\), by striking/)
  assert.equal(E.numOf(list[1].action.matter[0]), "6")
  assert.equal(E.numOf(list[3].action.matter[0]), "3")
  assert.equal(E.numOf(list[4].action.matter[0]), "j")
})

test("carried out on the stored text, which already holds the amendment: nothing applies twice", () => {
  const list = E.instructionsOf(s101, { jurisdiction: "us", work: "/us/bill/119/hr/6644" })
  const { doc, outcomes } = E.carryOut(usc, list)
  const statuses = outcomes.map((o) => `${o.instruction.portion.join("/") || "§"} ${o.instruction.action.kind}: ${o.status}${o.detail ? ` (${o.detail})` : ""}`)
  assert.equal(outcomes[0].status, "already-made", statuses.join("\n"))
  for (const o of outcomes) assert.ok(["already-made", "applied"].includes(o.status), statuses.join("\n"))
  assert.ok(outcomes.filter((o) => o.status === "already-made").length >= 4, statuses.join("\n"))
  assert.equal(E.diffDocs(usc, doc).status === "same", outcomes.every((o) => o.status === "already-made"))
})

test("quotation marks the printing marks but does not print: H.R. 139's nine instructions to 15 U.S.C. 261 apply", () => {
  // An introduced printing carries “4 hours” as quoted text with no quotation marks in its words.
  const bill = S.nodeFromJSON(JSON.parse(fixture("us-bill-119-hr-139@2025-01-03_ih.json")))
  const statute = E.uslmToDoc(E.parseXml(fixture("us-usc-t15-s261@2026-09-09.xml")), { identifier: "/us/usc/t15/s261", dialect: "uslm" }).doc
  const list = E.instructionsOf(bill, { jurisdiction: "us", work: "/us/bill/119/hr/139" })
  assert.equal(list.length, 9)
  assert.deepEqual(list[0].action, { kind: "strike-insert", strike: "4 hours", through: null, insert: "3 hours" })
  const { doc, outcomes } = E.carryOut(statute, list)
  assert.deepEqual([...new Set(outcomes.map((o) => o.status))], ["applied"])
  const specs = E.marked(E.diffDocs(statute, doc))
  assert.deepEqual(specs.filter((s) => s.kind === "strike").slice(0, 3).map((s) => statute.textBetween(s.from, s.to)), ["4", "5", "6"])
  assert.deepEqual(specs.filter((s) => s.kind === "insert").slice(0, 3).map((s) => s.text), ["3", "4", "5"])
})

test("an instruction the words forms do not wholly read is not guessed at", () => {
  // Section 63(b) of H.R. 557: a place and two more actions after the struck word.
  assert.equal(E.parseAction("by striking “and” at the end of paragraph (3), by striking the period at the end of paragraph (4) and inserting “, and”, and by adding at the end the following:").kind, "unread")
  assert.equal(E.parseAction("by redesignating section 224 as section 225 and by inserting after section 223 the following new section:").kind, "unread")
  assert.equal(E.parseAction("by inserting after section 223 the following new section:").kind, "insert-unit-after")
})

test("a struck phrase is never found inside a word", () => {
  const ins = { from: 0, to: 0, text: "", work: "/us/usc/t12/s1701x", cite: null, portion: ["a", "4", "C"], part: null, action: { kind: "strike", strike: "or", through: null } }
  const { doc, outcomes } = E.carryOut(usc, [ins])
  assert.equal(outcomes[0].status, "applied", outcomes[0].detail ?? "")
  const [struck] = E.marked(E.diffDocs(usc, doc)).filter((s) => s.kind === "strike")
  // The strike's hunk carries the spaces around the word: " or " in "urban or rural", never the "or" of "for".
  assert.match(usc.textBetween(struck.from, struck.to), /^\s*or\s*$/)
  assert.match(usc.textBetween(struck.from - 1, struck.to + 1), /(?<![\p{L}\p{N}])or(?![\p{L}\p{N}])/u)
})

test("quoted matter carried into a statute takes the statute's addresses; a unit rewritten stays whole", () => {
  // H.R. 286 rewrites 18 U.S.C. 1038(a)(1) and (b) to read as follows, and adds subsection (e).
  const bill = S.nodeFromJSON(JSON.parse(fixture("us-bill-119-hr-286@2025-01-09_ih.json")))
  const statute = E.uslmToDoc(E.parseXml(fixture("us-usc-t18-s1038@2026-05-04.xml")), { identifier: "/us/usc/t18/s1038", dialect: "uslm" }).doc
  const list = E.instructionsOf(bill, { jurisdiction: "us", work: "/us/bill/119/hr/286" })
  const { doc, outcomes } = E.carryOut(statute, list)
  assert.deepEqual(outcomes.map((o) => o.status), ["applied", "applied", "applied"])
  const ids = []
  doc.descendants((n) => void (n.attrs?.identifier && ids.push(n.attrs.identifier)))
  assert.ok(ids.includes("/us/usc/t18/s1038/e"), ids.join(" "))
  const kinds = E.marked(E.diffDocs(statute, doc)).map((s) => s.kind)
  assert.ok(kinds.includes("strike-block") && kinds.includes("insert-block"), kinds.join(" "))
})

test("carried out on the text before it: applied, and the engine draws the redline", () => {
  // The words the bill strikes, put back into (a)(4)(C) to stand for the text before enactment.
  const json = structuredClone(usc.toJSON())
  const visit = (node, inside) => {
    const here = inside || node.attrs?.identifier === "/us/usc/t12/s1701x/a/4/C"
    if (here && node.type === "text" && node.text.includes(INSERTED)) {
      node.text = node.text.replace(INSERTED, "adequate distribution of amounts for rural areas having traditionally low levels of access, and foreclosure rates")
      return true
    }
    return (node.content ?? []).some((c) => visit(c, here))
  }
  assert.ok(visit(json, false), "(a)(4)(C) holds the inserted words")
  const before = S.nodeFromJSON(json)
  const [first] = E.instructionsOf(s101, { jurisdiction: "us", work: "/us/bill/119/hr/6644" })
  const { doc, outcomes } = E.carryOut(before, [first])
  assert.equal(outcomes[0].status, "applied", outcomes[0].detail ?? "")
  const specs = E.marked(E.diffDocs(before, doc))
  const struck = specs.filter((s) => s.kind === "strike").map((s) => before.textBetween(s.from, s.to)).join(" ")
  const inserted = specs.filter((s) => s.kind === "insert").map((s) => s.text).join(" ")
  assert.match(struck, /adequate/)
  assert.match(inserted, /geographically diverse/)
})
