// A name to show for whoever owns a fork. Owners are a Google subject (`u-…`)
// or a browser's claim check — neither is a name — so the viewer's own forks
// say "you" and everyone else is `reader-` and four hex digits of a stable
// hash of their id, the same for everyone who looks. When sign-in carries a
// name, it goes here.

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function handleFor(owner: string | null | undefined, me?: string | null): string {
  if (!owner) return "someone"
  if (me && owner === me) return "you"
  return `reader-${hash(owner).toString(16).padStart(8, "0").slice(0, 4)}`
}
