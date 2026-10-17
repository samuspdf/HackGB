"""Pick the study facilities by on-site releases (EPA TRI).

Input:  data/raw/tri_2024_wi.csv  (TRI Basic Data File, Wisconsin, 2024)
Output (research/facility_lists/):
        all_facilities.txt         top 10 per city (30 names)
        facilities_<city>.txt      top 5 per city, with release details
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
YEAR = 2024
RAW = ROOT / "data" / "raw" / f"tri_{YEAR}_wi.csv"
OUT_DIR = ROOT / "research" / "facility_lists"
CITIES = {"GREEN BAY": "BROWN", "MANITOWOC": "MANITOWOC", "SHEBOYGAN": "SHEBOYGAN"}
SHORTLIST = 10
PER_CITY = 5
GRAMS_PER_POUND = 453.592

df = pd.read_csv(RAW, low_memory=False)
df.columns = [c.split(". ", 1)[1] if ". " in c else c for c in df.columns]
df = df[df["CITY"].isin(CITIES)]

release_cols = ["5.1 - FUGITIVE AIR", "5.2 - STACK AIR", "5.3 - WATER",
                "ON-SITE RELEASE TOTAL", "TOTAL RELEASES"]
grams = df["UNIT OF MEASURE"].eq("Grams")
df.loc[grams, release_cols] = df.loc[grams, release_cols] / GRAMS_PER_POUND

df["air"] = df["5.1 - FUGITIVE AIR"] + df["5.2 - STACK AIR"]
df["water"] = df["5.3 - WATER"]
df["land"] = (df["ON-SITE RELEASE TOTAL"] - df["air"] - df["water"]).clip(lower=0)
df["pbt"] = df["PBT"].eq("YES")
df["carcinogen"] = df["CARCINOGEN"].eq("YES")

keys = ["CITY", "TRIFD", "FACILITY NAME", "STREET ADDRESS", "ZIP",
        "INDUSTRY SECTOR", "LATITUDE", "LONGITUDE"]
fac = df.groupby(keys).agg(
    onsite=("ON-SITE RELEASE TOTAL", "sum"), air=("air", "sum"),
    water=("water", "sum"), land=("land", "sum"), total=("TOTAL RELEASES", "sum"),
    n_chem=("CHEMICAL", "nunique"), pbt=("pbt", "any"), carcinogen=("carcinogen", "any"),
).reset_index()
top_chems = (df.sort_values("ON-SITE RELEASE TOTAL", ascending=False)
               .groupby("TRIFD")["CHEMICAL"]
               .apply(lambda s: ", ".join(c.split(" (")[0] for c in s.head(3))))
fac["top_chems"] = fac["TRIFD"].map(top_chems)

header = [
    f"Source: EPA Toxics Release Inventory (TRI) Basic Data File, Wisconsin, reporting year {YEAR}",
    "        https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present",
    f"Method: top {PER_CITY} facilities per city (TRI 'CITY' field) ranked by total ON-SITE releases",
    "        (air + water + land at the facility). Ranking uses RAW POUNDS, not toxicity-weighted;",
    "        it will be re-checked once RSEI toxicity weights are loaded (spec rule 2.3).",
    "Note:   These are REPORTED releases, which are mostly legal under permit. They are not violations.",
    "",
]
for city in CITIES:
    sub = fac[fac["CITY"] == city].sort_values("onsite", ascending=False)
    title = f"Lakeshore Watch — {city.title()} Study Facilities"
    lines = [title, "=" * len(title), *header,
             f"{city.title()} ({CITIES[city].title()} County) — "
             f"{len(sub)} TRI facilities reported in {YEAR}",
             "-" * 60]
    for i, r in enumerate(sub.head(PER_CITY).to_dict("records"), 1):
        flags = [f for f, on in (("PBT chemical", r["pbt"]), ("carcinogen", r["carcinogen"])) if on]
        lines += [
            f"{i}. {r['FACILITY NAME'].title()}",
            f"   TRI ID: {r['TRIFD']} | Industry: {r['INDUSTRY SECTOR']}",
            f"   Address: {r['STREET ADDRESS'].title()}, {city.title()}, WI {r['ZIP']} | "
            f"Lat/Lon: {r['LATITUDE']:.5f}, {r['LONGITUDE']:.5f}",
            f"   On-site releases: {r['onsite']:,.0f} lb (air {r['air']:,.0f} | "
            f"water {r['water']:,.0f} | land {r['land']:,.0f})",
            f"   Total incl. off-site transfers: {r['total']:,.0f} lb | Chemicals reported: {r['n_chem']}",
            f"   Top chemicals: {r['top_chems']}",
            f"   Flags: {', '.join(flags) if flags else 'none'}",
            "",
        ]
    out = OUT_DIR / f"facilities_{city.lower().replace(' ', '_')}.txt"
    out.write_text("\n".join(lines))
    print(f"Wrote {out}")

title = "Lakeshore Watch — All Shortlisted Facilities"
lines = [title, "=" * len(title),
         f"Top {SHORTLIST} per city by on-site releases, EPA TRI {YEAR} (raw pounds).",
         f"The top {PER_CITY} in each city are the study facilities (marked *).", ""]
for city in CITIES:
    sub = fac[fac["CITY"] == city].sort_values("onsite", ascending=False).head(SHORTLIST)
    lines.append(f"{city.title()}")
    for i, r in enumerate(sub.to_dict("records"), 1):
        mark = "*" if i <= PER_CITY else " "
        lines.append(f" {mark}{i:>2}. {r['FACILITY NAME'].title()}  "
                     f"({r['onsite']:,.0f} lb on-site, TRI ID {r['TRIFD']})")
    lines.append("")
out = OUT_DIR / "all_facilities.txt"
out.write_text("\n".join(lines))
print(f"Wrote {out}")
