// A name to show for whoever owns a fork. Owners are a Google subject (`u-…`)
// or a browser's claim check — neither is a name — so each gets a stable,
// friendly handle the way Brendan mocked it: "Rare-unicorn-3". The same id
// always gets the same handle, for everyone who looks.

const ADJECTIVES = ["Rare", "Quiet", "Bright", "Bold", "Calm", "Swift", "Keen", "Wise", "Brave", "Plain", "Sharp", "Fair", "Grand", "Early", "Late", "Steady", "Merry", "Sober", "Civil", "Frank"]
const NOUNS = ["unicorn", "heron", "otter", "falcon", "badger", "lynx", "marten", "osprey", "beaver", "bison", "moose", "raven", "salmon", "walrus", "wren", "yak", "elk", "ibis", "koi", "newt"]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function handleFor(owner: string | null | undefined): string {
  if (!owner) return "someone"
  const h = hash(owner)
  return `${ADJECTIVES[h % ADJECTIVES.length]}-${NOUNS[(h >>> 5) % NOUNS.length]}-${(h >>> 10) % 10}`
}
