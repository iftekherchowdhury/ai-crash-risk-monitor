#!/usr/bin/env python3
"""Download the FRED history used by the backtest into hist/ (not committed; FRED data keeps its own terms)."""
import os, subprocess, sys, time
def get(url):  # curl: FRED stalls some non-curl TLS clients
    return subprocess.run(['curl', '-fsSL', '--max-time', '90', url], check=True, capture_output=True).stdout
SERIES = ['NASDAQ100', 'VIXCLS', 'DGS10', 'DFII10', 'BAA10Y', 'STLFSI4', 'NFCI', 'NASDAQSOX']
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.makedirs(f'{root}/hist', exist_ok=True)
for s in SERIES:
    url = f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={s}&cosd=1990-01-01'
    for t in range(4):
        try:
            data = get(url)
            open(f'{root}/hist/{s}.csv', 'wb').write(data); print(s, len(data)); break
        except Exception as e:
            print(s, 'retry', e, file=sys.stderr); time.sleep(5 * (t + 1))
    else: sys.exit(f'failed {s}')
