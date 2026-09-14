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
