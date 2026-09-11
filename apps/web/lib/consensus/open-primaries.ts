import type { Conversation } from "@/lib/consensus/data"

// The first conversation on /unite-2 (Brendan, 2026-09-11): open primaries,
// seeded from open-primaries-seed-comments.csv at the repository root. The
// statements are the CSV's, in its order; nobody has voted yet, so every tally
// is empty and the survey runs locally until the conversation is live on the
// engine. It is not in lib/consensus/data's list on purpose: the directory at
// /consensus shows rooms that have clustered, and this one has not.

const SEED = [
  "Primaries paid for by taxpayers should be open to every registered voter.",
  "A political party is a private association and should decide for itself who picks its nominees.",
  "Closing a primary to party members is a reasonable way to stop rival voters from meddling.",
  "Independent voters are shut out of the only election that is actually competitive where they live.",
  "If a party wants a closed primary, the party should pay for it rather than the public.",
  "Top-two primaries, where the two leading candidates advance regardless of party, produce better general elections.",
  "Combining an open primary with ranked-choice voting is too complicated for most voters.",
  "Ranked-choice voting should be decided separately from who may vote in a primary.",
  "Opening primaries would not make elected officials any less partisan.",
  "Changing the primary system is best done by the legislature, not by ballot measure.",
  "Out-of-state donors should not fund campaigns to change how a state runs its elections.",
  "A ballot measure funded mostly by out-of-state money is still legitimate if voters decide it.",
  "Voters rejected these measures in 2024, and that verdict should settle the question for now.",
  "Congress should require states to let unaffiliated voters vote in federal primaries.",
  "How primaries work is a state matter and Congress should stay out of it.",
  "Whatever the rule is, it should apply to every party in the state equally.",
  "Letting a voter change party registration at the polling place invites strategic voting.",
  "Allowing unaffiliated voters to choose one party's ballot is a fair middle ground.",
  "Nonpartisan primaries would help good candidates who do not fit either party.",
  "The current system protects incumbents more than it protects parties.",
  "I would be more likely to vote in a primary if I did not have to register with a party.",
  "Louisiana closing its congressional primaries is a step backward.",
  "Most voters do not know their own state's primary rules, and that is the bigger problem.",
]

const empty = () => ({ agree: 0, disagree: 0, pass: 0, seen: 0 })

export const openPrimaries: Conversation = {
  slug: "open-primaries",
  title: "Open primaries",
  topic: "Open primaries",
  description:
    "Who should be allowed to vote in a primary, and who gets to decide? Twenty-three statements other people have made. Judge each one.",
  source: null,
  stats: {
    views: 0,
    voters: 0,
    commenters: 0,
    statements: SEED.length,
    groups: 0,
    votes: 0,
  },
  groups: [],
  statements: SEED.map((text, tid) => ({
    tid,
    text,
    moderated: 1,
    votes: empty(),
    byGroup: {},
  })),
}
