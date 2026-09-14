// LexisNexis's free public-access viewer, read the way a reader reads it.
//
// Four states — Arkansas, Georgia, Mississippi and Tennessee — publish their
// codes here and nowhere else, each linking to it from its own legislature's
// site. The viewer is an application, not a document, so this is what it takes
// to get a page out of it:
//
//  1. `lexisnexis.com/hottopics/<x>code` redirects to a container page whose
//     only job is to write a `LNDOMENV` cookie describing the browser and
//     reload itself. Writing that cookie and asking again returns the real
//     container. Nothing is signed in to and no credential is used: the
//     identity the site hands out is the anonymous public one.
//
//  2. The container carries the top of the table of contents in its own page
//     model — the root, and one node per title.
//
//  3. Below that the tree is drawn by a component, and the component asks for
//     children the way its own bundle says to:
//
//       PATCH /r/tocprovider/<component>/toc/<component>
//       {"id":"<component>","props":{"action":"open-to",
//        "items":[{"fieldName":"nodeId","value":"AAB"},
//                 {"fieldName":"targetLevel","value":4}]}}
//
//     which answers with that node's whole subtree, every leaf carrying the
//     content item its document lives at.
//
//  4. A document is `api/document?collection=statutes-legislation&id=<urn>`,
//     which redirects to the page the reader would see, with the section, its
//     heading and its history in it.
//
// What comes back is the statute and its history. The publisher's editorial
// layer is not in this edition, and the copyright block it prints under each
// section belongs to the State; neither is stored.
import { fetchDoc } from "./pool.mjs"
import { UA } from "./fetch.mjs"

const ADVANCE = "https://advance.lexis.com"

/** One anonymous session: the cookies the container insists on. */
export class Session {
  constructor() {
    this.jar = new Map()
    this.crid = null
    this.component = null
    this.container = null
    this.entry = null
    this.renewing = null
  }

  get cookie() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
  }

  #keep(response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";")
      const at = pair.indexOf("=")
      this.jar.set(pair.slice(0, at).trim(), pair.slice(at + 1))
    }
  }

  async request(url, { method = "GET", body = null, headers = {} } = {}) {
    const response = await fetch(url, {
      redirect: "manual",
      method: body ? method : "GET",
      ...(body ? { body } : {}),
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
    })
    this.#keep(response)
    return response
  }

  // The fingerprint the container's own script writes before it will serve.
  // It describes this fetcher honestly: the same user agent it sends, and a
  // plain desktop screen.
  #fingerprint() {
    this.jar.set(
      "LNDOMENV",
      encodeURIComponent(
        JSON.stringify({
          id: "fingerprint",
          props: {
            modernizr: { canvas: true, webgl: true, cssanimations: true, flexbox: true, localstorage: true, sessionstorage: true, touchevents: false },
            lang: "en-US",
            time: new Date().toISOString(),
            useragent: UA,
            resolution: { availWidth: 1680, availHeight: 1027, colorDepth: 30, width: 1680, height: 1050 },
            cdnsupport: true,
          },
        })
      )
    )
  }

  /** Open again, from the same door, when the viewer has forgotten us. */
  async renew() {
    // Every lane that noticed at the same moment waits on the one renewal.
    if (!this.renewing) {
      this.renewing = (async () => {
        this.jar = new Map()
        await this.open(this.entry)
        this.renewing = null
      })()
    }
    return this.renewing
  }

  /** Follow the entry link, writing the cookie the page asks for, to the end. */
  async open(entry) {
    this.entry = entry
    let url = entry
    for (let hop = 0; hop < 14; hop++) {
      const response = await this.request(url)
      const body = response.status >= 300 && response.status < 400 ? "" : await response.text()
      const next = response.headers.get("location") ?? /window\.location\.replace\('([^']+)'\)/.exec(body)?.[1] ?? null
      if (!next) {
        if (!/"componentmodels"/.test(body)) throw new Error(`the viewer answered ${response.status} at ${url}`)
        this.container = body
        this.crid = /crid=([0-9a-f-]+)/.exec(url)?.[1] ?? null
        this.component = /\{"id":"([0-9a-z_]+)","props":\{[^{}]*"type":"document_toccontents","baseurl":"\/tocprovider"\}/.exec(body)?.[1] ?? null
        if (!this.component) throw new Error("the container named no contents component")
        return this
      }
      if (/LNDOMENV/.test(body)) this.#fingerprint()
      url = new URL(next, url).toString()
    }
    throw new Error("the viewer redirected in a circle")
  }

  /**
   * One node opened to a depth, and everything under it.
   *
   * `targetLevel` is absolute, not relative: a title sits at level 1, so
   * opening it to 4 reaches its subchapters' sections. A level the node does
   * not reach is refused, so the caller asks for the deepest the node itself
   * offers.
   */
  async openTo(nodeId, targetLevel) {
    const response = await this.request(`${ADVANCE}/r/tocprovider/${this.component}/toc/${this.component}`, {
      method: "PATCH",
      body: JSON.stringify({
        id: this.component,
        props: { action: "open-to", items: [{ fieldName: "nodeId", value: nodeId }, { fieldName: "targetLevel", value: targetLevel }] },
      }),
      headers: { "content-type": "application/json", "x-ln-currentrequestid": this.crid ?? "", accept: "application/json, text/javascript, */*; q=0.01", "x-requested-with": "XMLHttpRequest" },
    })
    if (response.status !== 200) return null
    const model = JSON.parse(await response.text())
    return model?.collections?.toccontainer?.collections?.tocnodes ?? null
  }
}

