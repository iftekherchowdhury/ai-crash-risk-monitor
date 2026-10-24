// AI crash risk monitor: static dashboard. Reads data/*.json and data/*.csv; no sign-in, no build step.
const LEVELS = [
  { l: 1, name: "Equity correction", trigger: "Nasdaq-100 closes at least 20% below its record close (31,224.69 on Oct 6, 2026, or any later record).",
    implied: "Option-implied: VXN as annual vol, driftless barrier hit gave about 61% (12 mo) / 77% (3 yr) on Oct 23, 2026. Risk-neutral, and 30-day vol overstates a 1-year horizon." },
  { l: 2, name: "Capex bust", trigger: "At least two of Microsoft, Amazon, Alphabet and Meta guide next-year capex below the current year's.",
    implied: "No traded market prices this directly.", now: "Tracked by hand from earnings calls; see the capex indicator." },
  { l: 3, name: "Credit losses", trigger: "ICE BofA US HY OAS closes above 6.00%, or CoreWeave or another AI-infrastructure borrower with over $5bn of debt misses a payment, does a distressed exchange or files.",
    implied: "CoreWeave CDS at 1,145 bps (Oct 21, 2026) with 40% recovery implied about 17% default odds in 12 months and 44% in 3 years. Risk-neutral." },
  { l: 4, name: "Systemic event", trigger: "St. Louis Fed FSI (STLFSI4) at 2.0 or above, or a US bank with over $100bn of assets fails, or the Fed opens a new 13(3) emergency facility.",
    implied: "No clean market price. STLFSI4 hit 2.0 in 3 of the 33 years since 1993." },
];
const GNAME = { price: "Price drawdowns", vol: "Implied volatility", rates: "Rates and Fed", valuation: "Valuation", oil: "Oil", capex: "Hyperscaler capex", buildout: "Data-center delays", nvda: "Nvidia", neocloud: "Neocloud equities", spreads: "Credit spreads (HY, CCC, B, IG)", coreweave: "CoreWeave (stock, bond, CDS)", bdc: "BDCs", gpu: "GPU rental prices", stress_idx: "Stress indexes (STLFSI, NFCI, ANFCI, MOVE)", banks: "Banks", funding: "Funding markets", privcredit: "Private credit" };
const EPISODES = [["Dot-com bust", "2000-03", "2002-10"], ["Global financial crisis", "2007-10", "2009-03"], ["COVID crash", "2020-02", "2020-04"], ["2022 rate shock", "2021-11", "2022-12"]];
const EPNOTE = { "Dot-com bust": "Score rose into the peak from equity volatility and drawdowns. With change-based rate thresholds, calm 1997 no longer reads as stressed.", "Global financial crisis": "Modest lead: credit and stress indexes climbed from Aug 2007, a year before Lehman.", "COVID crash": "Missed. Exogenous shock; the Feb month-end already includes the first week of the selloff.", "2022 rate shock": "Missed. Score stayed low at the peak and rose only as the drawdown happened." };
const WEAK = [
  "It missed COVID (2020) and the 2022 rate shock: no rise in the score before either peak.",
  "Few independent episodes. 1997–2026 holds about five 20% Nasdaq-100 drawdowns, so every hit rate here rests on a handful of events and overlapping monthly windows.",
  "Lookahead bias. Thresholds and weights were chosen in 2026 with full knowledge of 2000, 2008, 2020 and 2022, so the backtest flatters the model.",
  "Ranges are not calibrated. They show sensitivity to assumptions (weights, thresholds, k, anchors), not a statistical confidence interval.",
  "Anchor vs backtest. The L1 anchor was 55% while an earlier month-end-only backtest showed a 29% hit rate for today's score band. That check undercounted: the trigger is a daily close, and with daily data the band's rate is about 57%. The core model now reads 70% and the anchor was raised to 60% (see CHANGELOG).",
  "AI-specific inputs (capex, CoreWeave, neoclouds, GPU prices, BDCs, private credit) have no free history, so they cannot be backtested at all. Level 2 has no core estimate.",
  "Proxies. The backtest uses Baa−10y (≥3.0%) for the HY OAS > 6% trigger and VIX for VXN.",
];
const DISCLOSURE = "Author's positions disclosure: pending. A statement of any holdings related to the companies and markets tracked here will be added before this section is considered complete.";
const METHOD = [
  ["Indicator stress", "s = clamp((value − calm) / (stressed − calm), 0, 1). Thresholds are in the Indicators table and data/indicators.csv."],
  ["Composite", "Weighted mean of the members that have data. Missing members drop out; stale values still count (and are flagged)."],
  ["Level score", "S = Σ wᵍ·compositeᵍ / Σ wᵍ over composites with data. Single-company composites (Nvidia, CoreWeave) are capped at 20% of the level."],
  ["Probability (full)", "p = anchor + k·(S − S₀). Anchors are judgment probabilities set at the Oct 23, 2026 close, when S₀ was measured: L1 60/80 (raised from 55/75 on Oct 24), L2 10/32, L3 25/45, L4 6/13. k = 50 pp (12 mo) and 35 pp (3 yr) per unit of S. Clamps: 1–95% and p12–97%."],
  ["Probability (core)", "Only indicators with free history (Nasdaq-100 and SOX drawdowns, VIX, 1-year changes in 10y real and nominal yields, HY OAS via Baa−10y, STLFSI4, NFCI). Core p = share of backtest months with a core score within ±0.10 of today's (at least 24 months) whose level trigger fired within the horizon, with a half-count prior. No judgment anchor. Level 2 has no core estimate."],
  ["Rates", "Rate stress uses 1-year changes, not levels: 10y real yield calm 0, stressed +1.25 pp; 10y nominal calm 0, stressed +1.5 pp. Level thresholds read hot whenever yields were simply high (1997–2000)."],
  ["Watchlist", "Indicators with no reliable free source (AI basket P/E, B200 rental, private-credit gating count) are shown but not scored."],
  ["Range", "4,000 Monte Carlo draws: every weight × U(0.5, 1.5), every threshold shifted ±25% of its range, k × U(0.5, 1.5), anchor × U(0.75, 1.25). Shown as the 10th–90th percentile."],
  ["Anchor change (Oct 23, 2026)", "L3 12-month cut from 30% to 25%: CoreWeave CDS implies about 17% risk-neutral, HY OAS would have to widen 260 bp, and the backtest's credit proxy reads calm. L1 held at 55%. L2 and L4 held."],
  ["Anchor change (Oct 24, 2026)", "L1 raised from 55/75 to 60/80. A corrected backtest (daily-close trigger instead of month-end) gives a 57% 12-month hit rate for mid scores and 78% for high scores; the core model reads 70% (17 of 24 neighbouring months, mostly from 2000–02 and 2008, so heavily overlapping). Option-implied odds are about 61%. 60% shrinks the core figure toward the options market."],
  ["Daily data", "A weekday GitHub Action fetches 17 indicators from FRED (including SOX and the Nasdaq Bank index). Manual indicators carry their last sourced value forward with its age shown, and are marked stale once past their freshness window. Nothing is estimated."],
];
const LIMITS = "A transparent, rules-based summary of hand-set judgments, updated daily from sourced data. It is not a statistically fitted forecast. Thresholds were chosen in 2026, knowing how 2000, 2008, 2020 and 2022 played out, so the backtest has lookahead bias and flatters the model. The backtest swaps in Baa−10y for HY OAS (FRED offers only 3 years of ICE data), uses VIX for all years, and leaves out Level 2 and every AI-specific indicator because they have no free history. It gave no warning before COVID or 2022. The ranges are sensitivity to assumptions, not calibrated confidence intervals. Not financial advice: nothing here is a recommendation to buy or sell anything.";
const EXTRA_SOURCES = ["https://fred.stlouisfed.org/series/BAA10Y", "https://fred.stlouisfed.org/series/IORB", "https://cappnotes.substack.com/p/closing-look-friday-october-23-2026", "https://www.axios.com/2026/10/23/ai-meta-data-center-spending"];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tone = (x) => (x < 0.34 ? "ok" : x < 0.67 ? "warn" : "bad");
const stress = (x, c, s) => Math.max(0, Math.min(1, (x - c) / (s - c)));
const fmt = (v) => (Math.abs(v) >= 1000 ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));
const link = (u, t) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t || new URL(u).hostname.replace(/^www\./, ""))}</a>` : "");
function csv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift(); return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
const table = (cols, rows) => `<div class="wrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
function lineChart(series, opts) {
  const W = 1000, H = opts.h || 260, P = 36; const xs = series[0].pts.length; if (!xs) return "";
  const all = series.flatMap((s) => s.pts.map((p) => p[1])).filter((v) => v != null);
  const lo = opts.min ?? Math.min(...all), hi = opts.max ?? Math.max(...all);
  const X = (i) => P + (i / Math.max(1, xs - 1)) * (W - 2 * P), Y = (v) => H - P + 10 - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = lo + (k / 4) * (hi - lo); g += `<line x1="${P}" x2="${W - P}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/><text x="2" y="${Y(v) + 4}">${opts.yfmt ? opts.yfmt(v) : fmt(v)}</text>`; }
  const step = Math.max(1, Math.ceil(xs / 10));
  series[0].pts.forEach((p, i) => { if (i % step === 0) g += `<text x="${X(i)}" y="${H - 4}" text-anchor="middle">${esc(p[0])}</text>`; });
  for (const s of series) {
    let d = "", pen = false;
    s.pts.forEach((p, i) => { if (p[1] == null) { pen = false; return; } d += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`; pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2}" ${s.dash ? 'stroke-dasharray="4 3"' : ""}/>`;
    if (xs === 1 && s.pts[0][1] != null) g += `<circle cx="${X(0)}" cy="${Y(s.pts[0][1])}" r="4" fill="${s.color}"/>`;
  }
  const leg = `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  return `${leg}<svg viewBox="0 0 ${W} ${H}" width="100%" style="color:var(--fg)">${g}</svg>`;
}
const C = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
const addYears = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCFullYear(x.getUTCFullYear() + n); return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };

async function main() {
  const get = (p) => fetch(p, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(p); return r; });
  const [out, bt, probs, inds, groups, reads, events, cal] = await Promise.all([
    get("data/out.json").then((r) => r.json()), get("data/backtest.json").then((r) => r.json()).catch(() => null),
    ...["probabilities", "indicators", "groups", "readings", "events", "calendar"].map((n) => get(`data/${n}.csv`).then((r) => r.text()).then(csv)),
  ]);
  const D = out.date, dates = [...new Set(reads.map((r) => r.date))].sort();
  const prevD = dates.filter((d) => d < D).pop();
  const val = (day, id) => { const r = reads.find((x) => x.date === day && x.id === id); return r && r.value !== "" ? r : null; };
  const stale = reads.filter((r) => r.date === D && r.status !== "ok");
  $("summary").innerHTML = `As of the ${esc(D)} US close. Four escalating AI-driven breakdowns, scored daily from ${inds.length} sourced indicators. ${stale.length ? `<span class="warn">${stale.length} indicator(s) stale or missing.</span>` : "All indicators fresh."} Not financial advice.`;
  $("horizon").textContent = `12 months = by ${addYears(D, 1)} · 3 years = by ${addYears(D, 3)}. Ranges are 10th–90th percentile of 4,000 assumption draws.`;
  const nowText = {
    1: () => { const r = val(D, "ndx"); return r ? `Now ${Math.abs(+r.value).toFixed(1)}% below the record (obs ${r.obs_date}); needs about ${Math.max(0, 20 + +r.value).toFixed(1)}% more.` : "Nasdaq-100 reading missing."; },
    2: () => LEVELS[1].now,
    3: () => { const r = val(D, "hy"), c = val(D, "crwv_cds"); return `${r ? `HY OAS ${(+r.value).toFixed(2)}% (obs ${r.obs_date}).` : "HY OAS missing."}${c ? ` CoreWeave 5y CDS ${fmt(+c.value)} bps (obs ${c.obs_date}${c.status !== "ok" ? ", stale" : ""}).` : ""}`; },
    4: () => { const r = val(D, "stlfsi"); return r ? `STLFSI4 ${(+r.value).toFixed(2)} (week of ${r.obs_date}). Last above 2.0 in 2020; before that 2001 and 2008-09.` : "STLFSI4 missing."; },
  };
  const P = probs.filter((r) => r.date === D);
  const pHist = (l) => probs.filter((r) => +r.level === l).sort((a, b) => (a.date < b.date ? -1 : 1));
  $("levels").innerHTML = LEVELS.map((L) => {
    const r = P.find((x) => +x.level === L.l) || {}; const s = out.scores[L.l]; const h = pHist(L.l);
    const ch = (k) => { if (h.length <= k) return "n/a"; const d = Math.round(+h[h.length - 1].p12 - +h[h.length - 1 - k].p12); return `${d > 0 ? "+" : ""}${d} pp`; };
    return `<div class="card"><h3>${L.l}. ${esc(L.name)}</h3>
      <div class="kv"><span>12 months</span><span><span class="big">${Math.round(r.p12)}%</span> <span class="muted">(${r.p12_lo}–${r.p12_hi}%)</span></span></div>
      <div class="kv"><span>3 years</span><span><b>${Math.round(r.p36)}%</b> <span class="muted">(${r.p36_lo}–${r.p36_hi}%)</span></span></div>
      ${(() => { const c = out.core && out.core[L.l]; if (!c) return `<div class="kv"><span>Core (backtested only)</span><span class="muted">n/a, no history</span></div>`;
        const g = Math.round(r.p12 - c.p12); return `<div class="kv"><span>Core (backtested only)</span><span><b>${Math.round(c.p12)}%</b> / ${Math.round(c.p36)}% <span class="muted">(${c.hits12}/${c.n12} months)</span></span></div>
        <div class="kv"><span>Full minus core, 12 mo</span><span class="${g > 0 ? "warn" : "ok"}">${g > 0 ? "+" : ""}${g} pp</span></div>`; })()}
      <div class="kv"><span>Stress score</span><span class="${tone(s)}">${s.toFixed(3)}</span></div>
      <div class="kv"><span>12-mo change, 1d / 1w</span><span>${ch(1)} / ${ch(5)}</span></div>
      <p><b>Trigger:</b> ${esc(L.trigger)}</p><p class="muted">${esc(nowText[L.l]())}</p></div>`;
  }).join("");
  const lvlTot = (l) => groups.filter((g) => +g.level === l).reduce((a, g) => a + +g.weight, 0);
  const gs = groups.map((g) => ({ ...g, sc: out.groups[g.level]?.[g.group] ?? null, share: +g.weight / lvlTot(+g.level) }));
  const mv = gs.filter((g) => g.sc != null).map((g) => ({ ...g, c: g.sc * g.share })).sort((a, b) => b.c - a.c).slice(0, 6);
  $("movers").innerHTML = table(["Composite", "Level", "Share of level", "Stress"], mv.map((g) => [esc(GNAME[g.group] || g.group), g.level, `${Math.round(g.share * 100)}%${g.single_company === "1" ? " (single company, capped)" : ""}`, `<span class="pill ${tone(g.sc)}">${Math.round(g.sc * 100)}%</span>`]));
  $("composites").innerHTML = table(["Composite", "Level", "Weight", "Stress", "What's in it"], gs.map((g) => [esc(GNAME[g.group] || g.group), g.level, `${Math.round(g.share * 100)}%`, g.sc == null ? '<span class="neutral">no data</span>' : `<span class="pill ${tone(g.sc)}">${Math.round(g.sc * 100)}%</span>`, esc(g.note)]));
  let lv = "all";
  const drawInd = () => {
    $("filter").innerHTML = ["all", "1", "2", "3", "4"].map((k) => `<button class="${k === lv ? "on" : ""}" data-k="${k}">${k === "all" ? "All" : "Level " + k}</button>`).join("");
    $("filter").querySelectorAll("button").forEach((b) => (b.onclick = () => { lv = b.dataset.k; drawInd(); }));
    const age = (od) => Math.round((new Date(D + "T12:00:00Z") - new Date(od + "T12:00:00Z")) / 864e5);
    $("indicators").innerHTML = table(["Indicator", "Lvl", "Composite", "Value", "1d chg", "Calm → stressed", "Stress", "Status", "Feed", "Source"],
      inds.filter((i) => i.scored !== "0" && (lv === "all" || i.level === lv)).map((i) => {
        const r = val(D, i.id), p = prevD ? val(prevD, i.id) : null; const v = r ? +r.value : null;
        const s = v == null ? null : stress(v, +i.calm, +i.stressed);
        const st = r ? r.status : "missing";
        return [esc(i.name), i.level, esc(GNAME[i.group] || i.group), v == null ? "—" : `${fmt(v)} ${esc(i.unit)}`, v != null && p ? `${v - +p.value >= 0 ? "+" : ""}${fmt(v - +p.value)}` : "—",
          `${fmt(+i.calm)} → ${fmt(+i.stressed)}`, s == null ? "—" : `<span class="pill ${tone(s)}">${Math.round(s * 100)}%</span>`,
          `<span class="${st === "ok" ? "ok" : st === "stale" ? "warn" : "bad"}">${esc(st)}</span>${r && r.obs_date ? `<br><span class="muted">obs ${esc(r.obs_date)}</span>` : ""}`,
          i.mode === "auto" ? '<span class="pill ok">auto</span>' : `<span class="pill warn">manual</span>${r && r.obs_date ? `<br><span class="muted">${age(r.obs_date)} days old</span>` : ""}`, link((r && r.source) || i.source)];
      }));
  };
  drawInd();
  const auto = inds.filter((i) => i.scored !== "0" && i.mode === "auto").length, man = inds.filter((i) => i.scored !== "0" && i.mode !== "auto").length;
  $("feedsum").textContent = `${auto} indicators update automatically from FRED each weekday; ${man} are entered by hand from cited sources (age shown). Core inputs: ${inds.filter((i) => i.core === "1").map((i) => i.id).join(", ")}.`;
  $("watch").innerHTML = table(["Indicator", "Level", "Why not scored"], inds.filter((i) => i.scored === "0").map((i) => [esc(i.name), i.level, "No reliable free, keyless source; chronically missing. Shown for transparency, excluded from all probabilities."]));
  $("weak").innerHTML = `<ul>${WEAK.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`;
  $("disclosures").innerHTML = `<p>${esc(DISCLOSURE)}</p><p class="muted">Not financial advice. The maintainers make no recommendation to buy or sell any security.</p>`;
  const hd = [...new Set(probs.map((r) => r.date))].sort();
  $("history").innerHTML = lineChart(LEVELS.map((L, k) => ({ name: `L${L.l} 12 mo`, color: C[k], pts: hd.map((d) => { const r = probs.find((x) => x.date === d && +x.level === L.l); return [d.slice(5), r ? +r.p12 : null]; }) })), { min: 0, max: 100, h: 220, yfmt: (v) => v.toFixed(0) + "%" }) + (hd.length < 2 ? '<p class="muted">History starts on Oct 23, 2026 and grows by one point per trading day.</p>' : "");
  if (bt) {
    const S = bt.series, q = S.filter((_, i) => i % 3 === 0 || i === S.length - 1);
    $("btchart").innerHTML = lineChart([
      { name: "Overall (avg L1, L3, L4)", color: C[0], w: 2.5, pts: q.map((r) => [r.m.slice(0, 4), r.all]) },
      { name: "L1 equity", color: C[1], w: 1.2, pts: q.map((r) => [r.m.slice(0, 4), r.l1]) },
      { name: "L3 credit proxy", color: C[2], w: 1.2, pts: q.map((r) => [r.m.slice(0, 4), r.l3]) },
      { name: "L4 systemic", color: C[3], w: 1.2, pts: q.map((r) => [r.m.slice(0, 4), r.l4]) },
    ], { min: 0, max: 1, h: 280 });
    const at = (m) => S.find((r) => r.m >= m);
    const shift = (m, n) => { const [y, mo] = m.split("-").map(Number); const t = y * 12 + mo - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
    $("episodes").innerHTML = table(["Episode", "Peak", "12 mo before", "3 mo before", "At peak", "Max after", "Note"], EPISODES.map(([n, pk, end]) => {
      const w = S.filter((r) => r.m >= pk && r.m <= end); const mx = w.reduce((a, r) => (r.all > a.all ? r : a), w[0] || { all: 0, m: "" });
      const g = (m) => (at(m) ? at(m).all.toFixed(2) : "—");
      return [n, pk, g(shift(pk, -12)), g(shift(pk, -3)), g(pk), `${mx.all.toFixed(2)} (${mx.m})`, esc(EPNOTE[n])];
    }));
    const last = S[S.length - 1], pct = Math.round((S.filter((r) => r.all <= last.all).length / S.length) * 100);
    $("btnow").innerHTML = `<b>Latest backtest reading (${esc(last.m)}):</b> ${last.all.toFixed(2)}, about the ${pct}th percentile since 1997. The reduced model can't see the AI-specific stress that drives the live score.`;
    const cb = bt.l1_calibration;
    $("calib").innerHTML = table(["L1 core score", "Months", "Followed by a daily close 20%+ below the Nasdaq-100 record within 12 mo", "Hit rate"], Object.entries(cb).map(([k, v]) => [esc(k), v.months, v.hits, v.months ? `${Math.round((v.hits / v.months) * 100)}%` : "—"]));
  } else $("btchart").textContent = "Backtest data not available.";
  $("events").innerHTML = table(["Date", "Lvl", "Event"], events.slice().reverse().slice(0, 40).map((e) => [esc(e.date), esc(e.level), `${esc(e.event)} ${link(e.source, "source")}`]));
  $("calendar").innerHTML = table(["Date", "Release", "Levels", "Confirmed"], cal.filter((c) => c.date >= D).map((c) => [esc(c.date), esc(c.event), esc(c.levels.replace(/\|/g, ", ")), c.confirmed === "yes" ? "yes" : '<span class="muted">tentative</span>']));
  $("method").innerHTML = table(["Step", "Rule"], METHOD.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)])) +
    table(["Level", "Model 12 mo", "Market-implied or base rate"], LEVELS.map((L) => { const r = P.find((x) => +x.level === L.l) || {}; return [`${L.l}. ${esc(L.name)}`, `${Math.round(r.p12)}% (${r.p12_lo}–${r.p12_hi}%)`, esc(L.implied)]; })) +
    `<div class="callout"><b>What this is and isn't.</b> ${esc(LIMITS)}</div><p>Full method: <a href="https://github.com/iftekherchowdhury/ai-crash-risk-monitor/blob/main/METHOD.md">METHOD.md</a>.</p>`;
  const srcs = [...new Set([...inds.map((i) => i.source), ...reads.filter((r) => r.date === D).map((r) => r.source), ...events.map((e) => e.source), ...EXTRA_SOURCES].filter(Boolean))];
  $("sources").innerHTML = srcs.map((u) => `<li>${link(u, u)}</li>`).join("");
}
main().catch((e) => { $("summary").innerHTML = `<span class="bad">Failed to load data: ${esc(e.message)}</span>`; });
