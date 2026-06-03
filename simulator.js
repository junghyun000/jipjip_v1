/* JIPJIP 노후 자금 시뮬레이터 — v2 UX
 * 핵심: 결과 우선(Hero), 6개 빠른 입력 카드, 점진 노출(상세 접힘), 시장 가정 단일 토글.
 * 계산 코어와 데이터 모델은 v1 그대로 유지. UI/이벤트만 재설계.
 */
(function () {
  "use strict";

  /* ============================ 상수/기본값 ============================ */
  const BASE_YEAR = 2026;
  const SCEN_API = "/api/scenarios";
  const TIER_API = "/api/tiers";
  const LS_SCEN = "jipjip:sim:scenarios:v1";
  const LS_STATE = "jipjip:sim:state:v2";
  const LS_STATE_V1 = "jipjip:sim:state:v1";
  const LS_TAB = "jipjip:lastTab";

  const TIER_FALLBACK = [
    { id: "top",  label: "최상급", deposit_base: 100000, monthly_cost_base: 450, refundable: true, notes: "더클래식500·VL르웨스트·삼성노블 대형 (보증금 8~12억, 월 350~500만)" },
    { id: "high", label: "상급",   deposit_base: 55000,  monthly_cost_base: 350, refundable: true, notes: "삼성노블 중형·더시그넘·서울시니어스 대형 (보증금 4~7억, 월 280~400만)" },
    { id: "mid",  label: "중급",   deposit_base: 30000,  monthly_cost_base: 250, refundable: true, notes: "노블레스타워·마리스텔라·서울시니어스 중형 (보증금 2.5~4억, 월 200~280만)" },
    { id: "low",  label: "하급",   deposit_base: 20000,  monthly_cost_base: 180, refundable: true, notes: "스프링카운티·사이언스빌리지 등 도심소형/비수도권 (보증금 1.5~2.5억, 월 150~200만)" },
  ];
  let TIERS = TIER_FALLBACK.slice();

  const DEFAULT_EVENTS = [
    { id: "fwm",  label: "와이프 어머니 장례식", category: "family", type: "one_time",      atAge: 58, amountToday: 1500, enabled: true },
    { id: "fwf",  label: "와이프 아버지 장례식", category: "family", type: "one_time",      atAge: 60, amountToday: 1500, enabled: true },
    { id: "fhm",  label: "남편 어머니 장례식",   category: "family", type: "one_time",      atAge: 56, amountToday: 1500, enabled: true },
    { id: "fhf",  label: "남편 아버지 장례식",   category: "family", type: "one_time",      atAge: 58, amountToday: 1500, enabled: true },
    { id: "care", label: "양가 부모 간병/요양 (분담)", category: "family", type: "probabilistic", startAge: 50, endAge: 65, probability: 0.60, amountToday: 6000, enabled: true },
    { id: "illw", label: "와이프 중대 질병 (암 등)", category: "health", type: "probabilistic", startAge: 50, endAge: 75, probability: 0.20, amountToday: 4000, enabled: true },
    { id: "illh", label: "남편 중대 질병 (암 등)",   category: "health", type: "probabilistic", startAge: 50, endAge: 75, probability: 0.27, amountToday: 4500, enabled: true },
    { id: "shock", label: "주식 시장 충격 (베어마켓)", category: "market", type: "market_shock", startAge: 28, endAge: 75, expectedCount: 6, severity: 0.25, enabled: true },
  ];

  // 시장 가정 프리셋 (단일 토글)
  const OUTLOOKS = {
    conservative: { inflation: 0.04, investReturn: 0.04, cashReturn: 0.015, reReturn: 0.02, incomeGrowth: 0.02 },
    neutral:      { inflation: 0.03, investReturn: 0.06, cashReturn: 0.025, reReturn: 0.03, incomeGrowth: 0.04 },
    aggressive:   { inflation: 0.02, investReturn: 0.08, cashReturn: 0.035, reReturn: 0.04, incomeGrowth: 0.06 },
  };
  const OUTLOOK_LABEL = { conservative: "보수", neutral: "중립", aggressive: "공격", custom: "커스텀" };

  const DEFAULTS = {
    wifeAge: 28, husbandAge: 33, entryAge: 75, stayYears: 10,
    cashCurrent: 10000, investmentCurrent: 20000,
    realEstateMode: "buy_later", realEstateCurrent: 0, realEstateBuyYear: 5, realEstateBuyPriceToday: 70000,
    sellMode: "at_entry", sellYearCustom: null, reSellCost: 0.04,
    wifeIncome: 5800, husbandIncome: 5600, netFactor: 0.83,
    incomeGrowth: 0.04, peakAge: 55, peakFlat: true,
    tierId: "mid", depositOverride: null, monthlyOverride: null, refundable: true, medicalPremium: 0.015,
    inflation: 0.03, investReturn: 0.06, cashReturn: 0.025, reReturn: 0.03,
    savingsRate: 0.30, allocCash: 0.30, inResidenceReal: 0.01,
    retireWife: 60, retireHusband: 60, pensionStartAge: 65, pensionAuto: true, pensionMonthlyOverride: null,
    bufferToday: 20000,
    events: DEFAULT_EVENTS.map((e) => ({ ...e })),
    lifeEventsEnabled: true,
    advancedOpen: false,
  };

  let state = loadState();
  let selectedN = clampStayToOption(state.stayYears);
  let built = false;
  let charts = { main: null, assets: null, income: null, stay: null };
  let refreshTimer = null;

  /* ============================ 상태 저장/로드 ============================ */
  function loadState() {
    try {
      const v2 = localStorage.getItem(LS_STATE);
      if (v2) {
        const merged = Object.assign({}, DEFAULTS, JSON.parse(v2));
        if (!Array.isArray(merged.events) || !merged.events.length) merged.events = DEFAULT_EVENTS.map((e) => ({ ...e }));
        return merged;
      }
      // v1 → v2 자동 이관
      const v1 = localStorage.getItem(LS_STATE_V1);
      if (v1) {
        const parsed = JSON.parse(v1);
        const merged = Object.assign({}, DEFAULTS, parsed, { lifeEventsEnabled: true, advancedOpen: false });
        if (!Array.isArray(merged.events) || !merged.events.length) merged.events = DEFAULT_EVENTS.map((e) => ({ ...e }));
        // v1 키는 보존 (롤백 대비)
        return merged;
      }
    } catch {}
    return Object.assign({}, DEFAULTS, { events: DEFAULT_EVENTS.map((e) => ({ ...e })) });
  }
  function persistState() { try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch {} }
  function clampStayToOption(v) { return [10, 20, 30].includes(Number(v)) ? Number(v) : 10; }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 120);
  }

  /* ============================ 계산 코어 (v1 유지) ============================ */
  function tierById(id) { return TIERS.find((t) => t.id === id) || TIERS[2] || TIER_FALLBACK[2]; }
  function depositMan(s) { return s.depositOverride != null ? Number(s.depositOverride) : Number(tierById(s.tierId).deposit_base); }
  function monthlyMan(s) { return s.monthlyOverride != null ? Number(s.monthlyOverride) : Number(tierById(s.tierId).monthly_cost_base); }

  function incomeAt(s, t) {
    const ageW = s.wifeAge + t, ageH = s.husbandAge + t;
    const g = s.incomeGrowth;
    const peakTW = Math.max(0, s.peakAge - s.wifeAge);
    const expo = (tt) => (s.peakFlat ? Math.min(tt, peakTW) : tt <= peakTW ? tt : peakTW);
    const w = ageW < s.retireWife ? s.wifeIncome * Math.pow(1 + g, expo(t)) : 0;
    const h = ageH < s.retireHusband ? s.husbandIncome * Math.pow(1 + g, expo(t)) : 0;
    return { wife: w, husband: h, gross: w + h };
  }

  function lifeEventsAtAge(s, ageW, t) {
    if (!s.lifeEventsEnabled) return { cost: 0, shockRate: 0, spikes: [] };
    const events = Array.isArray(s.events) ? s.events : [];
    let cost = 0, shockRate = 0;
    const spikes = [];
    const inflFactor = Math.pow(1 + s.inflation, t);
    for (const ev of events) {
      if (!ev || !ev.enabled) continue;
      if (ev.type === "one_time") {
        if (Number(ev.atAge) === ageW) {
          const amt = Math.max(0, Number(ev.amountToday) || 0) * inflFactor;
          cost += amt; spikes.push({ id: ev.id, label: ev.label, amount: amt });
        }
      } else if (ev.type === "probabilistic") {
        const a0 = Number(ev.startAge), a1 = Number(ev.endAge);
        if (ageW >= a0 && ageW <= a1) {
          const years = Math.max(1, a1 - a0 + 1);
          const annual = (Math.max(0, Math.min(1, Number(ev.probability) || 0)) * Math.max(0, Number(ev.amountToday) || 0)) / years;
          cost += annual * inflFactor;
        }
      } else if (ev.type === "market_shock") {
        const a0 = Number(ev.startAge), a1 = Number(ev.endAge);
        if (ageW >= a0 && ageW <= a1) {
          const years = Math.max(1, a1 - a0 + 1);
          const count = Math.max(0, Number(ev.expectedCount) || 0);
          const sev = Math.max(0, Math.min(1, Number(ev.severity) || 0));
          shockRate += (count / years) * sev;
        }
      }
    }
    return { cost, shockRate: Math.min(0.99, shockRate), spikes };
  }

  function pensionAt(s, t) {
    const startT = s.pensionStartAge - s.wifeAge;
    if (t < startT) return 0;
    if (!s.pensionAuto) {
      const m = Number(s.pensionMonthlyOverride) || 0;
      return m * 12 * Math.pow(1 + s.inflation, t);
    }
    const yearsW = Math.min(Math.max(s.retireWife - 23, 0), 40);
    const yearsH = Math.min(Math.max(s.retireHusband - 28, 0), 40);
    const todayW = s.wifeIncome * 0.85 * yearsW * 0.01;
    const todayH = s.husbandIncome * 0.85 * yearsH * 0.01;
    return (todayW + todayH) * Math.pow(1 + s.inflation, t);
  }

  function compute(s) {
    const T = Math.max(1, s.entryAge - s.wifeAge);
    const Tmax = T + 30;
    const infl = s.inflation;
    const series = [];
    const mode = s.realEstateMode || "none";
    let W = { cash: Math.max(0, s.cashCurrent), inv: Math.max(0, s.investmentCurrent), re: mode === "owned" ? Math.max(0, s.realEstateCurrent) : 0 };
    const buyYear = mode === "buy_later" ? Math.max(0, Number(s.realEstateBuyYear) || 0) : null;
    const sellYear = mode === "none" ? Infinity
      : s.sellMode === "at_entry" ? T
      : s.sellMode === "custom" ? Number(s.sellYearCustom)
      : Infinity;
    let sellProceeds = 0, sellAtYear = null;
    let buyAtYear = null, buyPriceNominal = 0, purchaseShortfall = 0;
    let cumLifeEvents = 0, cumLifeEventsToday = 0, totalShockLoss = 0;
    const lifeEventSeries = [], lifeEventSpikes = [];

    for (let t = 0; t <= Tmax; t++) {
      const inc = incomeAt(s, t);
      const pen = pensionAt(s, t);
      const net = inc.gross * s.netFactor + pen;
      const working = (s.wifeAge + t) < s.retireWife || (s.husbandAge + t) < s.retireHusband;
      const savings = working ? Math.max(0, net * s.savingsRate) : 0;
      const toCash = savings * s.allocCash;
      const toInv = savings - toCash;

      series.push({
        t, year: BASE_YEAR + t, ageW: s.wifeAge + t, ageH: s.husbandAge + t,
        cash: W.cash, inv: W.inv, re: W.re, total: W.cash + W.inv + W.re,
        incomeW: inc.wife, incomeH: inc.husband, pension: pen, net, savings,
      });

      W.cash = W.cash * (1 + s.cashReturn) + toCash;
      W.inv = W.inv * (1 + s.investReturn) + toInv;
      W.re = W.re * (1 + s.reReturn);

      const nextAgeW = s.wifeAge + t + 1;
      const lev = lifeEventsAtAge(s, nextAgeW, t + 1);
      if (lev.shockRate > 0 && W.inv > 0) {
        const loss = W.inv * lev.shockRate;
        W.inv = Math.max(0, W.inv - loss);
        totalShockLoss += loss;
      }
      if (lev.cost > 0) {
        let needE = lev.cost;
        const fc = Math.min(W.cash, needE); W.cash = Math.max(0, W.cash - fc); needE -= fc;
        const fi = Math.min(W.inv, needE); W.inv = Math.max(0, W.inv - fi); needE -= fi;
        cumLifeEvents += lev.cost;
        cumLifeEventsToday += lev.cost / Math.pow(1 + infl, t + 1);
        lifeEventSeries.push({ t: t + 1, year: BASE_YEAR + t + 1, ageW: nextAgeW, cost: lev.cost, cumNom: cumLifeEvents, cumToday: cumLifeEventsToday });
        lev.spikes.forEach((sp) => lifeEventSpikes.push({ ageW: nextAgeW, year: BASE_YEAR + t + 1, label: sp.label, amount: sp.amount }));
      }

      if (mode === "buy_later" && buyAtYear == null && t + 1 === buyYear) {
        const priceToday = Math.max(0, Number(s.realEstateBuyPriceToday) || 0);
        const priceNom = priceToday * Math.pow(1 + s.reReturn, buyYear);
        let need = priceNom;
        const fc = Math.min(W.cash, need); W.cash = Math.max(0, W.cash - fc); need -= fc;
        const fi = Math.min(W.inv, need); W.inv = Math.max(0, W.inv - fi); need -= fi;
        W.re = priceNom;
        buyAtYear = t + 1; buyPriceNominal = priceNom;
        if (need > 0) purchaseShortfall = need;
      }

      if (t + 1 === sellYear && W.re > 0) {
        sellProceeds = W.re * (1 - s.reSellCost);
        sellAtYear = t + 1;
        W.inv += sellProceeds; W.re = 0;
      }
    }

    const fEntry = Math.pow(1 + infl, T);
    const dep = depositMan(s);
    const mon = monthlyMan(s);
    const annualMan = mon * 12;
    const depositNom = dep * fEntry;
    const bufferNom = s.bufferToday * fEntry;
    const rrReal = s.inResidenceReal;
    const W0total = Math.max(0, s.cashCurrent) + Math.max(0, s.investmentCurrent) + (mode === "owned" ? Math.max(0, s.realEstateCurrent) : 0);
    const W75 = series[T];

    function needs(N) {
      const x = 1 / (1 + rrReal);
      const feeFactor = Math.abs(rrReal) < 1e-9 ? N : (1 - Math.pow(x, N)) / (1 - x);
      const kFees = annualMan * fEntry * feeFactor;
      const totalNom = depositNom + kFees + bufferNom;
      const netSpent = kFees + bufferNom + (s.refundable ? 0 : depositNom);
      const requiredCagr = W0total > 0 ? Math.pow(totalNom / W0total, 1 / T) - 1 : null;
      return { N, kFees, totalNom, totalToday: totalNom / fEntry, netSpent, gap: W75.total - totalNom, achieve: totalNom > 0 ? W75.total / totalNom : 0, requiredCagr };
    }
    const needsByN = { 10: needs(10), 20: needs(20), 30: needs(30) };

    const stayCurve = [];
    const inflStay = infl + s.medicalPremium;
    const nominalStayReturn = infl + s.inResidenceReal;
    let remain = Math.max(0, W75.total - depositNom - bufferNom);
    let cumLife = 0, depletedAt = null;
    for (let k = 0; k <= 30; k++) {
      stayCurve.push({ k, remain: Math.max(0, remain), cumLife });
      const life = annualMan * fEntry * Math.pow(1 + inflStay, k);
      cumLife += life;
      remain = (remain - life) * (1 + nominalStayReturn);
      if (remain <= 0 && depletedAt == null) depletedAt = k + 1;
    }

    return {
      T, Tmax, fEntry, series, needsByN, W75, W0total,
      depositNom, bufferNom, annualMan, dep, mon,
      sellProceeds, sellAtYear, stayCurve, depletedAt,
      buyAtYear, buyPriceNominal, purchaseShortfall,
      pensionAtEntry: pensionAt(s, T),
      lifeEventSeries, lifeEventSpikes, cumLifeEvents, cumLifeEventsToday, totalShockLoss,
      cumLifeEventsAt75: lifeEventSeries.filter((p) => p.t <= T).reduce((m, p) => Math.max(m, p.cumNom), 0),
      cumLifeEventsTodayAt75: lifeEventSeries.filter((p) => p.t <= T).reduce((m, p) => Math.max(m, p.cumToday), 0),
    };
  }

  /* ============================ 시장 가정 추론/적용 ============================ */
  function inferOutlook(s) {
    for (const [name, vals] of Object.entries(OUTLOOKS)) {
      const match = Object.entries(vals).every(([k, v]) => Math.abs(s[k] - v) < 1e-6);
      if (match) return name;
    }
    return "custom";
  }
  function applyOutlook(name) {
    const vals = OUTLOOKS[name];
    if (!vals) return;
    Object.assign(state, vals);
    persistState();
    buildUI(); // 카드 + 상세 동시 갱신
    refresh();
  }

  /* ============================ 포맷 ============================ */
  function won(man) {
    if (man == null || !isFinite(man)) return "-";
    const neg = man < 0, a = Math.abs(man);
    let s = a >= 10000 ? (a / 10000).toFixed(1) + "억" : Math.round(a).toLocaleString() + "만";
    return (neg ? "−" : "") + s;
  }
  function eok(man) { return man / 10000; }
  function pct(x) { return x == null ? "-" : (x * 100).toFixed(1) + "%"; }
  function todayMan(nomMan, t, infl) { return nomMan / Math.pow(1 + infl, t); }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
  function statusColor(pct) { return pct >= 1.0 ? "good" : pct >= 0.7 ? "warn" : "bad"; }
  function statusEmoji(pct) { return pct >= 1.0 ? "💚" : pct >= 0.7 ? "🟡" : "🔴"; }

  /* ============================ UI: 빌드 (v2) ============================ */
  function buildUI() {
    const root = document.getElementById("simRoot");
    if (!root) return;
    const ol = inferOutlook(state);
    const monthlySav = Math.round((state.wifeIncome + state.husbandIncome) * state.netFactor * state.savingsRate / 12);
    const totalAssets = Math.max(0, state.cashCurrent) + Math.max(0, state.investmentCurrent) + (state.realEstateMode === "owned" ? Math.max(0, state.realEstateCurrent) : 0);
    const reLabel = state.realEstateMode === "none" ? "부동산 없음"
      : state.realEstateMode === "owned" ? `보유 ${won(state.realEstateCurrent)}`
      : `${state.realEstateBuyYear}년 뒤 매입 (${won(state.realEstateBuyPriceToday)})`;
    const tier = tierById(state.tierId);

    root.innerHTML = `
      <div class="v2-root">

        <!-- HERO -->
        <section class="v2-hero" id="v2Hero">
          <div class="v2-stay-pill" role="tablist" aria-label="거주 기간">
            ${[10, 20, 30].map((n) => `<button type="button" role="tab" data-stayout="${n}" class="${selectedN === n ? "is-active" : ""}" aria-selected="${selectedN === n}">${n}년 거주</button>`).join("")}
          </div>
          <div class="v2-hero-result">
            <div class="v2-hero-emoji" id="v2HeroEmoji">💚</div>
            <div class="v2-hero-numeric">
              <strong id="v2HeroPct">-%</strong>
              <span>달성률</span>
            </div>
          </div>
          <div class="v2-hero-sub" id="v2HeroSub">예상 - / 목표 -</div>
          <div class="v2-hero-alert" id="v2HeroAlert"></div>
        </section>

        <!-- QUICK CARDS -->
        <section class="v2-quick" aria-label="빠른 입력">

          <article class="v2-card" data-card="profile">
            <header><span class="v2-card-icon">👫</span><span class="v2-card-label">우리</span><button class="v2-card-toggle" type="button" aria-label="펼치기">▾</button></header>
            <strong class="v2-card-value" id="v2vProfile">와이프 ${state.wifeAge} · 남편 ${state.husbandAge}</strong>
            <span class="v2-card-sub">입주 와이프 ${state.entryAge}세 (${BASE_YEAR + state.entryAge - state.wifeAge}년)</span>
            <div class="v2-card-expand" hidden>
              <label><span>와이프 나이</span><input type="number" data-vkey="wifeAge" min="18" max="60" value="${state.wifeAge}" /></label>
              <label><span>남편 나이</span><input type="number" data-vkey="husbandAge" min="18" max="65" value="${state.husbandAge}" /></label>
              <label><span>입주 나이 (와이프)</span><input type="number" data-vkey="entryAge" min="60" max="90" value="${state.entryAge}" /></label>
            </div>
          </article>

          <article class="v2-card" data-card="assets">
            <header><span class="v2-card-icon">💰</span><span class="v2-card-label">자산</span><button class="v2-card-toggle" type="button" aria-label="펼치기">▾</button></header>
            <strong class="v2-card-value" id="v2vAssets">${won(totalAssets)}</strong>
            <span class="v2-card-sub" id="v2vAssetsSub">현금 ${won(state.cashCurrent)} · 투자 ${won(state.investmentCurrent)} · ${reLabel}</span>
            <div class="v2-card-slider">
              <input type="range" min="0" max="200000" step="500" value="${state.cashCurrent + state.investmentCurrent}" data-vkey="liquidTotal" aria-label="유동 자산 합계" />
              <div class="v2-slider-marks"><span>0</span><span>10억</span><span>20억</span></div>
            </div>
            <div class="v2-card-expand" hidden>
              <label><span>현금성 (만원)</span><input type="number" data-vkey="cashCurrent" step="500" min="0" value="${state.cashCurrent}" /></label>
              <label><span>투자 (만원)</span><input type="number" data-vkey="investmentCurrent" step="500" min="0" value="${state.investmentCurrent}" /></label>
              <label><span>부동산 상태</span>
                <select data-vkey="realEstateMode">
                  <option value="owned" ${state.realEstateMode === "owned" ? "selected" : ""}>현재 보유</option>
                  <option value="buy_later" ${state.realEstateMode === "buy_later" ? "selected" : ""}>미래 매입</option>
                  <option value="none" ${state.realEstateMode === "none" ? "selected" : ""}>매입 없음</option>
                </select></label>
              <label data-rerow="owned"><span>현재 시세 (만원)</span><input type="number" data-vkey="realEstateCurrent" step="1000" min="0" value="${state.realEstateCurrent}" /></label>
              <label data-rerow="buy"><span>매입까지 (년 후)</span><input type="number" data-vkey="realEstateBuyYear" step="1" min="0" max="50" value="${state.realEstateBuyYear}" /></label>
              <label data-rerow="buy"><span>매입가 (현재가치, 만원)</span><input type="number" data-vkey="realEstateBuyPriceToday" step="1000" min="0" value="${state.realEstateBuyPriceToday}" /></label>
            </div>
          </article>

          <article class="v2-card" data-card="income">
            <header><span class="v2-card-icon">💼</span><span class="v2-card-label">소득 & 저축</span><button class="v2-card-toggle" type="button" aria-label="펼치기">▾</button></header>
            <strong class="v2-card-value" id="v2vIncome">${won(state.wifeIncome + state.husbandIncome)}</strong>
            <span class="v2-card-sub" id="v2vIncomeSub">월 ${monthlySav.toLocaleString()}만 저축 · 저축률 ${Math.round(state.savingsRate * 100)}%</span>
            <div class="v2-card-slider">
              <input type="range" min="0" max="60" step="1" value="${Math.round(state.savingsRate * 100)}" data-vkey="savingsRatePct" aria-label="저축률" />
              <div class="v2-slider-marks"><span>0%</span><span>30%</span><span>60%</span></div>
            </div>
            <div class="v2-card-expand" hidden>
              <label><span>와이프 연봉 (세전, 만원)</span><input type="number" data-vkey="wifeIncome" step="100" min="0" value="${state.wifeIncome}" /></label>
              <label><span>남편 연봉 (세전, 만원)</span><input type="number" data-vkey="husbandIncome" step="100" min="0" value="${state.husbandIncome}" /></label>
              <label><span>실수령 환산 (%)</span><input type="number" data-vkey="netFactorPct" step="1" min="60" max="95" value="${Math.round(state.netFactor * 100)}" /></label>
              <label><span>소득 피크 나이</span><input type="number" data-vkey="peakAge" step="1" min="45" max="60" value="${state.peakAge}" /></label>
            </div>
          </article>

          <article class="v2-card" data-card="tier">
            <header><span class="v2-card-icon">🏡</span><span class="v2-card-label">실버타운</span><button class="v2-card-toggle" type="button" aria-label="펼치기">▾</button></header>
            <strong class="v2-card-value" id="v2vTier">${esc(tier.label)}</strong>
            <span class="v2-card-sub" id="v2vTierSub">${won(depositMan(state))} · 월 ${won(monthlyMan(state))}</span>
            <div class="v2-tabs v2-tabs-4">
              ${TIERS.map((t) => `<button type="button" data-vtier="${t.id}" class="${state.tierId === t.id ? "is-active" : ""}">${esc(t.label)}</button>`).join("")}
            </div>
            <div class="v2-card-expand" hidden>
              <label><span>보증금 (만원)</span><input type="number" data-vkey="depositOverride" step="1000" min="0" placeholder="${tier.deposit_base}" value="${state.depositOverride ?? ""}" /></label>
              <label><span>월 비용 (만원)</span><input type="number" data-vkey="monthlyOverride" step="10" min="0" placeholder="${tier.monthly_cost_base}" value="${state.monthlyOverride ?? ""}" /></label>
              <label class="v2-inline"><input type="checkbox" data-vkey="refundable" ${state.refundable ? "checked" : ""} /><span>보증금 반환형</span></label>
            </div>
          </article>

          <article class="v2-card" data-card="stay">
            <header><span class="v2-card-icon">🌅</span><span class="v2-card-label">거주 기간</span><button class="v2-card-toggle" type="button" aria-label="펼치기">▾</button></header>
            <strong class="v2-card-value" id="v2vStay">${selectedN}년</strong>
            <span class="v2-card-sub">와이프 ${state.entryAge}~${state.entryAge + selectedN}세</span>
            <div class="v2-tabs v2-tabs-3">
              ${[10, 20, 30].map((n) => `<button type="button" data-stayout="${n}" class="${selectedN === n ? "is-active" : ""}">${n}년</button>`).join("")}
            </div>
            <div class="v2-card-expand" hidden>
              <label><span>입주 나이 (와이프)</span><input type="number" data-vkey="entryAge" min="60" max="90" value="${state.entryAge}" /></label>
              <label><span>거주 중 의료비 가산 (%)</span><input type="number" data-vkey="medicalPremiumPct" step="0.5" min="0" max="5" value="${(state.medicalPremium * 100).toFixed(1)}" /></label>
            </div>
          </article>

          <article class="v2-card" data-card="outlook">
            <header><span class="v2-card-icon">📈</span><span class="v2-card-label">시장 가정</span><button class="v2-card-toggle" type="button" aria-label="펼치기">▾</button></header>
            <strong class="v2-card-value" id="v2vOutlook">${OUTLOOK_LABEL[ol]}</strong>
            <span class="v2-card-sub" id="v2vOutlookSub">물가 ${pct(state.inflation)} · 투자 ${pct(state.investReturn)} · 소득 ${pct(state.incomeGrowth)}</span>
            <div class="v2-tabs v2-tabs-3">
              <button type="button" data-voutlook="conservative" class="${ol === "conservative" ? "is-active" : ""}">보수</button>
              <button type="button" data-voutlook="neutral" class="${ol === "neutral" ? "is-active" : ""}">중립</button>
              <button type="button" data-voutlook="aggressive" class="${ol === "aggressive" ? "is-active" : ""}">공격</button>
            </div>
            <div class="v2-card-expand" hidden>
              <label><span>물가상승률 (%)</span><input type="number" data-vkey="inflationPct" step="0.1" min="0" max="8" value="${(state.inflation * 100).toFixed(1)}" /></label>
              <label><span>투자 수익률 (%)</span><input type="number" data-vkey="investReturnPct" step="0.1" min="0" max="12" value="${(state.investReturn * 100).toFixed(1)}" /></label>
              <label><span>현금성 수익률 (%)</span><input type="number" data-vkey="cashReturnPct" step="0.1" min="0" max="6" value="${(state.cashReturn * 100).toFixed(1)}" /></label>
              <label><span>부동산 증가율 (%)</span><input type="number" data-vkey="reReturnPct" step="0.1" min="0" max="8" value="${(state.reReturn * 100).toFixed(1)}" /></label>
              <label><span>소득 증가율 (%)</span><input type="number" data-vkey="incomeGrowthPct" step="0.1" min="0" max="10" value="${(state.incomeGrowth * 100).toFixed(1)}" /></label>
            </div>
          </article>
        </section>

        <!-- METRIC ROW (보조 카드 4개) -->
        <section class="v2-metric-row">
          <div class="v2-metric"><span>예상 75세 자산</span><strong id="v2mWealth">-</strong><em id="v2mWealthToday">-</em></div>
          <div class="v2-metric"><span>입주 필요 자산</span><strong id="v2mTarget">-</strong><em id="v2mTargetToday">-</em></div>
          <div class="v2-metric"><span>국민연금 (75세·월)</span><strong id="v2mPension">-</strong><em id="v2mPensionToday">-</em></div>
          <div class="v2-metric"><span>라이프 이벤트 (~75세)</span><strong id="v2mEvents">-</strong><em id="v2mEventsToday">-</em></div>
        </section>

        <!-- MAIN CHART -->
        <section class="v2-chart-card">
          <div class="v2-chart-head">
            <h3>📊 자산 추이</h3>
            <button type="button" id="v2ChartMoreBtn" class="ghost-button">차트 더 보기 →</button>
          </div>
          <div class="v2-canvas"><canvas id="v2ChartMain" role="img" aria-label="나이별 자산 추이"></canvas></div>
          <p id="v2ChartFallback" class="v2-fallback" hidden></p>
        </section>

        <!-- LIFE EVENTS TOGGLE -->
        <section class="v2-life-bar">
          <div class="v2-life-info">
            <label class="v2-switch"><input type="checkbox" id="v2LifeEnabled" ${state.lifeEventsEnabled ? "checked" : ""} /><span></span></label>
            <div>
              <strong>🪦 라이프 이벤트 ${state.lifeEventsEnabled ? "적용" : "미적용"}</strong>
              <span>양가 부모님 장례식·중대 질병·시장 충격 평균값 반영</span>
            </div>
          </div>
          <button type="button" id="v2LifeOpenBtn" class="ghost-button">개별 조정 →</button>
        </section>

        <!-- ADVANCED -->
        <details class="v2-advanced" id="v2Advanced" ${state.advancedOpen ? "open" : ""}>
          <summary>⚙️ 상세 설정 (가정값 개별 조정)</summary>
          <div class="v2-advanced-body">
            <div class="v2-adv-sec">
              <h4>은퇴 & 국민연금</h4>
              <div class="v2-adv-grid">
                <label><span>와이프 은퇴 나이</span><input type="number" data-vkey="retireWife" min="50" max="70" value="${state.retireWife}" /></label>
                <label><span>남편 은퇴 나이</span><input type="number" data-vkey="retireHusband" min="50" max="70" value="${state.retireHusband}" /></label>
                <label><span>연금 수령 개시</span><input type="number" data-vkey="pensionStartAge" min="60" max="70" value="${state.pensionStartAge}" /></label>
                <label class="v2-inline"><input type="checkbox" data-vkey="pensionAuto" ${state.pensionAuto ? "checked" : ""} /><span>연금 자동 추정</span></label>
                <label><span>연금 월액 수동 (만원/부부)</span><input type="number" data-vkey="pensionMonthlyOverride" min="0" step="10" value="${state.pensionMonthlyOverride ?? ""}" /></label>
              </div>
            </div>
            <div class="v2-adv-sec">
              <h4>저축 분배 & 버퍼</h4>
              <div class="v2-adv-grid">
                <label><span>신규 저축 중 현금 비중 (%)</span><input type="number" data-vkey="allocCashPct" min="0" max="100" step="5" value="${Math.round(state.allocCash * 100)}" /></label>
                <label><span>거주 중 잔여자산 실질수익 (%)</span><input type="number" data-vkey="inResidenceRealPct" step="0.5" min="-2" max="5" value="${(state.inResidenceReal * 100).toFixed(1)}" /></label>
                <label><span>의료·예비비 버퍼 (만원, 현재가치)</span><input type="number" data-vkey="bufferToday" step="1000" min="0" value="${state.bufferToday}" /></label>
              </div>
            </div>
            <div class="v2-adv-sec">
              <h4>부동산 매도 처리</h4>
              <div class="v2-adv-grid">
                <label><span>매도 처리</span>
                  <select data-vkey="sellMode">
                    <option value="at_entry" ${state.sellMode === "at_entry" ? "selected" : ""}>입주 시점 매도</option>
                    <option value="keep" ${state.sellMode === "keep" ? "selected" : ""}>계속 보유</option>
                    <option value="custom" ${state.sellMode === "custom" ? "selected" : ""}>지정 연도 매도</option>
                  </select></label>
                <label><span>매도까지 연수 (지정 시)</span><input type="number" data-vkey="sellYearCustom" min="0" max="60" value="${state.sellYearCustom ?? ""}" /></label>
                <label><span>양도·중개 비용 (%)</span><input type="number" data-vkey="reSellCostPct" step="0.5" min="0" max="12" value="${(state.reSellCost * 100).toFixed(1)}" /></label>
              </div>
            </div>
          </div>
        </details>

        <!-- SCENARIO BAR -->
        <section class="v2-scenbar">
          <select id="simScenSelect" aria-label="시나리오 선택"><option value="">시나리오 불러오기…</option></select>
          <button type="button" id="simSaveBtn" class="secondary-button">현재 저장</button>
          <button type="button" id="simResetBtn" class="ghost-button">초기화</button>
        </section>

        <!-- GLOSSARY -->
        <details class="v2-glossary">
          <summary>📖 용어집 — 어려운 용어를 여기서 확인하세요</summary>
          <dl>
            <dt>달성률</dt><dd>예상 75세 자산을 입주 필요 자산으로 나눈 값. 100% 이상이면 목표 달성.</dd>
            <dt>명목 / 현재가치 (Present Value)</dt><dd>명목 = 미래 시점의 액면 금액. 현재가치 = 오늘의 구매력으로 환산. <code>현재가치 = 명목 ÷ (1+물가)^연수</code>.</dd>
            <dt>물가상승률 (Inflation)</dt><dd>해마다 물가가 오르는 비율. 같은 돈의 구매력이 매년 줄어듭니다.</dd>
            <dt>복리 (Compound Interest)</dt><dd>원금뿐 아니라 그동안 불어난 수익에도 다시 수익이 붙는 것.</dd>
            <dt>CAGR</dt><dd>연평균 복리 수익률. 여러 해에 걸친 성장률을 매년 일정한 복리로 환산한 값.</dd>
            <dt>실수령 환산</dt><dd>세전 연봉에서 4대보험·세금을 뺀 실제 통장 입금액 비율(기본 83%).</dd>
            <dt>보증금 반환형</dt><dd>실버타운 퇴거 시 보증금을 (대부분 전액) 돌려받는 임대 방식. 최종 소진액에서 제외.</dd>
            <dt>국민연금 (소득대체율)</dt><dd>가입 기간·소득에 비례해 노후 매달 받는 공적연금. 본 시뮬레이터는 2021년 가입 기준 단순 추정.</dd>
            <dt>3-버킷 (현금/투자/부동산)</dt><dd>자산을 성격별로 나눠 각기 다른 수익률·물가 민감도로 굴리는 방식.</dd>
            <dt>결정적 이벤트 (Deterministic)</dt><dd>발생 시점·비용이 거의 확정인 사건. 예: 부모님 장례식. 입력 시점에 일회성 지출 반영.</dd>
            <dt>확률적 이벤트 (Probabilistic) — 기대값</dt><dd>발생할 수도 안 할 수도 있는 사건. <code>매년 비용 = 확률 × 비용 ÷ 구간</code>으로 평활해 매년 차감.</dd>
            <dt>시장 충격</dt><dd>베어마켓처럼 투자 자산이 급락하는 사건. <code>매년 평균 손실 = (횟수 ÷ 구간) × 강도</code>로 환산.</dd>
            <dt>시장 가정 (Outlook)</dt><dd>보수/중립/공격 프리셋. 5개 가정값(물가·투자·현금·부동산·소득)을 묶어 단일 토글로 조정.</dd>
          </dl>
        </details>

        <p class="v2-disclaimer">※ 본 도구는 가정 기반 시뮬레이션이며 투자·재무 자문이 아닙니다. 47년 장기 추정은 본질적으로 불확실하므로 의사결정 보조로만 활용하세요.</p>
      </div>

      <!-- 라이프 이벤트 모달 -->
      <div class="v2-modal" id="v2LifeModal" hidden role="dialog" aria-modal="true" aria-labelledby="v2LifeModalTitle">
        <div class="v2-modal-card">
          <header><h3 id="v2LifeModalTitle">🪦 라이프 이벤트 개별 조정</h3><button type="button" class="v2-modal-close" aria-label="닫기">×</button></header>
          <p class="sim-help">결정/확률/시장충격 3종. <b>결정적</b>은 시점·비용을, <b>확률적</b>은 구간·확률·비용을, <b>시장 충격</b>은 횟수·강도를 입력합니다.</p>
          <div id="evList" class="ev-list"></div>
          <footer><button type="button" id="evResetBtn" class="ghost-button">기본값으로 초기화</button></footer>
        </div>
      </div>

      <!-- 차트 더 보기 모달 -->
      <div class="v2-modal" id="v2ChartModal" hidden role="dialog" aria-modal="true">
        <div class="v2-modal-card v2-modal-wide">
          <header><h3>📊 차트 더 보기</h3><button type="button" class="v2-modal-close" aria-label="닫기">×</button></header>
          <section class="sim-chart-card"><h3>자산 추이 <span>(현금/투자/부동산 적층)</span></h3><div class="sim-canvas-wrap"><canvas id="chartAssets"></canvas></div></section>
          <section class="sim-chart-card"><h3>소득 & 누적 저축</h3><div class="sim-canvas-wrap"><canvas id="chartIncome"></canvas></div></section>
          <section class="sim-chart-card"><h3>입주 후 잔여자산 소진</h3><div class="sim-canvas-wrap"><canvas id="chartStay"></canvas></div></section>
        </div>
      </div>
    `;

    bindAll();
    updateReVisibility();
    renderEventList();
    loadScenarioList();
    built = true;
    refresh();
  }

  /* ============================ UI: 동기화 ============================ */
  function syncCardValues(r) {
    const get = (id) => document.getElementById(id);
    const monthlySav = Math.round((state.wifeIncome + state.husbandIncome) * state.netFactor * state.savingsRate / 12);
    const totalAssets = Math.max(0, state.cashCurrent) + Math.max(0, state.investmentCurrent) + (state.realEstateMode === "owned" ? Math.max(0, state.realEstateCurrent) : 0);
    const reLabel = state.realEstateMode === "none" ? "부동산 없음"
      : state.realEstateMode === "owned" ? `보유 ${won(state.realEstateCurrent)}`
      : `${state.realEstateBuyYear}년 뒤 매입 (${won(state.realEstateBuyPriceToday)})`;
    const ol = inferOutlook(state);
    const tier = tierById(state.tierId);

    if (get("v2vProfile")) get("v2vProfile").textContent = `와이프 ${state.wifeAge} · 남편 ${state.husbandAge}`;
    if (get("v2vAssets")) get("v2vAssets").textContent = won(totalAssets);
    if (get("v2vAssetsSub")) get("v2vAssetsSub").textContent = `현금 ${won(state.cashCurrent)} · 투자 ${won(state.investmentCurrent)} · ${reLabel}`;
    if (get("v2vIncome")) get("v2vIncome").textContent = won(state.wifeIncome + state.husbandIncome);
    if (get("v2vIncomeSub")) get("v2vIncomeSub").textContent = `월 ${monthlySav.toLocaleString()}만 저축 · 저축률 ${Math.round(state.savingsRate * 100)}%`;
    if (get("v2vTier")) get("v2vTier").textContent = tier.label;
    if (get("v2vTierSub")) get("v2vTierSub").textContent = `${won(depositMan(state))} · 월 ${won(monthlyMan(state))}`;
    if (get("v2vStay")) get("v2vStay").textContent = `${selectedN}년`;
    if (get("v2vOutlook")) get("v2vOutlook").textContent = OUTLOOK_LABEL[ol];
    if (get("v2vOutlookSub")) get("v2vOutlookSub").textContent = `물가 ${pct(state.inflation)} · 투자 ${pct(state.investReturn)} · 소득 ${pct(state.incomeGrowth)}`;
  }

  function renderHero(r) {
    const n = r.needsByN[selectedN];
    const pctAchieve = n.achieve;
    const color = statusColor(pctAchieve);
    const emoji = statusEmoji(pctAchieve);
    const heroEl = document.getElementById("v2Hero");
    if (heroEl) heroEl.dataset.status = color;
    const pctEl = document.getElementById("v2HeroPct");
    if (pctEl) pctEl.textContent = `${Math.round(pctAchieve * 100)}%`;
    const emEl = document.getElementById("v2HeroEmoji");
    if (emEl) emEl.textContent = emoji;
    const sub = document.getElementById("v2HeroSub");
    if (sub) sub.innerHTML = `예상 <strong>${won(r.W75.total)}</strong> / 목표 <strong>${won(n.totalNom)}</strong>`;
    const al = document.getElementById("v2HeroAlert");
    if (al) {
      let msg, cls = "good";
      if (r.depletedAt != null && r.depletedAt <= selectedN) { msg = `❌ 거주 ${r.depletedAt}년차에 자금 고갈 — 저축률·등급 조정 권장`; cls = "bad"; }
      else if (r.purchaseShortfall > 0) { msg = `⚠️ 부동산 매입 시점(${BASE_YEAR + r.buyAtYear}년)에 자금 ${won(r.purchaseShortfall)} 부족`; cls = "warn"; }
      else if (pctAchieve < 1) { msg = `⚠️ 목표에 ${won(Math.abs(n.gap))} 부족 (현재가치 ${won(Math.abs(n.gap) / r.fEntry)})`; cls = "warn"; }
      else { msg = `✅ ${selectedN}년 거주 충분 달성 (GAP +${won(n.gap)} · 현재가치 +${won(n.gap / r.fEntry)})`; cls = "good"; }
      al.textContent = msg;
      al.dataset.kind = cls;
    }
    document.querySelectorAll("[data-stayout]").forEach((b) => {
      const a = Number(b.dataset.stayout) === selectedN;
      b.classList.toggle("is-active", a);
      b.setAttribute("aria-selected", a ? "true" : "false");
    });
  }

  function renderMetrics(r) {
    const infl = state.inflation;
    const n = r.needsByN[selectedN];
    const penMonth = r.pensionAtEntry / 12;
    const m = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    m("v2mWealth", won(r.W75.total));
    m("v2mWealthToday", `현재가치 ${won(todayMan(r.W75.total, r.T, infl))}`);
    m("v2mTarget", won(n.totalNom));
    m("v2mTargetToday", `현재가치 ${won(n.totalToday)}`);
    m("v2mPension", `월 ${won(penMonth)}`);
    m("v2mPensionToday", `현재가치 월 ${won(todayMan(penMonth, r.T, infl))}`);
    m("v2mEvents", won(r.cumLifeEventsAt75));
    m("v2mEventsToday", `현재가치 ${won(r.cumLifeEventsTodayAt75)}`);
  }

  /* ============================ 차트 ============================ */
  function chartReady() { return typeof window.Chart !== "undefined"; }

  function renderMainChart(r) {
    const el = document.getElementById("v2ChartMain");
    if (!el) return;
    if (!chartReady()) {
      const fb = document.getElementById("v2ChartFallback");
      if (fb) { fb.textContent = `📊 차트 라이브러리 로드 실패 — 75세 예상 자산 ${won(r.W75.total)} / 목표 ${won(r.needsByN[selectedN].totalNom)}`; fb.hidden = false; }
      return;
    }
    const fb = document.getElementById("v2ChartFallback"); if (fb) fb.hidden = true;
    if (charts.main) charts.main.destroy();
    const slice = r.series.filter((p) => p.t <= r.T);
    const labels = slice.map((p) => p.ageW);
    const target = r.needsByN[selectedN].totalNom;
    const eventByT = {};
    for (const sp of r.lifeEventSpikes) eventByT[sp.ageW] = (eventByT[sp.ageW] || 0) + sp.amount;
    const eventMarkers = labels.map((ageW) => eventByT[ageW] ? eok(r.W75.total) * 0.05 : null);

    charts.main = new window.Chart(el.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "예상 자산", data: slice.map((p) => eok(p.total)), borderColor: "#008f72", backgroundColor: "#00c89622", fill: true, tension: 0.25, pointRadius: 0, borderWidth: 3 },
          { label: `목표 (${selectedN}년)`, data: labels.map(() => eok(target)), borderColor: "#c43d45", borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 2 },
          { label: "라이프 이벤트", data: eventMarkers, borderColor: "rgba(0,0,0,0)", backgroundColor: "#888780", pointRadius: 6, pointStyle: "triangle", showLine: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { usePointStyle: true } },
          tooltip: { callbacks: {
            title: (ctx) => `와이프 ${slice[ctx[0].dataIndex].ageW}세 (${slice[ctx[0].dataIndex].year}년)`,
            label: (i) => {
              if (i.dataset.label === "라이프 이벤트") {
                const sp = r.lifeEventSpikes.filter((x) => x.ageW === slice[i.dataIndex].ageW);
                return sp.length ? sp.map((x) => ` ${x.label}: ${won(x.amount)}`).join("\n") : ` 라이프 이벤트 없음`;
              }
              return ` ${i.dataset.label}: ${i.parsed.y.toFixed(1)}억`;
            },
          } },
        },
        scales: { y: { title: { display: true, text: "자산 (억, 명목)" }, ticks: { callback: (v) => v + "억" } }, x: { title: { display: true, text: "와이프 나이" } } },
      },
    });
  }

  function renderModalCharts(r) {
    if (!chartReady()) return;
    const slice = r.series.filter((p) => p.t <= r.T);
    const labels = slice.map((p) => p.ageW);
    // 자산 적층
    const a = document.getElementById("chartAssets");
    if (a) {
      if (charts.assets) charts.assets.destroy();
      charts.assets = new window.Chart(a.getContext("2d"), {
        type: "line",
        data: { labels, datasets: [
          { label: "현금", data: slice.map((p) => eok(p.cash)), borderColor: "#00c896", backgroundColor: "#00c89633", fill: true, tension: 0.25, pointRadius: 0 },
          { label: "투자", data: slice.map((p) => eok(p.inv)), borderColor: "#008f72", backgroundColor: "#008f7233", fill: true, tension: 0.25, pointRadius: 0 },
          { label: "부동산", data: slice.map((p) => eok(p.re)), borderColor: "#BA7517", backgroundColor: "#BA751733", fill: true, tension: 0.25, pointRadius: 0 },
        ] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { stacked: true, ticks: { callback: (v) => v + "억" } } } },
      });
    }
    // 소득 + 누적 저축
    let cum = 0; const cumSav = slice.map((p) => { cum += p.savings; return eok(cum); });
    const cumLifeByT = {}; for (const p of r.lifeEventSeries) cumLifeByT[p.t] = p.cumNom;
    let lastL = 0; const cumLifeArr = slice.map((p) => { if (cumLifeByT[p.t] != null) lastL = cumLifeByT[p.t]; return eok(lastL); });
    const i = document.getElementById("chartIncome");
    if (i) {
      if (charts.income) charts.income.destroy();
      charts.income = new window.Chart(i.getContext("2d"), {
        type: "line",
        data: { labels, datasets: [
          { label: "가구 소득", data: slice.map((p) => p.incomeW + p.incomeH), borderColor: "#06362f", fill: false, tension: 0.25, pointRadius: 0, yAxisID: "y" },
          { label: "국민연금", data: slice.map((p) => p.pension), borderColor: "#BA7517", borderDash: [6, 4], fill: false, pointRadius: 0, yAxisID: "y" },
          { label: "누적 저축", data: cumSav, borderColor: "#008f72", borderWidth: 3, fill: false, tension: 0.25, pointRadius: 0, yAxisID: "y1" },
          { label: "누적 라이프 이벤트", data: cumLifeArr, borderColor: "#c43d45", borderDash: [6, 4], fill: false, pointRadius: 0, yAxisID: "y1" },
        ] },
        options: { responsive: true, maintainAspectRatio: false, scales: {
          y: { position: "left", title: { display: true, text: "소득(만원/년)" } },
          y1: { position: "right", title: { display: true, text: "누적(억)" }, grid: { drawOnChartArea: false }, ticks: { callback: (v) => v + "억" } },
        } },
      });
    }
    // 거주 후
    const s = document.getElementById("chartStay");
    if (s) {
      if (charts.stay) charts.stay.destroy();
      charts.stay = new window.Chart(s.getContext("2d"), {
        type: "line",
        data: { labels: r.stayCurve.map((p) => p.k), datasets: [
          { label: "잔여 자산", data: r.stayCurve.map((p) => eok(p.remain)), borderColor: "#00c896", borderWidth: 3, fill: false, tension: 0.25, pointRadius: 0 },
          { label: "누적 생활비", data: r.stayCurve.map((p) => eok(p.cumLife)), borderColor: "#BA7517", borderDash: [6, 4], fill: false, pointRadius: 0 },
        ] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (v) => v + "억" } }, x: { title: { display: true, text: "거주 연차" } } } },
      });
    }
  }

  /* ============================ 라이프 이벤트 목록 (모달) ============================ */
  function renderEventList() {
    const wrap = document.getElementById("evList");
    if (!wrap) return;
    const events = state.events || [];
    wrap.innerHTML = events.map((ev, idx) => {
      const badge = ev.type === "one_time" ? "결정" : ev.type === "probabilistic" ? "확률" : "시장";
      let body = "";
      if (ev.type === "one_time") {
        body = `<label><span>시점 (와이프 나이)</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="atAge" value="${Number(ev.atAge) || 0}" /></label>
                <label><span>비용 (현재가치, 만원)</span><input type="number" min="0" step="100" data-evidx="${idx}" data-evfield="amountToday" value="${Number(ev.amountToday) || 0}" /></label>`;
      } else if (ev.type === "probabilistic") {
        body = `<label><span>구간 시작</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="startAge" value="${Number(ev.startAge) || 0}" /></label>
                <label><span>구간 종료</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="endAge" value="${Number(ev.endAge) || 0}" /></label>
                <label><span>발생 확률 (%)</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="probabilityPct" value="${Math.round((Number(ev.probability) || 0) * 100)}" /></label>
                <label><span>발생 시 비용 (현재가치, 만원)</span><input type="number" min="0" step="100" data-evidx="${idx}" data-evfield="amountToday" value="${Number(ev.amountToday) || 0}" /></label>`;
      } else {
        body = `<label><span>구간 시작</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="startAge" value="${Number(ev.startAge) || 0}" /></label>
                <label><span>구간 종료</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="endAge" value="${Number(ev.endAge) || 0}" /></label>
                <label><span>발생 횟수 (구간 내)</span><input type="number" min="0" max="50" step="1" data-evidx="${idx}" data-evfield="expectedCount" value="${Number(ev.expectedCount) || 0}" /></label>
                <label><span>강도 (자산 손실 %)</span><input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="severityPct" value="${Math.round((Number(ev.severity) || 0) * 100)}" /></label>`;
      }
      return `<div class="ev-row" data-evcat="${ev.category}">
        <div class="ev-head"><label class="ev-toggle">
          <input type="checkbox" data-evidx="${idx}" data-evfield="enabled" ${ev.enabled ? "checked" : ""} />
          <strong>${esc(ev.label)}</strong>
          <span class="ev-badge ev-badge-${ev.type}">${badge}</span>
        </label></div>
        <div class="ev-body">${body}</div>
      </div>`;
    }).join("");
  }

  function updateReVisibility() {
    const mode = state.realEstateMode;
    document.querySelectorAll('[data-rerow="owned"]').forEach((el) => el.toggleAttribute("hidden", mode !== "owned"));
    document.querySelectorAll('[data-rerow="buy"]').forEach((el) => el.toggleAttribute("hidden", mode !== "buy_later"));
  }

  /* ============================ 이벤트 바인딩 ============================ */
  function bindAll() {
    const root = document.getElementById("simRoot");

    // 위임: input/change
    root.addEventListener("input", (e) => onValueChange(e.target));
    root.addEventListener("change", (e) => onValueChange(e.target));

    // 위임: click
    root.addEventListener("click", (e) => {
      const toggle = e.target.closest(".v2-card-toggle");
      if (toggle) { const card = toggle.closest(".v2-card"); const exp = card.querySelector(".v2-card-expand"); if (exp) { exp.hidden = !exp.hidden; toggle.textContent = exp.hidden ? "▾" : "▴"; } return; }
      const stay = e.target.closest("[data-stayout]");
      if (stay) { selectedN = Number(stay.dataset.stayout); state.stayYears = selectedN; persistState(); document.querySelectorAll("[data-stayout]").forEach((b) => { const a = Number(b.dataset.stayout) === selectedN; b.classList.toggle("is-active", a); b.setAttribute("aria-selected", a ? "true" : "false"); }); refresh(); return; }
      const tier = e.target.closest("[data-vtier]");
      if (tier) { state.tierId = tier.dataset.vtier; state.depositOverride = null; state.monthlyOverride = null; persistState(); buildUI(); return; }
      const ol = e.target.closest("[data-voutlook]");
      if (ol) { applyOutlook(ol.dataset.voutlook); return; }
    });

    // 어드밴스드 토글 상태 저장
    document.getElementById("v2Advanced")?.addEventListener("toggle", (e) => { state.advancedOpen = e.target.open; persistState(); });

    // 라이프 이벤트 토글
    document.getElementById("v2LifeEnabled")?.addEventListener("change", (e) => { state.lifeEventsEnabled = e.target.checked; persistState(); buildUI(); });

    // 모달 — 라이프 이벤트
    document.getElementById("v2LifeOpenBtn")?.addEventListener("click", () => openModal("v2LifeModal"));
    document.getElementById("v2ChartMoreBtn")?.addEventListener("click", () => { openModal("v2ChartModal"); setTimeout(() => renderModalCharts(compute(state)), 50); });
    document.querySelectorAll(".v2-modal-close").forEach((b) => b.addEventListener("click", (e) => { e.target.closest(".v2-modal").hidden = true; }));
    document.querySelectorAll(".v2-modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.hidden = true; }));

    // 라이프 이벤트 항목 입력
    document.getElementById("evList")?.addEventListener("input", onEventValue);
    document.getElementById("evList")?.addEventListener("change", onEventValue);
    document.getElementById("evResetBtn")?.addEventListener("click", () => {
      if (!confirm("라이프 이벤트를 모두 기본값으로 되돌릴까요?")) return;
      state.events = DEFAULT_EVENTS.map((e) => ({ ...e })); persistState(); renderEventList(); refresh();
    });

    // 시나리오 바
    document.getElementById("simSaveBtn")?.addEventListener("click", saveScenario);
    document.getElementById("simResetBtn")?.addEventListener("click", resetState);
    document.getElementById("simScenSelect")?.addEventListener("change", (e) => { if (e.target.value) applyScenario(e.target.value); });
  }

  function openModal(id) { const m = document.getElementById(id); if (m) m.hidden = false; }

  function onEventValue(e) {
    const el = e.target;
    const idx = el.dataset.evidx;
    const field = el.dataset.evfield;
    if (idx == null || !field) return;
    const i = Number(idx);
    if (!state.events[i]) return;
    if (field === "enabled") state.events[i].enabled = el.checked;
    else if (field === "probabilityPct") state.events[i].probability = Math.max(0, Math.min(100, Number(el.value) || 0)) / 100;
    else if (field === "severityPct") state.events[i].severity = Math.max(0, Math.min(100, Number(el.value) || 0)) / 100;
    else state.events[i][field] = Number(el.value) || 0;
    persistState();
    scheduleRefresh();
  }

  function onValueChange(el) {
    const key = el.dataset.vkey;
    if (!key) return;
    const val = el.type === "checkbox" ? el.checked : el.value;
    switch (key) {
      // 직접 매핑(숫자)
      case "wifeAge": case "husbandAge": case "entryAge":
      case "cashCurrent": case "investmentCurrent": case "realEstateCurrent":
      case "realEstateBuyYear": case "realEstateBuyPriceToday":
      case "wifeIncome": case "husbandIncome": case "peakAge":
      case "retireWife": case "retireHusband": case "pensionStartAge":
      case "bufferToday":
        state[key] = Number(val) || 0; break;
      case "depositOverride": case "monthlyOverride": case "sellYearCustom": case "pensionMonthlyOverride":
        state[key] = val === "" ? null : Number(val); break;
      // 비율 (pct → 소수)
      case "savingsRatePct": state.savingsRate = Math.max(0, Math.min(60, Number(val) || 0)) / 100; break;
      case "netFactorPct": state.netFactor = Math.max(0.6, Math.min(0.95, (Number(val) || 0) / 100)); break;
      case "inflationPct": state.inflation = Math.max(0, Math.min(8, Number(val) || 0)) / 100; break;
      case "investReturnPct": state.investReturn = Math.max(0, Math.min(12, Number(val) || 0)) / 100; break;
      case "cashReturnPct": state.cashReturn = Math.max(0, Math.min(6, Number(val) || 0)) / 100; break;
      case "reReturnPct": state.reReturn = Math.max(0, Math.min(8, Number(val) || 0)) / 100; break;
      case "incomeGrowthPct": state.incomeGrowth = Math.max(0, Math.min(10, Number(val) || 0)) / 100; break;
      case "allocCashPct": state.allocCash = Math.max(0, Math.min(100, Number(val) || 0)) / 100; break;
      case "inResidenceRealPct": state.inResidenceReal = Math.max(-2, Math.min(5, Number(val) || 0)) / 100; break;
      case "reSellCostPct": state.reSellCost = Math.max(0, Math.min(12, Number(val) || 0)) / 100; break;
      case "medicalPremiumPct": state.medicalPremium = Math.max(0, Math.min(5, Number(val) || 0)) / 100; break;
      // 자산 메인 슬라이더 (cash + inv 합계 → 기존 비율 유지)
      case "liquidTotal": {
        const newTotal = Math.max(0, Number(val) || 0);
        const oldTotal = state.cashCurrent + state.investmentCurrent;
        if (oldTotal > 0) {
          const ratio = state.cashCurrent / oldTotal;
          state.cashCurrent = Math.round(newTotal * ratio);
          state.investmentCurrent = newTotal - state.cashCurrent;
        } else {
          state.cashCurrent = Math.round(newTotal * 0.3);
          state.investmentCurrent = newTotal - state.cashCurrent;
        }
        break;
      }
      // 토글/셀렉트
      case "realEstateMode": state[key] = val; updateReVisibility(); break;
      case "sellMode": state[key] = val; break;
      case "refundable": case "pensionAuto": state[key] = !!val; break;
      default:
        state[key] = val; break;
    }
    persistState();
    scheduleRefresh();
  }

  /* ============================ 메인 refresh ============================ */
  function refresh() {
    if (!built) return;
    let r;
    try { r = compute(state); } catch (err) { const al = document.getElementById("v2HeroAlert"); if (al) { al.dataset.kind = "bad"; al.textContent = "계산 오류: " + err.message; } return; }
    renderHero(r);
    renderMetrics(r);
    syncCardValues(r);
    renderMainChart(r);
    // 라이프 이벤트 라벨 갱신
    const bar = document.querySelector(".v2-life-bar strong");
    if (bar) bar.textContent = `🪦 라이프 이벤트 ${state.lifeEventsEnabled ? "적용" : "미적용"}`;
  }

  /* ============================ 시나리오 (v1 동일) ============================ */
  async function loadScenarioList() {
    const sel = document.getElementById("simScenSelect");
    if (!sel) return;
    let list = [];
    try { const res = await fetch(SCEN_API, { headers: { accept: "application/json" }, cache: "no-store" }); if (res.ok) list = await res.json(); else throw 0; }
    catch { list = lsScenarios(); }
    sel.innerHTML = `<option value="">시나리오 불러오기…</option>` + list.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.is_default ? " ★" : ""}</option>`).join("");
  }
  function lsScenarios() { try { return JSON.parse(localStorage.getItem(LS_SCEN) || "[]"); } catch { return []; } }
  function lsSaveScenarios(list) { try { localStorage.setItem(LS_SCEN, JSON.stringify(list)); } catch {} }

  async function saveScenario() {
    const name = prompt("시나리오 이름을 입력하세요", "내 시나리오");
    if (!name) return;
    const payload = scenarioFromState(name);
    try { const res = await fetch(SCEN_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); if (!res.ok) throw 0; toast("시나리오를 DB에 저장했습니다."); }
    catch { const list = lsScenarios(); list.unshift(Object.assign({ id: "ls-" + Date.now(), is_default: false }, payload)); lsSaveScenarios(list); toast("오프라인 저장(localStorage)했습니다."); }
    loadScenarioList();
  }
  async function applyScenario(id) {
    let scen = null;
    try { const res = await fetch(`${SCEN_API}/${encodeURIComponent(id)}`, { cache: "no-store" }); if (res.ok) scen = await res.json(); else throw 0; }
    catch { scen = lsScenarios().find((s) => String(s.id) === String(id)); }
    if (!scen) { toast("시나리오를 찾을 수 없습니다."); return; }
    state = Object.assign({}, DEFAULTS, stateFromScenario(scen));
    selectedN = clampStayToOption(state.stayYears);
    persistState(); buildUI(); toast(`'${scen.name}' 적용됨`);
  }
  function resetState() {
    if (!confirm("모든 입력을 기본값으로 되돌릴까요?")) return;
    state = Object.assign({}, DEFAULTS, { events: DEFAULT_EVENTS.map((e) => ({ ...e })) });
    selectedN = 10; persistState(); buildUI();
  }

  function scenarioFromState(name) {
    const s = state;
    return {
      name, description: "", base_year: BASE_YEAR,
      wife_age: s.wifeAge, husband_age: s.husbandAge, entry_age: s.entryAge, stay_years: selectedN,
      cash_current: s.cashCurrent, investment_current: s.investmentCurrent, real_estate_current: s.realEstateCurrent,
      has_real_estate: s.realEstateMode === "owned",
      real_estate_mode: s.realEstateMode, real_estate_buy_year: s.realEstateBuyYear, real_estate_buy_price_today: s.realEstateBuyPriceToday,
      sell_mode: s.sellMode, sell_year_custom: s.sellYearCustom, re_sell_cost_rate: s.reSellCost,
      wife_income: s.wifeIncome, husband_income: s.husbandIncome, net_factor: s.netFactor,
      income_growth_rate: s.incomeGrowth, income_peak_age: s.peakAge,
      tier_id: s.tierId, deposit_override: s.depositOverride, monthly_cost_override: s.monthlyOverride,
      refundable: s.refundable, medical_premium_rate: s.medicalPremium,
      inflation_rate: s.inflation, investment_return: s.investReturn, cash_return: s.cashReturn, real_estate_return: s.reReturn,
      savings_rate: s.savingsRate, savings_alloc_cash: s.allocCash, in_residence_real_return: s.inResidenceReal,
      retire_age_wife: s.retireWife, retire_age_husband: s.retireHusband, pension_start_age: s.pensionStartAge,
      pension_auto: s.pensionAuto, pension_monthly_override: s.pensionMonthlyOverride, medical_buffer_today: s.bufferToday,
      life_events: Array.isArray(s.events) ? s.events : [],
    };
  }
  function stateFromScenario(d) {
    const num = (v, f) => (v == null ? f : Number(v));
    return {
      wifeAge: num(d.wife_age, 28), husbandAge: num(d.husband_age, 33), entryAge: num(d.entry_age, 75), stayYears: num(d.stay_years, 10),
      cashCurrent: num(d.cash_current, 0), investmentCurrent: num(d.investment_current, 0), realEstateCurrent: num(d.real_estate_current, 0),
      realEstateMode: d.real_estate_mode || (d.has_real_estate ? "owned" : "none"),
      realEstateBuyYear: d.real_estate_buy_year == null ? 5 : Number(d.real_estate_buy_year),
      realEstateBuyPriceToday: d.real_estate_buy_price_today == null ? 70000 : Number(d.real_estate_buy_price_today),
      sellMode: d.sell_mode || "at_entry", sellYearCustom: d.sell_year_custom, reSellCost: num(d.re_sell_cost_rate, 0.04),
      wifeIncome: num(d.wife_income, 5800), husbandIncome: num(d.husband_income, 5600), netFactor: num(d.net_factor, 0.83),
      incomeGrowth: num(d.income_growth_rate, 0.04), peakAge: num(d.income_peak_age, 55), peakFlat: true,
      tierId: d.tier_id || "mid", depositOverride: d.deposit_override, monthlyOverride: d.monthly_cost_override,
      refundable: d.refundable == null ? true : !!d.refundable, medicalPremium: num(d.medical_premium_rate, 0.015),
      inflation: num(d.inflation_rate, 0.03), investReturn: num(d.investment_return, 0.06), cashReturn: num(d.cash_return, 0.025), reReturn: num(d.real_estate_return, 0.03),
      savingsRate: num(d.savings_rate, 0.3), allocCash: num(d.savings_alloc_cash, 0.3), inResidenceReal: num(d.in_residence_real_return, 0.01),
      retireWife: num(d.retire_age_wife, 60), retireHusband: num(d.retire_age_husband, 60), pensionStartAge: num(d.pension_start_age, 65),
      pensionAuto: d.pension_auto == null ? true : !!d.pension_auto, pensionMonthlyOverride: d.pension_monthly_override, bufferToday: num(d.medical_buffer_today, 20000),
      events: Array.isArray(d.life_events) && d.life_events.length ? d.life_events : DEFAULT_EVENTS.map((e) => ({ ...e })),
      lifeEventsEnabled: true, advancedOpen: false,
    };
  }

  function toast(msg) {
    let t = document.getElementById("simToast");
    if (!t) { t = document.createElement("div"); t.id = "simToast"; t.className = "sim-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ============================ 등급 로드 ============================ */
  async function loadTiers() {
    try { const res = await fetch(TIER_API, { cache: "no-store" }); if (res.ok) { const data = await res.json(); if (Array.isArray(data) && data.length) TIERS = data; } } catch {}
  }

  /* ============================ 탭 라우터 ============================ */
  function activateTab(name) {
    if (name !== "simulator" && name !== "listings") name = "listings";
    document.querySelectorAll("[data-tab]").forEach((el) => { el.hidden = el.dataset.tab !== name; });
    document.querySelectorAll(".tab-button").forEach((btn) => {
      const active = btn.dataset.target === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll("[data-listings-only]").forEach((el) => { el.style.display = name === "listings" ? "" : "none"; });
    const tag = document.getElementById("topbarTagline");
    if (tag) tag.textContent = name === "simulator" ? "와이프 75세 실버타운까지, 우리 자금이 충분한지 한눈에" : "찜한 매물을 비교하고 임장 기록을 남기는 작업대";
    try { localStorage.setItem(LS_TAB, name); } catch {}
    if (name === "simulator") {
      if (location.hash !== "#simulator") history.replaceState(null, "", "#simulator");
      if (!built) buildUI(); else refresh();
    } else if (location.hash === "#simulator") {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function initTabs() {
    const buttons = Array.from(document.querySelectorAll(".tab-button"));
    buttons.forEach((btn, i) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.target));
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          const next = buttons[(i + dir + buttons.length) % buttons.length];
          next.focus(); activateTab(next.dataset.target);
        }
      });
    });
    let initial = "listings";
    if (location.hash === "#simulator") initial = "simulator";
    else { try { initial = localStorage.getItem(LS_TAB) || "listings"; } catch {} }
    activateTab(initial);
    window.addEventListener("hashchange", () => { if (location.hash === "#simulator") activateTab("simulator"); });
  }

  function start() { initTabs(); loadTiers().then(() => { if (built) buildUI(); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