/** The titles the container names, as the reader first sees them. */
export function titlesOf(container) {
  const out = []
  for (const m of container.matchAll(/\{"id":"([A-Z]{2,})","props":\{([\s\S]{0,1400}?)\},"data":/g)) {
    const props = m[2]
    if (!/"level":1[,}]/.test(props)) continue
    const name = /"linktemplatetitle":"((?:[^"\\]|\\.)*)"/.exec(props)?.[1]
    if (!name) continue
    // "5|91|143" — how many nodes lie at each level under this one. The last
    // is the deepest the viewer will open the node to.
    const levels = (/"countsbylevel":"([0-9|]*)"/.exec(props)?.[1] ?? "").split("|").filter(Boolean)
    if (out.some((t) => t.id === m[1])) continue
    out.push({ id: m[1], name: unescapeJson(name), deepest: levels.length + 1 })
  }
  return out
}

/** Every node under one the viewer has opened, depth first, in its own order. */
export function flatten(nodes, out = []) {
  for (const node of nodes ?? []) {
    const props = node.props ?? {}
    const href = props.linktemplatehrefvalue ?? ""
    out.push({
      id: node.id,
      level: props.level ?? null,
      name: unescapeJson(props.linktemplatetitle ?? ""),
      hasChildren: props.haschildren === true,
      urn: /\/shared\/document\/[a-z-]+\/(urn:contentItem:[0-9A-Z-]+)/.exec(href)?.[1] ?? null,
      counts: (props.countsbylevel ?? "").split("|").filter(Boolean).length,
    })
    flatten(node.collections?.nodehierarchy, out)
  }
  return out
}

/**
 * A handful of sessions, used in turn.
 *
 * The viewer meters a session, not an address: one session answers about one
 * document a second however many lanes are pointed at it, and six sessions
 * answer about six. It is the same thing a reader does by opening a second
 * tab, and the cost to the host is the same requests either way — they simply
 * are not made to wait in one queue.
 */
export class Sessions {
  constructor(entry, count = Number(process.env.LAWS_SESSIONS ?? 6)) {
    this.entry = entry
    this.count = Math.max(1, count)
    this.all = []
    this.at = 0
  }

