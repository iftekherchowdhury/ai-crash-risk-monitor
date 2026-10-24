# Changelog

All weight, threshold and anchor changes are recorded here with a rationale.

## 2026-10-24: round-2 review fixes
- **L1 anchor raised from 55/75 to 60/80.** Reason: the earlier calibration (29% hit rate for mid scores) checked month-end closes only, but the trigger is any daily close. The corrected backtest gives mid 21/37 (57%) and high 7/9 (78%). The new core model reads 70% (17 of 24 neighbouring months, but these cluster in 2000–02 and 2008 and overlap heavily). Option-implied odds are about 61%. 60% shrinks the core estimate toward the options market. L2, L3 and L4 anchors unchanged.
- **Core probability added.** Each level now shows an empirical, anchor-free probability from backtested inputs only, next to the full figure, with the gap.
- **Change-based rate thresholds.** `real10` and `nom10` (levels) replaced by `real10_chg` (calm 0, stressed +1.25 pp) and `nom10_chg` (calm 0, stressed +1.5 pp), the 1-year changes. Average 1997 L1 backtest score fell from 0.54 to 0.24, so 1997 no longer reads as false stress.
- **More automation.** SOX drawdown now comes from FRED NASDAQSOX. KBW (manual) replaced by the Nasdaq Bank index drawdown from FRED NASDAQBANK (`bank_dd`). 17 indicators automated, 15 manual (shown with their age).
- **Watchlist.** `ai_pe`, `b200` and `pc_gated` were chronically missing; they are no longer scored and are listed as a watchlist.
- Backtest: daily-close L1 trigger, SOX added, core-only scoring with live thresholds.
- Added Known weaknesses (top of METHOD and the site), a Disclosures placeholder, Maintainers wanted and a roadmap.
- Because the indicator set changed, S₀ was recomputed on the 2026-10-23 data, so L2–L4 still equal their anchors on that date.

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
