// One adapter per source shape. States that share a publisher share an
// adapter; a state with a source of its own gets a file of its own. What every
// adapter has in common is the shape it yields, which is the "Laws" table —
// the runner owns the ordering, the tree and the write.
import ca from "./ca.mjs"
import dc from "./dc.mjs"
import ma from "./ma.mjs"
import ny from "./ny.mjs"
import us from "./us.mjs"

export const ADAPTERS = [us, ca, dc, ma, ny]

export function adapterFor(state) {
  return ADAPTERS.find((a) => a.states.includes(state.toUpperCase())) ?? null
}
