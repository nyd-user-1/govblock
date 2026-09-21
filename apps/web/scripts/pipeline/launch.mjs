// The Database dashboard's runs (Brendan, 2026-09-20): fetch one jurisdiction's
// bill text now, or every jurisdiction at once on a fleet, from a play button.
//
//   node scripts/pipeline/launch.mjs list
//   node scripts/pipeline/launch.mjs status      (runs with the steps each box has reported, and a single run's log tail)
//   node scripts/pipeline/launch.mjs single TX [--dry-run]
//   node scripts/pipeline/launch.mjs fleet [--boxes 8] [--dry-run]
//   node scripts/pipeline/launch.mjs stop <instance-id|all|single|fleet>
//   node scripts/pipeline/launch.mjs quota
//
// How it runs, and why it is safe. The loaders are livingston's
// (scripts/box/text-backfill.mjs), and only a box inside the VPC reaches
// Aurora's private endpoint. Rather than wake the 44b worker box — whose
// scheduler would launch every overdue nightly job the moment it boots — each
// run is a throwaway instance on livingston's own fleet pattern
// (scripts/box/fleet-launch.sh --bootstrap): stock Ubuntu, the scheduler's
// timers disabled before anything else, livingston unpacked from the fleet's
// bundle in S3, the one command run, the log copied to S3, then `shutdown`,
// which terminates it. No box talks to another; the database is the
// coordinator, so a stopped run loses nothing — what it had not fetched is
// simply still outstanding for the next one.
//
// One connection per host is the rule. A single-state run and a fleet must
// never walk the same legislature at once, so `fleet` refuses while singles
// are up and `single` refuses while a fleet is (the dashboard stops them first).
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { ledger as writeLedger } from "./ledger.mjs"

const REGION = "us-east-1"
const SUBNET = "subnet-09e840612db030382"
const SG = "sg-0d89f5998e3415eb0"
const KEY = "44b-worker"
const PROFILE = "arn:aws:iam::638175140432:instance-profile/44b-worker-selfstop"
const BUCKET = "livingston-fec-bulk-638175140432"
const PDF_BUCKET = "livingston-bill-pdfs-638175140432"
// The one database a run writes. Not a choice the box makes.
const CLUSTER = "aurora-2525"
const TYPE = "t4g.medium"
const VCPUS = 2
// The fleet's states. FEEDS have a loader of their own and take a box each; WALKED are fetched from the links in
// "Documents", ordered by how many bills their 2025-26 sessions hold (the dataset ledger, 2026-09-20) so the deal
// below spreads the large ones. New Jersey, Illinois and Tennessee are walked like the rest: livingston's fleet
// skipped them only because a dedicated box owned those hosts during the first backfill.
const FEEDS = ["US", "NY", "CA", "TX", "MA"]
const WALKED = "IL,NJ,MN,HI,OK,TN,MS,VA,MO,GA,WV,RI,CT,MD,PA,LA,IA,AZ,SC,MI,FL,OR,WA,KY,AL,WI,OH,NH,ME,IN,NC,AR,NM,UT,NE,MT,DC,VT,ID,KS,CO,DE,SD,NV,ND,WY,AK".split(",")
const OVERRIDES = "webserver1.lsb.state.ok.us=0:4:norobots,www.oklegislature.gov=0:4:norobots,www3.oklegislature.gov=0:4:norobots,www.capitol.hawaii.gov=0:4:norobots,leg.colorado.gov=0:4:norobots,www.leg.state.co.us=0:4:norobots,www.palegis.us=1500:1"

const walker = (state) => `--source state_link --state ${state} --since-session 2023 --max-errors 20`

/**
 * What a single-state run executes: the state's own feed where it has one, the state_link walker otherwise. Texas
 * and Massachusetts take both, feed first: most of what Aurora holds for Texas came through the walker (131K of
 * 174K), and the feed alone leaves those documents unfetched.
 */
