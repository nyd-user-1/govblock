// Load the two congressional directories into Aurora through the RDS Data API.
//
//   House:  https://directory.house.gov/ — the House Telephone Directory. The
//           page is an Angular app that embeds its whole dataset as JSON:
//           `employees` (every House staffer, with title, phone and the office
//           they work for) and `offices` (member, district, committee and
//           institutional offices, with addresses). No API, so we read the page.
//   Senate: https://www.senate.gov/general/contact_information/senators_cfm.xml
//           — one record per senator: office, phone, contact form, website,
//           class and leadership position, keyed by bioguide id. The Senate
//           publishes no staff directory; its staff appear only in the
//           semiannual Report of the Secretary of the Senate (PDF).
//
// Idempotent: rows are upserted on their source id and rows the source no
// longer lists are deleted, so a re-run is a refresh. Run from the repo root:
//
//   node scripts/directory/load.mjs            # both
//   node scripts/directory/load.mjs house      # one
//   node scripts/directory/load.mjs senate
//
// Reads POLICY_CLUSTER_ARN / POLICY_SECRET_ARN / POLICY_DATABASE / AWS_REGION
// from apps/web/.env.local, the same variables the app uses.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, BatchExecuteStatementCommand, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  readFileSync(join(ROOT, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
)
const resourceArn = env.POLICY_CLUSTER_ARN
const secretArn = env.POLICY_SECRET_ARN
const database = env.POLICY_DATABASE || "policy"
if (!resourceArn || !secretArn) throw new Error("POLICY_CLUSTER_ARN and POLICY_SECRET_ARN must be set in apps/web/.env.local")
const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })

const s = (v) => (v === null || v === undefined || v === "" ? { isNull: true } : { stringValue: String(v) })

async function withResume(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (/resuming|DatabaseResuming|Throttl|timed? ?out|ECONNRESET|socket hang up/i.test(msg) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}

const exec = (sql, parameters) =>
  withResume(() => client.send(new ExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameters, continueAfterTimeout: true })))

async function batch(sql, rows, size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const parameterSets = rows.slice(i, i + size)
    await withResume(() => client.send(new BatchExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameterSets })))
  }
}

const DDL = [
  `create table if not exists house_offices (
     id text primary key, name text not null, kind text, street text, locality text, region text, postal text,
     parent_id text, fetched_at timestamptz not null default now())`,
  `create table if not exists house_staff (
     id text primary key, name text not null, job_title text, staffer_type text, telephone text, street text,
     office_id text, fetched_at timestamptz not null default now())`,
  `create index if not exists house_staff_office_idx on house_staff (office_id)`,
  `create index if not exists house_offices_parent_idx on house_offices (parent_id)`,
  `create table if not exists senate_contact (
     bioguide_id text primary key, last_name text, first_name text, party text, state text, address text, phone text,
     contact_form text, website text, class text, leadership_position text, fetched_at timestamptz not null default now())`,
]

