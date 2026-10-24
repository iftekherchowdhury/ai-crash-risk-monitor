#!/usr/bin/env python3
"""AI crash risk monitor model (v2: composites, bands, backtest).
Usage:
  python3 compute.py D            recompute for close date D (YYYY-MM-DD), write probabilities.csv rows and data/out.json
  python3 compute.py D --backtest also rebuild data/backtest.json from hist/*.csv (FRED downloads)
"""
import csv, json, sys, random, math, os
from collections import defaultdict
D = sys.argv[1]
H = os.path.dirname(os.path.abspath(__file__)); os.chdir(H)
ANCHOR = {1: (55, 75), 2: (10, 32), 3: (25, 45), 4: (6, 13)}   # judgment anchors at ANCHOR_DATE
ANCHOR_DATE = "2026-10-23"
K12, K36 = 50.0, 35.0          # pp per unit change in level score (0-1)
COMPANY_CAP = 0.20             # max share of a level for any single-company group
N_MC, ANCHOR_UNC = 4000, 0.25  # Monte Carlo draws; +/-25% relative judgment uncertainty on anchors

ind = list(csv.DictReader(open('data/indicators.csv')))
grp = list(csv.DictReader(open('data/groups.csv')))
rd = list(csv.DictReader(open('data/readings.csv')))

def latest_as_of(day):
    out = {}
    for r in rd:
        if r['value'] != '' and r['date'] <= day: out[r['id']] = float(r['value'])
    return out

def stress(x, c, s): return max(0.0, min(1.0, (x - c) / (s - c)))

def level_scores(vals, wmul=None, tshift=None):
    """Level score = weighted mean over groups of (weighted mean member stress). Missing members/groups drop out."""
    wmul = wmul or {}; tshift = tshift or {}
    res = {}
    for L in (1, 2, 3, 4):
        gs = [g for g in grp if int(g['level']) == L]
        num = den = 0.0; detail = {}
        gw = {g['group']: float(g['weight']) * wmul.get(g['group'], 1) for g in gs}
        tot = sum(gw.values())
        for g in gs:  # enforce single-company cap
            if g['single_company'] == '1': gw[g['group']] = min(gw[g['group']], COMPANY_CAP * tot)
        for g in gs:
            mem = [i for i in ind if i['group'] == g['group'] and i['id'] in vals]
            if not mem: continue
            n = d = 0.0
            for i in mem:
                c, s = float(i['calm']), float(i['stressed']); sh = tshift.get(i['id'], 0) * (s - c)
                w = float(i['weight']) * wmul.get(i['id'], 1)
                n += w * stress(vals[i['id']], c + sh, s + sh); d += w
            detail[g['group']] = n / d
            num += gw[g['group']] * detail[g['group']]; den += gw[g['group']]
        res[L] = (num / den if den else 0.0, detail)
    return res

def probs(S, S0, anchor_mul=(1, 1, 1, 1), k=1.0):
    out = {}
    for L in (1, 2, 3, 4):
        a12, a36 = ANCHOR[L][0] * anchor_mul[L - 1], ANCHOR[L][1] * anchor_mul[L - 1]
        p12 = max(1, min(95, a12 + k * K12 * (S[L] - S0[L])))
        p36 = max(p12, min(97, a36 + k * K36 * (S[L] - S0[L])))
        out[L] = (p12, p36)
    return out

vals = latest_as_of(D); base = latest_as_of(ANCHOR_DATE)
nom = level_scores(vals); nom0 = level_scores(base)
S = {L: nom[L][0] for L in nom}; S0 = {L: nom0[L][0] for L in nom0}
P = probs(S, S0)
random.seed(42); draws = defaultdict(list)
for _ in range(N_MC):
    wm = {g['group']: random.uniform(0.5, 1.5) for g in grp}; wm.update({i['id']: random.uniform(0.5, 1.5) for i in ind})
    ts = {i['id']: random.uniform(-0.25, 0.25) for i in ind}
    Sp = {L: v[0] for L, v in level_scores(vals, wm, ts).items()}
    am = tuple(random.uniform(1 - ANCHOR_UNC, 1 + ANCHOR_UNC) for _ in range(4))
    # anchor calibration is fixed to the nominal score at the anchor date, so perturbed parameters move today's probability
    pp = probs(Sp, S0, am, random.uniform(0.5, 1.5))
    for L in pp: draws[(L, 12)].append(pp[L][0]); draws[(L, 36)].append(pp[L][1])