export const SINGLE = {
  CA: "--source ca-pubinfo --session 2025",
  TX: ["--source tx-ftp --all-sessions --ftp-connections 2", walker("TX")],
  MA: ["--source ma-api --batch 2000 --api-parallel 12", walker("MA")],
  // Virginia is walked. Its own loader (--source va-lis) needs VA_LIS_API_KEY, which is on neither this machine nor
  // the fleet's bundle (2026-09-20); with the key, this becomes ["--source va-lis --batch 2000 --api-parallel 8", walker("VA")].
  // The current session alone: without --session the bulk loader re-reads every New York session on file.
  NY: "--source nysenate-bulk --session 2025",
  // Congress has a pipeline of its own in livingston (scripts/pipeline/congress), not text-backfill: a command that
  // starts with "scripts/" is run as it stands. The text that moved in three weeks, from api.congress.gov, then the
  // bills the API says moved in the last two days with their actions, cosponsors and committees — a thousand at most:
  // each costs eight calls against 20,000 an hour, and three days after a recess was 3,136 bills (2026-09-20).
  US: ["scripts/pipeline/congress/sync.mjs --days 21", "scripts/pipeline/congress/bill-delta.mjs --days 2 --limit 1000"],
}
export const NOT_RUNNABLE = new Set([])
/** `node launch.mjs load NY`: fill the table from the S3 sink for one state — what a sunk run left to do. */
export function load(state, dry = false) {
  const code = dry ? "dry" : shipCode()
  return { ...run(`gb-load-${state.toLowerCase()}`, `--source s3-load --state ${state} --batch 2000`, { mode: "single", state }, dry ? "ami-dry" : ubuntuAmi(), dry), code }
}
/** `node launch.mjs convert PA`: turn the PDFs the relay parked (scripts/pipeline/relay.mjs) into text, on a box. */
export function convert(state, dry = false) {
  const code = dry ? "dry" : shipCode()
  return { ...run(`gb-convert-${state.toLowerCase()}`, `--source pdf-batch --state ${state} --batch 500 --concurrency 8`, { mode: "single", state }, dry ? "ami-dry" : ubuntuAmi(), dry), code }
}

// A run discovers, then fetches (Brendan, 2026-09-20: "the whole point of a run is to discover new documents and
// ingest them"). Every text loader, the states' own feeds included, only fills text for bills "Bills" already holds;
// none of them adds a bill. What adds bills and their document links is livingston's discovery: New York's own
// Senate API (api/bills-sync.ts), and for every other state LegiScan's index, one weekly archive a session, taken
// only when its hash has moved (scripts/box/national-sweep.mjs --only). The index is LegiScan's; the text never is.
// Congress is discovered from govinfo's BILLSTATUS zips: the whole congress in eight downloads, no API calls.
// `since` (YYYY-MM-DD) is New York's alone: its sync starts from the newest action on file, and a day that has to
// reach further back says so (`single NY --since 2026-09-01`).
export const discover = (states, since = "") =>
  states.length === 1 && states[0] === "NY"
    ? `scripts/box/run-handler.mjs api/bills-sync.ts${/^\d{4}-\d{2}-\d{2}$/.test(since) ? ` since=${since}` : ""}`
    : states.length === 1 && states[0] === "US"
      // Two steps. "Bills" takes a new bill of Congress from LegiScan's index like any state's (the fleet of
      // 2026-09-20 ran without it and 453 versions had no bill to attach to); govinfo's BILLSTATUS zips then fill
      // the record around it, the whole congress in eight downloads and no API calls.
      ? ["scripts/box/national-sweep.mjs --only US --max-refetch 60", "scripts/pipeline/congress/billstatus.mjs"]
      : `scripts/box/national-sweep.mjs --only ${states.join(",")} --max-refetch 60`

const aws = (...args) => execFileSync("aws", [...args, "--region", REGION, "--output", "json"], { encoding: "utf8", maxBuffer: 1 << 26 })
const json = (...args) => JSON.parse(aws(...args) || "null")

function ubuntuAmi() {
  return json("ssm", "get-parameter", "--name", "/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id").Parameter.Value
}

