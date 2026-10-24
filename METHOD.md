# Method

## 1. Indicators
`data/indicators.csv` lists each indicator with a `calm` and a `stressed` value. Stress is linear between them and clamped:

    s = clamp((x − calm) / (stressed − calm), 0, 1)

`calm` may be above `stressed` (e.g. a drawdown of −5% calm, −35% stressed); the formula handles both directions.

## 2. Composites
Indicators that measure the same thing (e.g. HY, CCC, B and IG spreads) are grouped in `data/groups.csv` and averaged with their indicator weights, using only members that have a value. Stale values still count and are flagged on the dashboard. This keeps correlated series from being counted several times.

## 3. Level score and single-company cap
`S_L = Σ w_g · composite_g / Σ w_g` over composites with data. Composites flagged `single_company=1` (Nvidia, CoreWeave) are capped at 20% of the level's total weight, with the excess redistributed proportionally.

## 4. Probabilities
    p12 = clamp(anchor12 + 50 · (S − S0), 1, 95)
    p36 = clamp(anchor36 + 35 · (S − S0), p12, 97)

`S0` is each level's score on 2026-10-23, the anchor date. Anchors (12 mo / 3 yr): L1 55/75, L2 10/32, L3 25/45, L4 6/13. They are judgment probabilities informed by market-implied odds (VXN barrier probability, CoreWeave CDS) and base rates (STLFSI4 ≥ 2.0 in 3 of 33 years).

## 5. Ranges
4,000 Monte Carlo draws (seed 42): each weight × U(0.5, 1.5); each threshold pair shifted by ±25% of its range; k × U(0.5, 1.5); anchors × U(0.75, 1.25). Reported as 10th–90th percentile. These are sensitivity ranges, not confidence intervals.

## 6. Backtest
Monthly from 1997 with FRED series NASDAQ100, VIXCLS, DGS10, DFII10 (from 2003), BAA10Y, STLFSI4 (from 1994) and NFCI:
- L1: Nasdaq-100 drawdown from its trailing 252-session high, VIX, 10y yields.
- L3: Baa−10y as the HY spread proxy (calm 1.8, stressed 3.5), because FRED only serves 3 years of ICE BofA history.
- L4: STLFSI4, NFCI.
- Overall = mean of L1, L3, L4. L2 and AI-specific indicators have no free history and are omitted.
- L1 calibration: share of months by score bucket followed within 12 months by a ≥20% Nasdaq-100 drawdown from the prior record (months already 20% down excluded).

## 7. Data freshness
`scripts/fetch_fred.py` writes one row per indicator per day. FRED values are `ok` if the observation is within 3 business days (8 for weekly series). Non-FRED values carry forward with their original observation date and source and become `stale` after 3 business days (~100 days for quarterly items). Missing values are `missing` and drop out of their composite. No value is ever interpolated or estimated.

## 8. Limitations
Hand-set thresholds with hindsight (lookahead bias in the backtest); proxies in the backtest; no warning before COVID or 2022; level-based rate thresholds read hot whenever yields are high; few independent episodes, so hit rates are rough. Not financial advice.
