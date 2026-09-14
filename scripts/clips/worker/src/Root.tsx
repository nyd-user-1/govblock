import React from "react"
import { Composition } from "remotion"
import { loadFont } from "@remotion/google-fonts/Geist"

import { ROLL_CALL_TALLY, RollCallTally, type RollCallTallyProps } from "./templates/roll-call-tally"

// The compositions the worker box can render. The template files are copied
// in from apps/web/components/clips/templates by render.mjs before each
// bundle, so the Player in /clips and the render read the same source.

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "800"], subsets: ["latin"] })

const Tally = (props: RollCallTallyProps) => <RollCallTally {...props} fontFamily={fontFamily} />

export const Root = () => (
  <Composition
    id={ROLL_CALL_TALLY.id}
    component={Tally}
    fps={ROLL_CALL_TALLY.fps}
    durationInFrames={ROLL_CALL_TALLY.durationInFrames}
    width={ROLL_CALL_TALLY.width}
    height={ROLL_CALL_TALLY.height}
    defaultProps={{ chamber: "house", congress: 0, session: 0, roll: 0, date: null, citation: null, billTitle: null, question: null, result: null, counts: { yea: 0, nay: 0, present: 0, notVoting: 0 }, parties: [] } satisfies RollCallTallyProps}
  />
)