// The box says where it is (Brendan, 2026-09-20: "a metered loader so the user sees the progression of the box from
// zero to running, with each stop along the way"). It cannot speak until it has the AWS CLI, so that is installed
// first; from then on each step appends a line to <name>.stages in S3, which `status` reads. Before that the
// dashboard has EC2's own word: pending, then running.
// `sink`: a fleet parks its texts in S3 and a later `--source s3-load` fills the table, to spare the database many
// writers at once. A single run writes its text straight to Aurora: with the sink on, the first Aurora run (New York,
// 2026-09-20) stamped 42,645 rows and left every text NULL.
// `find`: the discovery step, run before the fetch and written to the same log. A discovery that fails does not end
// the run — what is already outstanding is still worth fetching — but the box says so (`discovered:<exit>`).
function userData(name, command, sink = false, find = "") {
  const at = `s3://${BUCKET}/_fleet/govblock/${name}`
  return `#!/bin/bash
# govblock pipeline run: ${name}
touch /home/ubuntu/.keep-up /home/ubuntu/.no-auto-jobs; chown ubuntu:ubuntu /home/ubuntu/.keep-up /home/ubuntu/.no-auto-jobs
systemctl disable --now run-due.timer run-due.service run-due-catchup.service 2>/dev/null || true
export DEBIAN_FRONTEND=noninteractive
stage() { echo "$1 $(date -u +%FT%TZ)" >> /tmp/stages; aws s3 cp --quiet /tmp/stages ${at}.stages --region ${REGION} 2>/dev/null || true; }
apt-get update -qq && apt-get install -y -qq unzip curl ca-certificates >/dev/null 2>&1
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o /tmp/awscli.zip && (cd /tmp && unzip -q awscli.zip && ./aws/install >/dev/null 2>&1)
stage aws
apt-get install -y -qq poppler-utils antiword git >/dev/null 2>&1
stage tools
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 && apt-get install -y -qq nodejs >/dev/null 2>&1
stage node
sudo -u ubuntu -H bash -c 'cd /home/ubuntu && aws s3 cp --quiet s3://${BUCKET}/_fleet/bootstrap/livingston.tgz /tmp/livingston.tgz --region ${REGION} && tar xzf /tmp/livingston.tgz && rm /tmp/livingston.tgz'
stage loader
# Today's code over the bundle's. The bundle was packed 2026-08-30, before livingston's loaders moved from Neon to
# Aurora (policy-db.mjs, 2026-09-03), and a box cannot pull: the first run from this dashboard wrote 406 New York
# texts into Neon, which nothing reads. The launcher uploads the laptop's HEAD at launch; the install adds what the
# newer code needs (pg).
sudo -u ubuntu -H bash -c 'aws s3 cp --quiet ${at.replace(/\/[^/]+$/, "")}/livingston-src.tgz /tmp/src.tgz --region ${REGION} && tar xzf /tmp/src.tgz -C /home/ubuntu/livingston && cd /home/ubuntu/livingston && npm install --no-audit --no-fund >/dev/null 2>&1'
stage code
# The database is Aurora, and the box is told so (Brendan, 2026-09-20: "it shouldn't be asked, it should be told"):
# the Neon address leaves the bundle's .env.local, the cluster named here supplies its own current credentials
# (livingston scripts/box/refresh-aurora-env.sh; the password rotates weekly, so it is never a value in a file),
# and the loader is handed that address and no other. No credentials, no run.
sed -i '/neon\.tech/d' /home/ubuntu/livingston/.env.local 2>/dev/null || true
sudo -u ubuntu -H bash -c 'aws s3 cp --quiet ${at.replace(/\/[^/]+$/, "")}/run.env /tmp/run.env --region ${REGION} && cat /tmp/run.env >> /home/ubuntu/livingston/.env.local; rm -f /tmp/run.env'
sudo -u ubuntu -H bash -c 'cd /home/ubuntu/livingston && AURORA_CLUSTER_ID=${CLUSTER} AWS_REGION=${REGION} bash scripts/box/refresh-aurora-env.sh' >/dev/null 2>&1
DBHOST=$(sudo -u ubuntu -H bash -c '. /home/ubuntu/.govblock/aurora.env 2>/dev/null && echo "$PGHOST"')
if [ -z "$DBHOST" ]; then stage "refused:no-aurora-credentials"; stage "done:3"; shutdown -h now; exit 3; fi
stage "db:$DBHOST"
mkdir -p /home/ubuntu/logs; chown ubuntu:ubuntu /home/ubuntu/logs
LOG=/home/ubuntu/logs/${name}.log
( while true; do sleep 30; aws s3 cp --quiet "$LOG" ${at}.log --region ${REGION} 2>/dev/null || true; done ) &
: > "$LOG"
${[find].flat().filter(Boolean).length ? `stage discovering
DCODE=0
${[find].flat().filter(Boolean).map((f) => `echo "$(date -u +%T) discover: ${f}" >> "$LOG"
sudo -u ubuntu -H bash -c '. /home/ubuntu/.govblock/aurora.env && export POLICY_DATABASE_URL="$AURORA_POLICY_URL" && cd /home/ubuntu/livingston && node --env-file=.env.local ${f}' >> "$LOG" 2>&1
D=$?; [ $D -gt $DCODE ] && DCODE=$D`).join("\n")}
echo "$(date -u +%T) discover: exit $DCODE" >> "$LOG"
stage "discovered:$DCODE"
` : ""}stage fetching
CODE=0
${[command].flat().map((c) => `echo "$(date -u +%T) fetch: ${c}" >> "$LOG"
sudo -u ubuntu -H bash -c '. /home/ubuntu/.govblock/aurora.env && export POLICY_DATABASE_URL="$AURORA_POLICY_URL" && cd /home/ubuntu/livingston && ${sink ? `PDF_DEFER_BUCKET=${PDF_BUCKET} TEXT_SINK_BUCKET=${PDF_BUCKET} ` : ""}POLITE_HOST_OVERRIDES=${OVERRIDES} POLITE_AUTO_LANES=4:16 node ${c.startsWith("scripts/") ? `--env-file=.env.local ${c}` : `scripts/box/text-backfill.mjs ${c}`}' >> "$LOG" 2>&1
C=$?; [ $C -gt $CODE ] && CODE=$C`).join("\n")}
# What was found and fetched is published: /changelog and /newsroom read two materialized views, and a view only
# changes when it is refreshed. The fleet of 2026-09-20 added 367 bills and the changelog showed none of them.
stage publishing
echo "$(date -u +%T) publish: scripts/box/refresh-matviews.mjs" >> "$LOG"
sudo -u ubuntu -H bash -c '. /home/ubuntu/.govblock/aurora.env && export POLICY_DATABASE_URL="$AURORA_POLICY_URL" && cd /home/ubuntu/livingston && node --env-file=.env.local scripts/box/refresh-matviews.mjs' >> "$LOG" 2>&1
C=$?; [ $C -gt $CODE ] && CODE=$C
echo "EXIT=$CODE $(date -u +%FT%TZ)" >> "$LOG"
aws s3 cp --quiet "$LOG" ${at}.log --region ${REGION} || true
stage "done:$CODE"
shutdown -h now
`
}

