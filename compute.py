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
ANCHOR = {1: (60, 80), 2: (10, 32), 3: (25, 45), 4: (6, 13)}   # judgment anchors at ANCHOR_DATE
ANCHOR_DATE = "2026-10-23"
K12, K36 = 50.0, 35.0          # pp per unit change in level score (0-1)
COMPANY_CAP = 0.20             # max share of a level for any single-company group
N_MC, ANCHOR_UNC = 4000, 0.25  # Monte Carlo draws; +/-25% relative judgment uncertainty on anchors

ind_all = list(csv.DictReader(open('data/indicators.csv')))
ind = [i for i in ind_all if i.get('scored', '1') == '1']   # watchlist rows (scored=0) never affect probabilities
CORE = {i['id'] for i in ind if i.get('core') == '1'}        # indicators with free history, used by the backtest
grp = list(csv.DictReader(open('data/groups.csv')))
rd = list(csv.DictReader(open('data/readings.csv')))

def latest_as_of(day):
    out = {}
    for r in rd:
        if r['value'] != '' and r['date'] <= day: out[r['id']] = float(r['value'])
    return out

def stress(x, c, s): return max(0.0, min(1.0, (x - c) / (s - c)))

def level_scores(vals, wmul=None, tshift=None, only=None):
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
            mem = [i for i in ind if i['group'] == g['group'] and i['id'] in vals and (only is None or i['id'] in only)]
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

# ---------------- backtest (core inputs only, same thresholds as live) ----------------
BT_SERIES = ['NASDAQ100', 'NASDAQSOX', 'VIXCLS', 'DGS10', 'DFII10', 'BAA10Y', 'STLFSI4', 'NFCI']
BAA_EVENT = 3.0      # Baa-10y level used as the proxy for "HY OAS > 6%" (ICE history is not free)
if '--backtest' in sys.argv:
    import bisect, datetime as dt
    def load(s):
        d = {}
        for r in csv.reader(open(f'hist/{s}.csv')):
            if r[0][:1].isdigit() and len(r) > 1 and r[1] not in ('', '.'): d[r[0]] = float(r[1])
        return d
    ser = {s: load(s) for s in BT_SERIES}; keys = {s: sorted(ser[s]) for s in ser}
    def asof(s, d):
        i = bisect.bisect_right(keys[s], d)
        return ser[s][keys[s][i - 1]] if i else None
    def trail_dd(s):  # drawdown from trailing 252-session high, so old bubbles do not saturate the score
        from collections import deque
        x = ser[s]; ks = keys[s]; q = deque(); out = {}
        for k, d in enumerate(ks):
            while q and x[ks[q[-1]]] <= x[d]: q.pop()
            q.append(k)
            while q[0] <= k - 252: q.popleft()
            out[d] = (x[d] / x[ks[q[0]]] - 1) * 100
        return out
    ndd, sdd = trail_dd('NASDAQ100'), trail_dd('NASDAQSOX')
    nd = ser['NASDAQ100']; days = keys['NASDAQ100']; rec = {}; m = 0
    for d in days: m = max(m, nd[d]); rec[d] = (nd[d] / m - 1) * 100
    def yago(d): return (dt.date.fromisoformat(d) - dt.timedelta(days=365)).isoformat()
    months = sorted({d[:7] for d in days if d >= '1997-01'})
    me = {mo: max(x for x in days if x[:7] == mo) for mo in months}
    out = []
    for mo in months:
        d = me[mo]; v = {'ndx': ndd[d], 'vix': asof('VIXCLS', d)}
        if keys['NASDAQSOX'][0] <= d: v['sox_dd'] = sdd[keys['NASDAQSOX'][bisect.bisect_right(keys['NASDAQSOX'], d) - 1]]
        for i, s in (('nom10_chg', 'DGS10'), ('real10_chg', 'DFII10')):
            a, b = asof(s, d), asof(s, yago(d))
            if a is not None and b is not None and keys[s][0] <= yago(d): v[i] = a - b
        baa = asof('BAA10Y', d); v['hy'] = 3.0 + (baa - 1.8) * 3.0 / 1.7   # Baa-10y mapped onto the HY OAS calm/stressed scale
        v['stlfsi'] = asof('STLFSI4', d); v['nfci'] = asof('NFCI', d)
        v = {k: x for k, x in v.items() if x is not None}
        sc = level_scores(v, only=CORE)
        o = {'m': mo, 'l1': round(sc[1][0], 3), 'l3': round(sc[3][0], 3), 'l4': round(sc[4][0], 3), 'dd': round(rec[d], 1)}
        o['all'] = round((o['l1'] + o['l3'] + o['l4']) / 3, 3)
        out.append(o)
    # event flags: did the level's (proxy) trigger fire within h months after this month-end?  None = outcome not yet known
    ev = {1: lambda d: rec[d] <= -20, 3: lambda d: ser['BAA10Y'].get(d, 0) >= BAA_EVENT, 4: lambda d: ser['STLFSI4'].get(d, -9) >= 2.0}
    evdays = {L: sorted(set(d for s in (['NASDAQ100'] if L == 1 else ['BAA10Y'] if L == 3 else ['STLFSI4']) for d in keys[s] if ev[L](d))) for L in ev}
    state = {1: lambda o: o['dd'] <= -20, 3: lambda o: (asof('BAA10Y', me[o['m']]) or 0) >= BAA_EVENT, 4: lambda o: (asof('STLFSI4', me[o['m']]) or -9) >= 2.0}
    last = days[-1]
    for o in out:
        d = me[o['m']]
        for L in ev:
            o[f'in{L}'] = int(state[L](o))
            for h in (12, 36):
                end = (dt.date.fromisoformat(d) + dt.timedelta(days=int(h * 30.44))).isoformat()
                hit = bisect.bisect_right(evdays[L], end) > bisect.bisect_right(evdays[L], d)
                o[f'e{L}_{h}'] = int(hit) if (hit or end <= last) else None
    buckets = defaultdict(lambda: [0, 0])
    for o in out:
        if o['in1'] or o['e1_12'] is None: continue
        b = 'low (<0.25)' if o['l1'] < .25 else 'mid (0.25-0.45)' if o['l1'] < .45 else 'high (>=0.45)'
        buckets[b][0] += o['e1_12']; buckets[b][1] += 1
    json.dump({'series': out, 'l1_calibration': {b: {'hits': v[0], 'months': v[1]} for b, v in sorted(buckets.items())}, 'baa_event': BAA_EVENT}, open('data/backtest.json', 'w'))
    print('calibration', json.dumps(buckets))

