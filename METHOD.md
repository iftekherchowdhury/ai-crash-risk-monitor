# Method

## Known weaknesses

Read these first.

- **Missed 2020 and 2022.** The score did not rise before the COVID crash or the 2022 rate shock.
- **Few episodes.** 1997–2026 has about five independent 20% Nasdaq-100 drawdowns. Every hit rate rests on a handful of events and on overlapping monthly windows.
- **Lookahead bias.** Thresholds and weights were chosen in 2026 with knowledge of 2000, 2008, 2020 and 2022, so the backtest flatters the model.
- **Uncalibrated ranges.** The ranges show sensitivity to assumptions, not statistical confidence.
- **Anchor vs backtest.** The L1 anchor was 55% while an earlier backtest showed a 29% hit rate for today's score band. That backtest checked only month-end closes, but the trigger is any daily close. With daily data the band's rate is about 57% (high band 78%), and the core model reads 70%. The anchor was raised to 60%; see CHANGELOG.
- **AI inputs cannot be backtested.** Capex, CoreWeave, neoclouds, GPU rental prices, BDCs and private credit have no free history. Level 2 has no core estimate.
- **Proxies.** The backtest uses Baa−10y ≥ 3.0% for HY OAS > 6%, and VIX for VXN.


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

`S0` is each level's score on 2026-10-23, the anchor date. Anchors (12 mo / 3 yr): L1 60/80 (55/75 until Oct 24, 2026), L2 10/32, L3 25/45, L4 6/13. They are judgment probabilities informed by market-implied odds (VXN barrier probability, CoreWeave CDS) and base rates (STLFSI4 ≥ 2.0 in 3 of 33 years).

### Core probability (backtested inputs only)
Next to each full probability the site shows a core probability, built only from indicators with free history back to 1997: `sox_dd`, `ndx`, `vix`, `real10_chg`, `nom10_chg`, `hy` (Baa−10y in the backtest, mapped as `hy = 3 + (baa − 1.8)·3/1.7`), `stlfsi` and `nfci`. Thresholds match the live model. Core p is the empirical share of backtest months, with a core score within ±0.10 of today's (and at least the 24 nearest months), whose trigger fired within the horizon: `(hits + 0.5)/(n + 1)`. Months already in the event are excluded. There are no judgment anchors. Triggers: L1 = a daily Nasdaq-100 close 20% below its record; L3 = Baa−10y ≥ 3.0%; L4 = STLFSI4 ≥ 2.0. L2 has no core estimate. "Full minus core" shows what the AI-specific inputs and the anchors add, or take away.

On 2026-10-23: L1 core 70% / 94% (17 of 24 neighbouring months, mostly 2000–02 and 2008, so heavily overlapping) vs full 60% / 80%; L3 core 14% / 49% vs full 25% / 45%; L4 core 10% / 40% vs full 6% / 13%.

## 5. Ranges
4,000 Monte Carlo draws (seed 42): each weight × U(0.5, 1.5); each threshold pair shifted by ±25% of its range; k × U(0.5, 1.5); anchors × U(0.75, 1.25). Reported as 10th–90th percentile. These are sensitivity ranges, not confidence intervals.

## 6. Backtest
Monthly from 1997 with FRED series NASDAQ100, NASDAQSOX, VIXCLS, DGS10, DFII10 (from 2003), BAA10Y, STLFSI4 (from 1994) and NFCI:
- L1: Nasdaq-100 drawdown from its trailing 252-session high, SOX drawdown (NASDAQSOX, from 2004), VIX, and 1-year changes in the 10y real and nominal yields.
- L3: Baa−10y as the HY spread proxy (calm 1.8, stressed 3.5), because FRED only serves 3 years of ICE BofA history.
- L4: STLFSI4, NFCI.
- Overall = mean of L1, L3, L4. L2 and AI-specific indicators have no free history and are omitted.
- L1 calibration: share of months by score bucket followed within 12 months by a daily close ≥20% below the Nasdaq-100 record (months already 20% down excluded). Earlier versions checked month-end closes only, which missed the 1998, 2018 and 2025 drawdowns. Current: low (<0.25) 48/117, mid 21/37, high 7/9. The unconditional rate is 76/163 (47%): 20% Nasdaq-100 drawdowns are common.

### Rates: change-based thresholds
Rate stress now uses 1-year changes (10y real: calm 0, stressed +1.25 pp; 10y nominal: calm 0, stressed +1.5 pp) instead of yield levels. Effect: the average 1997 L1 score fell from 0.54 to 0.24, so calm 1997 no longer reads as stressed. Oct 1997 (Asian crisis selloff) still peaks at 0.46. The trade-off is that 2023 reads higher (0.18 → 0.34) because yields jumped in 2022–23.

## 7. Data freshness
`scripts/fetch_fred.py` writes one row per indicator per day. FRED values are `ok` if the observation is within 3 business days (8 for weekly series). Non-FRED values carry forward with their original observation date and source and become `stale` after 3 business days (~100 days for quarterly items). Missing values are `missing` and drop out of their composite. No value is ever interpolated or estimated.

## 8. Limitations
Hand-set thresholds with hindsight (lookahead bias in the backtest); proxies in the backtest; no warning before COVID or 2022; few independent episodes, so hit rates are rough. Not financial advice.
