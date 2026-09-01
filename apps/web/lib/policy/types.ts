// The row shapes the boards read — livingston-v3 lib/policy/types.ts, the
// three the block views use.
export type MemberRow = {
  people_id: number
  name: string
  first_name: string
  last_name: string
  party: string
  role: string
  chamber: string
  district: string
  photo_url: string | null
  leadership_title: string | null
  active: boolean
}

export type Committee = {
  committee_id?: number
  committee_name: string
  slug?: string
  chamber: string
  chair_name?: string | null
  member_count?: string | null
  meeting_schedule?: string | null
  committee_url?: string | null
  description?: string | null
  bills: number
}

export type Hearing = {
  date: string
  time: string
  type: string
  description: string
  location: string
  bill_id: number
  bill_number: string
  title: string
  committee: string | null
  chamber: string | null
  body: string | null
  status_desc: string | null
}

export type StateRow = {
  state: string
  bills: number
  latest_year: number
  sessions: number
}
