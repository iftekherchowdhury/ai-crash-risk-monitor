#!/usr/bin/env python3
"""Print the Page's DATA block (between // DATA-START and // DATA-END) from data/*. Run after compute.py.
Usage: python3 build_data.py D > data/page_data.js"""
import csv, json, sys, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = sys.argv[1]
ind = list(csv.DictReader(open('data/indicators.csv'))); grp = list(csv.DictReader(open('data/groups.csv')))
rd = list(csv.DictReader(open('data/readings.csv'))); out = json.load(open('data/out.json'))
dates = sorted({r['date'] for r in rd if r['date'] <= D}); prevD = dates[-2] if len(dates) > 1 else None
def get(day, i):
    x = [r for r in rd if r['date'] == day and r['id'] == i]; return x[-1] if x else None
I = []
for i in ind:
    r = get(D, i['id']); p = get(prevD, i['id']) if prevD else None
    num = lambda r: float(r['value']) if r and r['value'] != '' else None
    I.append({'id': i['id'], 'l': int(i['level']), 'g': i['group'], 'n': i['name'], 'u': i['unit'], 'c': float(i['calm']), 's': float(i['stressed']),
              'w': float(i['weight']), 'mode': i['mode'], 'sc1': i['scored'] == '1', 'core': i['core'] == '1', 'v': num(r), 'od': r['obs_date'] if r else '', 'st': r['status'] if r else 'missing', 'prev': num(p)})
G = [{'l': int(g['level']), 'g': g['group'], 'w': float(g['weight']), 'one': g['single_company'] == '1', 'note': g['note'],
      'sc': out['groups'][g['level']].get(g['group'])} for g in grp]
H = {}
for r in csv.DictReader(open('data/probabilities.csv')):
    h = H.setdefault(r['date'], {'d': r['date'][5:], 'p': [0]*4, 'q': [0]*4, 'lo': [0]*4, 'hi': [0]*4, 'qlo': [0]*4, 'qhi': [0]*4, 's': [0]*4})
    k = int(r['level']) - 1
    h['p'][k] = round(float(r['p12'])); h['q'][k] = round(float(r['p36'])); h['s'][k] = float(r['score'])
    h['lo'][k], h['hi'][k], h['qlo'][k], h['qhi'][k] = int(r['p12_lo']), int(r['p12_hi']), int(r['p36_lo']), int(r['p36_hi'])
ev = [{'d': r['date'], 'l': int(r['level']), 't': r['event']} for r in csv.DictReader(open('data/events.csv'))]
ev = sorted(ev, key=lambda e: e['d'], reverse=True)[:25]
cal = [{'date': r['date'], 'title': r['event'] + ('' if r['confirmed'] == 'yes' else ' (est.)')} for r in csv.DictReader(open('data/calendar.csv')) if r['date'] >= D]
sp = json.load(open('data/spark.json'))
bt = json.load(open('data/backtest.json')); s = bt['series']
q = [[o['m'], o['all'], o['l1'], o['l3'], o['l4']] for o in s if o['m'][5:] in ('03', '06', '09', '12')]
if q[-1][0] != s[-1]['m']: q.append([s[-1]['m'], s[-1]['all'], s[-1]['l1'], s[-1]['l3'], s[-1]['l4']])
data = {'asOf': D, 'history': [H[k] for k in sorted(H)], 'sparkName': sp['names'], 'spark': [v[-30:] for v in sp['values']],
        'groups': G, 'ind': I, 'events': ev, 'calendar': cal, 'bt': q, 'cal1': bt['l1_calibration'], 'core': [out['core'].get(str(k)) for k in (1, 2, 3, 4)]}
print('// DATA-START\nconst DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n// DATA-END')
