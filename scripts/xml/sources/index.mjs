// Which reader feeds a job. A source knows the Work prefix its job covers (so
// the controller can load what the index already holds) and yields the job's
// documents. A job with no reader is set 'waiting', not dropped.
import { federalBills } from "./federal-bills.mjs"

const SOURCES = [
  {
    name: "GovInfo bulk data, BILLS",
    matches: (job) => job.jurisdiction === "us" && job.kind === "bill",
    jurisdiction: () => "us",
    prefix: (job) => `/us/bill/${Math.floor((Number(job.unit) - 1789) / 2) + 1}/`,
    read: (job, ctx) => federalBills({ unit: job.unit, ...ctx }),
  },
]

export function sourceFor(job) {
  return SOURCES.find((s) => s.matches(job)) ?? null
}
