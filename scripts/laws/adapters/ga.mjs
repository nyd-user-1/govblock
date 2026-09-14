// Georgia Code Revision Commission — the Official Code of Georgia.
//
// Published through LexisNexis's free public-access viewer and nowhere else —
// the state's own site links there. How the viewer is read is in
// `lib/lexis.mjs`; this names the door and lets the runner do the rest.
import { lexisLaws } from "../lib/lexis.mjs"
import { map } from "../lib/pool.mjs"

export default {
  id: "ga-lexis",
  name: "Georgia Code Revision Commission — the Official Code of Georgia",
  states: ["GA"],
  source: "https://www.lexisnexis.com/hottopics/gacode/",

  laws(context) {
    return lexisLaws({ ...context, entry: "https://www.lexisnexis.com/hottopics/gacode/", map })
  },
}
