# Contributing

Thanks for helping. Three kinds of contribution:

## Data corrections and manual readings
Add or fix rows in `data/readings.csv` (`date,id,value,obs_date,status,source`). Every value needs a public source URL and the date the value was observed. Never estimate a value; leave it missing instead.

## New indicators
Open a "New indicator" issue first. A PR should add a row to `data/indicators.csv` (calm, stressed, weight, source), assign it to a composite in `data/groups.csv`, explain why it isn't redundant with existing members, and, if it has free history, extend the backtest.

## Weight, threshold or anchor changes
These change the forecast, so they need:
1. A written rationale (evidence, not preference).
2. A rerun: `python3 scripts/fetch_hist.py && python3 compute.py <date> --backtest`, with before/after level probabilities and the backtest episode table / L1 calibration in the PR description.
3. An entry in `CHANGELOG.md` with date, old → new values, and the reason.

Anchors are only re-set at a quarterly review, and `ANCHOR_DATE`/S0 must be documented when they are.

## Ground rules
- Don't commit secrets or API keys. `FRED_API_KEY` belongs in repository secrets only.
- Don't commit raw ICE BofA history or other data whose terms forbid redistribution; use a fetch script.
- CI runs compute and the backtest on every PR; it must pass.
- Python standard library only; the site is plain HTML/JS.
