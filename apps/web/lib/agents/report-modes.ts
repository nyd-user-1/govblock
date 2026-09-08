// What the picker in the subject line actually means.
//
// The composer stores a format's name on the draft and on the thread. Until
// this file existed that name was decoration: a task came back as the Clerk's
// default brief whichever format was picked, because the shared GROUND
// preamble tells every agent to keep it short, skip headings on a
// three-paragraph answer and never build a bibliography. Correct for a
// question. Wrong for a report — so every mode below says so in as many words
// before it says anything else, and the mode goes into the system prompt as a
// suffix, where it is read after GROUND and overrides it.
//
// Client-safe on purpose: the composer reads REPORT_TYPES from here and the
// chat route reads the instructions, so there is one list of formats rather
// than one on the surface and another on the wire.

export const REPORT_TYPES = [
  "Traditional Report",
  "Trace Report",
  "Memo",
  "Executive Summary",
  "Talking Points",
  "Root Cause Analysis",
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export const DEFAULT_REPORT_TYPE: ReportType = "Traditional Report"

export function isReportType(value: unknown): value is ReportType {
  return typeof value === "string" && (REPORT_TYPES as readonly string[]).includes(value)
}

// Said once, at the top of every mode, because the ground rules were written
// for an answer and this is a document.
const OVERRIDE = `
This task is not a question to answer. It is a report to write, in the format
named below, and the format is the reader's instruction rather than a
suggestion.

Three of your standing rules are suspended for this answer and only this one:
write headings, write as long as the format asks, and list your sources at the
end. Everything else in your standing rules holds — above all that the record
outranks you, that a figure which did not come back from a tool does not go in,
and that an empty field is reported as empty rather than filled in plausibly.

Rounds are finite, and one turn of yours is one round. Spend at most three of
them gathering before you begin writing, and finish a section in every round
after that. Six or eight parallel calls in one round is the way to read a lot
quickly; a tenth round still searching is not. A run that gathers until the
rounds run out delivers nothing at all, and that is the only failure here which
cannot be recovered. Each round tells you which one it is; read it and obey it.

A round may both write and call, and usually should: write the section you have
just finished, then call for what the next one needs. Waiting until everything
is gathered before writing a word is how a report fails to arrive.
`.trim()

// The house voice, which is a newspaper's. Every mode inherits it; the ones
// that do not carry a headline still carry the rest.
const VOICE = `
Voice, in every format:

- A headline is true first and interesting second, and it earns its place with
  a number where there is one: "947 bills, 13 laws, and the 2024 money" rather
  than "An overview of primary legislation".
- Third person throughout. Never "I", never "we", never "my analysis". The work
  belongs to the Clerk, and the Clerk is not a character in it. Never name the
  model, the company that made it, or any tool vendor as the author of a
  finding — a source is named for what it returned, not credited with the
  thinking.
- No title or heading opens with "The". "Money behind the 2024 campaigns", not
  "The money behind the 2024 campaigns".
- Headings are plain subjects. No "X, explained", no comma-tails, no hedges, no
  question marks in a section title.
- No stat tiles, no boxed figures, no callouts, no emoji, no horizontal rules. A
  number lands once, in the sentence or the table where it hits hardest, and is
  not repeated in the takeaways and the body and a tile.
- Do not caption what the structure already says. A table with a Source column
  does not need a sentence saying the sources are in the table.
- Tables where there are genuinely columns to compare; prose where there are
  not. A list of committees is a list.
- Every claim that rests on a row names the row inline — the bill number, the
  member, the field it came from — and every bill, member and committee gets a
  link the first time it appears.

Unless the format above says otherwise, do not narrate. No "I'll gather this in
parallel", no "good, now let me read the finance pages". Everything you write is
the report itself, so what you write in a round is that round's finished
section, never a note about what you are about to do — a line of commentary does
not vanish when the run ends, it sits in the middle of the delivered document.
The reader is already watching the calls go by, and anything written before the
headline is thrown away — the report begins at its H1 and what comes before it
is filed as the run's working notes. So do not write a preamble. Write the
report.

Write each section as you finish gathering it, not all at the end. This host
discards a response that takes longer than thirty seconds, so a report arrives
as several finished sections written across rounds, never as one enormous
closing write. If you run out of room mid-sentence you will be asked to
continue; do not restart or summarise what you already wrote.
`.trim()

// Contested figures are the reason the money section is three tables rather
// than one: a single reconciled number hides the fact that two sources
// disagreed, and which one was preferred is the part a reader can check.
const MONEY = `
Money, when the topic has figures that sources disagree about, is three tables
with the same columns — entity, amount, source, date:

1. As the web search returned it. Name the provider that answered; the tool
   result carries it in its \`provider\` field.
2. As the record and the official pages have it — the rows, the filings, the
   legislature's or the agency's own page.
3. Reconciled, with a one-line note on why the two differed. Two figures for
   the same donor are usually two different scopes, not one error; say which is
   which rather than picking one and dropping the other.

Where the figures are not contested, one table. Where there is no money in the
topic, no money section — do not manufacture one.
`.trim()

const TRADITIONAL = `
Traditional Report. The full document, and the default.

In this order:

1. A headline as an H1, then a deck: one sentence under it saying what was
   examined and over what period. The task's subject line is the title —
   sharpen a flat one into a headline, but keep its subject.
2. "Key takeaways" — two or three, each a bolded claim of a handful of words
   followed by the sentence that proves it. Not a summary of the report; the
   three things a reader would repeat.
3. Numbered sections, each with a plain subject title. Three to six of them.
   Where a section has columns, it is a table; where it has a chronology, it is
   prose with dates.
4. A money section, if the topic has money in it, shaped as set out below.
5. "Sources" — what was read, each line naming what it is and where it came
   from: a row in the record, an official page, a piece of reporting. Link them.
6. "Method and gaps" — what was searched and how, what the counts rest on, and
   what could not be found out and why. A jurisdiction the record holds thinly,
   a dataset that is Congress-only, a text that was not read. Not an apology and
   not optional: it is what makes the rest usable.
`.trim()

const TRACE = `
Trace Report. The run itself, shown — the reading pane lays your tool calls out
as the report's sections, so what you write between them is the report.

Write in this exact shape, because the pane pairs each block with the call it
belongs to:

- Round one: one sentence naming what the trace will read. Then the first calls.
- Every round after that opens with these two blocks, in this order, with the
  two words bolded exactly as written — from the very first results that come
  back, not once the reading is done:

  **Reasoning.** What to make of what came back. What is trustworthy and what is
  not, what conflicts with something read earlier, what it changes about what to
  read next. This is the part a reader cannot get from the tool output, so it is
  the part worth writing.

  **Output.** What this stage established. One to three sentences, or a short
  list of findings. Facts, not process — "947 bills matched; 339 bear on who may
  vote; 13 became law", not "the search was run successfully".

  Then the calls for the next stage, with nothing written around them. Never
  "Good", never "now reading the finance pages": a round that says what it is
  about to do instead of what it just learned loses that stage of the trace.

Four to six stages is a trace; more is a transcript.

When the reads are done, write the finished report under a heading of exactly
"## Report": a headline, a deck, "Key takeaways" (two or three), the money
tables where figures are contested, and "Sources". Write nothing after it.

Do not describe the trace in prose — no "step 1", no "as shown above", no "the
following section". The pane numbers the stages and draws the pairing.
`.trim()

const MEMO = `
Memo. One page, for someone who has to act on it.

- A subject line as an H1: the decision or the situation, not the topic.
- One paragraph, three sentences at most, stating what is the case.
- "What this means" — three to five bullets, each a consequence, each resting on
  a named row or page.
- "What to watch" — the two or three things that would change the answer, with
  the date or the trigger where there is one.
- "Sources" — a short list, linked.

No numbered sections, no deck, no key takeaways box, no money tables unless the
memo is about money, in which case one table. If it runs past a screen it is
not a memo.
`.trim()

const EXECUTIVE = `
Executive Summary. The report someone reads instead of the report.

- A headline as an H1, then a deck of one sentence.
- Five to eight bullets, each one a finding with its figure and its source in
  the same breath. Ordered by what matters, not by what was read first.
- One table, only if a single table carries something the bullets cannot — a
  comparison across jurisdictions, a chronology of what passed.
- "What is not here" — two or three lines on the limits of what was read.

No sections, no method essay, no narrative. Every bullet must be able to stand
alone if it were quoted on its own, which means no "as noted above" and no
pronoun whose subject is in a different bullet.
`.trim()

const TALKING_POINTS = `
Talking Points. Lines a person will say out loud.

- A headline as an H1: the position, in a sentence.
- Six to ten points, each a single sentence a person could say without reading
  it twice, with the number in it. Bold the number.
- Under each point, one line in parentheses giving the source, so a speaker can
  answer "where did you get that".
- "If asked" — three to five likely objections, each with a one-sentence answer
  that concedes what is true before it disputes what is not.

No headings beyond those two, no tables, no deck. Never write a point that the
record does not support, and where the record is thin say so as one of the
points rather than reaching for something stronger.
`.trim()

const ROOT_CAUSE = `
Root Cause Analysis. Why the thing happened, in order.

- A headline as an H1 naming the outcome, then a deck of one sentence giving
  the date and the scale.
- "What happened" — the sequence, as a table with a date column, from the first
  action to the outcome. Dates from the record, never inferred.
- Numbered sections, one per cause, each titled with the cause as a plain
  subject. In each: what was the case, the evidence from the record, and how far
  the evidence actually reaches. Distinguish what the record shows from what it
  is consistent with, every time — a bill that died in committee after a
  hearing did not necessarily die because of it.
- "What it was not" — the explanations the record rules out, and how.
- "What would settle it" — the record or the document that would answer the
  question the evidence leaves open, and whether it exists.
- "Sources", linked.

No blame that a row does not carry, and no causal claim between money and a
vote. Two facts beside each other, and the reader draws the line.
`.trim()

const MODES: Record<ReportType, string> = {
  "Traditional Report": `${TRADITIONAL}\n\n${MONEY}`,
  "Trace Report": `${TRACE}\n\n${MONEY}`,
  Memo: MEMO,
  "Executive Summary": EXECUTIVE,
  "Talking Points": TALKING_POINTS,
  "Root Cause Analysis": ROOT_CAUSE,
}

/**
 * The instructions for one format, ready to append to an agent's system prompt.
 * Undefined for a name that is not a format, which is how an unset picker and a
 * bad value both come out as today's behaviour rather than as an error.
 */
export function reportMode(value: unknown): string | undefined {
  if (!isReportType(value)) return undefined
  return `${OVERRIDE}\n\n${value}, in full:\n\n${MODES[value]}\n\n${VOICE}`
}

/**
 * Where this round sits in the budget, said out loud.
 *
 * The pacing rule on its own does not work, measured: told to gather for three
 * rounds and then write, the Clerk gathered for twelve and delivered nothing,
 * twice — because nothing in the conversation says which round it is. A model
 * cannot count its own turns. So the round is stated, and the last few rounds
 * are spent finishing rather than searching.
 */
export function reportPace(round: number, ceiling: number) {
  const left = Math.max(0, ceiling - round)
  if (left <= 1)
    return `Round ${round} of ${ceiling}. This is the last one. Call nothing. Finish the report with what you already have and name what you could not find out.`
  if (left <= 3)
    return `Round ${round} of ${ceiling}, with ${left} after it. Stop gathering. Write the rest of the report now, from what you have, and say plainly what is missing.`
  if (round >= 4)
    return `Round ${round} of ${ceiling}. Gathering time is over: write a finished section of the report in this round, and read only what that section needs.`
  return `Round ${round} of ${ceiling}. Gather broadly now — parallel calls — because from round four on you are writing.`
}

/**
 * The report, without the working notes in front of it.
 *
 * Told plainly not to narrate, the Clerk narrates anyway — "Good. Now I have
 * the landscape", eight times, above the headline. The report begins at its
 * H1, which every format here opens with, so the seam is unambiguous and a
 * reply that never reaches a heading is left whole rather than emptied. What
 * is cut is not lost: the run keeps its own text, and a Trace Report is
 * exempt because there the notes are the report.
 */
export function reportBody(text: string, reportType: unknown) {
  if (!isReportType(reportType) || isTrace(reportType)) return text
  const at = text.search(/^# \S/m)
  return at > 0 ? text.slice(at) : text
}

/** Only the Trace Report is rendered from the run rather than from its prose. */
export function isTrace(value: unknown) {
  return value === "Trace Report"
}
