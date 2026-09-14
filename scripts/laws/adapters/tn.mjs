// Tennessee Code Commission — the Tennessee Code.
//
// Published through LexisNexis's free public-access viewer and nowhere else —
// the state's own site links there. How the viewer is read is in
// `lib/lexis.mjs`; this names the door and lets the runner do the rest.
import { lexisLaws } from "../lib/lexis.mjs"
import { map } from "../lib/pool.mjs"

export default {
  id: "tn-lexis",
  name: "Tennessee Code Commission — the Tennessee Code",
  states: ["TN"],
  source: "https://www.lexisnexis.com/hottopics/tncode/",

  laws(context) {
    return lexisLaws({ ...context, entry: "https://www.lexisnexis.com/hottopics/tncode/", map })
  },
}
