import { DEFAULT_LOOK, type Look } from "./palette"
import type { Scene, StudioSpec } from "./spec"

// Studio's opening gallery (Brendan, 2026-09-14: "2 rows, 4 cols, with 8
// templates already prepared"): the roll call tally and the bill history as
// they were, then a member, a committee, a party, a chamber, a bill's
// cosponsors and a state's session. Each opens on a link that fills it.

export type Prepared = { id: string; name: string; link: string; spec: StudioSpec }

let n = 0
const id = () => `g${++n}`
const base = { transition: "look" as const }
const title = (eyebrow: string, headline: string, subhead: string, seconds = 4): Scene => ({ ...base, id: id(), kind: "title", seconds, eyebrow, headline, subhead, align: "left" })
const number = (value: string, label: string, color: "yes" | "no" | "accent" | "ink" = "accent", seconds = 3.5): Scene => ({ ...base, id: id(), kind: "number", seconds, value, label, color })
const stats = (items: [string, string][], seconds = 4.5): Scene => ({ ...base, id: id(), kind: "stats", seconds, items: items.map(([value, label]) => ({ value, label })) })
const timeline = (max = 6, seconds = 7): Scene => ({ ...base, id: id(), kind: "timeline", seconds, max, dates: true })
const bars = (heading: string, seconds = 5): Scene => ({ ...base, id: id(), kind: "bars", seconds, title: heading })
const end = (tagline: string): Scene => ({ ...base, id: id(), kind: "end", seconds: 3, tagline })

const spec = (name: string, scenes: Scene[], look: Partial<Look> = {}): StudioSpec => ({ version: 2, name, aspect: "9:16", fps: 30, look: { ...DEFAULT_LOOK, ...look }, scenes })

export const GALLERY: Prepared[] = [
  {
    id: "roll-call-tally",
    name: "Roll call tally",
    link: "house-119-2/295",
    spec: spec("Roll call tally", [{ ...base, id: id(), kind: "roll-call-tally", seconds: 15, transition: "none" }]),
  },
  {
    id: "bill-history",
    name: "Bill history",
    link: "/bills/2058568",
    spec: spec("Bill history", [{ ...base, id: id(), kind: "bill-history", seconds: 20, transition: "none" }]),
  },
  {
    id: "member",
    name: "Member scorecard",
    link: "/members/8965",
    spec: spec(
      "Member scorecard",
      [
        { ...base, id: id(), kind: "portrait", seconds: 3.5, image: "{photo}", name: "{name}", detail: "{party} · {state}" },
        stats([
          ["{sponsored}", "bills sponsored"],
          ["{becameLaw}", "became law"],
          ["{votesCast}", "votes cast"],
        ]),
        number("{crossedPct}%", "of party-line votes cast against the party", "accent"),
        timeline(5),
        end("{title} {name}"),
      ],
      { theme: "violet", base: "mauve", heading: "playfair-display", font: "inter" }
    ),
  },
  {
    id: "committee",
    name: "Committee at a glance",
    link: "/committees/hsag00",
    spec: spec(
      "Committee at a glance",
      [
        title("{chamber} committee", "{name}", "Chair {chair} · Ranking member {rankingMember}"),
        stats([
          ["{members}", "members"],
          ["{meetings}", "meetings"],
          ["{hearings}", "hearings"],
        ]),
        bars("Seats"),
        timeline(5),
        end("{name}"),
      ],
      { theme: "green", base: "olive", chart: "party", heading: "space-grotesk", font: "space-grotesk" }
    ),
  },
  {
    id: "party",
    name: "Party unity",
    link: "/party/r-house",
    spec: spec(
      "Party unity",
      [
        title("{chamber} · {congress}th Congress", "{party}", "{seats} of {ofSeats} seats"),
        number("{unity}%", "voted with the party when the parties split", "accent", 4),
        stats([
          ["{crossings}", "votes against the party"],
          ["{sponsored}", "bills sponsored"],
          ["{becameLaw}", "became law"],
        ]),
        bars("Most votes against the party", 6),
        end("{party} in the {chamber}"),
      ],
      { theme: "red", chart: "party", heading: "montserrat", font: "montserrat", motion: "slide" }
    ),
  },
  {
    id: "chamber",
    name: "Chamber by the numbers",
    link: "house-119-2",
    spec: spec(
      "Chamber by the numbers",
      [
        title("{congress}th Congress · session {session}", "The {chamber}", "{first} to {last}"),
        stats([
          ["{rollCalls}", "roll calls"],
          ["{passed}", "passed"],
          ["{failed}", "failed"],
        ]),
        number("{splitPct}%", "split along party lines", "no"),
        bars("Roll calls by month", 6),
        end("The {chamber}, session {session}"),
      ],
      { theme: "blue", base: "zinc", heading: "ibm-plex-sans", font: "ibm-plex-sans", motion: "zoom" }
    ),
  },
  {
    id: "cosponsors",
    name: "Bill cosponsors",
    link: "/bills/2058568",
    spec: spec(
      "Bill cosponsors",
      [
        title("Sponsored by {sponsor}", "{citation}", "{title}"),
        number("{cosponsors}", "cosponsors", "accent"),
        number("{acrossTheAisle}", "from across the aisle", "yes"),
        bars("Cosponsors by party"),
        end("{citation}"),
      ],
      { mode: "light", base: "stone", theme: "orange", chart: "party", heading: "merriweather", font: "lora", radius: "large" }
    ),
  },
  {
    id: "state",
    name: "State session",
    link: "/state/ny",
    spec: spec(
      "State session",
      [
        title("{session}", "{state}", "{bills} bills introduced"),
        stats([
          ["{signed}", "signed"],
          ["{vetoed}", "vetoed"],
          ["{passedOneChamber}", "passed a chamber"],
        ]),
        number("{signedPct}%", "signed into law", "yes"),
        timeline(5),
        end("{state} · {session}"),
      ],
      { mode: "light", base: "mist", theme: "blue", heading: "instrument-serif", font: "dm-sans", motion: "slide" }
    ),
  },
]
