
const LEVELS = [
  { l: 1, name: "Equity correction", e: [35, 70],
    trigger: "Nasdaq-100 closes at least 20% below its record close (31,224.69 on Oct 6, 2026, or any later record).",
    now: "Now 7.3% below the record; needs about 12.7% more.",
    implied: "Option-implied: VXN 28.7 as annual vol, driftless barrier hit gives about 61% (12 mo) / 77% (3 yr). Risk-neutral, and 30-day vol overstates a 1-year horizon." },
  { l: 2, name: "Capex bust", e: [8, 30],
    trigger: "At least two of Microsoft, Amazon, Alphabet and Meta guide next-year capex below the current year's.",
    now: "None has. Meta raised 2026 guidance on Oct 22.",
    implied: "No traded market prices this directly." },
  { l: 3, name: "Credit losses", e: [15, 35],
    trigger: "ICE BofA US HY OAS closes above 6.00%, or CoreWeave or another AI-infrastructure borrower with over $5bn of debt misses a payment, does a distressed exchange or files.",
    now: "HY OAS 3.40%. CoreWeave current on its debt; 5y CDS 1,145 bps.",
    implied: "CoreWeave CDS at 1,145 bps with 40% recovery implies about 17% default odds in 12 months and 44% in 3 years. Risk-neutral, so likely above real-world odds, and it covers only one of the triggers." },
  { l: 4, name: "Systemic event", e: [4, 10],
    trigger: "St. Louis Fed FSI (STLFSI4) at 2.0 or above, or a US bank with over $100bn of assets fails, or the Fed opens a new 13(3) emergency facility.",
    now: "STLFSI4 −0.63 (Oct 16). It was last above 2.0 in 2020; before that in 2001 and 2008-09.",
    implied: "No clean market price. STLFSI4 hit 2.0 in 3 of the 33 years since 1993." },
];
const H12 = "12 months = by Oct 23, 2027";
const H36 = "3 years = by Oct 23, 2029";
const GNAME: Record<string, string> = { price: "Price drawdowns", vol: "Implied volatility", rates: "Rates and Fed", valuation: "Valuation", oil: "Oil", capex: "Hyperscaler capex", buildout: "Data-center delays", nvda: "Nvidia", neocloud: "Neocloud equities", spreads: "Credit spreads (HY, CCC, B, IG)", coreweave: "CoreWeave (stock, bond, CDS)", bdc: "BDCs", gpu: "GPU rental prices", stress_idx: "Stress indexes (STLFSI, NFCI, ANFCI, MOVE)", banks: "Banks", funding: "Funding markets", privcredit: "Private credit" };
const EPISODES = [
  ["Dot-com bust", "Mar 2000", "0.21", "0.28", "0.35", "0.75 (Sep 2002)", "−82%", "Score rose into the peak from equity volatility and drawdowns. With change-based rate thresholds, calm 1997 no longer reads as stressed."],
  ["Global financial crisis", "Oct 2007", "0.05", "0.14", "0.28", "0.94 (Nov 2008)", "−54% from Oct 2007", "Modest lead: credit and stress indexes climbed from Aug 2007, a year before Lehman."],
  ["COVID crash", "Feb 2020", "0.10", "0.08", "0.39*", "0.81 (Mar 2020)", "−30% intramonth", "Missed. Exogenous shock; *Feb 28 month-end already includes the first week of the selloff."],
  ["2022 rate shock", "Nov 2021", "0.13", "0.06", "0.08", "0.56 (Sep 2022)", "−35%", "Missed. Score stayed low at the peak and rose only as the drawdown happened."],
];

type Ind = (typeof DATA.ind)[number];
const BT = DATA.bt as unknown as [string, number, number, number, number][];
const stress = (x: number, c: number, s: number): number => Math.max(0, Math.min(1, (x - c) / (s - c)));
const tone = (x: number): "success" | "warning" | "danger" => (x < 0.34 ? "success" : x < 0.67 ? "warning" : "danger");
const fmt = (v: number): string => (Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));
const last = DATA.history[DATA.history.length - 1];
const diff = (k: number, li: number, key: "p" | "q"): string => {
  const h = DATA.history;
  if (h.length <= k) return "n/a";
  const d = h[h.length - 1][key][li] - h[h.length - 1 - k][key][li];
  return (d >= 0 ? "+" : "") + d.toFixed(0) + " pp";
};
const lvlWeight = (g: (typeof DATA.groups)[number]): number => {
  const tot = DATA.groups.filter((x) => x.l === g.l).reduce((a, x) => a + x.w, 0);
  return g.w / tot;
};

