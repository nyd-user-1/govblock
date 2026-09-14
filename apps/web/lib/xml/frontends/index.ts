import type { FrontEnd } from "../ir"
import { textFrontEnd } from "./text"
import { stateFrontEnd } from "./generic"
import { ny } from "./ny"
import { PROFILES } from "./profiles"
import { us } from "./us"

// One front end per jurisdiction, by the two-letter code the corpus uses.
// A jurisdiction with no front end of its own parses as plain text, at the
// lowest tier, and the coverage file says so; the Compiler page reads this
// map and lib/xml/coverage.generated.json.

export const FRONT_ENDS: Readonly<Record<string, FrontEnd>> = {
  ...Object.fromEntries(Object.entries(PROFILES).map(([k, p]) => [k, stateFrontEnd(p)])),
  US: us,
  NY: ny,
}

export function frontEndFor(jurisdiction: string): FrontEnd {
  return FRONT_ENDS[jurisdiction.toUpperCase()] ?? textFrontEnd
}

export { ny, textFrontEnd, us }
