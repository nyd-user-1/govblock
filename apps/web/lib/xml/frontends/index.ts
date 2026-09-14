import type { FrontEnd } from "../ir"
import { textFrontEnd } from "./text"
import { us } from "./us"

// One front end per jurisdiction, by the two-letter code the corpus uses.
// A jurisdiction with no front end of its own parses as plain text, at the
// lowest tier, and the coverage file says so; the Compiler page reads this
// map and lib/xml/coverage.generated.json.

export const FRONT_ENDS: Readonly<Record<string, FrontEnd>> = {
  US: us,
}

export function frontEndFor(jurisdiction: string): FrontEnd {
  return FRONT_ENDS[jurisdiction.toUpperCase()] ?? textFrontEnd
}

export { textFrontEnd, us }
