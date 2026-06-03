/* JIPJIP 노후 자금 시뮬레이터 — 자족형 모듈 (app.js와 독립)
 * 단위 규칙: 금액=만원, 비율=소수(0.03=3%), 나이/연수=정수.
 * 계산은 100% 클라이언트에서 수행 → 정적 호스팅(GitHub Pages)에서도 완전 동작.
 * 시나리오 영속화는 /api/scenarios 우선, 실패 시 localStorage 폴백.
 */
(function () {
  "use strict";

  const BASE_YEAR = 2026;
  const SCEN_API = "/api/scenarios";
  const TIER_API = "/api/tiers";
  const LS_SCEN = "jipjip:sim:scenarios:v1";
  const LS_STATE = "jipjip:sim:state:v1";
  const LS_TAB = "jipjip:lastTab";

  // 등급 프리셋 폴백 (DB/api 미연결 시). 근거: docs/silver-town-research.md
  const TIER_FALLBACK = [
    { id: "top",  label: "최상급", deposit_base: 100000, monthly_cost_base: 450, refundable: true, notes: "더클래식500·VL르웨스트·삼성노블 대형 (보증금 8~12억, 월 350~500만)" },
    { id: "high", label: "상급",   deposit_base: 55000,  monthly_cost_base: 350, refundable: true, notes: "삼성노블 중형·더시그넘·서울시니어스 대형 (보증금 4~7억, 월 280~400만)" },
    { id: "mid",  label: "중급",   deposit_base: 30000,  monthly_cost_base: 250, refundable: true, notes: "노블레스타워·마리스텔라·서울시니어스 중형 (보증금 2.5~4억, 월 200~280만)" },
    { id: "low",  label: "하급",   deposit_base: 20000,  monthly_cost_base: 180, refundable: true, notes: "스프링카운티·사이언스빌리지 등 도심소형/비수도권 (보증금 1.5~2.5억, 월 150~200만)" },
  ];
  let TIERS = TIER_FALLBACK.slice();

  // 라이프 이벤트 기본값 (와이프 나이 기준, 금액=만원/현재가치)
  // 출처: 한국소비자원 장례비 평균, 국립암센터 누적암발생률, 베어마켓 통계
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
  };

  let state = loadState();
  let selectedN = clampStayToOption(state.stayYears);
  let built = false;
  let charts = { assets: null, income: null, stay: null };
  let refreshTimer = null;

  /* ============================ 계산 코어 ============================ */
  function tierById(id) { return TIERS.find((t) => t.id === id) || TIERS[2] || TIER_FALLBACK[2]; }

  function depositMan(s) {
    return s.depositOverride != null ? Number(s.depositOverride) : Number(tierById(s.tierId).deposit_base);
  }
  function monthlyMan(s) {
    return s.monthlyOverride != null ? Number(s.monthlyOverride) : Number(tierById(s.tierId).monthly_cost_base);
  }

  function incomeAt(s, t) {
    const ageW = s.wifeAge + t, ageH = s.husbandAge + t;
    const g = s.incomeGrowth;
    const peakTW = Math.max(0, s.peakAge - s.wifeAge);
    const expo = (tt) => (s.peakFlat ? Math.min(tt, peakTW) : tt <= peakTW ? tt : peakTW);
    const w = ageW < s.retireWife ? s.wifeIncome * Math.pow(1 + g, expo(t)) : 0;
    const h = ageH < s.retireHusband ? s.husbandIncome * Math.pow(1 + g, expo(t)) : 0;
    return { wife: w, husband: h, gross: w + h };
  }

  // 라이프 이벤트: 결정/확률/시장충격 3타입을 그 해 명목 비용·시장 손실율로 환산
  function lifeEventsAtAge(s, ageW, t) {
    const events = Array.isArray(s.events) ? s.events : [];
    let cost = 0;          // 그 해 라이프 이벤트 지출 (명목, 만원)
    let shockRate = 0;     // 그 해 inv 차감율 (시장 충격, 0~1)
    const spikes = [];     // 그 해 발생한 결정적 이벤트 목록
    const inflFactor = Math.pow(1 + s.inflation, t);
    for (const ev of events) {
      if (!ev || !ev.enabled) continue;
      if (ev.type === "one_time") {
        if (Number(ev.atAge) === ageW) {
          const amt = Math.max(0, Number(ev.amountToday) || 0) * inflFactor;
          cost += amt;
          spikes.push({ id: ev.id, label: ev.label, amount: amt });
        }
      } else if (ev.type === "probabilistic") {
        const a0 = Number(ev.startAge), a1 = Number(ev.endAge);
        if (ageW >= a0 && ageW <= a1) {
          const years = Math.max(1, a1 - a0 + 1);
          const annualExpected = (Math.max(0, Math.min(1, Number(ev.probability) || 0)) * Math.max(0, Number(ev.amountToday) || 0)) / years;
          cost += annualExpected * inflFactor;
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
    const yearsW = Math.min(Math.max(s.retireWife - 23, 0), 40); // 와이프 2021년 23세 가입 가정
    const yearsH = Math.min(Math.max(s.retireHusband - 28, 0), 40); // 남편 2021년 28세 가입 가정
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
    let W = {
      cash: Math.max(0, s.cashCurrent),
      inv: Math.max(0, s.investmentCurrent),
      re: mode === "owned" ? Math.max(0, s.realEstateCurrent) : 0,
    };
    const buyYear = mode === "buy_later" ? Math.max(0, Number(s.realEstateBuyYear) || 0) : null;
    const sellYear = mode === "none" ? Infinity
      : s.sellMode === "at_entry" ? T
      : s.sellMode === "custom" ? Number(s.sellYearCustom)
      : Infinity;
    let sellProceeds = 0, sellAtYear = null;
    let buyAtYear = null, buyPriceNominal = 0, purchaseShortfall = 0;
    let cumLifeEvents = 0;          // 누적 라이프 이벤트 지출 (명목)
    let cumLifeEventsToday = 0;     // 누적 라이프 이벤트 지출 (현재가치)
    let totalShockLoss = 0;         // 누적 시장 충격 손실 추정 (명목, 표시용)
    const lifeEventSeries = [];     // [{t, year, ageW, cost, cumNom, cumToday}]
    const lifeEventSpikes = [];     // 일회성 이벤트 발생 기록 (카드/툴팁용)

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

      // 라이프 이벤트 (t+1 시점) — 시장 충격은 inv에서 차감, 비용은 cash→inv 순
      const nextAgeW = s.wifeAge + t + 1;
      const lev = lifeEventsAtAge(s, nextAgeW, t + 1);
      if (lev.shockRate > 0 && W.inv > 0) {
        const loss = W.inv * lev.shockRate;
        W.inv = Math.max(0, W.inv - loss);
        totalShockLoss += loss;
      }
      if (lev.cost > 0) {
        let needE = lev.cost;
        const fromCashE = Math.min(W.cash, needE); W.cash = Math.max(0, W.cash - fromCashE); needE -= fromCashE;
        const fromInvE = Math.min(W.inv, needE); W.inv = Math.max(0, W.inv - fromInvE); needE -= fromInvE;
        cumLifeEvents += lev.cost;
        cumLifeEventsToday += lev.cost / Math.pow(1 + infl, t + 1);
        lifeEventSeries.push({ t: t + 1, year: BASE_YEAR + t + 1, ageW: nextAgeW, cost: lev.cost, cumNom: cumLifeEvents, cumToday: cumLifeEventsToday });
        lev.spikes.forEach((sp) => lifeEventSpikes.push({ ageW: nextAgeW, year: BASE_YEAR + t + 1, label: sp.label, amount: sp.amount }));
      }

      // 미래 매입: 매입 시점에 도달하면 cash → inv 순으로 매입가 조달
      if (mode === "buy_later" && buyAtYear == null && t + 1 === buyYear) {
        const priceToday = Math.max(0, Number(s.realEstateBuyPriceToday) || 0);
        const priceNom = priceToday * Math.pow(1 + s.reReturn, buyYear);
        let need = priceNom;
        const fromCash = Math.min(W.cash, need); W.cash = Math.max(0, W.cash - fromCash); need -= fromCash;
        const fromInv  = Math.min(W.inv,  need); W.inv  = Math.max(0, W.inv  - fromInv);  need -= fromInv;
        W.re = priceNom;
        buyAtYear = t + 1; buyPriceNominal = priceNom;
        if (need > 0) purchaseShortfall = need;
      }

      // 매도: 보유 부동산을 매도 시점에 처분 → inv로 흡수
      if (t + 1 === sellYear && W.re > 0) {
        sellProceeds = W.re * (1 - s.reSellCost);
        sellAtYear = t + 1;
        W.inv += sellProceeds;
        W.re = 0;
      }
    }

    const fEntry = Math.pow(1 + infl, T);
    const dep = depositMan(s);
    const mon = monthlyMan(s);
    const annualMan = mon * 12;
    const depositNom = dep * fEntry;
    const bufferNom = s.bufferToday * fEntry;
    const rrReal = s.inResidenceReal; // 거주 중 잔여자산 실질수익률
    const W0total = Math.max(0, s.cashCurrent) + Math.max(0, s.investmentCurrent) + (mode === "owned" ? Math.max(0, s.realEstateCurrent) : 0);
    const W75 = series[T];

    function needs(N) {
      const x = 1 / (1 + rrReal);
      const feeFactor = Math.abs(rrReal) < 1e-9 ? N : (1 - Math.pow(x, N)) / (1 - x);
      const kFees = annualMan * fEntry * feeFactor;
      const totalNom = depositNom + kFees + bufferNom;
      const netSpent = kFees + bufferNom + (s.refundable ? 0 : depositNom);
      const requiredCagr = W0total > 0 ? Math.pow(totalNom / W0total, 1 / T) - 1 : null;
      return {
        N, kFees, totalNom, totalToday: totalNom / fEntry, netSpent,
        gap: W75.total - totalNom, achieve: totalNom > 0 ? W75.total / totalNom : 0, requiredCagr,
      };
    }

    const needsByN = { 10: needs(10), 20: needs(20), 30: needs(30) };

    // 차트3: 입주 후 거주 중 잔여자산 소진 (선택 N과 무관하게 30년)
    const stayCurve = [];
    const inflStay = infl + s.medicalPremium;
    const nominalStayReturn = infl + s.inResidenceReal;
    let remain = Math.max(0, W75.total - depositNom - bufferNom); // 생활비 충당 가용분(보증금·버퍼 제외)
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
      lifeEventSeries, lifeEventSpikes,
      cumLifeEvents, cumLifeEventsToday, totalShockLoss,
      // 75세 시점까지 누적 라이프 이벤트 (메트릭 카드용)
      cumLifeEventsAt75: lifeEventSeries.filter((p) => p.t <= T).reduce((m, p) => Math.max(m, p.cumNom), 0),
      cumLifeEventsTodayAt75: lifeEventSeries.filter((p) => p.t <= T).reduce((m, p) => Math.max(m, p.cumToday), 0),
    };
  }

  /* ============================ 포맷 ============================ */
  function won(man) {
    if (man == null || !isFinite(man)) return "-";
    const neg = man < 0, a = Math.abs(man);
    let s;
    if (a >= 10000) s = (a / 10000).toFixed(1) + "억";
    else s = Math.round(a).toLocaleString() + "만";
    return (neg ? "−" : "") + s;
  }
  function eok(man) { return man / 10000; }
  function pct(x) { return x == null ? "-" : (x * 100).toFixed(1) + "%"; }
  function todayMan(nomMan, t, infl) { return nomMan / Math.pow(1 + infl, t); }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }

  /* ============================ 상태 저장/로드 ============================ */
  function loadState() {
    try {
      const raw = localStorage.getItem(LS_STATE);
      if (raw) {
        const merged = Object.assign({}, DEFAULTS, JSON.parse(raw));
        if (!Array.isArray(merged.events) || !merged.events.length) merged.events = DEFAULT_EVENTS.map((e) => ({ ...e }));
        return merged;
      }
    } catch {}
    return Object.assign({}, DEFAULTS, { events: DEFAULT_EVENTS.map((e) => ({ ...e })) });
  }
  function persistState() { try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch {} }
  function clampStayToOption(v) { return [10, 20, 30].includes(Number(v)) ? Number(v) : 10; }

  function setVal(key, value) {
    state[key] = value;
    persistState();
    scheduleRefresh();
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 140);
  }

  /* ============================ UI: 입력 컨트롤 빌더 ============================ */
  // 멀티모드(슬라이더 + 숫자 + 프리셋). value는 비율(소수) 또는 정수.
  function rangeCtrl(key, label, o) {
    const v = state[key];
    const disp = o.percent ? pct(v) : (o.scale ? (v / o.scale) : v) + (o.unit || "");
    const num = o.percent ? (v * 100) : (o.scale ? v / o.scale : v);
    const presets = (o.presets || []).map((p) =>
      `<button type="button" class="sim-preset" data-key="${key}" data-role="preset" data-value="${p.value}">${esc(p.label)}</button>`
    ).join("");
    return `
      <div class="sim-ctrl" data-ctrl="${key}">
        <div class="sim-ctrl-head"><label for="r-${key}">${esc(label)}</label><output id="o-${key}">${disp}</output></div>
        <input type="range" id="r-${key}" data-key="${key}" data-role="range"
               min="${o.min}" max="${o.max}" step="${o.step}" value="${o.percent ? v * 100 : (o.scale ? v / o.scale : v)}" />
        <div class="sim-ctrl-foot">
          <div class="sim-presets">${presets}</div>
          <div class="sim-num"><input type="number" id="n-${key}" data-key="${key}" data-role="number"
               min="${o.min}" max="${o.max}" step="${o.step}" value="${round2(num)}" /><span>${o.percent ? "%" : (o.unit || "")}</span></div>
        </div>
        ${o.help ? `<p class="sim-help">${esc(o.help)}</p>` : ""}
      </div>`;
  }
  function numCtrl(key, label, o) {
    o = o || {};
    const v = state[key];
    const shown = o.scale ? (v == null ? "" : v / o.scale) : (v == null ? "" : v);
    return `
      <label class="sim-field">
        <span>${esc(label)}${o.unit ? ` <em>(${o.unit})</em>` : ""}</span>
        <input type="number" data-key="${key}" data-role="numfield" ${o.scale ? `data-scale="${o.scale}"` : ""}
               ${o.min != null ? `min="${o.min}"` : ""} ${o.max != null ? `max="${o.max}"` : ""} step="${o.step || 1}" value="${shown}" />
      </label>`;
  }
  function toggleCtrl(key, label, help) {
    return `
      <label class="sim-toggle">
        <input type="checkbox" data-key="${key}" data-role="toggle" ${state[key] ? "checked" : ""} />
        <span>${esc(label)}</span>${help ? `<em>${esc(help)}</em>` : ""}
      </label>`;
  }
  function round2(x) { return Math.round((Number(x) + Number.EPSILON) * 100) / 100; }

  /* ============================ UI: 빌드 ============================ */
  function buildUI() {
    const root = document.getElementById("simRoot");
    if (!root) return;
    const tierButtons = TIERS.map((t) =>
      `<button type="button" class="sim-tier ${state.tierId === t.id ? "is-active" : ""}" data-tier="${t.id}" title="${esc(t.notes)}">
         <strong>${esc(t.label)}</strong><span>${won(t.deposit_base)} · 월 ${won(t.monthly_cost_base)}</span>
       </button>`
    ).join("");

    root.innerHTML = `
      <div class="sim-grid">
        <aside class="sim-inputs">
          <div class="sim-scenbar">
            <select id="simScenSelect" aria-label="시나리오 선택"><option value="">시나리오 불러오기…</option></select>
            <button type="button" id="simSaveBtn" class="secondary-button">저장</button>
            <button type="button" id="simResetBtn" class="ghost-button">초기화</button>
          </div>

          <details class="sim-sec" open><summary>👤 프로필</summary>
            <div class="sim-sec-body">
              ${numCtrl("wifeAge", "와이프 현재 나이", { unit: "세", min: 18, max: 60 })}
              ${numCtrl("husbandAge", "남편 현재 나이", { unit: "세", min: 18, max: 65 })}
              ${numCtrl("entryAge", "입주 나이(와이프 기준)", { unit: "세", min: 60, max: 90 })}
              <div class="sim-field"><span>거주 기간</span>
                <div class="sim-radio" id="stayRadio">
                  ${[10, 20, 30].map((n) => `<button type="button" data-stay="${n}" class="${selectedN === n ? "is-active" : ""}">${n}년</button>`).join("")}
                </div>
              </div>
            </div>
          </details>

          <details class="sim-sec" open><summary>💰 자산 현황</summary>
            <div class="sim-sec-body">
              ${numCtrl("cashCurrent", "현금성 자산", { unit: "억", scale: 10000, min: 0, step: 0.1 })}
              ${numCtrl("investmentCurrent", "투자 자산", { unit: "억", scale: 10000, min: 0, step: 0.1 })}

              <label class="sim-field"><span>부동산 상태</span>
                <select data-key="realEstateMode" data-role="select">
                  <option value="owned">현재 보유 중</option>
                  <option value="buy_later">미래에 매입 예정</option>
                  <option value="none">매입 계획 없음</option>
                </select>
              </label>

              <div data-rerow="owned">${numCtrl("realEstateCurrent", "현재 부동산 시세", { unit: "억", scale: 10000, min: 0, step: 0.1 })}</div>

              <div data-rerow="buy">
                ${numCtrl("realEstateBuyYear", "매입까지 연수", { unit: "년 후", min: 0, max: 50, step: 1 })}
                ${numCtrl("realEstateBuyPriceToday", "매입 예정가 (현재가치 입력)", { unit: "억", scale: 10000, min: 0, step: 0.1 })}
                <p class="sim-help">매입 시점 가격 = 입력값 × (1+부동산상승률)^연수. 현금→투자 순으로 자금 차감, 부족하면 경고합니다.</p>
              </div>

              <div data-rerow="sell">
                <label class="sim-field"><span>매도 처리</span>
                  <select data-key="sellMode" data-role="select">
                    <option value="at_entry">입주 시점에 매도</option>
                    <option value="keep">계속 보유</option>
                    <option value="custom">지정 연도에 매도</option>
                  </select>
                </label>
                ${numCtrl("sellYearCustom", "매도까지 연수(지정 시)", { unit: "년 후", min: 0, max: 60, step: 1 })}
                ${rangeCtrl("reSellCost", "부동산 양도·중개 비용", { min: 0, max: 12, step: 0.5, percent: true, help: "매도가에서 차감(양도세+중개비 근사)" })}
              </div>
            </div>
          </details>

          <details class="sim-sec"><summary>🏢 소득</summary>
            <div class="sim-sec-body">
              ${numCtrl("wifeIncome", "와이프 세전 연봉", { unit: "만원", min: 0, step: 100 })}
              ${numCtrl("husbandIncome", "남편 세전 연봉", { unit: "만원", min: 0, step: 100 })}
              ${rangeCtrl("netFactor", "실수령 환산", { min: 70, max: 95, step: 1, percent: true, help: "세전 대비 실수령(4대보험·세금 반영)" })}
              ${rangeCtrl("incomeGrowth", "소득 상승률(피크까지)", { min: 0, max: 10, step: 0.5, percent: true, presets: [{ label: "보수 2%", value: 2 }, { label: "중립 4%", value: 4 }, { label: "공격 6%", value: 6 }] })}
              ${numCtrl("peakAge", "소득 피크 나이(와이프)", { unit: "세", min: 45, max: 60 })}
            </div>
          </details>

          <details class="sim-sec"><summary>🏡 실버타운</summary>
            <div class="sim-sec-body">
              <div class="sim-field"><span>등급 선택 <em id="tierTag">(${esc(tierById(state.tierId).label)})</em></span>
                <div class="sim-tiers" id="tierBtns">${tierButtons}</div>
              </div>
              ${numCtrl("depositOverride", "보증금(직접 지정 시)", { unit: "억", scale: 10000, min: 0, step: 0.1 })}
              ${numCtrl("monthlyOverride", "월 생활비(직접 지정 시)", { unit: "만원", min: 0, step: 10 })}
              ${toggleCtrl("refundable", "보증금 반환형", "퇴거 시 보증금 환급(소진액에서 제외)")}
              ${rangeCtrl("medicalPremium", "거주 중 의료·돌봄 물가 가산", { min: 0, max: 5, step: 0.5, percent: true, help: "일반 물가 + 가산율(요양 단계 대비)" })}
            </div>
          </details>

          <details class="sim-sec" open><summary>📈 시뮬레이션 가정</summary>
            <div class="sim-sec-body">
              ${rangeCtrl("inflation", "물가상승률", { min: 0, max: 8, step: 0.5, percent: true, presets: [{ label: "보수 2%", value: 2 }, { label: "중립 3%", value: 3 }, { label: "공격 5%", value: 5 }] })}
              ${rangeCtrl("investReturn", "투자자산 수익률", { min: 0, max: 12, step: 0.5, percent: true, presets: [{ label: "보수 3%", value: 3 }, { label: "중립 6%", value: 6 }, { label: "공격 9%", value: 9 }] })}
              ${rangeCtrl("cashReturn", "현금성 수익률", { min: 0, max: 6, step: 0.5, percent: true, presets: [{ label: "보수 1.5%", value: 1.5 }, { label: "중립 2.5%", value: 2.5 }, { label: "공격 4%", value: 4 }] })}
              ${rangeCtrl("reReturn", "부동산 가치 증가율", { min: 0, max: 8, step: 0.5, percent: true, presets: [{ label: "보수 1%", value: 1 }, { label: "중립 3%", value: 3 }, { label: "공격 5%", value: 5 }] })}
              ${rangeCtrl("savingsRate", "저축률(실수령 대비)", { min: 0, max: 60, step: 1, percent: true, presets: [{ label: "보수 15%", value: 15 }, { label: "중립 30%", value: 30 }, { label: "공격 45%", value: 45 }] })}
              ${rangeCtrl("allocCash", "신규 저축 중 현금 비중", { min: 0, max: 100, step: 5, percent: true, help: "나머지는 투자 자산으로 적립" })}
              ${rangeCtrl("inResidenceReal", "거주 중 잔여자산 실질수익률", { min: -2, max: 5, step: 0.5, percent: true })}
            </div>
          </details>

          <details class="sim-sec"><summary>👵 은퇴 & 국민연금</summary>
            <div class="sim-sec-body">
              ${numCtrl("retireWife", "와이프 은퇴 나이", { unit: "세", min: 50, max: 70 })}
              ${numCtrl("retireHusband", "남편 은퇴 나이", { unit: "세", min: 50, max: 70 })}
              ${numCtrl("pensionStartAge", "국민연금 수령 개시(와이프)", { unit: "세", min: 60, max: 70 })}
              ${toggleCtrl("pensionAuto", "국민연금 자동 추정", "2021년 가입 기준 단순 추정")}
              ${numCtrl("pensionMonthlyOverride", "국민연금 월액(수동, 부부)", { unit: "만원", min: 0, step: 10 })}
            </div>
          </details>

          <details class="sim-sec"><summary>🛟 버퍼</summary>
            <div class="sim-sec-body">
              ${numCtrl("bufferToday", "의료·예비비 버퍼(현재가치)", { unit: "억", scale: 10000, min: 0, step: 0.1 })}
            </div>
          </details>

          <details class="sim-sec"><summary>🪦 라이프 이벤트 (예측 가능한 큰 지출)</summary>
            <div class="sim-sec-body">
              <p class="sim-help">결정/확률/시장충격 3종. <b>결정적</b> 사건은 시점·비용을 입력합니다. <b>확률적</b> 사건은 구간·확률·비용 → 기대값(연 평균)이 매년 분산 적용됩니다. <b>시장 충격</b>은 47년 중 발생 횟수·강도 → 평균 손실이 매년 투자 자산에서 차감됩니다. 모든 비용은 <b>현재가치</b>로 입력하세요.</p>
              <div id="evList" class="ev-list"></div>
              <button type="button" id="evResetBtn" class="ghost-button">기본값으로 초기화</button>
            </div>
          </details>
        </aside>

        <main class="sim-output">
          <div class="sim-stay-toggle" role="tablist" aria-label="거주 기간">
            ${[10, 20, 30].map((n) => `<button type="button" role="tab" data-stayout="${n}" class="${selectedN === n ? "is-active" : ""}" aria-selected="${selectedN === n}">${n}년 거주</button>`).join("")}
          </div>
          <div id="simCards" class="sim-cards"></div>
          <div id="simAlert" class="sim-alert" hidden></div>

          <section class="sim-chart-card">
            <h3>자산 추이 <span>(명목 · 현금/투자/부동산)</span></h3>
            <div class="sim-canvas-wrap"><canvas id="chartAssets" role="img" aria-label="나이별 자산 추이 그래프"></canvas></div>
            <p id="chartAssetsFallback" class="sim-fallback" hidden></p>
          </section>

          <section class="sim-chart-card">
            <h3>소득 & 누적 저축 추이 <span>(가구 소득 · 국민연금 · 누적 저축)</span></h3>
            <div class="sim-canvas-wrap"><canvas id="chartIncome" role="img" aria-label="나이별 소득 추이 그래프"></canvas></div>
            <p id="chartIncomeFallback" class="sim-fallback" hidden></p>
          </section>

          <section class="sim-chart-card">
            <h3>입주 후 잔여자산 소진 <span>(거주 0~30년)</span></h3>
            <div class="sim-canvas-wrap"><canvas id="chartStay" role="img" aria-label="거주 연차별 잔여자산 그래프"></canvas></div>
            <p id="chartStayFallback" class="sim-fallback" hidden></p>
          </section>

          <details class="sim-glossary"><summary>📖 용어집 — 어려운 용어를 여기서 확인하세요</summary>
            <dl>
              <dt>명목 가치 (Nominal)</dt><dd>물가상승을 반영한 미래 시점의 실제 금액. 예: 47년 뒤 "10억"은 그 시점의 액면 금액.</dd>
              <dt>현재가치 / 오늘가치 (Present Value)</dt><dd>미래 금액을 오늘의 구매력으로 환산한 값. <code>현재가치 = 명목 ÷ (1+물가)^연수</code>. 미래 10억이 물가 3%·47년이면 오늘 약 2.5억의 구매력.</dd>
              <dt>물가상승률 (Inflation)</dt><dd>해마다 물가가 오르는 비율. 같은 돈의 구매력이 매년 줄어듭니다.</dd>
              <dt>복리 (Compound Interest)</dt><dd>원금뿐 아니라 그동안 불어난 수익에도 다시 수익이 붙는 것. 긴 기간일수록 효과가 큽니다.</dd>
              <dt>CAGR (연평균 복리 수익률)</dt><dd>여러 해에 걸친 성장률을 매년 일정한 복리로 환산한 값. "현재 자산 → 목표"에 매년 몇 %가 필요한지.</dd>
              <dt>실수령 환산</dt><dd>세전 연봉에서 4대보험·세금을 뺀 실제 통장 입금액 비율. 기본 83% 가정.</dd>
              <dt>실질 수익률 (Real Return)</dt><dd>명목 수익률에서 물가상승률을 뺀, 구매력 기준의 진짜 수익률.</dd>
              <dt>보증금 반환형</dt><dd>실버타운 퇴거 시 보증금을 (대부분 전액) 돌려받는 임대 방식. 거주 중에는 묶이지만 최종 소진액에서는 빠집니다.</dd>
              <dt>생활비 충당계수 (feeFactor)</dt><dd>거주 N년간 매년 내는 생활비의 현재가치 합계를 첫해 생활비 대비 배수로 나타낸 값. 잔여자산 운용수익률이 높을수록 작아집니다.</dd>
              <dt>국민연금 (소득대체율)</dt><dd>가입 기간·소득에 비례해 노후에 매달 받는 공적연금. 본 시뮬레이터는 2021년 가입 기준으로 단순 추정합니다(실제와 차이 가능).</dd>
              <dt>버퍼 (예비비)</dt><dd>의료비·요양 전환 등 예측 못한 지출에 대비해 따로 확보하는 여유 자금.</dd>
              <dt>3-버킷 (현금/투자/부동산)</dt><dd>자산을 성격별로 나눠 각기 다른 수익률·물가 민감도로 굴리는 방식.</dd>
              <dt>결정적 이벤트 (Deterministic)</dt><dd>발생 시점과 비용이 거의 확정적인 사건. 예: 양가 부모님 장례식. 입력한 시점에 일회성 지출로 반영됩니다.</dd>
              <dt>확률적 이벤트 (Probabilistic) — 기대값 모델</dt><dd>발생할 수도 안 할 수도 있는 사건. <code>구간 내 매년 비용 = 확률 × 비용 ÷ 구간 길이</code>로 평활(smoothing)해서 매년 차감합니다. 실제로는 한 시점에 큰 비용이 발생하지만, 장기 기대값으로 보면 같습니다.</dd>
              <dt>시장 충격 (Market Shock)</dt><dd>베어마켓·금융위기처럼 투자 자산이 급락하는 사건. 발생 횟수와 강도(-25% 등)를 입력하면 <code>매년 평균 손실 = (횟수 ÷ 구간) × 강도</code>로 환산해 투자 자산에서 추가 차감합니다.</dd>
              <dt>기대 손실 (Expected Loss)</dt><dd>발생 확률과 손실 크기를 곱한 평균. 47년 중 6번 -25% 충격이면 매년 약 3.2%의 추가 손실.</dd>
            </dl>
          </details>

          <p class="sim-disclaimer">※ 본 도구는 가정 기반 시뮬레이션이며 투자·재무 자문이 아닙니다. 47년 장기 추정은 본질적으로 불확실하므로 의사결정 보조로만 활용하세요. 정확한 예상연금은 국민연금공단 「내 연금 알아보기」를 참고하세요.</p>
        </main>
      </div>`;

    // 셀렉트 초기값 반영
    const sellSel = root.querySelector('[data-key="sellMode"]');
    if (sellSel) sellSel.value = state.sellMode;
    const reSel = root.querySelector('[data-key="realEstateMode"]');
    if (reSel) reSel.value = state.realEstateMode;

    bindInputs(root);
    updateReVisibility();
    renderEventList();
    loadScenarioList();
    built = true;
  }

  function renderEventList() {
    const wrap = document.getElementById("evList");
    if (!wrap) return;
    const events = state.events || [];
    wrap.innerHTML = events.map((ev, idx) => {
      const badge = ev.type === "one_time" ? "결정"
                  : ev.type === "probabilistic" ? "확률"
                  : "시장";
      let body = "";
      if (ev.type === "one_time") {
        body = `
          <label>시점 (와이프 나이)<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="atAge" value="${Number(ev.atAge) || 0}" /></label>
          <label>비용 (현재가치, 만원)<input type="number" min="0" step="100" data-evidx="${idx}" data-evfield="amountToday" value="${Number(ev.amountToday) || 0}" /></label>`;
      } else if (ev.type === "probabilistic") {
        body = `
          <label>구간 시작<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="startAge" value="${Number(ev.startAge) || 0}" /></label>
          <label>구간 종료<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="endAge" value="${Number(ev.endAge) || 0}" /></label>
          <label>발생 확률 (%)<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="probabilityPct" value="${Math.round((Number(ev.probability) || 0) * 100)}" /></label>
          <label>발생 시 비용 (현재가치, 만원)<input type="number" min="0" step="100" data-evidx="${idx}" data-evfield="amountToday" value="${Number(ev.amountToday) || 0}" /></label>`;
      } else if (ev.type === "market_shock") {
        body = `
          <label>구간 시작<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="startAge" value="${Number(ev.startAge) || 0}" /></label>
          <label>구간 종료<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="endAge" value="${Number(ev.endAge) || 0}" /></label>
          <label>발생 횟수 (구간 내)<input type="number" min="0" max="50" step="1" data-evidx="${idx}" data-evfield="expectedCount" value="${Number(ev.expectedCount) || 0}" /></label>
          <label>강도 (자산 손실, %)<input type="number" min="0" max="100" step="1" data-evidx="${idx}" data-evfield="severityPct" value="${Math.round((Number(ev.severity) || 0) * 100)}" /></label>`;
      }
      return `
        <div class="ev-row" data-evcat="${ev.category}">
          <div class="ev-head">
            <label class="ev-toggle">
              <input type="checkbox" data-evidx="${idx}" data-evfield="enabled" ${ev.enabled ? "checked" : ""} />
              <strong>${esc(ev.label)}</strong>
              <span class="ev-badge ev-badge-${ev.type}">${badge}</span>
            </label>
          </div>
          <div class="ev-body">${body}</div>
        </div>`;
    }).join("");
  }

  function updateReVisibility() {
    const mode = state.realEstateMode;
    const showOwned = mode === "owned";
    const showBuy = mode === "buy_later";
    const showSell = mode !== "none";
    document.querySelector('[data-rerow="owned"]')?.toggleAttribute("hidden", !showOwned);
    document.querySelector('[data-rerow="buy"]')?.toggleAttribute("hidden", !showBuy);
    document.querySelector('[data-rerow="sell"]')?.toggleAttribute("hidden", !showSell);
  }

  /* ============================ 이벤트 바인딩 ============================ */
  function bindInputs(root) {
    // 슬라이더/숫자(비율·정수) — 위임
    root.addEventListener("input", (e) => {
      const el = e.target;
      const key = el.dataset.key;
      if (!key) return;
      const role = el.dataset.role;
      if (role === "range" || role === "number") {
        const o = ctrlMeta(key);
        let v = Number(el.value);
        if (o && o.percent) v = v / 100;
        else if (o && o.scale) v = v * o.scale;
        state[key] = v;
        syncCtrl(key, o);
        persistState();
        scheduleRefresh();
      } else if (role === "numfield") {
        const scale = el.dataset.scale ? Number(el.dataset.scale) : 1;
        state[key] = el.value === "" ? (key.endsWith("Override") || key === "sellYearCustom" ? null : 0) : Number(el.value) * scale;
        persistState();
        scheduleRefresh();
      }
    });
    root.addEventListener("change", (e) => {
      const el = e.target;
      const key = el.dataset.key;
      if (!key) return;
      if (el.dataset.role === "toggle") { state[key] = el.checked; persistState(); scheduleRefresh(); }
      else if (el.dataset.role === "select") {
        state[key] = el.value;
        persistState();
        if (key === "realEstateMode") updateReVisibility();
        scheduleRefresh();
      }
    });
    // 프리셋 / 등급 / 거주기간 — 클릭 위임
    root.addEventListener("click", (e) => {
      const preset = e.target.closest(".sim-preset");
      if (preset) {
        const key = preset.dataset.key, o = ctrlMeta(key);
        const v = Number(preset.dataset.value);
        state[key] = o && o.percent ? v / 100 : v;
        syncCtrl(key, o); persistState(); scheduleRefresh(); return;
      }
      const tier = e.target.closest(".sim-tier");
      if (tier) {
        state.tierId = tier.dataset.tier;
        state.depositOverride = null; state.monthlyOverride = null;
        root.querySelectorAll(".sim-tier").forEach((b) => b.classList.toggle("is-active", b === tier));
        const tag = root.querySelector("#tierTag"); if (tag) tag.textContent = `(${tierById(state.tierId).label})`;
        const depF = root.querySelector('[data-key="depositOverride"]'); if (depF) depF.value = "";
        const monF = root.querySelector('[data-key="monthlyOverride"]'); if (monF) monF.value = "";
        persistState(); scheduleRefresh(); return;
      }
      const stay = e.target.closest("[data-stay]");
      if (stay) {
        selectedN = Number(stay.dataset.stay); state.stayYears = selectedN;
        root.querySelectorAll("[data-stay]").forEach((b) => b.classList.toggle("is-active", b === stay));
        syncStayOut(); persistState(); refresh(); return;
      }
      const stayOut = e.target.closest("[data-stayout]");
      if (stayOut) {
        selectedN = Number(stayOut.dataset.stayout); state.stayYears = selectedN;
        root.querySelectorAll("[data-stay]").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.stay) === selectedN));
        syncStayOut(); persistState(); refresh(); return;
      }
    });

    root.querySelector("#simSaveBtn")?.addEventListener("click", saveScenario);
    root.querySelector("#simResetBtn")?.addEventListener("click", resetState);
    root.querySelector("#simScenSelect")?.addEventListener("change", (e) => { if (e.target.value) applyScenario(e.target.value); });

    // 라이프 이벤트 입력
    root.addEventListener("input", (e) => {
      const el = e.target;
      const idx = el.dataset.evidx;
      const field = el.dataset.evfield;
      if (idx == null || !field) return;
      const i = Number(idx);
      if (!state.events[i]) return;
      if (field === "enabled") return; // change에서 처리
      if (field === "probabilityPct") {
        state.events[i].probability = Math.max(0, Math.min(100, Number(el.value) || 0)) / 100;
      } else if (field === "severityPct") {
        state.events[i].severity = Math.max(0, Math.min(100, Number(el.value) || 0)) / 100;
      } else {
        state.events[i][field] = Number(el.value) || 0;
      }
      persistState();
      scheduleRefresh();
    });
    root.addEventListener("change", (e) => {
      const el = e.target;
      const idx = el.dataset.evidx;
      const field = el.dataset.evfield;
      if (idx == null || field !== "enabled") return;
      const i = Number(idx);
      if (!state.events[i]) return;
      state.events[i].enabled = el.checked;
      persistState();
      scheduleRefresh();
    });
    root.querySelector("#evResetBtn")?.addEventListener("click", () => {
      if (!confirm("라이프 이벤트를 모두 기본값으로 되돌릴까요?")) return;
      state.events = DEFAULT_EVENTS.map((e) => ({ ...e }));
      persistState();
      renderEventList();
      refresh();
    });
  }

  function syncStayOut() {
    document.querySelectorAll("[data-stayout]").forEach((b) =>
      b.classList.toggle("is-active", Number(b.dataset.stayout) === selectedN));
  }

  function syncCtrl(key, o) {
    const r = document.getElementById("r-" + key);
    const n = document.getElementById("n-" + key);
    const out = document.getElementById("o-" + key);
    const v = state[key];
    const shown = o && o.percent ? v * 100 : (o && o.scale ? v / o.scale : v);
    if (r) r.value = shown;
    if (n) n.value = round2(shown);
    if (out) out.textContent = o && o.percent ? pct(v) : (o && o.scale ? v / o.scale : v) + (o ? (o.unit || "") : "");
  }

  // 컨트롤 메타(슬라이더 동기화용) — buildUI의 rangeCtrl 옵션과 일치
  const CTRL_META = {
    reSellCost: { percent: true }, netFactor: { percent: true }, incomeGrowth: { percent: true },
    medicalPremium: { percent: true }, inflation: { percent: true }, investReturn: { percent: true },
    cashReturn: { percent: true }, reReturn: { percent: true }, savingsRate: { percent: true },
    allocCash: { percent: true }, inResidenceReal: { percent: true },
  };
  function ctrlMeta(key) { return CTRL_META[key] || null; }

  /* ============================ 출력 렌더 ============================ */
  function refresh() {
    if (!built) return;
    let r;
    try { r = compute(state); } catch (err) { showAlert("계산 오류: " + err.message); return; }
    renderCards(r);
    renderCharts(r);
  }

  function card(title, mainHtml, subHtml, cls) {
    return `<div class="sim-card ${cls || ""}"><span class="sim-card-t">${title}</span><strong class="sim-card-m">${mainHtml}</strong>${subHtml ? `<span class="sim-card-s">${subHtml}</span>` : ""}</div>`;
  }

  function renderCards(r) {
    const n = r.needsByN[selectedN];
    const infl = state.inflation;
    const gapPositive = n.gap >= 0;
    const achievePct = (n.achieve * 100);
    const mode = state.realEstateMode;
    let reTxt;
    if (mode === "none") reTxt = "부동산 없음";
    else if (r.sellAtYear != null) reTxt = `${won(r.sellProceeds)} <small>(${BASE_YEAR + r.sellAtYear}년 매도 · 현재가치 ${won(todayMan(r.sellProceeds, r.sellAtYear, infl))})</small>`;
    else if (mode === "buy_later" && r.buyAtYear != null) reTxt = `매입 ${won(r.buyPriceNominal)} <small>(${BASE_YEAR + r.buyAtYear}년 · 현재가치 ${won(todayMan(r.buyPriceNominal, r.buyAtYear, infl))})</small>`;
    else reTxt = "계속 보유";
    const sellTxt = reTxt;
    const penMonth = r.pensionAtEntry / 12;

    const cards = [
      card(`입주 필요자산 <em>(${selectedN}년)</em>`, won(n.totalNom), `현재가치 ${won(n.totalToday)}`, "is-target"),
      card("예상 75세 자산", won(r.W75.total), `현재가치 ${won(todayMan(r.W75.total, r.T, infl))}`, "is-wealth"),
      card("목표 대비 GAP", `${gapPositive ? "+" : "−"}${won(Math.abs(n.gap))}`, `달성률 ${achievePct.toFixed(0)}%`, gapPositive ? "is-good" : "is-bad"),
      card("실제 소진 예상액", won(n.netSpent), state.refundable ? "보증금 환급 제외" : "보증금 포함", ""),
      card("현재자산 → 필요수익률", pct(n.requiredCagr), "추가 저축 0 가정", ""),
      card(mode === "buy_later" && r.buyAtYear != null && r.sellAtYear == null ? "부동산 매입" : "부동산 매도 순현금", sellTxt, "", ""),
      card("국민연금(75세·부부)", `월 ${won(penMonth)}`, `현재가치 월 ${won(todayMan(penMonth, r.T, infl))}`, ""),
      card("라이프 이벤트 총지출 (~75세)", won(r.cumLifeEventsAt75), `현재가치 ${won(r.cumLifeEventsTodayAt75)}`, ""),
      card("입주까지", `${r.T}년 후`, `${BASE_YEAR + r.T}년 · 물가배수 ${r.fEntry.toFixed(2)}배`, ""),
    ].join("");
    document.getElementById("simCards").innerHTML = cards;

    const alert = document.getElementById("simAlert");
    if (r.purchaseShortfall > 0) {
      alert.hidden = false; alert.className = "sim-alert is-warn";
      alert.textContent = `⚠️ 부동산 매입 시점(${BASE_YEAR + r.buyAtYear}년)에 자금이 ${won(r.purchaseShortfall)} 부족합니다. 매입 연수를 늦추거나 저축률을 올리세요.`;
    } else if (r.depletedAt != null && r.depletedAt <= selectedN) {
      alert.hidden = false; alert.className = "sim-alert is-bad";
      alert.textContent = `⚠️ 예상 자산으로는 거주 ${r.depletedAt}년차에 생활비가 고갈됩니다 (목표 ${selectedN}년 미달). 저축률·수익률·등급을 조정해 보세요.`;
    } else if (!gapPositive) {
      alert.hidden = false; alert.className = "sim-alert is-warn";
      alert.textContent = `목표 자산에 ${won(Math.abs(n.gap))} 부족합니다. 저축률을 높이거나 등급을 낮추면 달성 가능성이 올라갑니다.`;
    } else {
      alert.hidden = false; alert.className = "sim-alert is-good";
      alert.textContent = `✅ ${selectedN}년 거주 목표를 ${won(n.gap)} 초과 달성하는 경로입니다.`;
    }
  }

  /* ============================ 차트 ============================ */
  const COL = { cash: "#00c896", inv: "#008f72", re: "#BA7517", gray: "#888780", amber: "#BA7517", line: "#06362f" };
  function chartReady() { return typeof window.Chart !== "undefined"; }

  function renderCharts(r) {
    if (!chartReady()) {
      fallbackText(r);
      return;
    }
    const infl = state.inflation;
    const labels = r.series.filter((p) => p.t <= r.T).map((p) => p.ageW);
    const slice = r.series.filter((p) => p.t <= r.T);

    // 1) 자산 적층 영역
    drawChart("assets", "chartAssets", {
      type: "line",
      data: {
        labels,
        datasets: [
          area("현금", slice.map((p) => eok(p.cash)), COL.cash),
          area("투자", slice.map((p) => eok(p.inv)), COL.inv),
          area("부동산", slice.map((p) => eok(p.re)), COL.re),
        ],
      },
      options: stackOpts("억", (ctx) => {
        const p = slice[ctx[0].dataIndex];
        return `와이프 ${p.ageW}세 (${p.year}년)`;
      }, (item) => {
        const p = slice[item.dataIndex];
        const tv = todayMan(p[dsKey(item.dataset.label)], p.t, infl);
        return ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}억 (현재가치 ${eok(tv).toFixed(1)}억)`;
      }),
    });

    // 2) 소득 & 누적저축 & 누적 라이프 이벤트 (이중축)
    let cum = 0;
    const cumSav = slice.map((p) => { cum += p.savings; return eok(cum); });
    // 누적 라이프 이벤트 (와이프 나이 t까지)
    const cumLifeByT = {};
    for (const p of r.lifeEventSeries) cumLifeByT[p.t] = p.cumNom;
    let lastCumLife = 0;
    const cumLifeArr = slice.map((p) => {
      if (cumLifeByT[p.t] != null) lastCumLife = cumLifeByT[p.t];
      return eok(lastCumLife);
    });
    drawChart("income", "chartIncome", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDS("가구 소득", slice.map((p) => p.incomeW + p.incomeH), COL.line, "y", false),
          lineDS("국민연금", slice.map((p) => p.pension), COL.amber, "y", true),
          lineDS("누적 저축", cumSav, COL.inv, "y1", false, true),
          lineDS("누적 라이프 이벤트", cumLifeArr, "#c43d45", "y1", true, false),
        ],
      },
      options: dualOpts((ctx) => `와이프 ${slice[ctx[0].dataIndex].ageW}세`),
    });

    // 3) 거주 중 소진
    drawChart("stay", "chartStay", {
      type: "line",
      data: {
        labels: r.stayCurve.map((p) => p.k),
        datasets: [
          lineDS("잔여 자산", r.stayCurve.map((p) => eok(p.remain)), COL.cash, "y", false, true),
          lineDS("누적 생활비", r.stayCurve.map((p) => eok(p.cumLife)), COL.amber, "y", true),
        ],
      },
      options: stayOpts(r),
    });
  }

  function dsKey(label) { return label === "현금" ? "cash" : label === "투자" ? "inv" : "re"; }
  function area(label, data, color) {
    return { label, data, borderColor: color, backgroundColor: color + "33", fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2 };
  }
  function lineDS(label, data, color, axis, dashed, thick) {
    return { label, data, borderColor: color, backgroundColor: color + "22", yAxisID: axis, fill: false, tension: 0.25, pointRadius: 0, borderWidth: thick ? 3 : 2, borderDash: dashed ? [6, 4] : [] };
  }
  function stackOpts(unit, titleCb, labelCb) {
    return {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { usePointStyle: true } }, tooltip: { callbacks: { title: titleCb, label: labelCb } } },
      scales: { y: { stacked: true, ticks: { callback: (v) => v + unit } }, x: { title: { display: true, text: "와이프 나이" } } },
    };
  }
  function dualOpts(titleCb) {
    return {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { usePointStyle: true } }, tooltip: { callbacks: { title: titleCb, label: (i) => ` ${i.dataset.label}: ${i.dataset.yAxisID === "y1" ? i.parsed.y.toFixed(1) + "억" : Math.round(i.parsed.y).toLocaleString() + "만원"}` } } },
      scales: {
        y: { position: "left", title: { display: true, text: "소득(만원/년)" }, ticks: { callback: (v) => Math.round(v / 10000) + "억" } },
        y1: { position: "right", title: { display: true, text: "누적저축(억)" }, grid: { drawOnChartArea: false }, ticks: { callback: (v) => v + "억" } },
        x: { title: { display: true, text: "와이프 나이" } },
      },
    };
  }
  function stayOpts(r) {
    return {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true } },
        tooltip: { callbacks: { title: (c) => `거주 ${c[0].label}년차`, label: (i) => ` ${i.dataset.label}: ${i.parsed.y.toFixed(1)}억` } },
      },
      scales: { y: { title: { display: true, text: "억(명목)" }, ticks: { callback: (v) => v + "억" } }, x: { title: { display: true, text: "거주 연차" } } },
    };
  }
  function drawChart(key, canvasId, cfg) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    document.getElementById(canvasId + "Fallback")?.setAttribute("hidden", "");
    if (charts[key]) charts[key].destroy();
    charts[key] = new window.Chart(el.getContext("2d"), cfg);
  }
  function fallbackText(r) {
    const n = r.needsByN[selectedN];
    [["chartAssets", `75세 예상 자산 ${won(r.W75.total)} (현금 ${won(r.W75.cash)} / 투자 ${won(r.W75.inv)} / 부동산 ${won(r.W75.re)})`],
     ["chartIncome", `현재 가구소득 ${won(state.wifeIncome + state.husbandIncome)} → 국민연금(75세) 월 ${won(r.pensionAtEntry / 12)}`],
     ["chartStay", `${selectedN}년 필요자산 ${won(n.totalNom)} · 고갈 ${r.depletedAt != null ? r.depletedAt + "년차" : "없음"}`]
    ].forEach(([id, txt]) => {
      const el = document.getElementById(id + "Fallback");
      if (el) { el.textContent = "📊 차트 라이브러리를 불러오지 못해 요약으로 표시합니다 — " + txt; el.hidden = false; }
    });
  }
  function showAlert(msg) { const a = document.getElementById("simAlert"); if (a) { a.hidden = false; a.className = "sim-alert is-bad"; a.textContent = msg; } }

  /* ============================ 시나리오 (API + localStorage) ============================ */
  async function loadScenarioList() {
    const sel = document.getElementById("simScenSelect");
    if (!sel) return;
    let list = [];
    try {
      const res = await fetch(SCEN_API, { headers: { accept: "application/json" }, cache: "no-store" });
      if (res.ok) list = await res.json();
      else throw new Error("api");
    } catch {
      list = lsScenarios();
    }
    sel.innerHTML = `<option value="">시나리오 불러오기…</option>` +
      list.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.is_default ? " ★" : ""}</option>`).join("");
  }
  function lsScenarios() { try { return JSON.parse(localStorage.getItem(LS_SCEN) || "[]"); } catch { return []; } }
  function lsSave(list) { try { localStorage.setItem(LS_SCEN, JSON.stringify(list)); } catch {} }

  async function saveScenario() {
    const name = prompt("시나리오 이름을 입력하세요", "내 시나리오");
    if (!name) return;
    const payload = scenarioFromState(name);
    try {
      const res = await fetch(SCEN_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("api");
      toast("시나리오를 DB에 저장했습니다.");
    } catch {
      const list = lsScenarios();
      list.unshift(Object.assign({ id: "ls-" + Date.now(), is_default: false }, payload));
      lsSave(list);
      toast("오프라인 저장(localStorage)했습니다.");
    }
    loadScenarioList();
  }

  async function applyScenario(id) {
    let scen = null;
    try {
      const res = await fetch(`${SCEN_API}/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (res.ok) scen = await res.json(); else throw new Error("api");
    } catch {
      scen = lsScenarios().find((s) => String(s.id) === String(id));
    }
    if (!scen) { toast("시나리오를 찾을 수 없습니다."); return; }
    state = Object.assign({}, DEFAULTS, stateFromScenario(scen));
    selectedN = clampStayToOption(state.stayYears);
    persistState();
    buildUI();
    refresh();
    toast(`'${scen.name}' 적용됨`);
  }

  function resetState() {
    if (!confirm("모든 입력을 기본값으로 되돌릴까요?")) return;
    state = Object.assign({}, DEFAULTS);
    selectedN = 10;
    persistState();
    buildUI();
    refresh();
  }

  // state ↔ DB 스키마(asset_scenarios) 매핑
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
      savingsRate: num(d.savings_rate, 0.30), allocCash: num(d.savings_alloc_cash, 0.30), inResidenceReal: num(d.in_residence_real_return, 0.01),
      retireWife: num(d.retire_age_wife, 60), retireHusband: num(d.retire_age_husband, 60), pensionStartAge: num(d.pension_start_age, 65),
      pensionAuto: d.pension_auto == null ? true : !!d.pension_auto, pensionMonthlyOverride: d.pension_monthly_override, bufferToday: num(d.medical_buffer_today, 20000),
      events: Array.isArray(d.life_events) && d.life_events.length ? d.life_events : DEFAULT_EVENTS.map((e) => ({ ...e })),
    };
  }

  function toast(msg) {
    let t = document.getElementById("simToast");
    if (!t) { t = document.createElement("div"); t.id = "simToast"; t.className = "sim-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ============================ 등급 데이터 로드(API) ============================ */
  async function loadTiers() {
    try {
      const res = await fetch(TIER_API, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length) TIERS = data;
      }
    } catch { /* 폴백 유지 */ }
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
    if (tag) tag.textContent = name === "simulator"
      ? "와이프 75세 실버타운 입주까지, 우리 자산이 충분한지 시뮬레이션"
      : "찜한 매물을 비교하고 임장 기록을 남기는 작업대";
    try { localStorage.setItem(LS_TAB, name); } catch {}
    if (name === "simulator") {
      if (location.hash !== "#simulator") history.replaceState(null, "", "#simulator");
      if (!built) buildUI();
      refresh();
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
    window.addEventListener("hashchange", () => {
      if (location.hash === "#simulator") activateTab("simulator");
    });
  }

  function start() {
    initTabs();
    loadTiers().then(() => { if (built) { buildUI(); refresh(); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
