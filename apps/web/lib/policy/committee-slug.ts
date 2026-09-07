// The id a committee page answers to, in the three shapes it takes:
//
//   hsvr00                    a federal committee, by congress.gov's system code
//   senate-aging              a New York committee, by the slug its site uses
//   tx-house-ways-and-means   any other state's, by state, chamber and name
//
// Shared by the committee cards and the page, so a card's link and the page's
// resolver agree on the spelling.

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export const committeeSlug = (state: string, chamber: string, name: string) => `${state.toLowerCase()}-${chamber.toLowerCase()}-${slugify(name)}`

/** "Veterans' Affairs Committee" → "Veterans' Affairs"; a subcommittee keeps its whole name. */
export const shortName = (name: string) => name.replace(/\s+Committee$/i, "").replace(/^Committee on (the )?/i, "")
