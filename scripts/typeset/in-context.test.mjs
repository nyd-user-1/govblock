// The in-context view's pure half (apps/web/lib/typeset/in-context.ts): markers on a
// fork's instructions and the redline drawn over each affected statute. H.R. 6644 § 101
// as enrolled against 12 U.S.C. 1701x, and a fork of 10 U.S.C. 130i(b)(1) grafted back
// into its section.
//
//   node --test scripts/typeset/in-context.test.mjs
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
const W1701X = "/us/usc/t12/s1701x"
const usc1701x = E.uslmToDoc(E.parseXml(fixture("us-usc-t12-s1701x@2026-07-23.xml")), { identifier: W1701X, dialect: "uslm" }).doc
const W130I = "/us/usc/t10/s130i"
const usc130i = E.uslmToDoc(E.parseXml(fixture("us-usc-t10-s130i@2026-04-17.xml")), { identifier: W130I, dialect: "uslm" }).doc
const BILL = { jurisdiction: "us", work: "/us/bill/119/hr/6644" }
const INSERTED = "that the recipients are geographically diverse and include organizations that serve urban or rural areas"

/** A document edited as JSON: the first run of `from` under `identifier` becomes `to`. */
function replaced(doc, identifier, from, to) {
  const json = structuredClone(doc.toJSON())
  const visit = (node, inside) => {
    const here = inside || node.attrs?.identifier === identifier
    if (here && node.type === "text" && node.text.includes(from)) {
      node.text = node.text.replace(from, to)
      return true
    }
    return (node.content ?? []).some((c) => visit(c, here))
  }
  assert.ok(visit(json, false), `no "${from}" under ${identifier}`)
  return S.nodeFromJSON(json)
}

test("a bill: one marker on each instruction, one tab for the Work they amend", () => {
  const { instructions, works, markers } = E.billContext(s101, BILL)
  assert.deepEqual(works, [W1701X])
  assert.equal(markers.length, 5)
  assert.deepEqual(
    markers.map((m) => m.unit),
    [`${W1701X}/a/4/C`, `${W1701X}/e`, `${W1701X}/i`, `${W1701X}/i`, W1701X]
  )
  markers.forEach((m, i) => assert.equal(m.at, instructions[i].to))
  assert.match(markers[0].title, /^12 U\.S\.C\. 1701x\(a\)\(4\)\(C\)$/)
})

test("a bill on the stored text, which already carries it: no redline, five outcomes already made or applied", () => {
  const { instructions } = E.billContext(s101, BILL)
  const { specs, outcomes } = E.billRedline(usc1701x, W1701X, instructions)
  assert.equal(outcomes.length, 5)
  assert.ok(outcomes.every((o) => ["already-made", "applied"].includes(o.status)))
  assert.equal(specs.length === 0, outcomes.every((o) => o.status === "already-made"))
})

test("a bill on the text before it: the struck words struck and the new words inserted, in the statute's positions", () => {
  const before = replaced(usc1701x, `${W1701X}/a/4/C`, INSERTED, "adequate distribution of amounts for rural areas having traditionally low levels of access, and foreclosure rates")
  // Served without its identifier: the Work is taken from the tab.
  const bare = S.nodes.doc.create({ ...before.attrs, identifier: null }, before.content)
  const { instructions } = E.billContext(s101, BILL)
  const { specs, outcomes } = E.billRedline(bare, W1701X, instructions)
  assert.equal(outcomes[0].status, "applied", outcomes[0].detail ?? "")
  assert.match(specs.filter((s) => s.kind === "strike").map((s) => bare.textBetween(s.from, s.to)).join(" "), /adequate distribution/)
  assert.match(specs.filter((s) => s.kind === "insert").map((s) => s.text).join(" "), /geographically diverse/)
})

test("a unit the text lacks falls back to the nearest unit above it", () => {
  assert.equal(E.unitPos(usc1701x, `${W1701X}/a/4/C/zz`).identifier, `${W1701X}/a/4/C`)
  assert.equal(E.unitPos(usc1701x, "/us/usc/t99/s1"), null)
})

test("a statute fork of 130i(b)(1): a marker on the changed unit, and the redline over the whole section", () => {
  const FORK = `${W130I}/b/1`
  const portion = E.byIdentifier(usc130i, FORK).node
  const base = S.nodes.doc.create({ identifier: W130I }, [portion])
  const fork = replaced(base, `${FORK}/D`, "exercise control", "assume control")
  const cite = { jurisdiction: "us", kind: "usc", work: W130I }

  const { instructions, markers } = E.forkContext(base, fork, cite, FORK)
  assert.equal(instructions.length, 1)
  assert.equal(markers.length, 1)
  assert.equal(markers[0].unit, `${FORK}/D`)
  assert.match(markers[0].title, /striking “exercise” and inserting “assume”/)
  // The marker ends the unit's first line of words.
  const d = E.byIdentifier(fork, `${FORK}/D`)
  assert.ok(markers[0].at > d.pos && markers[0].at < d.pos + d.node.nodeSize)

  const red = E.forkRedline(usc130i, fork, FORK)
  assert.deepEqual(red.specs.filter((s) => s.kind === "strike").map((s) => usc130i.textBetween(s.from, s.to)), ["exercise"])
  assert.deepEqual(red.specs.filter((s) => s.kind === "insert").map((s) => s.text), ["assume"])
  const at = E.byIdentifier(usc130i, `${FORK}/D`)
  for (const s of red.specs) assert.ok((s.from ?? s.at) > at.pos && (s.from ?? s.at) < at.pos + at.node.nodeSize)

  assert.equal(E.graft(usc130i, fork, `${W130I}/zz`), null)
})