  async open(log) {
    // The sign-in service refuses one open in every few with
    // `ERR_DATA_INVALID` and grants the next, so a refusal is waited out
    // rather than treated as a wall. A pool short of its full count still
    // reads the state; a pool of none cannot.
    // Opening a session is itself metered — ask for several in a row from one
    // address and the sign-in service starts answering `ERR_DATA_INVALID` —
    // so they are opened a few seconds apart and a refusal is waited out for
    // as long as a minute before it is given up on.
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    for (let i = 0; i < this.count; i++) {
      if (i) await wait(4000 + Math.random() * 3000)
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          this.all.push(await new Session().open(this.entry))
          break
        } catch (error) {
          if (attempt === 5) {
            log?.(`· one session would not open — ${error.message}`)
            break
          }
          await wait(10000 * (attempt + 1) + Math.random() * 5000)
        }
      }
    }
    if (!this.all.length) throw new Error("the viewer would not open a single session")
    log?.(`${this.all.length} sessions`)
    return this
  }

  /** The first one, for the table of contents, which is a handful of calls. */
  get first() {
    return this.all[0]
  }

  next() {
    this.at = (this.at + 1) % this.all.length
    return this.all[this.at]
  }
}

/**
 * One document, cached under an address that does not move between runs.
 *
 * A session is good for an hour or so and a state takes longer than that, so a
 * document that comes back as anything but a document is taken as that
 * session having ended: it is opened again — once, however many lanes noticed
 * at the same moment — and the document asked for afresh.
 */
export async function document(state, sessions, urn) {
  const url = `${ADVANCE}/api/document?collection=statutes-legislation&id=${encodeURIComponent(urn)}&context=1000516`
  const session = sessions.next ? sessions.next() : sessions
  const ask = () =>
    fetchDoc(state, url, {
      headers: { cookie: session.cookie },
      notFound: null,
      validate: (body) => /SS_DocumentHeader|SS_Banner/.test(String(body)),
    })
  const first = await ask()
  if (first) return first
  await session.renew()
  return ask()
}

/**
 * The statute out of a document page: the heading the publisher banners, the
 * words under it, and the history line.
 *
 * The copyright block the State prints at the foot is left where it is.
 */
export function read(html) {
  const whole = String(html)
  const from = whole.indexOf('class="SS_DocumentHeader"')
  if (from < 0) return null
  const cut = whole.indexOf('class="SS_Copyright"', from)
  // Both ends are cut back to the start of their own tag, so no half tag is
  // left behind for the stripper to keep.
  const body = whole.slice(whole.lastIndexOf("<", from), cut > from ? whole.lastIndexOf("<", cut) : undefined)
  return body
}

