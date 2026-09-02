import json, re, os, sys, urllib.parse, urllib.request

KEY = next(l.split("=",1)[1].strip().strip('"').strip("'")
           for l in open(os.path.expanduser("~/Code/livingston/.env.local"))
           if l.startswith("YOUTUBE_API_KEY="))
codes = json.load(open(os.path.expanduser("~/Code/govblock/apps/web/lib/data/congress/committee-codes.json")))["byCode"]

def get(url):
    return json.load(urllib.request.urlopen(url, timeout=25))

def words(s):
    return set(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())

STOP = {"and","on","the","of","committee","subcommittee","us","u","s"}

units = 0
found, rejected, missing = {}, [], []
for code, meta in sorted(codes.items()):
    if not code.endswith("00"):
        continue
    chamber = "House" if code[0] == "h" else "Senate"
    name = meta["name"]
    q = f"{chamber} Committee on {name}"
    url = ("https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5"
           f"&q={urllib.parse.quote(q)}&key={KEY}")
    try:
        d = get(url); units += 100
    except Exception as e:
        print("!", code, e); continue

    key_words = words(name) - STOP
    best = None
    for it in d.get("items", []):
        sn = it["snippet"]
        title, desc = sn.get("title",""), sn.get("channelTitle","") + " " + sn.get("description","")
        blob = words(title + " " + desc)
        # A committee channel names its chamber AND enough of its own subject.
        overlap = len(key_words & blob)
        has_chamber = chamber.lower() in blob or ("congress" in blob)
        says_committee = "committee" in blob
        score = overlap + (2 if has_chamber else 0) + (2 if says_committee else 0)
        cand = {"channelId": sn.get("channelId") or it["id"].get("channelId"),
                "title": title, "score": score, "overlap": overlap,
                "chamber": has_chamber, "committee": says_committee}
        if not best or score > best["score"]:
            best = cand
    # Accept only a channel that names its chamber, says committee, and shares
    # at least half its subject words. Anything less is somebody else.
    if best and best["chamber"] and best["committee"] and best["overlap"] >= max(1, len(key_words)//2):
        ch = get("https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet"
                 f"&id={best['channelId']}&key={KEY}"); units += 1
        item = (ch.get("items") or [None])[0]
        if item:
            found[code] = {"channelId": best["channelId"], "title": item["snippet"]["title"],
                           "uploads": item["contentDetails"]["relatedPlaylists"]["uploads"],
                           "chamber": chamber, "name": name}
            print(f"OK   {code:8} {name[:34]:36} -> {item['snippet']['title'][:44]}")
            continue
    if best:
        rejected.append((code, name, best["title"], best["score"]))
        print(f"skip {code:8} {name[:34]:36} -> rejected {best['title'][:34]!r} score={best['score']}")
    else:
        missing.append((code, name)); print(f"none {code:8} {name}")

print(f"\nquota spent: {units} units of 10000/day")
print(f"mapped {len(found)}, rejected {len(rejected)}, none {len(missing)}")
json.dump(found, open(sys.argv[1], "w"), indent=1)
