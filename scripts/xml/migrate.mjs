// Runs a migration under sql/ against Aurora over the Data API, which takes
// one statement a call: the file is split on the semicolons that end a line,
// comments dropped, and each statement run in order. Every statement in the
// XML migrations is `if not exists`, so a second run is a no-op.
//
//   node scripts/xml/migrate.mjs sql/005_expressions.sql
import { readFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { exec } from "../laws/lib/db.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const file = process.argv[2]
if (!file) {
  console.error("usage: node scripts/xml/migrate.mjs sql/005_expressions.sql")
  process.exit(2)
}

const statements = readFileSync(join(ROOT, file), "utf8")
  .split("\n")
  .filter((line) => !/^\s*--/.test(line))
  .map((line) => line.replace(/\s+--.*$/, ""))
  .join("\n")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean)

for (const sql of statements) {
  const t0 = Date.now()
  await exec(sql)
  console.log(`✓ ${sql.split("\n")[0].slice(0, 90)}  (${Date.now() - t0} ms)`)
}
console.log(`${statements.length} statements from ${file}`)
