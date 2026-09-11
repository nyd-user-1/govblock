// New York — the Consolidated Laws, the Constitution, the unconsolidated laws,
// the court acts and the rules, from the Senate's Open Legislation API.
//
// New York was loaded first and by hand; this is that load written down, so a
// re-run is one command and the state is refreshed on the same terms as every
// other. `?full=true` hands back the whole law — tree and text — in one call,
// which is why New York is the cheapest jurisdiction on the list.
//
// The API is first party (nysenate.gov) and needs a free key, in .env.local as
// NYS_LEGISLATION_API_KEY.
import { env } from "../lib/db.mjs"
import { get } from "../lib/fetch.mjs"

const BASE = "https://legislation.nysenate.gov/api/3/laws"

const TYPES = { CONSOLIDATED: "CONSOLIDATED", UNCONSOLIDATED: "UNCONSOLIDATED", COURT_ACTS: "COURT_ACTS", RULES: "RULES", MISC: "MISC" }

export default {
  id: "ny-openleg",
  name: "New York Senate — Open Legislation API",
  states: ["NY"],
  source: "https://legislation.nysenate.gov/",

  async *laws({ only, log }) {
    const key = env.NYS_LEGISLATION_API_KEY
    if (!key) throw new Error("NYS_LEGISLATION_API_KEY is not in apps/web/.env.local")
    const list = await get(`${BASE}?key=${key}&limit=1000`, { json: true })
    const laws = list.result.items.filter((l) => !only || l.lawId === only)
    log(`${laws.length} laws`)

    for (const info of laws) {
      const body = await get(`${BASE}/${info.lawId}?key=${key}&full=true`, { json: true })
      const root = body.result?.documents
      if (!root) {
        log(`✗ ${info.lawId} — the API returned no documents`)
        continue
      }
      const nodes = []
      const walk = (doc, parent, depth) => {
        nodes.push({
          location_id: doc.locationId,
          doc_type: doc.docType,
          doc_level_id: doc.docLevelId ?? null,
          title: doc.title ?? null,
          parent_location_id: parent,
          sequence_no: doc.sequenceNo ?? null,
          depth,
          active_date: doc.activeDate ?? null,
          repealed_date: doc.repealedDate ?? null,
          repealed: !!doc.repealed,
          // The API writes line breaks as a literal backslash-n.
          text: doc.text ? String(doc.text).replace(/\\n/g, "\n") : null,
        })
        for (const child of doc.documents?.items ?? []) walk(child, doc.locationId, depth + 1)
      }
      walk(root, null, 0)
      yield {
        law_id: info.lawId,
        law_name: info.name,
        law_type: TYPES[info.lawType] ?? "MISC",
        chapter: info.chapter ?? null,
        nodes,
      }
    }
  },
}
