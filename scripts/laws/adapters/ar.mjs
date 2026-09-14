// Arkansas Bureau of Legislative Research — the Arkansas Code of 1987.
//
// Published through LexisNexis's free public-access viewer and nowhere else —
// the state's own site links there. How the viewer is read is in
// `lib/lexis.mjs`; this names the door and lets the runner do the rest.
import { lexisLaws } from "../lib/lexis.mjs"
import { map } from "../lib/pool.mjs"

export default {
  id: "ar-lexis",
  name: "Arkansas Bureau of Legislative Research — the Arkansas Code of 1987",
  states: ["AR"],
  source: "https://www.lexisnexis.com/hottopics/arcode/",

  laws(context) {
    return lexisLaws({ ...context, entry: "https://www.lexisnexis.com/hottopics/arcode/", map })
  },
}