def core_prob(bt, L, s, h, width=0.10, nmin=24):
    """Empirical frequency of the level's trigger within h months among backtest months whose core score was near s."""
    pool = [o for o in bt['series'] if not o.get(f'in{L}') and o.get(f'e{L}_{h}') is not None]
    near = [o for o in pool if abs(o[f'l{L}'] - s) <= width]
    if len(near) < nmin: near = sorted(pool, key=lambda o: abs(o[f'l{L}'] - s))[:nmin]
    hits = sum(o[f'e{L}_{h}'] for o in near)
    return round(100 * (hits + 0.5) / (len(near) + 1), 1), hits, len(near)

vals = latest_as_of(D); base = latest_as_of(ANCHOR_DATE)
nom = level_scores(vals); nom0 = level_scores(base)
coreS = level_scores(vals, only=CORE)
bt = json.load(open('data/backtest.json')) if os.path.exists('data/backtest.json') else None
core = {}
for L in (1, 3, 4):
    if bt and 'e1_12' in bt['series'][0]:
        s_ = coreS[L][0]; a, h1, n1 = core_prob(bt, L, s_, 12); b, h3, n3 = core_prob(bt, L, s_, 36)
        core[L] = {'score': round(s_, 3), 'p12': a, 'p36': max(a, b), 'hits12': h1, 'n12': n1, 'hits36': h3, 'n36': n3}
core[2] = None   # no free history for any Level 2 input
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

rows = [[D, L, round(P[L][0], 1), round(P[L][1], 1), bands[L][12][0], bands[L][12][1], bands[L][36][0], bands[L][36][1], round(S[L], 3), core[L]['p12'] if core.get(L) else '', core[L]['p36'] if core.get(L) else ''] for L in (1, 2, 3, 4)]
old = list(csv.reader(open('data/probabilities.csv')))
hdr = ['date', 'level', 'p12', 'p36', 'p12_lo', 'p12_hi', 'p36_lo', 'p36_hi', 'score', 'core_p12', 'core_p36']
keep = [r for r in old[1:] if r[0] != D]
keep = [r + [''] * (len(hdr) - len(r)) for r in keep]
csv.writer(open('data/probabilities.csv', 'w')).writerows([hdr] + sorted(keep + [[str(x) for x in r] for r in rows]))
json.dump({'date': D, 'scores': {L: round(S[L], 3) for L in S}, 'groups': {L: {g: round(v, 3) for g, v in nom[L][1].items()} for L in nom},
           'probs': {L: [round(P[L][0]), round(P[L][1])] for L in P}, 'bands': bands, 'core': core}, open('data/out.json', 'w'), indent=1)
for r in rows: print(r)

