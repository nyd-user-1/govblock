// The standing law of a jurisdiction, into the "Laws" table.
//
//   node scripts/laws/load.mjs --list                 which jurisdictions have an adapter
//   node scripts/laws/load.mjs --state CA             load California
//   node scripts/laws/load.mjs --state CA --dry       read the source, write nothing
//   node scripts/laws/load.mjs --state CA --law BPC   one law, to check the tree
//   node scripts/laws/load.mjs --state CA --force     reload laws already on file
//
// One runner, one adapter per source shape — states that share a publisher
// share an adapter. The adapter's whole job is to yield laws in document
// order; this file owns the ordering, the tree, the transaction and the
// summary, so every source lands in the same shape and /laws draws it with
// no further work.
//
// A law is written in one transaction, so a law with rows on file is a law
// that finished. That is what makes `--resume` (the default) honest: an
// interrupted run is restarted with the same command and picks up where it
// stopped.
import { begin, commit, one, q, rollback, writeRows } from "./lib/db.mjs"
import { ADAPTERS, adapterFor } from "./adapters/index.mjs"

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : null
}

const DRY = flag("dry")
const FORCE = flag("force")
const ONLY = value("law")
const LIMIT = Number(value("limit") ?? 0) || null

if (flag("list") || (!value("state") && !flag("all"))) {
  console.log("jurisdictions with an adapter:\n")
  for (const adapter of ADAPTERS) {
    console.log(`  ${adapter.states.join(", ").padEnd(10)} ${adapter.id.padEnd(16)} ${adapter.name}`)
  }
  console.log("\n  node scripts/laws/load.mjs --state CA")
  process.exit(0)
}

const states = flag("all") ? ADAPTERS.flatMap((a) => a.states) : [String(value("state")).toUpperCase()]

const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`

// What counts as a leaf — a node that carries the words of the law rather than
// a heading over them. New York's court acts and rules use the last three, and
// /api/laws searches all four.
const LEAF = new Set(["SECTION", "RULE", "JOINT_RULE", "PREAMBLE"])

for (const state of states) {
  const adapter = adapterFor(state)
  if (!adapter) {
    console.error(`no adapter for ${state} — see docs/state-law-sources.md`)
    process.exitCode = 1
    continue
  }
  console.log(`\n${state} · ${adapter.name}`)

  const done = new Set(
    DRY || FORCE ? [] : (await q(`select distinct law_id from "Laws" where state = $1`, [state])).map((r) => r.law_id)
  )
  if (done.size) console.log(`  ${plural(done.size, "law")} already on file — skipping (use --force to reload)`)

  let laws = 0
  let sections = 0
  let rows = 0
  const skipped = []

  // `have` is handed to the adapter as well as checked here: a source that
  // costs a request per section should not spend thirty thousand of them on
  // laws that are already written.
  for await (const law of adapter.laws({ state, only: ONLY, have: done, log: (m) => console.log(`  ${m}`) })) {
    if (ONLY && law.law_id !== ONLY) continue
    if (done.has(law.law_id)) continue
    if (LIMIT && laws >= LIMIT) break

    // Document order is the adapter's; the numbering is ours, so `?text=1` can
    // page a law in the order a reader reads it and the crumbs walk up.
    const nodes = law.nodes.map((node, i) => ({
      state,
      law_id: law.law_id,
      law_name: law.law_name,
      law_type: law.law_type,
      chapter: law.chapter ?? null,
      location_id: node.location_id,
      doc_type: node.doc_type,
      doc_level_id: node.doc_level_id ?? null,
      title: node.title ?? null,
      parent_location_id: node.parent_location_id ?? null,
      sequence_no: node.sequence_no ?? i,
      depth: node.depth ?? 0,
      active_date: node.active_date ?? null,
      repealed_date: node.repealed_date ?? null,
      repealed: node.repealed ?? false,
      text: node.text ?? null,
    }))

    const bad = check(nodes)
    if (bad.length) {
      skipped.push(`${law.law_id}: ${bad[0]}`)
      console.log(`  ✗ ${law.law_id} — ${bad[0]}`)
      continue
    }

    const count = nodes.filter((n) => LEAF.has(n.doc_type)).length
    if (DRY) {
      console.log(`  · ${law.law_id.padEnd(10)} ${plural(nodes.length, "node").padEnd(18)} ${plural(count, "section").padEnd(20)} ${law.law_name}`)
      laws += 1
      sections += count
      rows += nodes.length
      continue
    }

    const tx = await begin()
    try {
      await writeRows(nodes, tx)
      await commit(tx)
    } catch (error) {
      await rollback(tx)
      throw error
    }
    laws += 1
    sections += count
    rows += nodes.length
    console.log(`  ✓ ${law.law_id.padEnd(10)} ${plural(nodes.length, "node").padEnd(18)} ${plural(count, "section").padEnd(20)} ${law.law_name}`)
  }

  const held = DRY ? null : await one(`select count(*)::int rows, count(distinct law_id)::int laws, count(*) filter (where doc_type = 'SECTION')::int sections from "Laws" where state = $1`, [state])
  console.log(`\n  ${DRY ? "would write" : "wrote"} ${plural(laws, "law")}, ${plural(sections, "section")}, ${plural(rows, "row")}`)
  if (held) console.log(`  ${state} now holds ${plural(Number(held.laws), "law")} and ${plural(Number(held.sections), "section")} across ${plural(Number(held.rows), "row")}`)
  if (skipped.length) console.log(`  ${plural(skipped.length, "law")} skipped:\n    ${skipped.join("\n    ")}`)
}

/**
 * What has to be true before a law is worth writing. A tree that does not hang
 * together draws wrong crumbs and wrong ordering, and the page has no way to
 * tell — so it is caught here, at the adapter's expense, rather than shipped.
 */
function check(nodes) {
  const problems = []
  if (!nodes.length) problems.push("no nodes")
  const ids = new Set()
  for (const node of nodes) {
    if (!node.location_id) problems.push("a node with no location_id")
    else if (ids.has(node.location_id)) problems.push(`duplicate location_id ${node.location_id}`)
    ids.add(node.location_id)
  }
  const roots = nodes.filter((n) => !n.parent_location_id)
  if (!roots.length) problems.push("no root node")
  for (const node of nodes) {
    if (node.parent_location_id && !ids.has(node.parent_location_id)) {
      problems.push(`${node.location_id} hangs off ${node.parent_location_id}, which is not in the law`)
      break
    }
  }
  if (!nodes.some((n) => LEAF.has(n.doc_type))) problems.push("no sections")
  if (!nodes.some((n) => LEAF.has(n.doc_type) && n.text)) problems.push("no section carries text")
  return problems
}
