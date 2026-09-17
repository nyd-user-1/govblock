"""District boundaries for the simulator's map, by the election they were used for.

    python3 scripts/elections/tiger.py download   # the Census's files, into ~/Code/govblock-data/elections/tiger
    python3 scripts/elections/tiger.py verify     # which state, chamber and year may be drawn → tiger/verified.json

The rule the map keeps (Brendan, 2026-09-16: never put results on the wrong
boundary):

- Congress. Each Congress has its own Census file, the districts that elected
  it: cd113 for 2012, cd114 for 2014, cd115 for 2016, cd116 for 2018, cd118 for
  2022, cd119 for 2024. 2020 elected the 117th Congress, which has no file of
  its own, so 2020 is not drawn.

- State legislatures. The Census collects each state's legislative districts
  before an election (the vintage). A year's results are drawn only when the
  districts collected for that election and the districts collected for the
  next one are the same districts — the same ids, and every district's total
  area (land and water) within 1% — so the lines provably did not move across the
  election. For 2024 the next collection is the Census's current service. A
  state that redrew between the two collections is left out of that year.
"""

import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(__file__))

ROOT = os.path.expanduser("~/Code/govblock-data/elections/tiger")
BASE = "https://www2.census.gov/geo/tiger"
UA = {"User-Agent": "govblock elections (brendan@nysgpt.com)"}

FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "12": "FL", "13": "GA",
    "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
    "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ",
    "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
    "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
}

SLD_YEARS = (2012, 2014, 2016, 2018, 2020, 2022, 2024)
# Congress → (the election that elected it, the files).
CONGRESSES = {
    113: (2012, [f"TIGER2013/CD/tl_2013_us_cd113.zip"]),
    114: (2014, [f"TIGER2014/CD/tl_2014_us_cd114.zip"]),
    115: (2016, [f"TIGER2016/CD/tl_2016_us_cd115.zip"]),
    116: (2018, [f"TIGER2018/CD/tl_2018_us_cd116.zip"]),
    118: (2022, [f"TIGER2022/CD/tl_2022_{f}_cd118.zip" for f in FIPS]),
    119: (2024, [f"TIGER2024/CD/tl_2024_{f}_cd119.zip" for f in FIPS]),
}
TIGERWEB = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer"


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                data = r.read()
            if data[:2] != b"PK":
                raise ValueError("not a zip")
            with open(path + ".part", "wb") as f:
                f.write(data)
            os.replace(path + ".part", path)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            time.sleep(3 + attempt * 5)
        except Exception:
            time.sleep(3 + attempt * 5)
    print("failed", url, flush=True)
    return False


def download():
    got = missing = 0
    for congress, (year, files) in CONGRESSES.items():
        for rel in files:
            ok = fetch(f"{BASE}/{rel}", os.path.join(ROOT, "cd", str(congress), os.path.basename(rel)))
            got += ok
            missing += not ok
            time.sleep(0.2)
        print(f"cd{congress}: done", flush=True)
    for year in SLD_YEARS:
        for fips in FIPS:
            for kind in ("sldu", "sldl"):
                name = f"tl_{year}_{fips}_{kind}.zip"
                ok = fetch(f"{BASE}/TIGER{year}/{kind.upper()}/{name}", os.path.join(ROOT, "sld", str(year), name))
                got += ok
                missing += not ok
                time.sleep(0.2)
        print(f"sld {year}: done", flush=True)
    print(f"{got} files, {missing} not published", flush=True)


def dbf_rows(zip_path):
    from dbf import read_bytes

    with zipfile.ZipFile(zip_path) as z:
        name = next(n for n in z.namelist() if n.endswith(".dbf"))
        return read_bytes(z.read(name))


def areas(zip_path, kind):
    code = "SLDUST" if kind == "sldu" else "SLDLST"
    out = {}
    try:
        rows = dbf_rows(zip_path)
    except zipfile.BadZipFile:
        return out  # an unreadable file counts as no file: the year is not drawn
    for r in rows:
        district = r.get(code, "")
        if not district or set(district) == {"Z"}:  # ZZZ: water or no district
            continue
        out[district] = (int(r.get("ALAND") or 0), int(r.get("AWATER") or 0), r.get("NAMELSAD", ""))
    return out


def current_areas(fips, kind):
    layer = 1 if kind == "sldu" else 2
    code = "SLDU" if kind == "sldu" else "SLDL"
    params = urllib.parse.urlencode({"where": f"STATE='{fips}'", "outFields": f"{code},AREALAND,AREAWATER,NAME", "returnGeometry": "false", "f": "json"})
    with urllib.request.urlopen(urllib.request.Request(f"{TIGERWEB}/{layer}/query?{params}", headers=UA), timeout=120) as r:
        body = json.load(r)
    out = {}
    for feature in body.get("features", []):
        a = feature["attributes"]
        district = a.get(code) or ""
        if district and set(district) != {"Z"}:
            out[district] = (int(a.get("AREALAND") or 0), int(a.get("AREAWATER") or 0), a.get("NAME", ""))
    return out


