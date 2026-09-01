import { neon } from "@neondatabase/serverless"

// The policy database, read only. One client per process; absent the URL the
// pages fall back to their committed snapshots, so a build without secrets
// still renders.
const url = process.env.POLICY_DATABASE_URL

export const sql = url ? neon(url) : null

export function hasDatabase() {
  return !!sql
}