async function loadHouse() {
  const html = await (await fetch("https://directory.house.gov/", { headers: { "user-agent": "govblock/1.0 (directory refresh)" } })).text()
  const read = (name) => {
    const m = html.match(new RegExp(`angular\\.module\\("employeeDirectory"\\)\\.value\\("${name}",\\s*(\\[[\\s\\S]*?\\])\\s*\\);`))
    if (!m) throw new Error(`directory.house.gov: no embedded "${name}" collection — the page changed`)
    return JSON.parse(m[1])
  }
  const offices = read("offices")
  const employees = read("employees")
  console.log(`house: ${offices.length} offices, ${employees.length} employees`)
  const started = new Date().toISOString()

  await batch(
    `insert into house_offices (id, name, kind, street, locality, region, postal, parent_id, fetched_at)
     values (:id, :name, :kind, :street, :locality, :region, :postal, :parent_id, now())
     on conflict (id) do update set name = excluded.name, kind = excluded.kind, street = excluded.street, locality = excluded.locality,
       region = excluded.region, postal = excluded.postal, parent_id = excluded.parent_id, fetched_at = now()`,
    offices.map((o) => [
      { name: "id", value: s(o._id) },
      { name: "name", value: s(o.name) },
      { name: "kind", value: s(o.description) },
      { name: "street", value: s(o.address?.streetAddress) },
      { name: "locality", value: s(o.address?.addressLocality) },
      { name: "region", value: s(o.address?.addressRegion) },
      { name: "postal", value: s(o.address?.postalCode) },
      { name: "parent_id", value: s(o.parentOrganization?._id) },
    ]),
  )
  await batch(
    `insert into house_staff (id, name, job_title, staffer_type, telephone, street, office_id, fetched_at)
     values (:id, :name, :job_title, :staffer_type, :telephone, :street, :office_id, now())
     on conflict (id) do update set name = excluded.name, job_title = excluded.job_title, staffer_type = excluded.staffer_type,
       telephone = excluded.telephone, street = excluded.street, office_id = excluded.office_id, fetched_at = now()`,
    employees.map((e) => [
      { name: "id", value: s(e._id) },
      { name: "name", value: s(e.name) },
      { name: "job_title", value: s(e.jobTitle) },
      { name: "staffer_type", value: s(e.stafferType) },
      { name: "telephone", value: s(e.telephone) },
      { name: "street", value: s(e.address?.streetAddress) },
      { name: "office_id", value: s(e.worksFor?._id) },
    ]),
  )
  // Whoever the directory stopped listing has left.
  const gone = await exec(`with d as (delete from house_staff where fetched_at < cast(:t as timestamptz) returning 1) select count(*) from d`, [
    { name: "t", value: s(started) },
  ])
  await exec(`delete from house_offices where fetched_at < cast(:t as timestamptz)`, [{ name: "t", value: s(started) }])
  console.log(`house: loaded; ${gone.records?.[0]?.[0]?.longValue ?? 0} departed staff removed`)
}

async function loadSenate() {
  const xml = await (await fetch("https://www.senate.gov/general/contact_information/senators_cfm.xml", { headers: { "user-agent": "govblock/1.0 (directory refresh)" } })).text()
  const field = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
    return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : null
  }
  const members = [...xml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((m) => m[1])
  console.log(`senate: ${members.length} senators`)
  const started = new Date().toISOString()
  await batch(
    `insert into senate_contact (bioguide_id, last_name, first_name, party, state, address, phone, contact_form, website, class, leadership_position, fetched_at)
     values (:bioguide_id, :last_name, :first_name, :party, :state, :address, :phone, :contact_form, :website, :class, :leadership_position, now())
     on conflict (bioguide_id) do update set last_name = excluded.last_name, first_name = excluded.first_name, party = excluded.party,
       state = excluded.state, address = excluded.address, phone = excluded.phone, contact_form = excluded.contact_form, website = excluded.website,
       class = excluded.class, leadership_position = excluded.leadership_position, fetched_at = now()`,
    members
      .filter((b) => field(b, "bioguide_id"))
      .map((b) => [
        { name: "bioguide_id", value: s(field(b, "bioguide_id")) },
        { name: "last_name", value: s(field(b, "last_name")) },
        { name: "first_name", value: s(field(b, "first_name")) },
        { name: "party", value: s(field(b, "party")) },
        { name: "state", value: s(field(b, "state")) },
        { name: "address", value: s(field(b, "address")) },
        { name: "phone", value: s(field(b, "phone")) },
        { name: "contact_form", value: s(field(b, "email")) },
        { name: "website", value: s(field(b, "website")) },
        { name: "class", value: s(field(b, "class")) },
        { name: "leadership_position", value: s(field(b, "leadership_position")) },
      ]),
  )
  await exec(`delete from senate_contact where fetched_at < cast(:t as timestamptz)`, [{ name: "t", value: s(started) }])
  console.log("senate: loaded")
}

const which = process.argv[2] ?? "both"
for (const ddl of DDL) await exec(ddl)
if (which === "house" || which === "both") await loadHouse()
if (which === "senate" || which === "both") await loadSenate()
