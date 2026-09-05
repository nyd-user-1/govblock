// congress.gov browses legislative subject terms in three lists — the general
// terms, the organizations, and the geographic ones — and publishes the split
// only behind a bot wall. This is the rule of thumb that sorts our terms the
// same three ways (2026-09-05): a term is geographic when it names a place,
// an organization when it names a body, and general otherwise. It errs on the
// side of general, so a term is never filed under a place or a body it is not.

export type SubjectKind = "general" | "organization" | "geographic"

const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia", "Puerto Rico", "Guam", "American Samoa", "Northern Mariana Islands", "Virgin Islands", "U.S. Virgin Islands",
]

const REGIONS = [
  "Africa", "Antarctica", "Arctic", "Arctic and polar regions", "Asia", "Australia", "Caribbean area", "Central America", "Europe",
  "Latin America", "Middle East", "North America", "Oceania", "South America", "Southeast Asia", "Central Asia", "East Asia", "South Asia",
  "Western Hemisphere", "Balkans", "Baltic States", "Scandinavia", "Sub-Saharan Africa", "North Africa", "Horn of Africa", "Persian Gulf",
  "Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Great Lakes", "Gulf of Mexico", "Mediterranean Sea", "Black Sea", "South China Sea",
  "Chesapeake Bay", "Mississippi River", "Colorado River", "Columbia River", "Missouri River", "Rio Grande", "Appalachia", "New England",
]

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina",
  "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burma", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Democratic Republic of the Congo", "Costa Rica",
  "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia (Republic)", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
  "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan",
  "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
  "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macau", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestinians", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan",
  "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe", "Tibet", "West Bank", "Gaza Strip", "Kurdistan", "Western Sahara", "Greenland", "Bermuda", "Cayman Islands",
]

const PLACES = new Set([...STATES, ...REGIONS, ...COUNTRIES].map((name) => name.toLowerCase()))

/** A place, by its last word: "Persian Gulf", "Aleutian Islands", "Great Plains". */
const PLACE_TAIL = /\b(ocean|sea|gulf|bay|islands?|river|lake|lakes|mountains|plains|region|peninsula|strait|coast|delta|valley|basin|territories)$/i

/**
 * A body, by how its name ends: a capitalised institutional noun. The capital
 * is the tell — CRS writes "Access Board" and "Coast guard", and the second
 * is the subject, not the service; "Government trust funds" and "Contracts
 * and agency" end in the same nouns, lower-cased, and are subjects too.
 */
const BODY_TAIL =
  /\b(Board|Commission|Committee|Council|Corporation|Foundation|Administration|Agency|Authority|Bureau|Department|Office|Institute|Institutes|Service|Bank|Fund|Association|Federation|Organization|University|College|Academy|Center|Centers|Court|Courts|Congress|Senate|Library|Museum|Guard|Corps|Army|Navy|Air Force|Space Force|Marine Corps|Institution|Partnership|Conference|Assembly|Union|Alliance|Exchange|Society|League|Caucus|Company|Companies|System|Trust)$/
/** A body, by how its name begins. */
const BODY_HEAD =
  /^(Department of|Office of|Bureau of|Executive Office|Supreme Court|Library of|Smithsonian|Architect of|Comptroller|Government National|Corporation for|Peace Corps|Amtrak|United Nations|European Union|North Atlantic|Organization of|Federal Reserve|World (Bank|Health|Trade)|International Monetary)/
/** "(CDC)", "(Ginnie Mae)": a body's short name in parentheses. "(U.S.)" is a place's. */
const SHORT_NAME = /\((?:[A-Z][A-Z&]{1,}|Ginnie Mae|Fannie Mae|Freddie Mac|Sallie Mae|Farmer Mac)\)$/

export function subjectKind(name: string): SubjectKind {
  const clean = name.trim()
  // "Atlantic Coast (U.S.)": the qualifier says where, not what.
  const bare = clean.replace(/\s*\((?:U\.S\.|United States)\)$/, "")
  if (PLACES.has(bare.toLowerCase())) return "geographic"
  if (PLACE_TAIL.test(bare) && !/\b(policy|law|program|research|management)\b/i.test(bare)) return "geographic"
  if (SHORT_NAME.test(clean)) return "organization"
  if (BODY_HEAD.test(clean) || BODY_TAIL.test(clean)) return "organization"
  return "general"
}

/** `Agriculture and Food` → `agriculture-and-food`: the path segment a term reads at. */
export function subjectSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
