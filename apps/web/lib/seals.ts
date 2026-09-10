// The seal a nominating organization wears in a record item's avatar slot.
//
// Harvested from Wikimedia Commons on 2026-09-02 by listing the distinct
// `organization` values in `congress_nominations` and resolving each by hand
// against a named Commons file — a search-only pass put the National Guard's
// seal on the Army, Alabama's on the Department of Transportation and
// Mississippi's judiciary on the federal one, so every entry below names the
// exact file it came from. `public/seals/SOURCES.md` carries the file page and
// licence for each; every one is public domain or CC0.
//
// The files are 144 px renderings, not the originals: an avatar is 36 CSS px
// and the Department of Veterans Affairs' seal is a 2 MB SVG.
//
// Six organizations have no seal on Commons under a licence we can use. They
// fall back to the Senate seal, which is honest — the Senate is the body the
// nomination is before, and it is what this page can actually say.

export type SealShape = "circle" | "rect"

export const AGENCY_SEALS: Record<string, { file: string; shape: SealShape }> = {
  "African Development Foundation": { file: "/seals/african-development-foundation.avif", shape: "circle" },
  "Air Force": { file: "/seals/air-force.avif", shape: "circle" },
  "Amtrak Board of Directors": { file: "/seals/amtrak-board-of-directors.avif", shape: "rect" },
  "Army": { file: "/seals/army.avif", shape: "circle" },
  "Asian Development Bank": { file: "/seals/asian-development-bank.avif", shape: "circle" },
  "Bureau of Consumer Financial Protection": { file: "/seals/bureau-of-consumer-financial-protection.avif", shape: "circle" },
  "Central Intelligence Agency": { file: "/seals/central-intelligence-agency.avif", shape: "circle" },
  "Coast Guard": { file: "/seals/coast-guard.avif", shape: "circle" },
  "Commodity Futures Trading Commission": { file: "/seals/commodity-futures-trading-commission.avif", shape: "circle" },
  "Congressional Research Service": { file: "/seals/congressional-research-service.avif", shape: "rect" },
  "Consumer Product Safety Commission": { file: "/seals/consumer-product-safety-commission.avif", shape: "circle" },
  "Department of Agriculture": { file: "/seals/department-of-agriculture.avif", shape: "circle" },
  "Department of Commerce": { file: "/seals/department-of-commerce.avif", shape: "circle" },
  "Department of Defense": { file: "/seals/department-of-defense.avif", shape: "circle" },
  "Department of Education": { file: "/seals/department-of-education.avif", shape: "circle" },
  "Department of Energy": { file: "/seals/department-of-energy.avif", shape: "circle" },
  "Department of Health and Human Services": { file: "/seals/department-of-health-and-human-services.avif", shape: "circle" },
  "Department of Homeland Security": { file: "/seals/department-of-homeland-security.avif", shape: "circle" },
  "Department of Housing and Urban Development": { file: "/seals/department-of-housing-and-urban-development.avif", shape: "circle" },
  "Department of Justice": { file: "/seals/department-of-justice.avif", shape: "circle" },
  "Department of Labor": { file: "/seals/department-of-labor.avif", shape: "circle" },
  "Department of State": { file: "/seals/department-of-state.avif", shape: "circle" },
  "Department of Transportation": { file: "/seals/department-of-transportation.avif", shape: "circle" },
  "Department of Veterans Affairs": { file: "/seals/department-of-veterans-affairs.avif", shape: "circle" },
  "Department of the Interior": { file: "/seals/department-of-the-interior.avif", shape: "circle" },
  "Department of the Treasury": { file: "/seals/department-of-the-treasury.avif", shape: "circle" },
  "Environmental Protection Agency": { file: "/seals/environmental-protection-agency.avif", shape: "circle" },
  "Equal Employment Opportunity Commission": { file: "/seals/equal-employment-opportunity-commission.avif", shape: "circle" },
  "Executive Office of the President": { file: "/seals/executive-office-of-the-president.avif", shape: "circle" },
  "Export-Import Bank of the United States": { file: "/seals/export-import-bank-of-the-united-states.avif", shape: "circle" },
  "Farm Credit Administration": { file: "/seals/farm-credit-administration.avif", shape: "circle" },
  "Federal Communications Commission": { file: "/seals/federal-communications-commission.avif", shape: "circle" },
  "Federal Deposit Insurance Corporation": { file: "/seals/federal-deposit-insurance-corporation.avif", shape: "circle" },
  "Federal Election Commission": { file: "/seals/federal-election-commission.avif", shape: "circle" },
  "Federal Energy Regulatory Commission": { file: "/seals/federal-energy-regulatory-commission.avif", shape: "circle" },
  "Federal Housing Finance Agency": { file: "/seals/federal-housing-finance-agency.avif", shape: "circle" },
  "Federal Labor Relations Authority": { file: "/seals/federal-labor-relations-authority.avif", shape: "rect" },
  "Federal Maritime Commission": { file: "/seals/federal-maritime-commission.avif", shape: "circle" },
  "Federal Mediation and Conciliation Services": { file: "/seals/federal-mediation-and-conciliation-services.avif", shape: "circle" },
  "Federal Mine Safety and Health Review Commission": { file: "/seals/federal-mine-safety-and-health-review-commission.avif", shape: "circle" },
  "Federal Motor Carrier Safety Administration": { file: "/seals/federal-motor-carrier-safety-administration.avif", shape: "rect" },
  "Federal Reserve System": { file: "/seals/federal-reserve-system.avif", shape: "circle" },
  "Federal Trade Commission": { file: "/seals/federal-trade-commission.avif", shape: "circle" },
  "General Services Administration": { file: "/seals/general-services-administration.avif", shape: "circle" },
  "Inter-American Foundation": { file: "/seals/inter-american-foundation.avif", shape: "circle" },
  "International Monetary Fund": { file: "/seals/international-monetary-fund.avif", shape: "circle" },
  "Marine Corps": { file: "/seals/marine-corps.avif", shape: "circle" },
  "Merit Systems Protection Board": { file: "/seals/merit-systems-protection-board.avif", shape: "circle" },
  "Metropolitan Washington Airports Authority": { file: "/seals/metropolitan-washington-airports-authority.avif", shape: "rect" },
  "National Aeronautics and Space Administration": { file: "/seals/national-aeronautics-and-space-administration.avif", shape: "circle" },
  "National Archives and Records Administration": { file: "/seals/national-archives-and-records-administration.avif", shape: "circle" },
  "National Credit Union Administration": { file: "/seals/national-credit-union-administration.avif", shape: "circle" },
  "National Endowment for the Arts": { file: "/seals/national-endowment-for-the-arts.avif", shape: "rect" },
  "National Endowment for the Humanities": { file: "/seals/national-endowment-for-the-humanities.avif", shape: "rect" },
  "National Indian Gaming Commission": { file: "/seals/national-indian-gaming-commission.avif", shape: "circle" },
  "National Labor Relations Board": { file: "/seals/national-labor-relations-board.avif", shape: "circle" },
  "National Mediation Board": { file: "/seals/national-mediation-board.avif", shape: "circle" },
  "National Science Foundation": { file: "/seals/national-science-foundation.avif", shape: "circle" },
  "National Transportation Safety Board": { file: "/seals/national-transportation-safety-board.avif", shape: "circle" },
  "Navy": { file: "/seals/navy.avif", shape: "circle" },
  "Nuclear Regulatory Commission": { file: "/seals/nuclear-regulatory-commission.avif", shape: "circle" },
  "Occupational Safety and Health Review Commission": { file: "/seals/occupational-safety-and-health-review-commission.avif", shape: "circle" },
  "Office of Government Ethics": { file: "/seals/office-of-government-ethics.avif", shape: "circle" },
  "Office of Personnel Management": { file: "/seals/office-of-personnel-management.avif", shape: "circle" },
  "Office of Special Counsel": { file: "/seals/office-of-special-counsel.avif", shape: "circle" },
  "Office of Surface Mining Reclamation and Enforcement": { file: "/seals/office-of-surface-mining-reclamation-and-enforcement.avif", shape: "circle" },
  "Office of the Director of National Intelligence": { file: "/seals/office-of-the-director-of-national-intelligence.avif", shape: "circle" },
  "Peace Corps": { file: "/seals/peace-corps.avif", shape: "circle" },
  "Pension Benefit Guaranty Corporation": { file: "/seals/pension-benefit-guaranty-corporation.avif", shape: "rect" },
  "Public Health Service": { file: "/seals/public-health-service.avif", shape: "circle" },
  "Securities and Exchange Commission": { file: "/seals/securities-and-exchange-commission.avif", shape: "circle" },
  "Small Business Administration": { file: "/seals/small-business-administration.avif", shape: "circle" },
  "Social Security Administration": { file: "/seals/social-security-administration.avif", shape: "circle" },
  "Space Force": { file: "/seals/space-force.avif", shape: "circle" },
  "Surface Transportation Board": { file: "/seals/surface-transportation-board.avif", shape: "circle" },
  "Tennessee Valley Authority": { file: "/seals/tennessee-valley-authority.avif", shape: "circle" },
  "The Judiciary": { file: "/seals/the-judiciary.avif", shape: "circle" },
  "United States Agency for Global Media": { file: "/seals/united-states-agency-for-global-media.avif", shape: "rect" },
  "United States International Trade Commission": { file: "/seals/united-states-international-trade-commission.avif", shape: "circle" },
  "United States Sentencing Commission": { file: "/seals/united-states-sentencing-commission.avif", shape: "circle" },
  "United States Tax Court": { file: "/seals/united-states-tax-court.avif", shape: "circle" },
}

/** The research service's own logo, for the CRS reports list. */
export const CRS_SEAL = AGENCY_SEALS["Congressional Research Service"]

/**
 * The seal for a nominating organization, or `null` when Commons has none we
 * can use — the caller falls back to the Senate seal and the list says so by
 * showing the chamber rather than pretending to an emblem.
 */
export function agencySeal(organization?: string | null) {
  if (!organization) return null
  return AGENCY_SEALS[organization] ?? null
}
