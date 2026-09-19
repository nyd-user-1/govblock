// Tags, out of GDELT's knowledge graph.
//
//   node scripts/gdelt/tags.mjs [--days 10] [--every 8] [--to 2026-09-17]
//
// Every article in GDELT's knowledge graph carries theme codes —
// LEGISLATION, WB_2165_HEALTH_ECONOMICS_AND_FINANCE, TAX_FNCACT_LAWMAKERS — and
// together they are the most complete vocabulary of what the news is about
// that anyone keeps. This reads a window of days of it, keeps the legislative
// coverage (the filter scripts/gdelt/daily.mjs uses), and counts every theme
// those stories carry, day by day. The codes are turned into words, and codes
// that read as the same word are merged, so a story is counted once per tag.
//
// Writes apps/web/lib/data/gdelt-tags.json, each tag with its codes and daily
// counts, and apps/web/lib/data/gdelt-tag-stories.json, a few stories under each. The raw
// files (about 5 MB a slice) are kept in the temp directory between runs and
// never committed.
//
// --every n reads one slice in every n (default 8, one every two hours).

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const DAYS = Number(arg("days", 10))
const EVERY = Number(arg("every", 8))
const TO = arg("to", new Date(Date.now() - 864e5).toISOString().slice(0, 10))
const OUT = new URL("../../apps/web/lib/data/gdelt-tags.json", import.meta.url)
const STORIES = new URL("../../apps/web/lib/data/gdelt-tag-stories.json", import.meta.url)
const DIR = join(tmpdir(), "gdelt-day")
mkdirSync(DIR, { recursive: true })
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.parse(`${TO}T00:00:00Z`) - (DAYS - 1 - i) * 864e5).toISOString().slice(0, 10))

