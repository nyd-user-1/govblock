// The originals, to S3, so a re-parse never re-fetches and a host that goes
// dark tomorrow costs nothing.
//
// Every document the pool takes is written under `<cache>/orig/<STATE>/<host>/`
// with the path the host served it at, so the mirror in S3 reads as the
// source's own tree rather than as a pile of hashes. The sync is incremental
// and runs beside the load rather than blocking it: a law is written to Aurora
// when it is parsed, and its originals are on their way up while the next law
// is being read.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

import { cacheDir } from "./fetch.mjs"

export const BUCKET = process.env.LAWS_BUCKET || "govblock-lake-638175140432"

let running = null
let again = false

/**
 * Push a state's originals. Calls that arrive while a sync is running collapse
 * into one more sync after it, which is what keeps a per-law call cheap.
 */
export function archive(state, log) {
  if (process.env.LAWS_NO_ARCHIVE) return Promise.resolve()
  const dir = join(cacheDir, "orig", state.toUpperCase())
  if (!existsSync(dir)) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = new Promise((resolve) => {
    const to = `s3://${BUCKET}/laws/${state.toLowerCase()}/`
    const child = spawn("aws", ["s3", "sync", dir, to, "--only-show-errors", "--no-progress"], { stdio: ["ignore", "ignore", "pipe"] })
    let complaint = ""
    child.stderr.on("data", (b) => (complaint += b.toString()))
    child.on("close", (code) => {
      // A failed archive is worth saying and not worth stopping for: the rows
      // are the deliverable and the originals are still on the box's disk.
      if (code !== 0 && complaint) log?.(`s3 sync ${state} exited ${code}: ${complaint.split("\n")[0]}`)
      running = null
      if (again) {
        again = false
        archive(state, log)
      }
      resolve()
    })
  })
  return running
}

/** Wait for the last sync to finish, which is what the end of a state does. */
export async function archiveDone() {
  while (running) await running
}
