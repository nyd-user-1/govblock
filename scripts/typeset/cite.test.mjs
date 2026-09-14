// Citations (apps/web/lib/typeset/cite.ts) on published law read from its
// stored Expressions: H.R. 6644 § 102 as enrolled, 10 U.S.C. 130i, and New
// York Agriculture and Markets Law § 16.
//
//   node --test scripts/typeset/cite.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { load } from "../xml/bundle.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFileSync(join(HERE, "fixtures", name), "utf8")
const E = await load("../../scripts/typeset/amend-entry.ts")

const nyBase = E.uslmToDoc(E.parseXml(fixture("us-ny-code-agm-s16@2026-02-20.xml")), { identifier: "/us-ny/code/agm/s16", dialect: "ny-statute" }).doc
const billBase = E.xmlSchema.nodeFromJSON(JSON.parse(fixture("us-bill-119-hr-6644-tI-s102@2026-06-25_enr.json")))
const uscBase = E.uslmToDoc(E.parseXml(fixture("us-usc-t10-s130i@2026-04-17.xml")), { identifier: "/us/usc/t10/s130i", dialect: "uslm" }).doc

test("hrefs: the address, the stored Work, and the relative forms GPO writes", () => {
  assert.deepEqual(E.addressOfHref("/us/usc/t12/s1709/r/4"), { kind: "usc", work: "/us/usc/t12/s1709", address: "/us/usc/t12/s1709/r/4" })
  assert.deepEqual(E.addressOfHref("usc/12/1701x"), { kind: "usc", work: "/us/usc/t12/s1701x", address: "/us/usc/t12/s1701x" })
  assert.deepEqual(E.addressOfHref("usc-chapter/38/15"), { kind: "usc-chapter", work: null, address: "/us/usc/t38/ch15" })
  assert.deepEqual(E.addressOfHref("pl/114/113"), { kind: "pl", work: "/us/pl/114/113", address: "/us/pl/114/113" })
  assert.deepEqual(E.addressOfHref("/us-ny/code/agm/s16/2-e/i"), { kind: "code", work: "/us-ny/code/agm/s16", address: "/us-ny/code/agm/s16/2-e/i" })
  assert.deepEqual(E.addressOfHref("/us-ma/code/gl/ch93A/s2"), { kind: "code", work: "/us-ma/code/gl/ch93A/s2", address: "/us-ma/code/gl/ch93A/s2" })
  assert.deepEqual(E.addressOfHref("/us-ny/const/artI/s11"), { kind: "const", work: "/us-ny/const/artI/s11", address: "/us-ny/const/artI/s11" })
  assert.equal(E.addressOfHref("#fn002007"), null)
})

test("New York spells its numbers", () => {
  assert.equal(E.wordsToNumber("three hundred three-a"), "303-a")
  assert.equal(E.wordsToNumber("seventy-six-a"), "76-a")
  assert.equal(E.wordsToNumber("two thousand eight hundred one-a"), "2801-a")
  assert.equal(E.wordsToNumber("eleven"), "11")
  assert.equal(E.wordsToNumber("33-0101"), "33-0101")
})

test("federal words: U.S.C. with its portion, section of title, Public Law", () => {
  const found = E.recognize("under 12 U.S.C. 1709(r)(4), section 1105(a) of title 31, United States Code, and Public Law 114–113", { jurisdiction: "us" })
  assert.deepEqual(found.map((f) => [f.kind, f.address]), [
    ["usc", "/us/usc/t12/s1709/r/4"],
    ["usc", "/us/usc/t31/s1105/a"],
    ["pl", "/us/pl/114/113"],
  ])
})

test("H.R. 6644 § 102: the ref marks resolve to the US Code, positions exact", () => {
  const cites = E.citationsOf(billBase, { jurisdiction: "us", work: "/us/bill/119/hr/6644" })
  assert.ok(cites.length > 0)
  for (const c of cites) assert.equal(billBase.textBetween(c.from, c.to, "", "￼"), c.text)
  const works = E.worksOf(cites)
  assert.ok(works.includes("/us/usc/t42/s5301"), works.join(", "))
  assert.ok(cites.every((c) => c.via === "ref" || c.kind !== "usc" || !cites.some((r) => r.via === "ref" && r.from < c.to && c.from < r.to)))
})

test("10 U.S.C. 130i: refs with a portion, and the words no ref covers", () => {
  const cites = E.citationsOf(uscBase, { jurisdiction: "us", work: "/us/usc/t10/s130i" })
  const byAddress = new Map(cites.map((c) => [c.address, c]))
  assert.equal(byAddress.get("/us/usc/t49/s46502")?.via, "ref")
  assert.equal(byAddress.get("/us/usc/t31/s1105/a")?.work, "/us/usc/t31/s1105")
  for (const c of cites) assert.equal(uscBase.textBetween(c.from, c.to, "", "￼"), c.text)
})

test("New York § 16: spelled-out sections of this chapter and of other laws", () => {
  const cites = E.citationsOf(nyBase, { jurisdiction: "us-ny", work: "/us-ny/code/agm/s16" })
  for (const c of cites) assert.equal(nyBase.textBetween(c.from, c.to, "", "￼"), c.text)
  const works = E.worksOf(cites)
  for (const w of ["/us-ny/code/agm/s303", "/us-ny/code/agm/s303-a", "/us-ny/code/agm/s303-b", "/us-ny/code/env/s33-0101", "/us-ny/code/abc/s76-a"]) assert.ok(works.includes(w), `${w} not in ${works.join(", ")}`)
  const listed = cites.filter((c) => c.work?.startsWith("/us-ny/code/agm/s303"))
  assert.deepEqual(listed.map((c) => c.text), ["three hundred three", "three hundred three-a", "three hundred three-b"])
})