function Spark({ values }: { values: number[] }) {
  const t = useGrokTheme();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v: number, i: number) => `${(i / (values.length - 1)) * 280},${56 - ((v - min) / (max - min || 1)) * 50}`).join(" ");
  return (
    <svg width="100%" viewBox="0 0 280 60" preserveAspectRatio="none" style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={t.dataviz.categorical[0]} strokeWidth={2} />
    </svg>
  );
}

export default function App() {
  const [lv, setLv] = useState<string>("all");
  const contrib = DATA.ind.filter((i: Ind) => i.v !== null).map((i: Ind) => ({ i, s: stress(i.v as number, i.c, i.s), ch: i.prev === null ? null : (i.v as number) - (i.prev as number) }));
  const firstDay = !contrib.some((x) => x.ch !== null);
  const moved = firstDay
    ? DATA.groups.filter((g) => g.sc !== null).map((g) => ({ g, x: (g.sc as number) * lvlWeight(g) })).sort((a, b) => b.x - a.x).slice(0, 8)
    : null;
  const movers = firstDay ? [] : contrib.filter((x) => x.ch !== null && x.ch !== 0).sort((a, b) => Math.abs((b.ch as number) / (b.i.s - b.i.c)) - Math.abs((a.ch as number) / (a.i.s - a.i.c))).slice(0, 8);
  const scored = DATA.ind.filter((i: Ind) => i.sc1);
  const shown = scored.filter((i: Ind) => lv === "all" || String(i.l) === lv);
  const ageD = (od: string) => Math.round((Date.parse(DATA.asOf + "T12:00:00Z") - Date.parse(od + "T12:00:00Z")) / 864e5);
  const counts = { ok: scored.filter((i: Ind) => i.st === "ok").length, stale: scored.filter((i: Ind) => i.st === "stale").length, missing: scored.filter((i: Ind) => i.st === "missing").length, auto: scored.filter((i: Ind) => i.mode === "auto").length };
  const cal = DATA.cal1 as Record<string, { hits: number; months: number }>;
  const calRows = ["low (<0.25)", "mid (0.25-0.45)", "high (>=0.45)"].filter((k) => cal[k]).map((k) => [k.replace("-", "–"), String(cal[k].months), String(cal[k].hits), `${Math.round((100 * cal[k].hits) / cal[k].months)}%`]);
  const btNow = BT[BT.length - 1];

  return (
    <Page title="AI crash risk monitor" width="full" summary={`Probabilities that four escalating AI-driven market breakdowns hit defined triggers, from ${scored.length} scored indicators (${counts.auto} automated) in ${DATA.groups.length} composites as of the ${DATA.asOf} close. ${counts.ok} current, ${counts.stale} stale, ${counts.missing} missing. Ranges are the model's sensitivity to its own assumptions, not confidence intervals. Not financial advice.`}>
      <Section heading="Risk levels" caption={`${H12}; ${H36}. Range = 10th–90th percentile across 4,000 perturbed versions of the model. Core = empirical hit rate from inputs with free history since 1997, no judgment anchors; the gap is what the AI-specific inputs and anchors add or subtract.`}>
        <Grid columns={4}>
          {LEVELS.map((L, li: number) => (
            <Section key={L.l} heading={`${L.l}. ${L.name}`}>
              <Properties items={[
                { label: "12 months", value: `${last.p[li]}% (${last.lo[li]}–${last.hi[li]}%)` },
                { label: "3 years", value: `${last.q[li]}% (${last.qlo[li]}–${last.qhi[li]}%)` },
                { label: "Core, backtested only", value: DATA.core[li] ? `${Math.round(DATA.core[li]!.p12)}% / ${Math.round(DATA.core[li]!.p36)}% (${DATA.core[li]!.hits12} of ${DATA.core[li]!.n12} months)` : "n/a, no history" },
                ...(DATA.core[li] ? [{ label: "Full minus core, 12 mo", value: `${last.p[li] - Math.round(DATA.core[li]!.p12) > 0 ? "+" : ""}${last.p[li] - Math.round(DATA.core[li]!.p12)} pp` }] : []),
                { label: "Stress score", value: last.s[li].toFixed(2) },
                { label: "7-day change", value: diff(5, li, "p") },
                { label: "30-day change", value: diff(21, li, "p") },
              ]} />
              <Text>{`Trigger: ${L.trigger}`}</Text>
              <Text>{L.now}</Text>
              <Spark values={DATA.spark[li]} />
              <Text>{`${DATA.sparkName[li]}, last 30 sessions.`}</Text>
            </Section>
          ))}
        </Grid>
      </Section>

      <Section heading={firstDay ? "Biggest stress contributors" : "What moved today"} caption={firstDay ? "First day of history: composites ranked by stress × share of their level. Day-over-day moves appear after the next update." : "Ranked by move as a share of each indicator's calm-to-stressed range"}>
        {firstDay && moved ? (
          <Rows rows={moved.map((m) => ({ title: GNAME[m.g.g] || m.g.g, detail: `Level ${m.g.l} · ${Math.round(lvlWeight(m.g) * 100)}% of level${m.g.one ? " (single company, capped at 20%)" : ""}`, status: { label: `stress ${Math.round((m.g.sc as number) * 100)}%`, tone: tone(m.g.sc as number) } }))} />
        ) : (
          <Rows rows={movers.map((x) => ({ title: x.i.n, detail: `Level ${x.i.l} · ${fmt(x.i.v as number)} ${x.i.u} (${(x.ch as number) >= 0 ? "+" : ""}${fmt(x.ch as number)})`, status: { label: `stress ${Math.round(x.s * 100)}%`, tone: tone(x.s) } }))} />
        )}
      </Section>

      <Section heading="Composites" caption="Correlated indicators are averaged into one composite so they count once. Single-company composites are capped at 20% of a level.">
        <Table
          columns={["Level", "Composite", "Share of level", "Stress", "Members"]}
          rows={DATA.groups.map((g) => [
            `L${g.l}`,
            GNAME[g.g] || g.g,
            `${Math.round(lvlWeight(g) * 100)}%`,
            g.sc === null ? <Status tone="neutral">no data</Status> : <Status tone={tone(g.sc)}>{`${Math.round(g.sc * 100)}%`}</Status>,
            scored.filter((i: Ind) => i.g === g.g).map((i: Ind) => i.id).join(", "),
          ])}
        />
      </Section>

      <Section heading="Indicators" actions={<Segmented options={[{ value: "all", label: "All" }, { value: "1", label: "L1" }, { value: "2", label: "L2" }, { value: "3", label: "L3" }, { value: "4", label: "L4" }]} value={lv} onChange={setLv} />}>
        <Table
          columns={["Indicator", "Lvl", "Composite", "Value", "As of", "Calm", "Stressed", "Weight in composite", "Status", "Feed"]}
          rows={shown.map((i: Ind) => {
            const s = i.v === null ? null : stress(i.v, i.c, i.s);
            return [
              i.n, String(i.l), GNAME[i.g] || i.g,
              i.v === null ? "missing" : `${fmt(i.v)} ${i.u}`,
              i.od || "-", fmt(i.c), fmt(i.s), String(i.w),
              s === null ? <Status tone="neutral">missing</Status> : i.st === "stale" ? <Status tone="neutral">{`stale · ${Math.round(s * 100)}%`}</Status> : <Status tone={tone(s)}>{s < 0.34 ? "calm" : s < 0.67 ? "elevated" : "stressed"}</Status>,
              i.mode === "auto" ? "auto (FRED)" : `manual · ${i.od ? ageD(i.od) + " days old" : "no value"}`,
            ];
          })}
        />
      </Section>

      <Section heading="Watchlist (not scored)" caption="Chronically missing: no reliable free, keyless source. Shown for transparency and excluded from every probability.">
        <Table columns={["Indicator", "Level"]} rows={DATA.ind.filter((i: Ind) => !i.sc1).map((i: Ind) => [i.n, `L${i.l}`])} />
      </Section>

      <Section heading="Backtest, 1997–2026" caption="Quarter-end core scores (backtested inputs only, live thresholds). 0 = calm, 1 = every component at its stressed threshold. Triggers use daily closes.">
        <LineChart
          points={BT.map((b) => ({ label: b[0].slice(0, 4), value: b[1] }))}
          labels={["Overall (L1, L3, L4 average)"]}
          lines={[{ label: "L1 equity", values: BT.map((b) => b[2]) }, { label: "L3 credit (Baa spread)", values: BT.map((b) => b[3]) }, { label: "L4 systemic", values: BT.map((b) => b[4]) }]}
          ceiling={1}
          floor={0}
        />
        <Table
          columns={["Episode", "Nasdaq peak", "12 mo before", "3 mo before", "At peak", "Max during", "Nasdaq-100 drop", "Read"]}
          rows={EPISODES}
        />
        <Text>{`The reduced model reads ${btNow[1].toFixed(2)} today (L1 ${btNow[2].toFixed(2)}, L3 ${btNow[3].toFixed(2)}, L4 ${btNow[4].toFixed(2)}), around the 45th percentile since 1997. Most of today's live stress comes from AI-specific indicators (CoreWeave, BDCs, neoclouds, private credit) that have no free history, so the backtest cannot validate them.`}</Text>
        <Table columns={["L1 core score", "Months", "Daily close 20%+ below Nasdaq-100 record within 12 mo", "Hit rate"]} rows={calRows} />
        <Text>{"Months already 20% or more below the prior record are excluded, which drops most of 2001–2016. Earlier versions checked month-end closes only and missed the 1998, 2018 and 2025 drawdowns; the unconditional rate is 47%. The price score uses a trailing 1-year high, so the 2000 bubble does not keep it pinned. Overlapping 12-month windows mean these come from only a handful of independent episodes, so treat the hit rates as rough."}</Text>
      </Section>

      <Section heading="Probability history">
        {DATA.history.length > 1 ? (
          <Grid columns={2}>
            <LineChart points={DATA.history.map((h) => ({ label: h.d, value: h.p[0] }))} labels={["Equity correction"]} lines={[1, 2, 3].map((k: number) => ({ label: LEVELS[k].name, values: DATA.history.map((h) => h.p[k]) }))} ceiling={100} floor={0} unit="%" />
            <LineChart points={DATA.history.map((h) => ({ label: h.d, value: h.q[0] }))} labels={["Equity correction"]} lines={[1, 2, 3].map((k: number) => ({ label: LEVELS[k].name, values: DATA.history.map((h) => h.q[k]) }))} ceiling={100} floor={0} unit="%" />
          </Grid>
        ) : (
          <ColumnSeries labels={LEVELS.map((L) => L.name)} series={[{ name: "Earlier 12-mo", values: LEVELS.map((L) => L.e[0]) }, { name: `12-mo, ${DATA.asOf}`, values: last.p }, { name: `3-yr, ${DATA.asOf}`, values: last.q }]} ceiling={100} unit="%" />
        )}
        {DATA.history.length === 1 ? <Text>{"Daily history starts Oct 23, 2026. This turns into a line chart for each horizon after the next update. Earlier estimates come from the original conversation and had no defined triggers."}</Text> : null}
      </Section>

      <Grid columns={2}>
        <Section heading="Events log">
          <Rows rows={DATA.events.map((e) => ({ lead: e.d.slice(5), title: e.t, meta: `L${e.l}` }))} />
        </Section>
        <Section heading="Upcoming releases">
          <MonthView month={DATA.asOf.slice(0, 7)} events={DATA.calendar.filter((c) => c.date.startsWith(DATA.asOf.slice(0, 7)))} today={DATA.asOf} />
          <MonthView month="2026-11" events={DATA.calendar.filter((c) => c.date.startsWith("2026-11"))} />
        </Section>
      </Grid>

      <Section heading="Method and limitations">
        <Section heading="Known weaknesses">
          <BulletList items={[
            "Missed COVID (2020) and the 2022 rate shock: no rise before either peak.",
            "Few episodes: about five independent 20% Nasdaq-100 drawdowns since 1997, with overlapping monthly windows.",
            "Lookahead bias: thresholds and weights were chosen in 2026 knowing how 2000, 2008, 2020 and 2022 played out.",
            "Ranges are sensitivity to assumptions, not calibrated confidence intervals.",
            "Anchor vs backtest: L1 was 55% against a 29% backtest rate. That check used month-end closes only; with daily closes the band's rate is 57% and the core model reads 70%. L1 raised to 60%.",
            "AI-specific inputs and Level 2 have no free history and cannot be backtested.",
            "Backtest proxies: Baa−10y ≥ 3.0% for HY OAS > 6%, and VIX for VXN.",
          ]} />
        </Section>
        <Properties items={[
          { label: "Indicator stress", value: "s = clamp((value − calm) / (stressed − calm), 0, 1). Thresholds are in the Indicators table." },
          { label: "Composite", value: "Weighted mean of the members that have data. Missing members drop out; stale values still count." },
          { label: "Level score", value: "S = Σ wᵍ·compositeᵍ / Σ wᵍ over composites with data. Single-company composites (Nvidia, CoreWeave) are capped at 20% of the level." },
          { label: "Probability (full)", value: "p = anchor + k·(S − S₀). Anchors are judgment probabilities set at the Oct 23, 2026 close, when S₀ was measured: L1 60/80, L2 10/32, L3 25/45, L4 6/13. k = 50 pp (12 mo) and 35 pp (3 yr) per unit of S. Clamps: 1–95% and p12–97%." },
          { label: "Probability (core)", value: "Only inputs with free history: Nasdaq-100 and SOX drawdowns, VIX, 1-year changes in 10y real and nominal yields, HY OAS (Baa−10y in the backtest), STLFSI4, NFCI. p = share of backtest months with a core score within ±0.10 of today's (at least 24) whose trigger fired, (hits + 0.5)/(n + 1)." },
          { label: "Rates", value: "Change-based: 1-year change in the 10y real yield (calm 0, stressed +1.25 pp) and nominal yield (calm 0, stressed +1.5 pp). Average 1997 L1 backtest score fell from 0.54 to 0.24." },
          { label: "Automation", value: "17 indicators update from FRED each weekday, including SOX (NASDAQSOX) and the Nasdaq Bank index (NASDAQBANK, replacing KBW). 15 are manual and show their age. 3 are on the watchlist." },
          { label: "Range", value: "4,000 draws: every weight × U(0.5, 1.5), every threshold shifted ±25% of its range, k × U(0.5, 1.5), anchor × U(0.75, 1.25). Shown as the 10th–90th percentile." },
          { label: "Anchor change", value: "L3 12-month cut from 30% to 25%: CoreWeave CDS implies about 17% risk-neutral (lower in the real world), HY OAS would have to widen 260 bp, and the backtest's credit proxy reads calm. L1 held at 55% on Oct 23, then raised to 60/80 on Oct 24: the corrected daily-close backtest gives 57% for mid scores and 78% for high, and the core model reads 70% (17 of 24 overlapping months from 2000–02 and 2008). Option-implied is about 61%, so 60% shrinks the core figure toward the market. L2 held (no market or historical check). L4 held, in line with the STLFSI base rate." },
        ]} />
        <Table columns={["Level", "Model 12 mo", "Market-implied or base rate"]} rows={LEVELS.map((L, li: number) => [`${L.l}. ${L.name}`, `${last.p[li]}% (${last.lo[li]}–${last.hi[li]}%)`, L.implied])} />
        <Callout tone="warning" lead="What this is and isn't.">{"A transparent, rules-based summary of hand-set judgments, updated daily from sourced data. It is not a statistically fitted forecast. Thresholds were chosen in 2026, knowing how 2000, 2008, 2020 and 2022 played out, so the backtest has lookahead bias and flatters the model. The backtest also swaps in Baa−10y for HY OAS (FRED offers only 3 years of ICE data), uses VIX for all years, and leaves out Level 2 and every AI-specific indicator because they have no free history. It gave no warning before COVID or 2022. The ranges are sensitivity to assumptions, not calibrated confidence intervals. Not financial advice: nothing here is a recommendation to buy or sell anything."}</Callout>
      </Section>

      <Section heading="Disclosures">
        <Text>{"The author holds no positions in CoreWeave (CRWV) or Nvidia (NVDA), including options, as of Oct 24, 2026. Not financial advice."}</Text>
      </Section>

      <Section heading="Sources">
        <LinkCards links={[
          { title: "FRED: HY, CCC, B, IG OAS; VXN, VIX, DFII10, DGS10, NASDAQ100, NASDAQSOX, NASDAQBANK, BAA10Y, SOFR, STLFSI4, NFCI", site: "fred.stlouisfed.org", href: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2" },
          { title: "St. Louis Fed Financial Stress Index (STLFSI4)", site: "fred.stlouisfed.org", href: "https://fred.stlouisfed.org/series/STLFSI4" },
          { title: "Moody's Baa minus 10y Treasury (backtest credit proxy)", site: "fred.stlouisfed.org", href: "https://fred.stlouisfed.org/series/BAA10Y" },
          { title: "Closing Look, Oct 23, 2026", site: "cappnotes.substack.com", href: "https://cappnotes.substack.com/p/closing-look-friday-october-23-2026" },
          { title: "10-year yield near 5%", site: "cnbc.com", href: "https://www.cnbc.com/2026/10/23/bonds-yields-us-treasurys.html" },
          { title: "SOX history and record", site: "historyofmarket.com", href: "https://historyofmarket.com/semi/semi-price/" },
          { title: "CoreWeave CDS and bond yields", site: "cnbc.com", href: "https://www.cnbc.com/2026/10/21/coreweaves-market-confidence-erodes-as-bond-yields-spike-stock-sinks.html" },
          { title: "CoreWeave bonds near 79 cents", site: "finance.yahoo.com", href: "https://finance.yahoo.com/markets/stocks/articles/coreweave-stock-fell-25-last-081349155.html" },
          { title: "Neocloud selloff, NextDC, Firmus", site: "gmt8press.com", href: "https://gmt8press.com/content/detail/443599" },
          { title: "NVDA price history", site: "stockanalysis.com", href: "https://stockanalysis.com/stocks/nvda/history/" },
          { title: "MOVE index", site: "finance.yahoo.com", href: "https://finance.yahoo.com/quote/%5EMOVE/history/" },
          { title: "Fed hike odds", site: "growbeansprout.com", href: "https://growbeansprout.com/tools/fedwatch" },
          { title: "Nasdaq-100 forward P/E, Oct 16", site: "nasdaq.com", href: "https://www.nasdaq.com/docs/global-indexes/global-markets-dashboard-oct-16-2026" },
          { title: "Hyperscaler capex above $700bn", site: "tmtfinance.com", href: "https://www.tmtfinance.com/intel/2026-hyperscaler-capex-tops-us700bn-analysis" },
          { title: "Meta negative free cash flow", site: "axios.com", href: "https://www.axios.com/2026/10/23/ai-meta-data-center-spending" },
          { title: "H100 rental index", site: "data.ornn.com", href: "https://data.ornn.com/markets/h100-sxm" },
          { title: "BDC discounts, 3Q 2026", site: "cefadvisors.com", href: "https://www.cefadvisors.com/Download/CEF%20Advisors%203Q%202026%20Article%20(PDF).pdf" },
          { title: "Non-traded BDC redemptions (Fitch)", site: "investmentnews.com", href: "https://www.investmentnews.com/alternatives/pace-of-investors-selling-nontraded-bdcs-slows-but-remains-significant-according-to-fitch/268574" },
        ]} />
      </Section>
    </Page>
  );
}
