// Which reader feeds a job. A source knows the Work prefixes its job covers
// (so the controller can load what the index already holds) and yields the
// job's documents. A job with no reader is set 'waiting', not dropped.
import { codeSegment, congressOf } from "../lib/address.mjs"
import { federalBills } from "./federal-bills.mjs"
import { statutes } from "./statutes.mjs"
import { uscTitle } from "./usc.mjs"

const SOURCES = [
  {
    name: "GovInfo bulk data, BILLS",
    matches: (job) => job.jurisdiction === "us" && job.kind === "bill",
    prefixes: (job) => [`/us/bill/${congressOf(job.unit)}/`],
    read: (job, ctx) => federalBills({ unit: job.unit, ...ctx }),
  },
  {
    name: "OLRC release point, USLM",
    matches: (job) => job.jurisdiction === "us" && job.kind === "statute",
    prefixes: (job) => [`/us/usc/${codeSegment("US", job.unit)}/`],
    read: (job, ctx) => uscTitle({ unit: job.unit, ...ctx }),
  },
  {
    name: '"Laws"',
    matches: (job) => job.jurisdiction !== "us" && job.kind === "statute",
    prefixes: (job) => (job.unit === "*" ? [`/${job.jurisdiction}/code/`, `/${job.jurisdiction}/const/`] : [`/${job.jurisdiction}/code/${codeSegment(job.jurisdiction, job.unit)}/`, `/${job.jurisdiction}/const/`]),
    read: (job, ctx) => statutes({ jurisdiction: job.jurisdiction, unit: job.unit, ...ctx }),
  },
  {
    name: "lake Parquet: bill_texts, bills, history_table",
    matches: (job) => job.jurisdiction !== "us" && job.kind === "bill",
    prefixes: (job) => [`/${job.jurisdiction}/bill/${job.unit}`],
    // Loaded on first use: the Parquet reader is a tool on the pipeline box, not a repo dependency.
    read: async function* (job, ctx) {
      const { stateBills } = await import("./state-bills.mjs")
      yield* stateBills({ jurisdiction: job.jurisdiction, unit: job.unit, ...ctx })
    },
  },
]

export function sourceFor(job) {
  return SOURCES.find((s) => s.matches(job)) ?? null
}
