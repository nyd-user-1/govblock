// /tags's letters, in a plain module (2026-09-20): the page builds its rail's
// index with them on the server and the explorer groups its sections with them
// in the browser. They lived in the explorer, a client module, and a server
// page cannot call a function that lives there — the build failed prerendering
// /tags (Amplify job 294).

export const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"]

/** The section a tag falls under: its first letter, or # for anything else. */
export const letterOf = (name: string) => {
  const first = name.charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : "#"
}

/** The section's anchor. */
export const letterId = (letter: string) => `letter-${letter === "#" ? "other" : letter.toLowerCase()}`
