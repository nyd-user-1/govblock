// Response shapes of /api/policy/* as the widgets consume them.

export type BillRow = {
  bill_id: number
  bill_number: string
  title: string
  description: string | null
  status_desc: string | null
  last_action: string | null
  last_action_date: string | null
  committee: string | null
  body: string | null
  url: string | null
  state_link: string | null
  text_chars: number | null
  sponsor: string | null
  sponsor_party: string | null
  sponsor_id: number | null
  /** The newest text on file — the bill's "last commit" (Brendan, 2026-09-03).
   *  Only the paged bill lists carry it; other bill rows leave it out. */
  latest_version?: string | null
  latest_document_id?: number | null
  latest_fetched_at?: string | null
  /** How many texts are on file. */
  versions?: number | null
}

export type Sponsor = {
  people_id: number
  name: string
  party: string
  role: string
  district: string
  chamber: string
  type: number
  photo_url: string | null
  /** The join to congress.gov's cosponsor rows, which key on it. */
  bioguide_id: string | null
}

export type RollCall = {
  roll_call_id: number
  date: string
  chamber: string
  description: string
  yea: number
  nay: number
  nv: number
  absent: number
  total: number
}

export type Bill = BillRow & {
  state: string
  session_id: number
  session_title: string | null
  status_date: string | null
  bill_type: string | null
  sponsors: Sponsor[]
  history: { date: string; chamber: string; action: string; sequence: number }[]
  rollCalls: RollCall[]
  referrals: { date: string; chamber: string; name: string }[]
  progress: { date: string; event: string }[]
  sameAs: {
    sast_type: string
    sast_bill_id: number
    sast_bill_number: string
  }[]
  documents: {
    document_id: number
    document_type: string
    document_desc: string
    url: string | null
    state_link: string | null
  }[]
  subjects: string[]
  texts: {
    document_id: number
    version: string | null
    chars: number
    fetched_at: string | null
    source: string | null
    /** The document's own date, where the source gave one. */
    date: string | null
  }[]
  hearings: {
    date: string
    time: string
    type: string
    description: string
    location: string
  }[]
}

export type BillText = {
  document_id: number
  version: string | null
  chars: number
  fetched_at: string | null
  text: string
  document_desc: string | null
  /** The document's own date from `Documents`, which is the day the version was
   *  published — `fetched_at` is the night we pulled it and is not that. */
  date: string | null
}

export type Votes = {
  rollCalls: RollCall[]
  votes: {
    roll_call_id: number
    vote_desc: string
    people_id: number
    name: string
    party: string
    district: string
    chamber: string
  }[]
}

export type Activity = {
  monthly: { ym: string; bills: number; senate: number; assembly: number }[]
  daily: { date: string; bills: number }[]
  rollCalls: { ym: string; roll_calls: number; yea: number; nay: number }[]
  statuses: { status: string; bills: number }[]
  committees: { committee: string; bills: number }[]
  total: number
}

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

export type Member = Omit<MemberRow, "active"> & {
  bio_long: string | null
  email: string | null
  phone_capitol: string | null
  phone_district: string | null
  address: string | null
  state: string
  legiscan_legislation_url: string | null
  nys_bio_url: string | null
  bio_url: string | null
  prime: number
  cosponsor: number
  votes: { yea: number; nay: number; updated_at: string } | null
  bills: (BillRow & { type: number })[]
  fec: {
    cycle: number
    receipts: number
    disbursements: number
    cash_on_hand_end: number
    individual_contributions: number
    coverage_end: string | null
  } | null
}

export type TopSponsor = {
  people_id: number
  name: string
  party: string
  role: string
  chamber: string
  district: string
  photo_url: string | null
  prime: number
}

export type Tally = {
  people_id: number
  name: string
  party: string
  chamber: string
  district: string
  photo_url: string | null
  yea: number
  nay: number
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

export type CommitteeDetail = {
  meta: Record<string, unknown> | null
  statuses: { status: string; bills: number }[]
  bills: BillRow[]
  hearings: {
    date: string
    time: string
    description: string
    bill_id: number
    bill_number: string
    title: string
  }[]
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

export type HearingDay = { date: string; hearings: number; committees: number }

export type SessionRow = { session_id: number; bills: number; title: string }

export type PartySeat = { chamber: string; party: string; seats: number }

export type StateRow = {
  state: string
  bills: number
  latest_year: number
  sessions: number
}

export type Options = {
  chambers: { value: string; count: number }[]
  committees: { value: string; count: number }[]
  statuses: { value: string; count: number }[]
  parties: { value: string; count: number }[]
  subjects: { value: string; count: number }[]
  sessions: SessionRow[]
}

export type StreamGroup = { state: string; session: number; bills: BillRow[] }

export type Discretionary = {
  years: { year: number; grants: number; total: number }[]
  latest: number | undefined
  grants: {
    grantee: string
    sponsor: string
    amount: number
    description: string
    approved: string
  }[]
}

export type Contract = {
  vendor: string
  department: string
  amount: number
  start: string
  end: string
  description: string
}

export type Capital = {
  agency: string
  program: string
  amount: number
  reappropriation: number
  encumbrance: number
  description: string
  fund: string
}

export type Lobbying = {
  count: number
  clients: number
  registrants: number
  filings: {
    client: string
    registrant: string
    income: number | null
    expenses: number | null
    year: number
    period: string
    url: string
  }[]
}

export type Fec = {
  totals: {
    cycle: number
    receipts: number
    disbursements: number
    cash_on_hand_end: number
    individual_contributions: number
  }[]
  contributions: {
    contributor: string
    employer: string | null
    amount: number
    date: string
    city: string | null
    state: string | null
  }[]
}
