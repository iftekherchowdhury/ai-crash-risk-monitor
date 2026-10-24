# AI crash risk monitor

**Live dashboard:** https://iftekherchowdhury.github.io/ai-crash-risk-monitor/

An open, rules-based daily estimate of the probability of four escalating AI-driven market breakdowns, over 12 months and 3 years:

| Level | Event | Trigger (what counts as "it happened") |
|---|---|---|
| 1 | Equity correction | Nasdaq-100 closes ≥20% below its record close (31,224.69 on Oct 6, 2026, or any later record) |
| 2 | Capex bust | At least two of Microsoft, Amazon, Alphabet and Meta guide next-year capex below the current year's |
| 3 | Credit losses | ICE BofA US HY OAS closes above 6.00%, or an AI-infrastructure borrower with >$5bn debt (e.g. CoreWeave) misses a payment, does a distressed exchange or files |
| 4 | Systemic event | STLFSI4 ≥ 2.0, or a US bank with >$100bn assets fails, or the Fed opens a new 13(3) emergency facility |

Horizons roll with the as-of date: "12 months" means by the same date next year.

> **Not financial advice.** This is a transparent summary of hand-set judgments, not a fitted forecast and not a recommendation to buy or sell anything.

## Method (short)

1. Each of 35 indicators gets a stress score `s = clamp((x − calm)/(stressed − calm), 0, 1)` (`data/indicators.csv`).
2. Correlated indicators are averaged into 17 composites (`data/groups.csv`) so they count once. Single-company composites (Nvidia, CoreWeave) are capped at 20% of their level.
3. Level score `S` = weighted mean of composites. Probability `p = anchor + k·(S − S₀)`, with judgment anchors set at the Oct 23, 2026 close (L1 60/80, L2 10/32, L3 25/45, L4 6/13), k = 50 (12 mo) / 35 (3 yr).
4. Ranges are the 10th–90th percentile of 4,000 Monte Carlo draws over weights, thresholds, k and anchors.
5. A backtest from 1997 uses only free FRED history (reduced model: L1, L3 via Baa−10y proxy, L4). Rate stress is change-based (1-year change in 10y yields).
6. **Core probability:** beside each full probability the dashboard shows a core probability, an empirical hit rate from backtested inputs only, with no judgment. The gap shows what the AI-specific inputs and anchors add.

Full detail in [METHOD.md](METHOD.md).

## Limitations

See **Known weaknesses** at the top of [METHOD.md](METHOD.md). In short:

- Missed 2020 and 2022. Few episodes. Ranges are not calibrated.

- Thresholds and anchors are judgment, chosen in 2026 with hindsight of 2000/2008/2020/2022: the backtest has lookahead bias.
- The backtest omits Level 2 and all AI-specific indicators (no free history) and proxies HY OAS with Baa−10y.
- It gave no warning before COVID or 2022.
- Ranges measure sensitivity to assumptions, not calibrated confidence.
- 15 scored indicators have no free, keyless, ToS-clean source and are updated by hand. They carry forward with their age shown and are flagged **stale** once past their window. Nothing is ever estimated.

## What updates automatically

A GitHub Action (`.github/workflows/daily.yml`) runs on weekdays at 21:45 UTC (after the US close):

- Fetches 17 indicators from FRED (no API key needed): SOX drawdown (NASDAQSOX), VXN, VIX, 1-year change in 10y real and nominal yields, Nasdaq-100 drawdown, WTI, HY/CCC/B/IG OAS, STLFSI4, NFCI, ANFCI, Nasdaq Bank index drawdown (NASDAQBANK, replaces KBW), SOFR−IORB, SOFR99−IORB.
- Carries every other indicator forward and marks it `stale` once past its freshness window (3 business days; ~100 days for quarterly items like capex and BDC data).
- Runs `compute.py`, commits `data/`, and redeploys the site.

Optional: add a repository secret `FRED_API_KEY` (free from https://fredaccount.stlouisfed.org/apikeys) to use the FRED API instead of the public CSV download. Nothing else is needed.

| Status | Indicators |
|---|---|
| **Automated (17, FRED)** | sox_dd, vxn, real10_chg, nom10_chg, ndx, vix, wti, hy, ccc, b_oas, ig, stlfsi, nfci, anfci, bank_dd, sofr_iorb, sofr99 |
| **Manual (15)**, age shown on the site | hike (Fed odds), ndx_pe, capex, nvda_spx, nvda_dd, dc_cancel, neocloud, bdc_disc, bdc_ytd, crwv, crwv_bond, crwv_cds, h100, move, pc_redeem |
| **Watchlist, not scored (3)** | ai_pe (AI basket P/E), b200 (B200 rental), pc_gated (private-credit gating count). They were chronically missing. |

Manual items stay manual because no free, keyless source without a ToS problem works from GitHub Actions. Stock prices (NVDA, CRWV, BDCs) are behind keys or bot challenges (Stooq now serves a proof-of-work challenge, which we do not bypass). MOVE and KBW are licensed indexes. CDS, bond and GPU prices come from paid or ad-hoc sources. Update them by PR: add rows to `data/readings.csv` with a source URL.

## Run locally

```sh
python3 scripts/fetch_fred.py 2026-10-26     # append today's readings
python3 scripts/fetch_hist.py                # download FRED history for the backtest (into hist/, not committed)
python3 compute.py 2026-10-26 --backtest     # write data/probabilities.csv, out.json, backtest.json
python3 -m http.server -d . 8000             # then open http://localhost:8000/site/ after: cp -r data site/
```

Python 3.9+ standard library only.

## Files

- `data/indicators.csv`: indicators, thresholds, weights, sources · `data/groups.csv`: composites and weights
- `data/readings.csv`: every daily value with observation date, status and source
- `data/probabilities.csv`, `data/out.json`, `data/backtest.json`: outputs
- `data/events.csv`, `data/calendar.csv`: event log and release calendar
- `site/`: static dashboard · `canvas/`: source for the original Grok canvas version

## Disclosures

Author's positions disclosure: **pending**. A statement of any holdings related to the companies and markets tracked here will be added here. Not financial advice.

## Maintainers wanted

This is a one-person project. Help is welcome, especially:

- a free, keyless, ToS-clean daily source for any manual indicator (stock prices, MOVE, GPU rental prices, CDS)
- statistical review of the core model and the calibration method
- independent review of thresholds and anchors (open an issue with evidence)
- co-maintainers to review data PRs

## Roadmap

- [ ] Automate more manual indicators as clean sources appear; retire any that stay missing
- [ ] Out-of-sample tracking: log each day's probabilities and score them against outcomes (Brier score) as horizons expire
- [ ] Replace judgment anchors with a fitted model once enough out-of-sample data exists
- [ ] Longer backtest history (pre-1997) for L1 and L4
- [ ] Episode-level (non-overlapping) calibration and confidence intervals for core probabilities
- [ ] Author positions disclosure

## Contributing

Issues and PRs welcome: new indicators, data corrections, and challenges to weights or thresholds. Any weight, threshold or anchor change needs a written rationale and a rerun backtest, and goes in [CHANGELOG.md](CHANGELOG.md). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT for code and model parameters. Data sources keep their own terms; see [LICENSE](LICENSE).
