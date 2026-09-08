# Rebuilding OpenSecrets from primary sources

Schema reconnaissance on OpenSecrets (formerly the Center for Responsive Politics)
and Follow the Money (formerly the National Institute on Money in State Politics),
a map from each of their tables back to the public source it was built from, and a
recommendation on what is worth rebuilding ourselves and in what order.

Everything below was checked on **2026-09-07**. No bulk downloads were attempted.
**The Follow the Money 1,000-row/year API cap has not been touched** — the entire
schema map came out of published documentation, so the cap is still fully
available for a live probe if we want one.

---

## Findings first

1. **OpenSecrets and Follow the Money are the same organization.** NIMSP and CRP
   merged in 2021. followthemoney.org now carries a banner saying so and pointing
   federal queries at opensecrets.org.
2. **OpenSecrets' API is dead, with a date.** opensecrets.org/api says: *"As of
   April 15, 2025, our API offerings have been discontinued."* `api.opensecrets.org`
   resolves (23.21.162.105) but refuses connections. The site now points people at
   `commercial@opensecrets.org` for "a custom data solution."
3. **Follow the Money is frozen and unmaintained.** Its own banner: *"This website
   displays state campaign finance data that is current through the 2024 election
   year. While the data is current, the site isn't maintained as we integrate with
   OpenSecrets and you may find bugs."* **State campaign finance has no live free
   aggregator right now.** That is a gap in the world, not just in our database.
4. **Their whole corpus is CC BY-NC-SA 3.0 US — non-commercial, share-alike.**
   Stated on every page of both sites and in the OpenData User's Guide. That is
   **incompatible with GovBlock's CC BY 4.0 data licence**, and it means "just
   mirror OpenSecrets" was never actually on the table. Rebuilding from primary
   federal and state disclosure — which is public domain — is the only path that
   leaves us free to license what we publish.
5. **Their moat is not the data. It is the coding layer.** Their own
   documentation is explicit: they take raw FEC/SOPR/IRS/PFD files and add
   "coding, standardizing names and applying IDs." Everything hard about
   OpenSecrets lives in five derived fields (`CID`, `ContribID`, `OrgName`/`UltOrg`,
   `RealCode`/`catcode`, `RecipCode`), and rebuilding those is the same job no
   matter which raw source we start from.
6. **We already hold more raw federal lobbying than they publish for free.**
   357,379 LDA filings across 2023–2026, $21.3 bn of reported spend, 677,465
   activity lines, 562,061 bill mentions.

---

## Part 1 — OpenSecrets schema