function grab(url) {
  const file = join(DIR, url.split("/").pop())
  if (!existsSync(file)) {
    try {
      execFileSync("curl", ["-sfL", "--max-time", "300", "-A", UA, "-o", file, url])
    } catch {
      return null
    }
  }
  return existsSync(file) && readFileSync(file).length > 100 ? file : null
}
const unzip = (file) => execFileSync("unzip", ["-p", file], { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" })

const stamps = (day) => {
  const out = []
  for (let minute = 0; minute < 24 * 60; minute += 15 * EVERY) {
    out.push(new Date(Date.parse(`${day}T00:00:00Z`) + minute * 60_000).toISOString().replace(/[-:T]/g, "").slice(0, 14))
  }
  return out
}

/* ------------------------------------------------------------- the words */

// Codes that are lists of things rather than subjects — languages, animals,
// ethnicities, religions, job titles, weapons, ailments — or a mood rather
// than a matter (KILL, AFFECT, UNCERTAINTY), or the filter's own buckets,
// which every story in the window carries.
const SKIP = /^(ACT_|TAX_|USPEC_|CRISISLEX_|SLFID_|MEDIA_MSM$|SOC_POINTSOFINTEREST|SOC_SUSPICIOUS|WB_\d+$|EPU_POLICY$|EPU_POLICY_GOVERNMENT$|EPU_ECONOMY_HISTORIC$|EPU_UNCERTAINTY|GENERAL_GOVERNMENT$|GENERAL_HEALTH$|UNGP_FORESTS_RIVERS_OCEANS$|AFFECT$|KILL$|DEAD$|WOUND$|UNCERTAINTY|UPDATESSYMPATHY$|MIGRATION_FEAR|EPU_CATS_MIGRATION_FEAR|ECON_WORLDCURRENCIES_|EPU_POLICY_POLITICAL$|EPU_POLICY_AUTHORITIES$|MOVEMENT_GENERAL$|SOC_GENERALCRIME$|TRIAL$|ARREST$|SEIZE$|DELAY$|RELEASE_PRISON$|MANMADE_DISASTER_IMPLIED$|NATURAL_DISASTER_IMPLIED$|SOC_SUSPICIOUSACTIVITY$|PERSECUTION$|EMERG$|SELF_IDENTIFIED)/
// Keep these of the TAX_ family: parties and named issues are subjects.
const KEEP = /^(TAX_POLITICAL_PARTY_|TAX_SPECIAL_ISSUES_)/
// GDELT writes some codes as one word.
const FIX = { ARMEDCONFLICT: "ARMED_CONFLICT", REFUGEECAMP: "REFUGEE_CAMP", FOODSECURITY: "FOOD_SECURITY", WATERSECURITY: "WATER_SECURITY", CYBER_ATTACK: "CYBERATTACK", MED_EMERGENCYROOM: "EMERGENCY_ROOM", SOC_TECHNOLOGYSECTOR: "TECHNOLOGY_SECTOR", MEDIA_SOCIAL: "SOCIAL_MEDIA" }
// The family prefixes, which say who keeps a code and not what it means.
const PREFIX = /^(WB_\d+_|EPU_POLICY_|ECON_DEVELOPMENTORGS_|MIL_SELF_IDENTIFIED_|TAX_FNCACT_|TAX_POLITICAL_PARTY_|TAX_DISEASE_|TAX_WEAPONS_|TAX_AIDGROUPS_|TAX_TERROR_GROUP_|TAX_MILITARY_TITLE_|TAX_SPECIAL_ISSUES_|TAX_RELIGION_|TAX_|EPU_CATS_|EPU_|SOC_|ECON_|UNGP_|CRISISLEX_[A-Z]\d+_|CRISISLEX_|ENV_|MEDIA_|USPEC_|HEALTH_|GOV_|INFO_|NATURAL_DISASTER_|MANMADE_DISASTER_|SELF_IDENTIFIED_)/
// Actors too generic to follow.
const GENERIC = new Set(["man", "men", "woman", "women", "people", "official", "officials", "leader", "leaders", "spokesman", "spokeswoman", "spokesperson", "resident", "residents", "member", "members", "citizen", "citizens", "person", "persons", "user", "users", "friend", "friends", "boy", "girl", "father", "mother", "son", "daughter", "wife", "husband", "chief", "head", "director", "manager", "worker", "workers", "staff", "team", "group", "general", "implied", "historic", "other", "policy"])

const slugOf = (code) =>
  (FIX[code] ?? code)
    .replace(PREFIX, "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

/* ------------------------------------------------------------ the reading */

const LEGISLATIVE = /LEGISLATION|GENERAL_GOVERNMENT|DEMOCRACY|ELECTION/
const GKG = { source: 3, url: 4, themes: 7, tone: 15, image: 18, extras: 26 }
const pageTitle = (extras) => (extras.match(/<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/)?.[1] ?? "").replace(/\s+/g, " ").trim()

const tags = new Map() // slug → { codes: Map, days: number[], stories: [] }
let articles = 0
const perDay = days.map(() => 0)
const seenUrls = new Set()

for (const [d, day] of days.entries()) {
  for (const stamp of stamps(day)) {
    const file = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.gkg.csv.zip`)
    if (!file) {
      console.warn(`missing ${stamp}`)
      continue
    }
    for (const line of unzip(file).split("\n")) {
      const c = line.split("\t")
      if (c.length < 27) continue
      const themes = c[GKG.themes] ?? ""
      if (!LEGISLATIVE.test(themes)) continue
      const url = c[GKG.url]
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      articles++
      perDay[d]++
      const title = pageTitle(c[GKG.extras] ?? "")
      const story = title.length > 24 ? { day, title: title.slice(0, 150), url, source: (c[GKG.source] ?? "").replace(/^www\./, ""), image: c[GKG.image] || null, tone: Math.round((Number((c[GKG.tone] ?? "").split(",")[0]) || 0) * 10) / 10 } : null
      const bySlug = new Map()
      for (const code of new Set(themes.split(";").filter(Boolean))) {
        if (SKIP.test(code) && !KEEP.test(code)) continue
        const slug = slugOf(code)
        if (!slug || slug.length < 3 || GENERIC.has(slug) || /^\d/.test(slug)) continue
        if (!bySlug.has(slug)) bySlug.set(slug, code)
      }
      for (const [slug, code] of bySlug) {
        let t = tags.get(slug)
        if (!t) tags.set(slug, (t = { codes: new Map(), days: days.map(() => 0), stories: [] }))
        t.codes.set(code, (t.codes.get(code) ?? 0) + 1)
        t.days[d]++
        // Keep a small pool of stories, newest days replacing oldest.
        if (story && (t.stories.length < 12 || Math.random() < 0.05)) {
          if (t.stories.length >= 12) t.stories.splice(Math.floor(Math.random() * 12), 1)
          t.stories.push(story)
        }
      }
    }
  }
  console.log(`${day}: ${perDay[d]} legislative articles, ${tags.size} tags so far`)
}

/* -------------------------------------------------------------- the file */

const MIN = Math.max(25, Math.round(articles / 1500))
const ACRONYMS = new Set(["us", "un", "eu", "nato", "ict", "ngo", "lgbt", "hiv", "aids", "gdp", "ai", "fbi", "cia", "irs", "sec", "epa", "fda", "cdc", "dhs", "ice", "doj", "who", "imf", "covid", "isis", "tv", "cbd", "ev", "icu", "k12", "wmd", "ied", "gmo", "ppp", "rd"])
const label = (slug) =>
  slug
    .split("-")
    .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 || w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")

// A code GDELT writes as one word (AGINGPOPULATION) joins the tag whose
// words are split (aging-population) when both exist.
for (const slug of [...tags.keys()]) {
  if (slug.includes("-")) continue
  const split = [...tags.keys()].find((other) => other.includes("-") && other.replace(/-/g, "") === slug)
  if (!split) continue
  const from = tags.get(slug)
  const into = tags.get(split)
  for (const [code, n] of from.codes) into.codes.set(code, (into.codes.get(code) ?? 0) + n)
  from.days.forEach((n, i) => (into.days[i] += n))
  into.stories.push(...from.stories)
  tags.delete(slug)
}

const out = [...tags]
  .map(([slug, t]) => ({
    slug,
    name: label(slug),
    codes: [...t.codes].sort((a, b) => b[1] - a[1]).map(([code]) => code),
    total: t.days.reduce((n, v) => n + v, 0),
    days: t.days,
    stories: t.stories
      .sort((a, b) => b.day.localeCompare(a.day))
      .filter((s, i, all) => all.findIndex((x) => x.source === s.source) === i)
      .slice(0, 4),
  }))
  .filter((t) => t.total >= MIN)
  .sort((a, b) => a.slug.localeCompare(b.slug))

// The index and the stories in two files: /tags reads the first only.
writeFileSync(OUT, JSON.stringify({ readAt: new Date().toISOString().slice(0, 16).replace("T", " "), days, every: EVERY, articles, perDay, tags: out.map(({ stories, ...t }) => t) }))
writeFileSync(STORIES, JSON.stringify(Object.fromEntries(out.map((t) => [t.slug, t.stories]))))
console.log(`${out.length} tags (at least ${MIN} articles each) from ${articles} articles → ${OUT.pathname}`)