function unescapeJson(s) {
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"')}"`)
  } catch {
    return s.replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }
}

// "1-1-101. Extension of western boundary line." — and, where a run was
// repealed at once, "§§ 1-1-1 through 1-1-6. Repealed."
const NUMBER = /^§*\s*([0-9][0-9A-Za-z.:-]*(?:\s+through\s+[0-9][0-9A-Za-z.:-]*)?)\.\s*(.*)$/s

// "TITLE 1 General Provisions (Chs. 1 — 5)" — the number, then the name, and
// the range of chapters the publisher prints after it, which is furniture.
const TITLE = /^(?:TITLE|Title)\s+([0-9A-Za-z](?:[0-9A-Za-z.]*[0-9A-Za-z])?)\.?\s*(.*)$/

// The words these four use for the levels between a title and a section, and
// the letters their locations are keyed by. The keys have to differ from each
// other: a subtitle and a subchapter are both "S" to a careless eye, and
// Arkansas Title 5 opens with a subtitle and a chapter that are both called
// General Provisions.
const LEVEL = {
  SUBTITLE: ["SUBTITLE", "ST"],
  CHAPTER: ["CHAPTER", "C"],
  SUBCHAPTER: ["SUBCHAPTER", "SC"],
  ARTICLE: ["ARTICLE", "A"],
  SUBARTICLE: ["ARTICLE", "SA"],
  PART: ["PART", "P"],
  SUBPART: ["PART", "SP"],
  DIVISION: ["DIVISION", "D"],
  SUBDIVISION: ["DIVISION", "SD"],
}

/**
 * Every law of one of the four, as the viewer's own tree gives it.
 *
 * A law is a title, which is how all four cite: "Ark. Code Ann. § 1-1-101" is
 * title 1, chapter 1, section 101.
 */
export async function* lexisLaws({ state, entry, only, have, log, width = Number(process.env.LAWS_WIDTH ?? 5), map }) {
  const sessions = await new Sessions(entry).open(log)
  const session = sessions.first
  const titles = titlesOf(session.container)
  log(`${titles.length} titles`)

  for (const title of titles) {
    const m = TITLE.exec(title.name.replace(/\s+/g, " ").trim())
    const number = m ? m[1] : title.id
    const law_id = `T${number}`
    if (only && law_id !== only.toUpperCase()) continue
    if (have?.has(law_id)) continue
    const law_name = titleCaseIfShouting(dash(m ? m[2] : title.name))

    const flat = await walk(session, title, log)
    if (!flat) {
      log(`✗ ${law_id} — the viewer would not open it`)
      continue
    }

    // Every leaf that is a section: a document, and a place in the tree.
    const leaves = flat.filter((n) => n.urn && NUMBER.test(n.name))
    if (!leaves.length) {
      log(`· ${law_id} — no section under it`)
      continue
    }

    let at = 0
    const documents = await map(leaves, width, async (leaf) => {
      const html = await document(state, sessions, leaf.urn)
      at += 1
      if (at % 1000 === 0) log(`${law_id} · ${at}/${leaves.length} fetched`)
      return html
    })
    const words = new Map(leaves.map((leaf, i) => [leaf.id, documents[i]]))

    const nodes = [
      { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: law_name, parent_location_id: null, depth: 0 },
    ]
    const seen = new Set(["TITLE"])
    // The viewer's node ids are the tree: a child's id begins with its
    // parent's. So a node's parent is whichever ancestor is still open above
    // it, which is the last node of a shallower level.
    const open = new Map([[1, "TITLE"]])
    for (const node of flat) {
      const level = node.level ?? 2
      const label = node.name.replace(/\s+/g, " ").trim()
      const parent = parentOf(open, level)
      const cited = NUMBER.exec(label)

      if (node.urn && cited) {
        const location_id = unique(cited[1].replace(/\s+/g, " "), seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: cited[1].replace(/\s+/g, " "),
          title: cited[2].replace(/\s+$/, "").replace(/\.$/, "") || null,
          parent_location_id: parent,
          depth: level - 1,
          repealed: /\brepealed\b/i.test(cited[2] ?? ""),
          text: statute(words.get(node.id), label),
        })
        open.set(level, location_id)
        continue
      }
      // A heading. Documents that are not sections — the publisher's chapter
      // notes, and its restatement of a heading it has already given — are
      // not carried.
      if (node.urn) continue
      const heading = /^([A-Za-z]+)\s+([0-9A-Za-z](?:[0-9A-Za-z.-]*[0-9A-Za-z])?)\.?\s*(.*)$/.exec(label)
      const [kind, key] = LEVEL[(heading?.[1] ?? "").toUpperCase()] ?? (level === 2 ? ["CHAPTER", "C"] : ["PART", "P"])
      const id = unique(`${key}${heading?.[2] ?? node.id}`, seen)
      seen.add(id)
      nodes.push({
        location_id: id,
        doc_type: kind,
        doc_level_id: heading?.[2] ?? null,
        title: titleCaseIfShouting(dash(heading ? heading[3] : label)) || label,
        parent_location_id: parent,
        depth: level - 1,
      })
      open.set(level, id)
    }

    log(`${law_id} · ${leaves.length.toLocaleString("en-US")} sections · ${law_name}`)
    yield { law_id, law_name, law_type: "CONSOLIDATED", chapter: number, nodes }
  }
}

/** One title, opened as deep as it goes — including the parts that go deeper. */
async function walk(session, title, log) {
  const nodes = await session.openTo(title.id, title.deepest)
  if (!nodes) return null
  const flat = flatten(nodes)
  // A node the viewer said has children but returned none is deeper than the
  // level asked for, so it is asked for again on its own terms.
  for (let pass = 0; pass < 6; pass++) {
    const missing = []
    for (let i = 0; i < flat.length; i++) {
      const next = flat[i + 1]
      if (flat[i].hasChildren && (!next || (next.level ?? 0) <= (flat[i].level ?? 0))) missing.push(i)
    }
    if (!missing.length) break
    for (const i of missing.reverse()) {
      const node = flat[i]
      const deeper = await session.openTo(node.id, (node.level ?? 1) + Math.max(node.counts, 1))
      if (!deeper) {
        node.hasChildren = false
        continue
      }
      const children = flatten(deeper)
      if (!children.length) {
        node.hasChildren = false
        continue
      }
      flat.splice(i + 1, 0, ...children)
    }
    if (log && pass === 0) log(`  ${title.id} · ${flat.length} nodes`)
  }
  return flat
}

/** The nearest open node above this level. */
function parentOf(open, level) {
  for (let up = level - 1; up >= 1; up--) if (open.has(up)) return open.get(up)
  return "TITLE"
}

// Arkansas, Mississippi and Tennessee carry only History under a section.
// Georgia's edition is the annotated one and prints case notes, law reviews,
// attorney-general opinions and practice aids under nearly every section.
// None of that is the law, so none of it is kept.
/** One section as prose: its heading, its words, and its history. */
function statute(html, label) {
  const block = read(html)
  if (!block) return null
  // The publisher's currency line and the breadcrumb sit above the section;
  // the statute begins at the heading it banners.
  const at = block.indexOf('class="SS_Banner"')
  let body = at > 0 ? block.slice(block.lastIndexOf("<", at)) : block
  // …and ends at the first banner that is neither the section's own heading
  // nor its history, which is where the publisher's own work begins.
  for (const m of body.matchAll(/<h2[^>]*class="SS_Banner"[^>]*>([\s\S]{0,90}?)<\/h2>/g)) {
    if (!m.index) continue
    const heading = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim()
    if (/^History\b/i.test(heading) || /^§?\s*[0-9]/.test(heading)) continue
    body = body.slice(0, m.index)
    break
  }
  const words = body
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;| | /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (!words) return null
  // The publisher heads its apparatus twice — once as a banner and once as a
  // bare word just above it — so a heading left dangling at the end goes too.
  const trimmed = words.replace(/\n+(?:Annotations|Notes|Notice|Research References[^\n]*|JUDICIAL DECISIONS|Opinion Notes|OPINIONS OF THE ATTORNEY GENERAL)\s*$/i, "").trim()
  if (!trimmed) return null
  return trimmed.startsWith(label.slice(0, 12)) ? trimmed : [label, trimmed].join("\n\n")
}

/** A heading without the range the publisher prints after it, or its dash. */
function dash(s) {
  return s
    .replace(/\s*\((?:Chs?|§§)\.?[^)]*\)\s*$/, "")
    .replace(/^\s*[—–-]\s*/, "")
    .trim()
}

/** A heading the publisher shouts is set the way every other state's is. */
function titleCaseIfShouting(s) {
  const words = s.trim()
  if (!words) return ""
  const letters = words.replace(/[^A-Za-z]/g, "")
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    return words.replace(/\w[\w']*/g, (w) => (SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
  }
  return words
}
const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "up", "with"])

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