def pct(a, q): a = sorted(a); return a[int(q * (len(a) - 1))]
bands = {L: {h: (round(pct(draws[(L, h)], .1)), round(pct(draws[(L, h)], .9))) for h in (12, 36)} for L in (1, 2, 3, 4)}

rows = [[D, L, round(P[L][0], 1), round(P[L][1], 1), bands[L][12][0], bands[L][12][1], bands[L][36][0], bands[L][36][1], round(S[L], 3)] for L in (1, 2, 3, 4)]
old = list(csv.reader(open('data/probabilities.csv')))
hdr = ['date', 'level', 'p12', 'p36', 'p12_lo', 'p12_hi', 'p36_lo', 'p36_hi', 'score']
keep = [r for r in old[1:] if r[0] != D]
keep = [r + [''] * (len(hdr) - len(r)) for r in keep]
csv.writer(open('data/probabilities.csv', 'w')).writerows([hdr] + sorted(keep + [[str(x) for x in r] for r in rows]))
json.dump({'date': D, 'scores': {L: round(S[L], 3) for L in S}, 'groups': {L: {g: round(v, 3) for g, v in nom[L][1].items()} for L in nom},
           'probs': {L: [round(P[L][0]), round(P[L][1])] for L in P}, 'bands': bands}, open('data/out.json', 'w'), indent=1)
for r in rows: print(r)

# ---------------- backtest ----------------
if '--backtest' in sys.argv:
    def load(s):
        d = {}
        for r in csv.reader(open(f'hist/{s}.csv')):
            if r[0][:1].isdigit() and r[1] not in ('', '.'): d[r[0]] = float(r[1])
        return d
    ser = {s: load(s) for s in ['NASDAQ100', 'VIXCLS', 'DGS10', 'DFII10', 'BAA10Y', 'STLFSI4', 'NFCI']}
    nd = ser['NASDAQ100']; days = sorted(nd); runmax = {}; m = 0
    for d in days: m = max(m, nd[d]); runmax[d] = m
    from collections import deque
    roll = {}; q = deque()
    for k, d in enumerate(days):  # trailing 252-session max, so old bubbles do not saturate the price score
        while q and nd[days[q[-1]]] <= nd[d]: q.pop()
        q.append(k)
        while q[0] <= k - 252: q.popleft()
        roll[d] = nd[days[q[0]]]
    def asof(s, d):
        ks = [k for k in ser[s] if k <= d]
        return ser[s][max(ks)] if ks else None
    months = sorted({d[:7] for d in days if d >= '1997-01'})
    out = []
    for mo in months:
        d = max(x for x in days if x[:7] == mo)
        dd = (nd[d] / runmax[d] - 1) * 100
        dd1 = (nd[d] / roll[d] - 1) * 100
        L1 = [(0.30, stress(dd1, -3, -20)), (0.20, stress(asof('VIXCLS', d), 15, 35))]
        rates = [stress(asof('DGS10', d), 4.0, 5.5)] + ([stress(asof('DFII10', d), 1.5, 3.0)] if asof('DFII10', d) is not None else [])
        L1.append((0.25, sum(rates) / len(rates)))
        s1 = sum(w * v for w, v in L1) / sum(w for w, _ in L1)
        s3 = stress(asof('BAA10Y', d), 1.8, 3.5)  # proxy for HY/CCC spread composite (ICE HY history not free beyond 3y)
        st = [stress(asof('STLFSI4', d), -0.5, 1.5)] if asof('STLFSI4', d) is not None else []
        st.append(stress(asof('NFCI', d), -0.5, 0.5))
        s4 = sum(st) / len(st)
        out.append({'m': mo, 'l1': round(s1, 3), 'l3': round(s3, 3), 'l4': round(s4, 3), 'all': round((s1 + s3 + s4) / 3, 3), 'dd': round(dd, 1)})
    # empirical L1 check: next-12m new >=20% NDX drawdown, conditional on not already in one
    idx = {o['m']: i for i, o in enumerate(out)}
    buckets = defaultdict(lambda: [0, 0])
    for i, o in enumerate(out[:-12]):
        if o['dd'] <= -20: continue
        hit = any(x['dd'] <= -20 for x in out[i + 1:i + 13])
        b = 'low (<0.25)' if o['l1'] < .25 else 'mid (0.25-0.45)' if o['l1'] < .45 else 'high (>=0.45)'
        buckets[b][0] += hit; buckets[b][1] += 1
    json.dump({'series': out, 'l1_calibration': {b: {'hits': v[0], 'months': v[1]} for b, v in buckets.items()}}, open('data/backtest.json', 'w'))
    print(json.dumps({b: v for b, v in buckets.items()}))
