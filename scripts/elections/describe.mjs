// A ranked-choice ballot file's name, read into the contest it counts:
//   NewYorkCity_20250624_DEMMayorCitywide.csv → New York City, Mayor, Democratic primary, 2025-06-24
//   Alaska_20221108_SenateDistrictB.csv       → Alaska, State Senate District B
// The names are FairVote's (Otis, doi:10.7910/DVN/AMK8PJ), in about forty
// spellings; each rule below is one of them.

const PLACES = {
  NewYorkCity: ["New York City", "NY", "city"],
  Alaska: ["Alaska", "AK", "state"],
  SanFrancisco: ["San Francisco", "CA", "city"],
  Minneapolis: ["Minneapolis", "MN", "city"],
  Oakland: ["Oakland", "CA", "city"],
  Berkeley: ["Berkeley", "CA", "city"],
  SanLeandro: ["San Leandro", "CA", "city"],
  Maine: ["Maine", "ME", "state"],
  Burlington: ["Burlington", "VT", "city"],
  Minnetonka: ["Minnetonka", "MN", "city"],
  TakomaPark: ["Takoma Park", "MD", "city"],
  PortlandME: ["Portland", "ME", "city"],
  RedondoBeach: ["Redondo Beach", "CA", "city"],
  PierceCounty: ["Pierce County", "WA", "county"],
  StLouisPark: ["St. Louis Park", "MN", "city"],
  LasCruces: ["Las Cruces", "NM", "city"],
  SantaFe: ["Santa Fe", "NM", "city"],
  Bloomington: ["Bloomington", "MN", "city"],
  Corvallis: ["Corvallis", "OR", "city"],
  PortlandOR: ["Portland", "OR", "city"],
  Springville: ["Springville", "UT", "city"],
  Boulder: ["Boulder", "CO", "city"],
  Easthampton: ["Easthampton", "MA", "city"],
  Eastpointe: ["Eastpointe", "MI", "city"],
  ElkRidge: ["Elk Ridge", "UT", "city"],
  USVirginIslands: ["U.S. Virgin Islands", "VI", "territory"],
  Vineyard: ["Vineyard", "UT", "city"],
  Westbrook: ["Westbrook", "ME", "city"],
  WoodlandHills: ["Woodland Hills", "UT", "city"],
}

const PARTIES = { DEM: "Democratic", REP: "Republican", CON: "Conservative", WFP: "Working Families" }
const BOROUGHS = { Bronx: "the Bronx", Kings: "Brooklyn", Manhattan: "Manhattan", NewYork: "Manhattan", Queens: "Queens", Richmond: "Staten Island" }

const OFFICES = [
  [/^Bo(?:S_|ard[oO]fSupervisors)(?:D|District)(\d+)$/, (m) => `Board of Supervisors District ${m[1]}`],
  [/^(?:CD|CongressionalDistrict)(\d+)$/, (m) => `U.S. House District ${m[1]}`],
  [/^(?:USHouse|US_House|USRepresentative)$/, () => "U.S. House"],
  [/^USSenator$/, () => "U.S. Senate"],
  [/^(?:RepublicanPresidentialNomineeofficial|President)$/, () => "President"],
  [/^CityCouncil(?:member)?(?:D|District)(\d+)$/, (m) => `City Council District ${m[1]}`],
  [/^CityCouncil(?:W|Ward)(\d+)$/, (m) => `City Council Ward ${m[1]}`],
  [/^Ward(\d+)CityCouncil$/, (m) => `City Council Ward ${m[1]}`],
  [/^(?:CityCouncil(?:AL|AtLarge|_AtLarge)|CouncilAtLarge)$/, () => "City Council At Large"],
  [/^CityCouncilAtLargeSeat([A-Z])$/, (m) => `City Council At Large Seat ${m[1]}`],
  [/^CityCouncil(Central|East|North|South)District$/, (m) => `City Council ${m[1]} District`],
  [/^CityCouncil_2yrPartialTerm$/, () => "City Council, two-year term"],
  [/^CityCouncil$/, () => "City Council"],
  [/^(?:HouseDistrict|StateHouseD|StateHouseDistrict)(\d+)$/, (m) => `State House District ${m[1]}`],
  [/^(?:SenateDistrict|StateSenate)([A-Z])$/, (m) => `State Senate District ${m[1]}`],
  [/^StateSenateDistrict(\d+)$/, (m) => `State Senate District ${m[1]}`],
  [/^CountyCouncilDistrict(\d+)$/, (m) => `County Council District ${m[1]}`],
  [/^Parks?Board(?:D|District)(\d+)$/, (m) => `Park Board District ${m[1]}`],
  [/^SchoolBoard(?:D|District)(\d+)$/, (m) => `School Board District ${m[1]}`],
  [/^SchoolDirector(?:D|Dist|District)(\d+)$/, (m) => `School Director District ${m[1]}`],
  [/^BoroughPresident(\w+)$/, (m) => `Borough President of ${BOROUGHS[m[1]] ?? m[1]}`],
  [/^Mayor(?:Citywide)?$/, () => "Mayor"],
  [/^PublicAdvocate(?:Citywide)?$/, () => "Public Advocate"],
  [/^GovernorLieutenantGovernor$/, () => "Governor and Lieutenant Governor"],
  [/^AssessorRecorder$/, () => "Assessor-Recorder"],
  [/^CountyAssessorTreasurer$/, () => "County Assessor-Treasurer"],
  [/^CountyExecutiveMember$/, () => "County Executive"],
]

const words = (s) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")
const slug = (s) => s.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

export function describe(file) {
  const [place, day, ...rest] = file.replace(/\.(csv|tab)$/, "").split("_")
  const known = PLACES[place]
  if (!known) throw new Error(`no place for ${file}`)
  const [jurisdiction, state, placeLevel] = known
  let parts = [...rest]
  let party = null
  let special = false
  if (parts.at(-1) === "Special") {
    special = true
    parts = parts.slice(0, -1)
  }
  const nominee = parts.at(-1)?.match(/^(Dem|Rep)Nominee$/)
  if (nominee) {
    party = nominee[1] === "Dem" ? "DEM" : "REP"
    parts = parts.slice(0, -1)
  }
  if (PARTIES[parts[0]]) party = parts.shift()
  let body = parts.join("_")
  const glued = body.match(/^(DEM|REP)(?=[A-Z][a-z])/)
  if (glued) {
    party = glued[1]
    body = body.slice(3)
  }
  if (/^RepublicanPresidentialNominee/.test(body)) party = "REP"
  const rule = OFFICES.find(([re]) => re.test(body))
  const office = rule ? rule[1](body.match(rule[0])) : words(body)
  const date = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`
  const level = /^(U\.S\.|President)/.test(office) ? "federal" : placeLevel
  const partyName = party ? PARTIES[party] : null
  const kind = partyName ? `${partyName} primary` : special ? "special election" : null
  return {
    id: slug([jurisdiction, date, party ?? "", office, special ? "special" : ""].filter(Boolean).join(" ")),
    jurisdiction,
    state,
    level,
    date,
    office,
    party: partyName,
    special,
    title: [`${jurisdiction} ${office}`, kind, date.slice(0, 4)].filter(Boolean).join(", "),
  }
}
