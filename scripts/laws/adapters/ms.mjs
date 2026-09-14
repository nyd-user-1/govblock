// Mississippi Joint Legislative Committee — the Mississippi Code of 1972.
//
// Published through LexisNexis's free public-access viewer and nowhere else —
// the state's own site links there. How the viewer is read is in
// `lib/lexis.mjs`; this names the door and lets the runner do the rest.
import { lexisLaws } from "../lib/lexis.mjs"
import { map } from "../lib/pool.mjs"

export default {
  id: "ms-lexis",
  name: "Mississippi Joint Legislative Committee — the Mississippi Code of 1972",
  states: ["MS"],
  source: "https://www.lexisnexis.com/hottopics/mscode/",

  laws(context) {
    return lexisLaws({ ...context, entry: "https://www.lexisnexis.com/hottopics/mscode/", map })
  },
}
