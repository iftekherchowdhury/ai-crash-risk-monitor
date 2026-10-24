# Changelog

All weight, threshold and anchor changes are recorded here with a rationale.

## 2026-10-24: open-source release
- Published repo, static dashboard, daily FRED workflow and PR CI.
- Raw FRED history is no longer stored; `scripts/fetch_hist.py` downloads it.

## 2026-10-23: hardening
- Added explicit triggers and rolling horizons for each level.
- Added Monte Carlo ranges (4,000 draws).
- Grouped correlated indicators into 17 composites; single-company composites capped at 20% of a level.
- Added 1997–present FRED backtest (reduced model) and L1 calibration.
- **Anchor change:** L3 12-month 30% → 25%. Rationale: CoreWeave CDS implies ~17% risk-neutral default odds (real-world lower), HY OAS would need to widen ~260 bp to trigger, and the backtest credit proxy reads calm. L1 held at 55% (option-implied ~61%, backtest mid-bucket hit rate ~29%); L2 and L4 held.

## 2026-10-23: initial version
- 35 indicators, four levels, anchors L1 55/75, L2 10/32, L3 30/45, L4 6/13.