def same(a, b, tolerance=0.01):
    # Total area, land and water together: between vintages the Census redraws
    # shorelines and moves ground between its land and water counts (a New York
    # senate district's land moved 2.8% from 2016 to 2018 with no redistricting),
    # which leaves the total nearly still. A redistricting moves whole precincts
    # and changes totals by far more than 1%.
    if not a or not b or set(a) != set(b):
        return False, "district ids differ" if a and b else "no file"
    moved = [d for d in a if abs((a[d][0] + a[d][1]) - (b[d][0] + b[d][1])) > tolerance * max(a[d][0] + a[d][1], 1)]
    return (not moved), (f"{len(moved)} districts changed area" if moved else "same")


def klarner_regimes():
    """(state, office) → {election year: the district plan in effect}, from Klarner's regime codes."""
    import csv
    import collections

    path = os.path.expanduser("~/Code/govblock-data/elections/klarner/127_slers_1967to2022.tab")
    counts = collections.defaultdict(collections.Counter)
    with open(path, encoding="utf-8", errors="ignore") as f:
        for x in csv.DictReader(f, delimiter="\t"):
            if x["etype"] != "g" or not x["year"].isdigit() or int(x["year"]) < 2010:
                continue
            counts[(x["sab"], "STATE SENATE" if x["sen"] == "1" else "STATE HOUSE", int(x["year"]))][x["regime"]] += 1
    out = collections.defaultdict(dict)
    for (state, office, year), c in counts.items():
        out[(state, office)][year] = c.most_common(1)[0][0]
    return out


def plan_at(regimes, year):
    """The plan in effect at an election year: that year's, or the latest election before it."""
    past = [y for y in regimes if y <= year]
    return regimes[max(past)] if past else None


def verify():
    result = {"rule": __doc__.split("The rule the map keeps")[1].strip(), "congress": {}, "legislatures": {}}
    regimes = klarner_regimes()
    for congress, (year, _) in CONGRESSES.items():
        result["congress"][str(year)] = {"congress": congress}
    for i, year in enumerate(SLD_YEARS):
        for fips, state in FIPS.items():
            for kind, office in (("sldu", "STATE SENATE"), ("sldl", "STATE HOUSE")):
                path = os.path.join(ROOT, "sld", str(year), f"tl_{year}_{fips}_{kind}.zip")
                if not os.path.exists(path):
                    continue
                before = areas(path, kind)
                if year == SLD_YEARS[-1]:
                    try:
                        after = current_areas(fips, kind)
                    except Exception as e:
                        after = {}
                    time.sleep(0.25)
                else:
                    nxt = SLD_YEARS[i + 1]
                    p2 = os.path.join(ROOT, "sld", str(nxt), f"tl_{nxt}_{fips}_{kind}.zip")
                    after = areas(p2, kind) if os.path.exists(p2) else {}
                ok, why = same(before, after)
                # The Census has missed redistrictings (Virginia's and North
                # Carolina's 2019 maps are in no vintage), so two matching
                # vintages are not enough alone. Klarner records the plan each
                # election was run under: the plan must not change before the
                # next election, and a plan that took effect at this election
                # must show in the Census files as a change from the last one.
                plans = regimes.get((state, office), {})
                if ok and year <= 2022:
                    here, later = plan_at(plans, year), plan_at(plans, year + 2)
                    if year not in plans:
                        ok, why = False, "no election in this chamber this year"
                    elif here != later and (year + 2) in plans:
                        ok, why = False, f"plan changed after this election ({here} to {later})"
                    elif here == str(year) and i > 0:
                        prev = SLD_YEARS[i - 1]
                        p0 = os.path.join(ROOT, "sld", str(prev), f"tl_{prev}_{fips}_{kind}.zip")
                        changed, _ = same(areas(p0, kind), before) if os.path.exists(p0) else (True, "")
                        if changed:
                            ok, why = False, f"plan {here} took effect but the Census files did not change"
                if ok and year == 2024 and state in {s for (s, _o) in regimes}:
                    last = plan_at(plans, 2022)
                    p0 = os.path.join(ROOT, "sld", "2022", f"tl_2022_{fips}_{kind}.zip")
                    unchanged, _ = same(areas(p0, kind), before) if os.path.exists(p0) else (False, "")
                    if not unchanged and last and int(last) >= 2022 and not os.path.exists(p0):
                        ok, why = False, "no 2022 file to compare"
                result.setdefault("checks", {})
                result["legislatures"].setdefault(str(year), {}).setdefault(state, {})[office] = {"verified": ok, "why": why, "districts": sorted(before)}
        drawn = sum(1 for s in result["legislatures"].get(str(year), {}).values() for o in s.values() if o["verified"])
        print(f"{year}: {drawn} chambers verified", flush=True)
    with open(os.path.join(ROOT, "verified.json"), "w") as f:
        json.dump(result, f)


if __name__ == "__main__":
    {"download": download, "verify": verify}[sys.argv[1]]()