Reconstructed from the **OpenSecrets OpenData User's Guide** (62 pp, last updated
2015-06-12), which ships the actual `CREATE TABLE` scripts. Recovered from a
mirror because opensecrets.org/open-data/* returns 403 to us. 26 tables in four
families.

### Campaign finance (6 tables) — built from the FEC

| Table | FEC source | Columns |
| --- | --- | --- |
| `CandsCRP` | `foiacn` (candidate master) | Cycle, FECCandID, **CID**, FirstLastP, Party, DistIDRunFor, DistIDCurr, CurrCand, CycleCand, CRPICO, **RecipCode**, NoPacs |
| `Cmtes` | `foiacm` (committee master) | Cycle, CmteID, PACShort, Affiliate, **UltOrg**, RecipID, RecipCode, FECCandID, Party, **PrimCode**, Source, Sensitive, Foreign, Active |
| `Indivs` | `itcont` (individual contributions) | Cycle, FECTransID, **ContribID**, Contrib, RecipID, **OrgName**, **UltOrg**, **RealCode**, Date, Amount, City, State, Zip, RecipCode, Type, CmteID, OtherID, **Gender**, Microfilm, Occupation, Employer, Source |
| `PACs` | `itpas2` (PAC → candidate) | Cycle, FECRecNo, PACID, CID, Amount, Date, RealCode, Type, **DI**, FECCandID |
| `Pac_Other` | `itoth` (PAC → PAC) | Cycle, FECRecNo, FilerID, DonorCmte, ContribLendTrans, City, State, Zip, FECOccEmp, PrimCode, Date, Amount, RecipID, Party, OtherID, RecipCode, RecipPrimCode, Amend, Report, PG, Microfilm, Type, RealCode, Source |
| `Expend` | FEC electronic filings (`oppexp`) | Cycle, TransID, CRPFilerID, RecipCode, PACShort, CRPRecipName, **ExpCode**, Amount, Date, City, State, Zip, CmteID_EF, CandID, Type, Descrip, PG, ElecOther, EntType, Source |

Their own caveat on `Expend`: *"We have never had sufficient staff to properly
work with the expenditure data, so in general it is not up to the standards of
most of our other data."* Worth knowing before we treat their expenditure numbers
as a benchmark.

### Lobbying (7 tables) — built from SOPR / LDA

| Table | Columns |
| --- | --- |
| `lobbying` | uniqid, registrant_raw, **registrant**, isfirm, client_raw, **client**, **ultorg**, amount, **catcode**, source, self, **IncludeNSFS**, use, ind, year, type, typelong, affiliate |
| `Lobbyists` | uniqID, **lobbyist**, lobbyist_raw, lobbyist_id, year, **Official Position**, **cid**, **formercongmem** |
| `LobbyIndus` | client, sub, total, year, catcode |
| `lobbyagency` | uniqID, agencyID, Agency |
| `lobbyissue` | SI_ID, uniqID, issueID, issue, SpecificIssue, year |
| `lob_bills` | B_ID, si_id, CongNo, **Bill_Name** |
| `lob_rpt` | TypeLong, Typecode |

`Lobbyists.formercongmem` + `Official Position` **is the revolving door**, and it
is one boolean and one free-text field. `lob_bills.Bill_Name` + `CongNo` is
exactly the bill-citation join the sibling lobbying tranche is re-keying.

### 527 organizations (3 tables) — built from IRS Form 8872

`Cmtes527`, `receipts527`, `Expenditures527`.

### Personal finances (10 tables) — built from House/Senate/OGE disclosures

`Agreement`, `PFD_Asset`, `Compensation`, `Gift`, `Honoraria`, `Income`,
`Liability`, `Position`, `Transactions`, `Travel`. Every one carries
`ID, Chamber, CID, CalendarYear, ReportType` plus `Orgname`/`Ultorg`/`Realcode`
— i.e. the same entity-coding layer applied to disclosure forms.

---

## Part 2 — Follow the Money schema

FTM does not expose tables; it exposes one summarising API over one fact table,
sliced by **tokens**. The `metaInfo.grouping` block lists them and the `records`
block returns one tag per grouped token. Full taxonomy, from their published API
documentation (`followthemoney.org/assets/FollowTheMoney-API.pdf`):

| Category | Token | Tag | Meaning |
| --- | --- | --- | --- |
| General | `s` | `Election_State` | State the election is in |
| General | `y` | `Election_Year` | Election year |
| General | `f-s` | `Filing_State` | State the report was filed in |
| General | `f-eid` | `Filer` | Filing entity |
| General | `f-y` | `Filing_Year` | Year of the reporting period |
| General | `c-r-osid` | `Office_Sought` | Specific seat |
| General | `c-r-oc` | `Office` | General office type |
| Candidates | `c-t-id` | `Candidate` | Candidate |
| Candidates | `c-t-eid` | `Career_Summary` | Career across years and offices |
| Candidates | `c-t-p` | `Political_Party` | Party |
| Candidates | `c-t-pt` | `Party_Details` | Party detail |
| Candidates | `c-t-sts` | `Status_of_Candidate` | Won/lost/withdrew |
| Candidates | `c-t-ico` | `Incumbency_Status` | Incumbent/challenger/open |
| Candidates | `c-r-id` | `Political_Race` | Race |
| Candidates | `c-r-ot` | `Type_of_Office` | Office type (P/G, federal/state) |
| Contributors | `d-eid` | `Contributor` | **Resolved donor entity id** |
| Contributors | `d-et` | `Type_of_Contributor` | Individual / non-individual |
| Contributors | `d-ccg` | `Sector` | **19 economic sectors** |
| Contributors | `d-cci` | `Industry` | Industry within sector |
| Contributors | `d-ccb` | `Business_Classification` | Leaf classification |
| Contributors | `d-ad-cty` / `d-ad-st` / `d-ad-zip` / `d-ad-str` | City / State / Zip / Street | Donor address |
| Contributors | `d-ins` | `In-State` | In- vs out-of-state money |
| Contributors | `d-empl` | `Employer` | Employer as filed |
| Contributors | `d-occupation` | `Occupation` | Occupation as filed |
| Advanced | `d-id` | `Record` | Group by this to get **individual rows** rather than summaries |
| Advanced | `d-amt` | `Amount` | Transaction amount |
| Advanced | `d-dte` | `Date` | Transaction date |
| Advanced | `d-nme` | `Original_Name` | **Name as it appeared on the report** |
| Advanced | `d-typ` | `Type_of_Transaction` | Itemized / unitemized / returned |
| Advanced | `d-ludte` | `Last_Updated` | Last update |
| Advanced | `c-t-i` / `c-t-icod` | `Incumbency_Data` / `Incumbency_Advantage` | Derived incumbency metrics |

Mechanics worth copying rather than inventing: every returned row carries a
`request` string — the URL parameters that re-query exactly that row's underlying
records. That is drill-down as a first-class field, and it is a nice pattern for
our own aggregate surfaces.

Second endpoint, separately documented: `api.followthemoney.org/entity.php?eid=…&APIKey=…&mode=json`,
which mirrors an Entity Details page.

**Note the pair `d-nme` (Original_Name) and `d-eid` (Contributor).** Keeping the
raw string beside the resolved entity is the single most important schema
decision in the whole system, and it is the one that makes their coding auditable.
Whatever we build should do the same.

---

## Part 3 — What they actually add (the part that is not free)

Both organisations describe their method plainly. FTM: *"The Institute receives
its data in either electronic or paper files from the disclosure agencies…
Researchers then standardize the contributor names and assign political donors an
economic interest code, based either on the occupation and employer information
contained in the disclosure reports or on information found through a variety of
research resources."*

Six derived layers, in rough order of cost to rebuild:

| Layer | What it is | Cost to rebuild |
| --- | --- | --- |
| **`RecipCode`** | 2 chars: `<Party><Status>` for candidates, `<Party>P` for party committees, `O<BLIO>` for outside spending, `P<BLIO>` otherwise. `BLIO` = Business / Labor / Ideological / Other. | Trivial — it is a lookup, fully documented. |
| **`CID`** | A candidate id stable across cycles, where FEC's `FECCandID` is not. | Easy — we already do this with `people_id` in the `Fec*` tables. |
| **`RealCode` / `catcode` / `PrimCode`** | 5-char industry code, three levels (Sector → Industry → Business Classification), 19 sectors. | **Medium as a taxonomy, hard as an assignment.** The taxonomy is published in full on followthemoney.org/our-data/about-our-data; the tree is copyable in an afternoon. Assigning a code to each of millions of employer strings is the actual work — and it is now a very good LLM job, which it was not when they built it by hand. |
| **`OrgName` / `UltOrg`** | Standardised employer name, and its ultimate parent. | **Hard.** Entity resolution over dirty free-text employers, plus a corporate-parent graph. Same shape as the org-matching we already do for LDA registrants and clients. |
| **`ContribID`** | A 12-char person id clustering an individual's donations across committees and cycles. | **Hard.** FEC ships no such key. Name+ZIP+employer clustering, and it is where every wrong answer comes from. |
| **`IncludeNSFS`** | Whether a lobbying registrant's report already includes its subsidiaries' spending, so parent and child totals are not double-counted. Values `y`/`n`/`s` (subcontractor). | **Medium, and mandatory.** Skip it and every "top lobbying spender" number we publish is wrong. Their worked example is General Electric in 2007. |

Their double-counting rules are documented and worth transcribing verbatim into
whatever we build: exclude `RealCode like 'Z9%'` (non-contributions) and
`'Z4%'` (joint fundraising committees); limit `Indivs` to transaction types
10/11/15/15E/15J/22Y; do not add `Indivs` money going to PACs on top of the PAC's
own contributions. Getting these wrong is how aggregators end up an order of
magnitude off.

---

## Part 4 — Source attribution map

Every table above, traced to the public source it was built from.

| Their table(s) | Upstream public source | Machine access | Verified 2026-09-07 | Feasibility |
| --- | --- | --- | --- | --- |
| `CandsCRP`, `Cmtes`, `Indivs`, `PACs`, `Pac_Other`, `Expend` | **Federal Election Commission** | Bulk zips at `fec.gov/files/bulk-downloads/{cycle}/` (`cn`, `cm`, `indiv`, `pas2`, `oth`, `oppexp`) + REST at `api.open.fec.gov` (api.data.gov key) | `indiv26.zip` 200 `application/zip`; OpenFEC 200 on `DEMO_KEY` | **easy to fetch, medium to load** — `indiv` is tens of millions of rows per cycle |
| `lobbying`, `Lobbyists`, `lobbyagency`, `lobbyissue`, `lob_bills`, `lob_rpt`, `LobbyIndus` | **Senate LDA** (and House Clerk mirror) | `lda.senate.gov/api/v1/filings/` | live | **already done** — see Part 5 |
| `Cmtes527`, `receipts527`, `Expenditures527` | **IRS**, Form 8872 (Political Organization Filing and Disclosure) | irs.gov bulk downloads | page 200 | easy |
| `Agreement`, `PFD_Asset`, `Compensation`, `Gift`, `Honoraria`, `Income`, `Liability`, `Position`, `Transactions`, `Travel` | **House Clerk** financial disclosures + **Senate eFD** + **OGE** | `disclosures-clerk.house.gov/FinancialDisclosure` (annual ZIPs of XML + PDF); `efdsearch.senate.gov` (session-cookie search, PDFs, many hand-written) | both 200 | **medium (House), hard (Senate)** — Senate filings are largely scanned images |
| FTM state contributions (`d-*` tokens) | **~50 state campaign-finance disclosure agencies** | Wildly heterogeneous: Socrata APIs, bulk CSV, ASP.NET search forms, and in some states paper | FTM publishes the full agency list at `/resources/state-disclosure-agencies/` — 134 links across campaign finance / elections / lobbyist disclosure | **hard, per state** — but see the pilot below |
| FTM state lobbying (Lobbying Expenditures, Lobbyist Link) | State ethics commissions | Same heterogeneity | same list | hard |
| FTM ballot measures | State ballot-measure committee filings | Same | same list | hard |
| Independent spending | FEC 24A/24E/24N/24F/24C types (federal); state agencies (state) | FEC bulk + API | live | easy federally |

Sanity check on the state pilot — **Washington's Public Disclosure Commission
publishes contributions as a Socrata dataset** (`data.wa.gov/resource/kv7h-kjye.json`).
One unauthenticated request returns a full contribution record: filer, office,
jurisdiction, election year, amount, cash-or-in-kind, receipt date,
`contributor_category`, name, full address, and a link back to the filed report.
That is FTM's entire schema, from the source, for free. States like this are the
place to start.

---

## Part 5 — What we already cover

| Their dataset | Ours | Verdict |
| --- | --- | --- |
| Lobbying (`lobbying`, `Lobbyists`, `lobbyissue`, `lob_bills`, `lobbyagency`) | `LobbyingFilings` 357,379 · `LobbyingActivities` 678,199 · `LobbyingBills` 562,061 · plus `lobbyists`, `lobbyists_clients`, `lobbying_spend`, `lobbyist_compensation`, `Individual_Lobbyists` | **Covered, and then some, for 2023–2026** (2026: 56,182 filings / 5,352 registrants / 27,329 clients / $3.50 bn. 2025: 108,958 / 5,479 / 28,307 / $6.77 bn). Missing: pre-2023, and every derived field — `catcode`, `ultorg`, `IncludeNSFS`, `formercongmem`. |
| Campaign finance (`Indivs`, `PACs`, `Pac_Other`, `Cmtes`, `CandsCRP`) | `FecContributions` 116,820 · `FecCommittees` 991 · `FecTotals` 5,517 · `FecIndependentExpenditures` 4,545 · `FecReceiptsByEmployer` 113,430 · `FecReceiptsBySize` · `FecReceiptsByState` | **Partial — a per-member slice, not the corpus.** Every table is keyed on `people_id`, i.e. pulled per tracked member from OpenFEC, and only for cycles 2024 (60,393 rows / 604 people) and 2026 (56,427 / 569). No PAC-to-PAC, no committee-to-committee, no non-tracked candidates, no employer standardisation. |
| 527s | — | **Net-new.** |
| Personal finances | — | **Net-new.** |
| State campaign finance | `Finance` (13), `FinanceContributors` (100), `FinanceSectors` (16) — placeholders | **Net-new, essentially entirely.** |
| Industry/sector coding | — | **Net-new, and it is the thing that makes the rest legible.** |

---

## Part 6 — Recommendation

**Rebuilding OpenSecrets wholesale is not worth it. Rebuilding four specific
pieces of it is, and we are already most of the way through the hardest one.**

The reasoning, plainly: their raw inputs are all public domain and mostly one
`curl` away; their published outputs are licensed non-commercially and are
therefore unusable to us; their API is switched off; and their state product is
frozen at 2024 with nobody maintaining it. So there is no mirroring option, only
a rebuilding option — and the rebuild is cheap wherever the federal government
publishes a file and expensive wherever a human had to read a form.

### Order of work

**1. Finish the federal lobbying layer we already own** — highest value, lowest
cost, no new source.
We hold the raw filings. What we do not hold is `catcode` (industry), `ultorg`
(corporate parent) and `IncludeNSFS` (the subsidiary rule). Add those three and
our lobbying pages become directly comparable to OpenSecrets' — on data we
already ingest and can license as we like. `formercongmem` (revolving door) is a
join from `LobbyingActivities` lobbyist names to `congress_members` and
`house_staff`, both of which we hold. Sequence this *after* the bill-identity
re-key in the sibling tranche.

**2. Copy the industry taxonomy, assign codes with a model.** The three-level
Sector → Industry → Business Classification tree is published in full and is
descriptive, not proprietary — 19 sectors, and it is the vocabulary the whole
field speaks. Transcribe the tree, then classify employer/registrant strings
against it. This is the layer that took CRP decades of staff research and is now
a tractable batch job. Do it once, apply it to lobbying *and* FEC contributions.

**3. Pull FEC bulk properly.** We have a per-member slice; the full `indiv`,
`pas2`, `oth`, `cn`, `cm`, `oppexp` bulk files are free, versioned by cycle, and
need no key. That converts our finance block from "this member's donors" into
"who funds what," and it is the input the coding layer in step 2 wants. Budget
for size: `indiv` is the big one.

**4. Personal financial disclosures — House first.** The Clerk publishes annual
ZIPs of XML plus PDFs; the Senate is mostly scans. Do the House, say so plainly
on the page, and leave the Senate for later. This is genuinely net-new and there
is no free competitor since the API shut off.

**5. State campaign finance — pilot, don't boil the ocean.** This is the biggest
gap in the world right now and the biggest trap. Start with the states that
publish structured data and nothing else: Washington (Socrata, verified above),
Colorado, Minnesota, Texas, California, New York, Florida, Illinois, Michigan.
Model the target schema on FTM's token list — `d-nme` beside `d-eid`, sector /
industry / business classification, in-state flag, filer vs election state — so
every state we add lands in the same shape. If a handful of high-population
states work, the pattern is proven and the rest is grind; if they do not, we
stopped after a fortnight. **Do not** start with the 40 states behind ASP.NET
search forms.

**6. 527s — later.** Small, self-contained, IRS bulk, no urgency.

### Not recommended

Mirroring OpenSecrets or FTM output, licensing their bulk data, or building
against `api.opensecrets.org`. The first is a licence violation, the second costs
money for data we can derive, and the third does not exist any more.

---

## Appendix A — the unspent 1,000-row cap

The Follow the Money free key is capped at **1,000 rows per year**, and this pass
spent **none of it** — the whole taxonomy above came from their published API PDF.
The key (`FOLLOWTHEMONEY_API_KEY`) lives in `~/Code/livingston/.env.local`, not in
govblock, and per the tranche brief it has **not** been copied across. If Brendan
says go, the probe worth running is small and specific:

1. One ungrouped call to read `metaInfo` — `format`, `completeness`, `paging`,
   `grouping`, `sorting`, `recordFormat`. Cost: 1 row. This confirms whether the
   live token list still matches the documented one, and `completeness` tells us
   how far their state coverage actually reaches.
2. One `gro=d-ccg` call — 19 sectors, 19 rows. Gives the live sector vocabulary
   with their ids.
3. One `gro=d-cci` call — the industry level under it, on the order of 100 rows.
4. One `gro=d-id&…` call with a tight filter — 5 rows — to capture the exact
   column set of an individual contribution record.
5. One `entity.php?eid=…` call to capture the Entity Details shape.

Total well under 200 rows, leaving the rest of the year's budget intact. Anything
beyond that should come from the states directly.

## Appendix B — probes run, and what they returned

| Target | Result |
| --- | --- |
| `opensecrets.org` (root, `/open-data/*`) | 403 — bot-protected, consistent across retries |
| `opensecrets.org/api/` | 200 — *"As of April 15, 2025, our API offerings have been discontinued."* |
| `api.opensecrets.org` | DNS resolves, connection refused |
| `followthemoney.org` | 200, slow (needs ~60 s timeouts) |
| `followthemoney.org/assets/FollowTheMoney-API.pdf` | 200, full token documentation |
| OpenSecrets OpenData User's Guide | recovered from a public mirror; 62 pp, all `CREATE TABLE` scripts |
| `fec.gov/files/bulk-downloads/2026/indiv26.zip` | 200 `application/zip` |
| `api.open.fec.gov` | 200 on `DEMO_KEY` |
| `lda.senate.gov/api/v1/filings/` | live (405 on HEAD, as expected) |
| `disclosures-clerk.house.gov/FinancialDisclosure` | 200 |
| `efdsearch.senate.gov/search/` | 200 |
| `irs.gov` political-organization disclosure | 200 |
| `data.wa.gov/resource/kv7h-kjye.json` | 200, full contribution records, no key |
