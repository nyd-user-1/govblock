import "server-only"

import { isJurisdiction } from "@/lib/filters"
import { one, q } from "@/lib/policy/db"

// A reader's profile (Brendan, 2026-09-11): what onboarding captures, keyed
// to the user id the auth contract mints. The home state here is the one
// thing the switcher's Active group, the datasets grid and the bills gate
// read; until a reader has one, the header's flag stands in as it always
// did. Aurora's `reader_profiles` table, created 2026-09-11 (a `profiles` table from an earlier app already sat there, with another shape).

export type Profile = {
  user_id: string
  email: string | null
  name: string | null
  image: string | null
  home_state: string | null
  zip: string | null
  address: string | null
  lng: number | null
  lat: number | null
  role: string | null
  organization: string | null
  phone: string | null
  interests: string[]
  brief_opt_in: boolean
  bio: string | null
  completed_at: string | null
  created_at: string | null
}

export const ROLES = ["Resident", "Legislative staff", "Elected official", "Advocate", "Lobbyist", "Journalist", "Researcher", "Attorney", "Student", "Other"] as const

export const INTERESTS = ["Housing", "Health", "Education", "Labor", "Environment", "Taxes and budget", "Public safety", "Elections", "Transportation", "Technology", "Agriculture", "Veterans"] as const

const COLUMNS = "user_id, email, name, image, home_state, zip, address, lng, lat, role, organization, phone, interests, brief_opt_in, bio, completed_at::text as completed_at, created_at::text as created_at"

const parse = (row: Record<string, unknown>): Profile => ({
  ...(row as Profile),
  interests: Array.isArray(row.interests) ? (row.interests as string[]) : typeof row.interests === "string" ? row.interests.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : [],
  brief_opt_in: !!row.brief_opt_in,
})

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const row = await one<Record<string, unknown>>(`select ${COLUMNS} from reader_profiles where user_id = $1`, [userId])
    return row ? parse(row) : null
  } catch (error) {
    console.error("profile: unavailable", error)
    return null
  }
}

export type ProfilePatch = Partial<Omit<Profile, "user_id" | "completed_at" | "created_at">> & { complete?: boolean }

const text = (v: unknown, max = 200) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : ""
  return s || null
}

/** Writes what was given and keeps the rest; a completed onboarding stays completed. */
export async function saveProfile(userId: string, patch: ProfilePatch): Promise<Profile | null> {
  const home = text(patch.home_state, 2)?.toUpperCase() ?? null
  const interests = (patch.interests ?? []).filter((i): i is string => typeof i === "string").map((i) => i.trim().slice(0, 40)).filter(Boolean).slice(0, 20)
  const row = await one<Record<string, unknown>>(
    `insert into reader_profiles (user_id, email, name, image, home_state, zip, address, lng, lat, role, organization, phone, interests, brief_opt_in, bio, completed_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::text[], $14, $15, case when $16 then now() else null end)
     on conflict (user_id) do update set
       email = coalesce(excluded.email, reader_profiles.email),
       name = coalesce(excluded.name, reader_profiles.name),
       image = coalesce(excluded.image, reader_profiles.image),
       home_state = coalesce(excluded.home_state, reader_profiles.home_state),
       zip = coalesce(excluded.zip, reader_profiles.zip),
       address = coalesce(excluded.address, reader_profiles.address),
       lng = coalesce(excluded.lng, reader_profiles.lng),
       lat = coalesce(excluded.lat, reader_profiles.lat),
       role = coalesce(excluded.role, reader_profiles.role),
       organization = coalesce(excluded.organization, reader_profiles.organization),
       phone = coalesce(excluded.phone, reader_profiles.phone),
       interests = case when cardinality(excluded.interests) > 0 then excluded.interests else reader_profiles.interests end,
       brief_opt_in = excluded.brief_opt_in,
       bio = coalesce(excluded.bio, reader_profiles.bio),
       completed_at = coalesce(reader_profiles.completed_at, excluded.completed_at),
       updated_at = now()
     returning ${COLUMNS}`,
    [
      userId,
      text(patch.email, 200),
      text(patch.name, 120),
      text(patch.image, 500),
      home && isJurisdiction(home) && home !== "US" ? home : null,
      text(patch.zip, 10),
      text(patch.address, 200),
      typeof patch.lng === "number" ? patch.lng : null,
      typeof patch.lat === "number" ? patch.lat : null,
      text(patch.role, 40),
      text(patch.organization, 120),
      text(patch.phone, 40),
      `{${interests.map((i) => `"${i.replace(/"/g, "")}"`).join(",")}}`,
      !!patch.brief_opt_in,
      text(patch.bio, 1000),
      !!patch.complete,
    ]
  )
  return row ? parse(row) : null
}
