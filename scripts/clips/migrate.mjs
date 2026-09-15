// Runs a migration file on Aurora, one statement at a time: the Data API
// takes a single statement per call.
//
//   node scripts/clips/migrate.mjs sql/020_clips.sql

import { readFileSync } from "node:fs"

import { exec } from "../laws/lib/db.mjs"

const file = process.argv[2]
if (!file) {
  console.error("usage: node scripts/clips/migrate.mjs <file.sql>")
  process.exit(2)
}

const statements = readFileSync(file, "utf8")
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean)

for (const [i, sql] of statements.entries()) {
  const head = sql.replace(/\s+/g, " ").slice(0, 90)
  await exec(sql)
  console.log(`${String(i + 1).padStart(2)}/${statements.length}  ${head}`)
}
