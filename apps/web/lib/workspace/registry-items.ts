// What the @nysgpt registry publishes (2026-09-10). One list, read by the docs
// page; registry.json at the repo root is what the build reads. Keep the two
// in step — a name here that is not there is a command that 404s.

export type RegistryItem = { name: string; kind: string; what: string }

export const REGISTRY_ITEMS: readonly RegistryItem[] = [
  { name: "district-join", kind: "Library", what: "Who represents a point, answered by ray-casting the district files: Congress, both state chambers and the county at once." },
  { name: "state-districts", kind: "Library", what: "Every state legislative chamber with its rank, its boundary file and its district count — 102 chambers, 6,843 districts." },
  { name: "state-fips", kind: "Library", what: "The Census's two-digit state codes both ways." },
  { name: "map-palette", kind: "Library", what: "A hue per key on the golden angle, the opacities that let washes stack, and the ramps for counts, money, heat and party split." },
  { name: "map-bounds", kind: "Library", what: "A bounding box grown over GeoJSON geometry, for flying a map to a feature." },
  { name: "map-basemap", kind: "Library", what: "OpenFreeMap's positron style, which needs no key." },
  { name: "policy-filters", kind: "Library", what: "The vocabulary the record is read through: state names, party labels, chamber names." },
  { name: "policy-imagery", kind: "Library", what: "Which picture a jurisdiction, chamber or member gets, and which colour a party gets." },
  { name: "use-local", kind: "Hook", what: "State that survives a reload, and reads correctly on the first server-rendered paint." },
  { name: "seals", kind: "Component", what: "A jurisdiction's flag chip, a chamber's seal, a member's portrait with its fallback, and a party dot." },
  { name: "directory-search", kind: "Component", what: "The clearable search field a directory is filtered with." },
] as const
