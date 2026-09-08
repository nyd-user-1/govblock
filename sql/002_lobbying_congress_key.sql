-- Federal lobbying, re-keyed onto congress.gov identity.  2026-09-07.
--
-- LDA filings cite a bill by the citation a lobbyist typed — "H.R. 1", and
-- sometimes "H.Res.1" when they meant H.R. 1 — and the loader stored it in
-- LegiScan's universal scheme (HB1, SB2587, HCR14).  That is faithful to the
-- filing, but it leaves the join to a bill running through LegiScan's mirror:
-- `bill_id`, which exists only for the bills the mirror has picked up, and
-- which is null for 1,011 rows of the 119th and 67 numbers of the 118th.
--
-- Audited 2026-09-07 before this ran: across all 10,667 distinct citations of
-- the 119th, `LobbyingBills.bill_id` and `congress_bills.bill_id` agree on
-- every one — zero disagreements.  The rows were never attached to the wrong
-- bill; they were attached through the wrong key, and shown under the wrong
-- title, because the mirror had H.R. 1 titled "FEHB Protection Act of 2025".
--
-- `congress_key` is that identity computed directly from the filing, with no
-- mirror in the path: `119-HR-1`, `118-S-2226`, matching congress_bills.key.
-- Generated and stored, so it cannot drift from bill_number, and so a congress
-- we have not harvested yet (the 118th) already carries the key it will join on
-- the day we do.  A prefix outside the table yields NULL rather than a guess.
--
-- See apps/web/docs/federal-sources.md.

alter table "LobbyingBills"
  add column if not exists congress_key text generated always as (
    ((session_id - 1789) / 2 + 1)::text || '-' ||
    case regexp_replace(bill_number, '[0-9].*$', '')
      when 'HB'  then 'HR'
      when 'SB'  then 'S'
      when 'HR'  then 'HRES'
      when 'SR'  then 'SRES'
      when 'HJR' then 'HJRES'
      when 'SJR' then 'SJRES'
      when 'HCR' then 'HCONRES'
      when 'SCR' then 'SCONRES'
    end || '-' || regexp_replace(bill_number, '^[A-Z]+', '')
  ) stored;

-- The bill lobbying block reads by key; the explorer reads by filing.
create index if not exists lobbying_bills_congress_key_idx on "LobbyingBills" (congress_key);
create index if not exists lobbying_bills_filing_idx on "LobbyingBills" (filing_uuid);