const LIVINGSTON = process.env.LIVINGSTON_DIR || path.join(os.homedir(), "Code", "livingston")

/**
 * The laptop's livingston to S3: what every box of this launch runs. Tracked files as they stand in the working tree
 * (`git stash create` names that tree without touching it), so a loader fix can be tried on a box before it is
 * committed; the answer says so with "+local".
 */
function shipCode() {
  const tgz = path.join(os.tmpdir(), `livingston-src-${process.pid}.tgz`)
  const tree = execFileSync("git", ["-C", LIVINGSTON, "stash", "create"], { encoding: "utf8" }).trim()
  execFileSync("git", ["-C", LIVINGSTON, "archive", "--format=tar.gz", "-o", tgz, tree || "HEAD"])
  const head = execFileSync("git", ["-C", LIVINGSTON, "log", "-1", "--format=%h %ad", "--date=short"], { encoding: "utf8" }).trim()
  aws("s3", "cp", tgz, `s3://${BUCKET}/_fleet/govblock/livingston-src.tgz`, "--quiet")
  fs.rmSync(tgz, { force: true })
  // The keys discovery needs. The fleet's bundle was packed for walking text and carries New York's key and nothing
  // else: the first discovery from this dashboard (California, 2026-09-20) ended in a second with "LEGISCAN_API_KEY
  // is required". They go to the same private bucket the bundle's own .env.local sits in, and nowhere else.
  const env = path.join(os.tmpdir(), `gb-run-env-${process.pid}`)
  const lines = fs.readFileSync(path.join(LIVINGSTON, ".env.local"), "utf8").split("\n").filter((l) => /^(LEGISCAN_API_KEY|CONGRESS_API_KEY|CONGRESS_USER_AGENT)=/.test(l.trim()))
  if (!lines.some((l) => l.startsWith("LEGISCAN_API_KEY="))) throw new Error("livingston's .env.local has no LEGISCAN_API_KEY; a run could not discover")
  fs.writeFileSync(env, lines.join("\n") + "\n", { mode: 0o600 })
  aws("s3", "cp", env, `s3://${BUCKET}/_fleet/govblock/run.env`, "--quiet")
  fs.rmSync(env, { force: true })
  return tree ? `${head} +local` : head
}

