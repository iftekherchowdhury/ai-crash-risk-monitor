#!/usr/bin/env python3
"""Append one readings.csv row per indicator for close date D.
FRED-sourceable indicators are fetched (no key needed; FRED_API_KEY is used if set).
Everything else carries its last sourced value forward and is marked stale once past its freshness window.
Nothing is ever estimated or interpolated.  Usage: python3 scripts/fetch_fred.py YYYY-MM-DD"""
import csv, json, os, subprocess, sys, time, datetime as dt
D = sys.argv[1]; root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(root)
KEY = os.environ.get('FRED_API_KEY', '').strip()
NDX_RECORD = 31224.69  # Oct 6, 2026 record close; drawdown uses max(record, highest close since)
SIMPLE = {'vxn': 'VXNCLS', 'real10': 'DFII10', 'nom10': 'DGS10', 'vix': 'VIXCLS', 'wti': 'DCOILWTICO', 'hy': 'BAMLH0A0HYM2',
          'ccc': 'BAMLH0A3HYC', 'b_oas': 'BAMLH0A2HYB', 'ig': 'BAMLC0A0CM', 'stlfsi': 'STLFSI4', 'nfci': 'NFCI', 'anfci': 'ANFCI'}
WEEKLY = {'stlfsi', 'nfci', 'anfci'}
QUARTERLY = {'capex', 'bdc_disc', 'bdc_ytd', 'pc_redeem', 'ndx_pe', 'dc_cancel'}  # manual, slow-moving: ok until ~100 days old
start = (dt.date.fromisoformat(D) - dt.timedelta(days=40)).isoformat()

def get(url):  # curl: FRED stalls some non-curl TLS clients
    return subprocess.run(['curl', '-fsSL', '--max-time', '60', url], check=True, capture_output=True).stdout

def series(sid):
    if KEY:
        url = f'https://api.stlouisfed.org/fred/series/observations?series_id={sid}&api_key={KEY}&file_type=json&observation_start={start}&observation_end={D}'
    else:
        url = f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd={start}&coed={D}'
    for t in range(3):
        try:
            raw = get(url).decode()
            if KEY:
                return {o['date']: float(o['value']) for o in json.loads(raw)['observations'] if o['value'] not in ('.', '')}
            out = {}
            for r in list(csv.reader(raw.splitlines()))[1:]:
                if len(r) > 1 and r[1] not in ('', '.'): out[r[0]] = float(r[1])
            return out
        except Exception as e:
            print('fetch', sid, e, file=sys.stderr); time.sleep(5 * (t + 1))
    return {}

def bdays(a, b):
    a, b = dt.date.fromisoformat(a), dt.date.fromisoformat(b); n = 0
    while a < b:
        a += dt.timedelta(days=1); n += a.weekday() < 5
    return n

ind = list(csv.DictReader(open('data/indicators.csv')))
rd = list(csv.DictReader(open('data/readings.csv')))
last = {}
for r in sorted(rd, key=lambda r: r['date']):  # same-day manual rows are kept (re-runs don't erase hand entries)
    if r['date'] <= D and r['value'] != '': last[r['id']] = r
rows = []
def latest(s): k = max(s); return k, s[k]
fetched = {}
for i, sid in SIMPLE.items():
    s = series(sid)
    if s: fetched[i] = latest(s) + (f'https://fred.stlouisfed.org/series/{sid}',)
nd = series('NASDAQ100')
if nd:
    k, v = latest(nd); peak = max([NDX_RECORD] + [x for d, x in nd.items() if d >= '2026-10-06'])
    fetched['ndx'] = (k, round((v / peak - 1) * 100, 2), 'https://fred.stlouisfed.org/series/NASDAQ100')
iorb = series('IORB')
for i, sid in (('sofr_iorb', 'SOFR'), ('sofr99', 'SOFR99')):
    s = series(sid)
    common = sorted(set(s) & set(iorb))
    if common:
        k = common[-1]; fetched[i] = (k, round((s[k] - iorb[k]) * 100, 1), f'https://fred.stlouisfed.org/series/{sid}')
for i in ind:
    iid = i['id']
    o = last.get(iid)
    if iid in fetched and o and o['date'] == D and (o['obs_date'] or '') > fetched[iid][0]:
        del fetched[iid]  # a hand-entered same-day value is newer than FRED's; keep it
    if iid in fetched:
        od, v, src = fetched[iid]
        lim = 8 if iid in WEEKLY else 3
        st = 'ok' if bdays(od, D) <= lim else 'stale'
        rows.append([D, iid, v, od, st, src])
    elif iid in last:
        r = last[iid]; od = r['obs_date'] or r['date']
        age = (dt.date.fromisoformat(D) - dt.date.fromisoformat(od)).days
        st = 'ok' if (iid in QUARTERLY and age <= 100) or (iid not in QUARTERLY and bdays(od, D) <= 3) else 'stale'
        rows.append([D, iid, r['value'], od, st, r['source']])
    else:
        rows.append([D, iid, '', '', 'missing', ''])
for r in rows:  # never replace a sourced same-day value with a failed fetch
    if r[4] == 'missing' and r[1] in last: o = last[r[1]]; r[2:] = [o['value'], o['obs_date'], o['status'], o['source']]
keep = [r for r in rd if r['date'] != D]
with open('data/readings.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['date', 'id', 'value', 'obs_date', 'status', 'source'])
    for r in keep: w.writerow([r[k] for k in ['date', 'id', 'value', 'obs_date', 'status', 'source']])
    w.writerows(rows)
print(f'{D}: fetched {len(fetched)}, carried {sum(1 for r in rows if r[1] not in fetched and r[4] != "missing")}, missing {sum(1 for r in rows if r[4] == "missing")}')
