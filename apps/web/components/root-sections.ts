// The root page's section ids, in a plain module both sides can import: the
// section that wears the id is a server component with a server-only query
// under it, and the hero's down arrow that scrolls to it is a client one.
export const BILLS_SECTION_ID = "bills"
// The root's second section since 2026-09-21: the account home's greeting and search, where the hero's down arrow lands. Its anchor is /#searchbar (Brendan, the same day).
export const SEARCH_SECTION_ID = "searchbar"
// The third (the second from 2026-09-20 until the search took its place): /state's table, where the search section's arrow lands.
export const JURISDICTIONS_SECTION_ID = "jurisdictions"

// An arrow's click is an anchor's (Brendan, 2026-09-21): the address takes the section's hash as an entry of its own
// in the history, so Back from the next page opens the root on the section it was left at, and the box scrolls
// there. Written by hand and not a plain <a href>, because the jump would not be smooth and the page scrolls inside
// the particle scroller's box (components/root-hash-scroll.tsx lands the hash on the way back).
export function goToSection(id: string) {
  if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`)
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}
