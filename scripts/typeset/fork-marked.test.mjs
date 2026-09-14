// The redline on the fork's own text (apps/web/lib/typeset/fork-marked.ts),
// on the stored law amend.test.mjs uses: what the fork adds is marked at its
// positions in the fork, and what it strikes from the base stands, as the
// base's words, where it stood.
//
//   node --test scripts/typeset/fork-marked.test.mjs
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

function edit(base, change) {
  const json = structuredClone(base.toJSON())
  change(json)
  return S.nodeFromJSON(json)
}

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

const level = (type, num, text, attrs = {}) => ({
  type,
  attrs,
  content: [{ type: "num", content: [{ type: "text", text: num }] }, { type: "content", content: [{ type: "p", content: [{ type: "text", text }] }] }],
})

test("an unchanged fork draws nothing", () => {
  assert.deepEqual(E.forkMarked(E.diffDocs(nyBase, edit(nyBase, () => {}))), [])
})

test("words replaced: the new words are marked in the fork, the old stand struck just before them", () => {
  const fork = edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", "and the rules of the department", "and the regulations of the department"))
  const specs = E.forkMarked(E.diffDocs(nyBase, fork))
  const ins = specs.filter((s) => s.kind === "ins")
  const del = specs.filter((s) => s.kind === "del")
  assert.deepEqual(ins.map((s) => fork.textBetween(s.from, s.to)), ["regulations"])
  assert.deepEqual(del.map((s) => s.text), ["rules"])
  // The struck word stands where the new one begins, after "the ".
  assert.equal(del[0].at, ins[0].from)
  assert.equal(fork.textBetween(del[0].at - 4, del[0].at), "the ")
})

test("words struck with nothing in their place stand between the fork's own words", () => {
  const fork = edit(nyBase, (j) => replace(j, "/us-ny/code/agm/s16/1", ", aquaculture,", ","))
  const specs = E.forkMarked(E.diffDocs(nyBase, fork))
  assert.deepEqual(specs.filter((s) => s.kind === "ins"), [])
  const [del] = specs.filter((s) => s.kind === "del")
  assert.match(del.text, /aquaculture/)
  assert.ok(del.at > 0 && del.at <= fork.content.size)
})

test("H.R. 6644: a number changed in a subsection", () => {
  const fork = edit(billBase, (j) => replace(j, "/us/bill/119/hr/6644/tI/s102/a", "18 months", "12 months"))
  const specs = E.forkMarked(E.diffDocs(billBase, fork))
  assert.deepEqual(specs.filter((s) => s.kind === "ins").map((s) => fork.textBetween(s.from, s.to)), ["12"])
  assert.deepEqual(specs.filter((s) => s.kind === "del").map((s) => s.text), ["18"])
})

test("a unit added is marked whole at its place in the fork", () => {
  const fork = edit(nyBase, (j) => {
    const { parent, index } = at(j, "/us-ny/code/agm/s16/2-g")
    parent.content.splice(index + 1, 0, level("subsection", "2-h", "Aid in the promotion of urban agriculture.", { role: "subdivision" }))
  })
  const blocks = E.forkMarked(E.diffDocs(nyBase, fork)).filter((s) => s.kind === "ins-block")
  assert.equal(blocks.length, 1)
  const node = fork.nodeAt(blocks[0].from)
  assert.equal(blocks[0].to - blocks[0].from, node.nodeSize)
  assert.match(node.textContent, /^2-hAid in the promotion of urban agriculture\./)
})

test("a unit removed stands, whole, where it stood", () => {
  const fork = edit(billBase, (j) => {
    const { parent, index } = at(j, "/us/bill/119/hr/6644/tI/s102/b/5")
    parent.content.splice(index, 1)
  })
  const [block] = E.forkMarked(E.diffDocs(billBase, fork)).filter((s) => s.kind === "del-block")
  assert.ok(block)
  assert.match(block.node.firstChild.textContent, /\(5\)/)
  // It stands before the paragraph that follows it in the fork, which is (6).
  assert.match(fork.nodeAt(block.at).firstChild.textContent, /\(6\)/)
})