/**
 * What Aurora holds, written down before a launch (sql/036): the dashboard's tiles say what a day's runs added by
 * comparing with the first snapshot of the last 24 hours. Over the Data API, which this machine reaches and a box
 * does not need to. A snapshot that cannot be written never stops a launch.
 */
/** Aurora's Data API addresses: the server's environment under the dashboard, apps/web/.env.local from a terminal. */
function dataEnv() {
  const env = { ...process.env }
  if (!env.POLICY_CLUSTER_ARN) for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = /^(POLICY_(?:CLUSTER|SECRET)_ARN)=(.*)$/.exec(l.trim())
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

function snapshot(note) {
  try {
    const env = dataEnv()
    execFileSync("aws", ["rds-data", "execute-statement", "--region", REGION, "--resource-arn", env.POLICY_CLUSTER_ARN, "--secret-arn", env.POLICY_SECRET_ARN, "--database", "policy", "--sql",
      `insert into "CorpusSnapshots" (bills, texts, texts_filled, documents, rollcalls, people, note) select (select count(*) from "Bills"), (select count(*) from "BillTexts"), (select count(text) from "BillTexts"), (select count(*) from "Documents"), (select count(*) from "Roll Call"), (select count(*) from "People" where committee_id is null and not coalesce(archived, false)), '${String(note).replace(/'/g, "''")}'`], { stdio: "ignore", timeout: 90_000 })
    execFileSync("aws", ["rds-data", "execute-statement", "--region", REGION, "--resource-arn", env.POLICY_CLUSTER_ARN, "--secret-arn", env.POLICY_SECRET_ARN, "--database", "policy", "--sql",
      `insert into "CorpusSnapshotStates" (at, state, bills, with_text) select date_trunc('second', now()), state, count(*), count(*) filter (where text_chars > 0) from "Bills" where state is not null group by state on conflict do nothing`], { stdio: "ignore", timeout: 90_000 })
  } catch {}
}

let ledgered = false
function run(name, command, tags, ami, dry, find = "") {
  // No S3 sink, the fleet included: a fleet after a discovery is weeks of new documents, not the 3.5M of the first
  // backfill, and written straight to Aurora they show on the Volume chart as they land. Worst case is some 400
  // connections against the cluster's 1,710.
  const data = userData(name, command, false, find)
  if (dry) return { name, command, find, dryRun: true, userDataBytes: data.length, ...(process.env.SHOW_SCRIPT ? { script: data } : {}) }
  // The last run of this name goes into the run log before its files are cleared for this one: once a launch,
  // not once a box, or a fleet of 24 would read S3 24 times.
  if (!ledgered) { ledgered = true; try { writeLedger(dataEnv()) } catch {} }
  try { aws("s3", "rm", `s3://${BUCKET}/_fleet/govblock/`, "--recursive", "--exclude", "*", "--include", `${name}.*`) } catch {}
  const tagSpec = `ResourceType=instance,Tags=[{Key=Name,Value=${name}},{Key=project,Value=govblock-pipeline},${Object.entries(tags).map(([k, v]) => `{Key=${k},Value=${v}}`).join(",")}]`
  const id = JSON.parse(
    aws("ec2", "run-instances", "--image-id", ami, "--instance-type", TYPE, "--subnet-id", SUBNET, "--security-group-ids", SG, "--key-name", KEY, "--iam-instance-profile", `Arn=${PROFILE}`, "--instance-initiated-shutdown-behavior", "terminate", "--block-device-mappings", '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3","DeleteOnTermination":true}}]', "--tag-specifications", tagSpec, "--user-data", data, "--query", "Instances[0].InstanceId")
  )
  return { name, command, id }
}

export function list() {
  const out = json("ec2", "describe-instances", "--filters", "Name=tag:project,Values=govblock-pipeline", "Name=instance-state-name,Values=pending,running,shutting-down,stopping", "--query", "Reservations[].Instances[].{id:InstanceId,state:State.Name,launched:LaunchTime,tags:Tags}")
  return (out ?? []).map((i) => {
    const tag = Object.fromEntries((i.tags ?? []).map((t) => [t.Key, t.Value]))
    return { id: i.id, status: i.state, launched: i.launched, mode: tag.mode ?? "single", state: tag.state ?? null, shard: tag.shard ?? null, states: tag.states ? tag.states.split("+") : tag.state ? [tag.state] : [], name: tag.Name }
  })
}

/**
 * What the dashboard draws: every run, the ones that finished in the last hour too, each with the steps its box has
 * reported and, for a single state, the tail of its log. One recursive copy reads every stages file at once.
 */
export function status() {
  const out = json("ec2", "describe-instances", "--filters", "Name=tag:project,Values=govblock-pipeline", "--query", "Reservations[].Instances[].{id:InstanceId,state:State.Name,launched:LaunchTime,tags:Tags}") ?? []
  const runs = out.map((i) => {
    const tag = Object.fromEntries((i.tags ?? []).map((t) => [t.Key, t.Value]))
    return { id: i.id, status: i.state, launched: i.launched, mode: tag.mode ?? "single", state: tag.state ?? null, shard: tag.shard ?? null, states: tag.states ? tag.states.split("+") : tag.state ? [tag.state] : [], name: tag.Name, stages: [], log: [] }
  })
  if (!runs.length) return runs
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gb-stages-"))
  try {
    aws("s3", "cp", `s3://${BUCKET}/_fleet/govblock/`, dir, "--recursive", "--exclude", "*", "--include", "*.stages", "--quiet")
  } catch {}
  // The newest run of a name owns its files; an older instance of the same name reports nothing.
  const newest = new Map()
  for (const r of runs) if (!newest.has(r.name) || newest.get(r.name).launched < r.launched) newest.set(r.name, r)
  for (const r of newest.values()) {
    try {
      r.stages = fs.readFileSync(path.join(dir, `${r.name}.stages`), "utf8").split("\n").filter(Boolean).map((l) => ({ stage: l.split(" ")[0], at: l.split(" ")[1] ?? null }))
    } catch {}
  }
  for (const r of [...newest.values()].filter((x) => x.mode === "single").slice(0, 3)) {
    try {
      r.log = execFileSync("aws", ["s3", "cp", `s3://${BUCKET}/_fleet/govblock/${r.name}.log`, "-", "--region", REGION], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter((l) => l.trim()).slice(-200)
    } catch {}
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return runs.filter((r) => newest.get(r.name) === r)
}

/** How many more boxes of this type the account's on-demand vCPU limit allows right now. */
export function room() {
  const limit = json("service-quotas", "get-service-quota", "--service-code", "ec2", "--quota-code", "L-1216C47A").Quota.Value
  const used = (json("ec2", "describe-instances", "--filters", "Name=instance-state-name,Values=pending,running", "--query", "Reservations[].Instances[].CpuOptions") ?? []).reduce((n, c) => n + (c?.CoreCount ?? 1) * (c?.ThreadsPerCore ?? 1), 0)
  return { limit, used, boxes: Math.max(0, Math.floor((limit - used) / VCPUS)) }
}

export function single(state, dry = false, fetchOnly = false, since = "") {
  if (NOT_RUNNABLE.has(state)) throw new Error(`${state} is not fetched by this loader`)
  const up = dry ? [] : list().filter((r) => r.status === "pending" || r.status === "running")
  // One connection a host: a state is refused only while a box that owns it is up. A fleet's boxes own their states,
  // so once New York's box has finished, New York can run again while Congress's is still fetching.
  if (up.some((r) => r.states.includes(state))) throw new Error(`${state} is already running`)
  const code = dry ? "dry" : shipCode()
  if (!dry) snapshot(`before ${state}`)
  // Congress's sync resumes from its last success, less a day. A catch-up names its own start (`single US --since
  // 2026-09-04`): the text sync alone, from that day, without the capped refresh of actions and cosponsors.
  const command = state === "US" && /^\d{4}-\d{2}-\d{2}$/.test(since) ? `scripts/pipeline/congress/sync.mjs --since ${since}T00:00:00Z` : (SINGLE[state] ?? walker(state))
  return { ...run(`gb-single-${state.toLowerCase()}`, command, { mode: "single", state }, dry ? "ami-dry" : ubuntuAmi(), dry, fetchOnly ? "" : discover([state], since)), code }
}

export function fleet(boxes, dry = false) {
  const up = dry ? [] : list().filter((r) => r.status === "pending" || r.status === "running")
  if (up.some((r) => r.mode === "single")) throw new Error("single-state runs are up; stop them before launching the fleet")
  if (up.some((r) => r.mode === "fleet")) throw new Error("a fleet is already running")
  const count = Math.max(FEEDS.length + 1, Math.min(boxes ?? room().boxes, 24))
  const ami = dry ? "ami-dry" : ubuntuAmi()
  if (!dry) shipCode()
  if (!dry) snapshot("before a fleet")
  // Each box owns its states, start to finish: it discovers them, then fetches them. The first fleet split the walk
  // by document id across every box (`--shard i/k`), which cannot follow a discovery — a box would be fetching a
  // state another box was still discovering. A state on one box also keeps the rule of one connection a host. The
  // states with a feed of their own take a box each; the walked states are dealt, largest first and back again,
  // over the rest.
  const walkers = count - FEEDS.length
  const hands = Array.from({ length: walkers }, () => [])
  WALKED.forEach((state, i) => {
    const lap = Math.floor(i / walkers), seat = i % walkers
    hands[lap % 2 ? walkers - 1 - seat : seat].push(state)
  })
  const runs = []
  for (const state of FEEDS) runs.push(run(`gb-fleet-${state.toLowerCase()}`, SINGLE[state], { mode: "fleet", shard: state, states: state }, ami, dry, discover([state])))
  hands.forEach((states, i) => {
    if (!states.length) return
    runs.push(run(`gb-fleet-${i}-of-${walkers}`, `--source state_link --all-states --only-states ${states.join(",")} --parallel 4 --batch 4000 --since-session 2023 --max-errors 20`, { mode: "fleet", shard: states.join("+"), states: states.join("+") }, ami, dry, discover(states)))
  })
  return runs
}

export function stop(what) {
  const ids = list().filter((r) => what === "all" || r.mode === what || r.id === what).map((r) => r.id)
  if (ids.length) aws("ec2", "terminate-instances", "--instance-ids", ...ids)
  return ids
}

if (process.argv[1]?.endsWith("launch.mjs")) {
  const [cmd, arg, ...rest] = process.argv.slice(2)
  const dry = process.argv.includes("--dry-run")
  const boxes = rest.includes("--boxes") ? Number(rest[rest.indexOf("--boxes") + 1]) : arg === "--boxes" ? Number(rest[0]) : undefined
  const out = cmd === "list" ? list() : cmd === "status" ? status() : cmd === "quota" ? room() : cmd === "single" ? single(String(arg).toUpperCase(), dry, process.argv.includes("--fetch-only"), process.argv.includes("--since") ? process.argv[process.argv.indexOf("--since") + 1] : "") : cmd === "load" ? load(String(arg).toUpperCase(), dry) : cmd === "convert" ? convert(String(arg).toUpperCase(), dry) : cmd === "fleet" ? fleet(boxes, dry) : cmd === "stop" ? stop(arg) : cmd === "ledger" ? writeLedger(dataEnv()) : { usage: "list | status | quota | single XX [--fetch-only] | load XX | convert XX | fleet [--boxes n] | stop <id|all|single|fleet> | ledger  [--dry-run]" }
  console.log(JSON.stringify(out, null, 2))
}
