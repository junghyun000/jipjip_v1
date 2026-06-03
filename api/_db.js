import { neon } from "@neondatabase/serverless";

let sqlClient = null;

export function getSql() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export async function listListings() {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    select *
    from listings
    order by coalesce(visit_date, date '9999-12-31') asc, created_at asc
  `;
  return rows.map(fromDbRow);
}

export async function upsertListing(id, body) {
  const sql = getSql();
  if (!sql) return null;
  const listing = toDbRecord({ ...body, id });

  await sql`
    insert into listings (
      id, status, visit_date, visit_time, visited, name, article_number, price, recent_deal,
      supply_area, exclusive_area, floor, direction, rooms, maintenance, households, parking,
      realtor_phone, description, naver_url, desired_price, negotiable_price, offer_price,
      move_in_date, move_in_memo, checklist, ratings, memo
    )
    values (
      ${listing.id}, ${listing.status}, ${listing.visitDate}, ${listing.visitTime}, ${listing.visited},
      ${listing.name}, ${listing.articleNumber}, ${listing.price}, ${listing.recentDeal},
      ${listing.supplyArea}, ${listing.exclusiveArea}, ${listing.floor}, ${listing.direction},
      ${listing.rooms}, ${listing.maintenance}, ${listing.households}, ${listing.parking},
      ${listing.realtorPhone}, ${listing.description}, ${listing.naverUrl}, ${listing.desiredPrice},
      ${listing.negotiablePrice}, ${listing.offerPrice}, ${listing.moveInDate}, ${listing.moveInMemo},
      ${listing.checklist}::jsonb, ${listing.ratings}::jsonb, ${listing.memo}
    )
    on conflict (id) do update set
      status = excluded.status,
      visit_date = excluded.visit_date,
      visit_time = excluded.visit_time,
      visited = excluded.visited,
      name = excluded.name,
      article_number = excluded.article_number,
      price = excluded.price,
      recent_deal = excluded.recent_deal,
      supply_area = excluded.supply_area,
      exclusive_area = excluded.exclusive_area,
      floor = excluded.floor,
      direction = excluded.direction,
      rooms = excluded.rooms,
      maintenance = excluded.maintenance,
      households = excluded.households,
      parking = excluded.parking,
      realtor_phone = excluded.realtor_phone,
      description = excluded.description,
      naver_url = excluded.naver_url,
      desired_price = excluded.desired_price,
      negotiable_price = excluded.negotiable_price,
      offer_price = excluded.offer_price,
      move_in_date = excluded.move_in_date,
      move_in_memo = excluded.move_in_memo,
      checklist = excluded.checklist,
      ratings = excluded.ratings,
      memo = excluded.memo
  `;
  return true;
}

export async function deleteListing(id) {
  const sql = getSql();
  if (!sql) return null;
  await sql`delete from listings where id = ${id}`;
  return true;
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function toDbRecord(listing) {
  return {
    id: listing.id,
    status: listing.status || "미방문",
    visitDate: listing.visitDate || null,
    visitTime: listing.visitTime || null,
    visited: Boolean(listing.visited),
    name: listing.name || "네이버 매물",
    articleNumber: listing.articleNumber || null,
    price: toNumberOrNull(listing.price),
    recentDeal: toNumberOrNull(listing.recentDeal),
    supplyArea: toNumberOrNull(listing.supplyArea),
    exclusiveArea: toNumberOrNull(listing.exclusiveArea),
    floor: listing.floor || null,
    direction: listing.direction || null,
    rooms: toNumberOrNull(listing.rooms),
    maintenance: listing.maintenance || null,
    households: listing.households || null,
    parking: listing.parking || null,
    realtorPhone: listing.realtorPhone || null,
    description: listing.description || null,
    naverUrl: listing.naverUrl || null,
    desiredPrice: listing.desiredPrice || null,
    negotiablePrice: listing.negotiablePrice || null,
    offerPrice: listing.offerPrice || null,
    moveInDate: listing.moveInDate || null,
    moveInMemo: listing.moveInMemo || null,
    checklist: JSON.stringify(Array.isArray(listing.checklist) ? listing.checklist : []),
    ratings: JSON.stringify(listing.ratings || {}),
    memo: listing.memo || null,
  };
}

function fromDbRow(row) {
  return {
    id: row.id,
    status: row.status || "미방문",
    visitDate: formatDate(row.visit_date),
    visitTime: formatTime(row.visit_time),
    visited: Boolean(row.visited),
    name: row.name || "네이버 매물",
    articleNumber: row.article_number || "",
    price: row.price || "",
    recentDeal: row.recent_deal || "",
    supplyArea: row.supply_area || "",
    exclusiveArea: row.exclusive_area || "",
    floor: row.floor || "",
    direction: row.direction || "",
    rooms: row.rooms || "",
    maintenance: row.maintenance || "",
    households: row.households || "",
    parking: row.parking || "",
    realtorPhone: row.realtor_phone || "",
    description: row.description || "",
    naverUrl: row.naver_url || "",
    desiredPrice: row.desired_price || "",
    negotiablePrice: row.negotiable_price || "",
    offerPrice: row.offer_price || "",
    moveInDate: row.move_in_date || "",
    moveInMemo: row.move_in_memo || "",
    checklist: parseJsonValue(row.checklist, []),
    ratings: parseJsonValue(row.ratings, {}),
    memo: row.memo || "",
  };
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(value);
  }
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : formatDateParts(parsed);
}

function formatTime(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  const match = String(value).match(/\d{2}:\d{2}/);
  return match ? match[0] : "";
}

function formatDateParts(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseJsonValue(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

/* ============================ 자산 시뮬레이터 ============================ */

export async function listTiers() {
  const sql = getSql();
  if (!sql) return null;
  return await sql`
    select id, label, deposit_base, monthly_cost_base, refundable, notes, display_order
    from silver_town_tiers order by display_order
  `;
}

export async function listScenarios() {
  const sql = getSql();
  if (!sql) return null;
  return await sql`
    select id, name, is_default, tier_id, stay_years, updated_at
    from asset_scenarios order by is_default desc, updated_at desc
  `;
}

export async function getScenario(id) {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`select * from asset_scenarios where id = ${id}`;
  return rows[0] || null;
}

export function validateScenario(b) {
  const errors = {};
  const stay = Number(b.stay_years ?? 10);
  if (!(stay > 0 && stay <= 50)) errors.stay_years = "거주 기간은 1~50년이어야 합니다.";
  const entry = Number(b.entry_age ?? 75);
  const wife = Number(b.wife_age ?? 28);
  if (!(entry > wife)) errors.entry_age = "입주 나이는 현재 나이보다 커야 합니다.";
  if (b.pension_auto === false && b.pension_monthly_override == null)
    errors.pension_monthly_override = "수동 연금 모드에서는 월 수령액이 필요합니다.";
  if (!b.name || !String(b.name).trim()) errors.name = "시나리오 이름이 필요합니다.";
  return Object.keys(errors).length ? errors : null;
}

function scenarioValues(b) {
  const n = (v, d) => (v == null || v === "" ? d : Number(v));
  const s = (v, d) => (v == null ? d : String(v));
  const opt = (v) => (v == null || v === "" ? null : Number(v));
  return {
    name: s(b.name, "시나리오"), description: s(b.description, null),
    base_year: n(b.base_year, 2026), wife_age: n(b.wife_age, 28), husband_age: n(b.husband_age, 33),
    entry_age: n(b.entry_age, 75), stay_years: n(b.stay_years, 10),
    cash_current: n(b.cash_current, 0), investment_current: n(b.investment_current, 0), real_estate_current: n(b.real_estate_current, 0),
    has_real_estate: !!b.has_real_estate, sell_mode: s(b.sell_mode, "at_entry"),
    sell_year_custom: opt(b.sell_year_custom), re_sell_cost_rate: n(b.re_sell_cost_rate, 0.04),
    real_estate_mode: s(b.real_estate_mode, "none"),
    real_estate_buy_year: opt(b.real_estate_buy_year),
    real_estate_buy_price_today: opt(b.real_estate_buy_price_today),
    wife_income: n(b.wife_income, 5800), husband_income: n(b.husband_income, 5600), net_factor: n(b.net_factor, 0.83),
    income_growth_rate: n(b.income_growth_rate, 0.04), income_peak_age: n(b.income_peak_age, 55),
    tier_id: s(b.tier_id, "mid"), deposit_override: opt(b.deposit_override), monthly_cost_override: opt(b.monthly_cost_override),
    refundable: b.refundable == null ? true : !!b.refundable, medical_premium_rate: n(b.medical_premium_rate, 0.015),
    inflation_rate: n(b.inflation_rate, 0.03), investment_return: n(b.investment_return, 0.06),
    cash_return: n(b.cash_return, 0.025), real_estate_return: n(b.real_estate_return, 0.03),
    savings_rate: n(b.savings_rate, 0.3), savings_alloc_cash: n(b.savings_alloc_cash, 0.3),
    in_residence_real_return: n(b.in_residence_real_return, 0.01),
    retire_age_wife: n(b.retire_age_wife, 60), retire_age_husband: n(b.retire_age_husband, 60),
    pension_start_age: n(b.pension_start_age, 65), pension_auto: b.pension_auto == null ? true : !!b.pension_auto,
    pension_monthly_override: opt(b.pension_monthly_override), medical_buffer_today: n(b.medical_buffer_today, 20000),
  };
}

export async function createScenario(b) {
  const sql = getSql();
  if (!sql) return null;
  const v = scenarioValues(b);
  const rows = await sql`
    insert into asset_scenarios (
      name, description, base_year, wife_age, husband_age, entry_age, stay_years,
      cash_current, investment_current, real_estate_current, has_real_estate, sell_mode, sell_year_custom, re_sell_cost_rate,
      real_estate_mode, real_estate_buy_year, real_estate_buy_price_today,
      wife_income, husband_income, net_factor, income_growth_rate, income_peak_age,
      tier_id, deposit_override, monthly_cost_override, refundable, medical_premium_rate,
      inflation_rate, investment_return, cash_return, real_estate_return,
      savings_rate, savings_alloc_cash, in_residence_real_return,
      retire_age_wife, retire_age_husband, pension_start_age, pension_auto, pension_monthly_override,
      medical_buffer_today
    ) values (
      ${v.name}, ${v.description}, ${v.base_year}, ${v.wife_age}, ${v.husband_age}, ${v.entry_age}, ${v.stay_years},
      ${v.cash_current}, ${v.investment_current}, ${v.real_estate_current}, ${v.has_real_estate}, ${v.sell_mode}, ${v.sell_year_custom}, ${v.re_sell_cost_rate},
      ${v.real_estate_mode}, ${v.real_estate_buy_year}, ${v.real_estate_buy_price_today},
      ${v.wife_income}, ${v.husband_income}, ${v.net_factor}, ${v.income_growth_rate}, ${v.income_peak_age},
      ${v.tier_id}, ${v.deposit_override}, ${v.monthly_cost_override}, ${v.refundable}, ${v.medical_premium_rate},
      ${v.inflation_rate}, ${v.investment_return}, ${v.cash_return}, ${v.real_estate_return},
      ${v.savings_rate}, ${v.savings_alloc_cash}, ${v.in_residence_real_return},
      ${v.retire_age_wife}, ${v.retire_age_husband}, ${v.pension_start_age}, ${v.pension_auto}, ${v.pension_monthly_override},
      ${v.medical_buffer_today}
    )
    returning id, name, is_default, created_at
  `;
  return rows[0];
}

export async function updateScenario(id, b) {
  const sql = getSql();
  if (!sql) return null;
  const v = scenarioValues(b);
  const rows = await sql`
    update asset_scenarios set
      name = ${v.name}, description = ${v.description}, base_year = ${v.base_year},
      wife_age = ${v.wife_age}, husband_age = ${v.husband_age}, entry_age = ${v.entry_age}, stay_years = ${v.stay_years},
      cash_current = ${v.cash_current}, investment_current = ${v.investment_current}, real_estate_current = ${v.real_estate_current},
      has_real_estate = ${v.has_real_estate}, sell_mode = ${v.sell_mode}, sell_year_custom = ${v.sell_year_custom}, re_sell_cost_rate = ${v.re_sell_cost_rate},
      real_estate_mode = ${v.real_estate_mode}, real_estate_buy_year = ${v.real_estate_buy_year}, real_estate_buy_price_today = ${v.real_estate_buy_price_today},
      wife_income = ${v.wife_income}, husband_income = ${v.husband_income}, net_factor = ${v.net_factor},
      income_growth_rate = ${v.income_growth_rate}, income_peak_age = ${v.income_peak_age},
      tier_id = ${v.tier_id}, deposit_override = ${v.deposit_override}, monthly_cost_override = ${v.monthly_cost_override},
      refundable = ${v.refundable}, medical_premium_rate = ${v.medical_premium_rate},
      inflation_rate = ${v.inflation_rate}, investment_return = ${v.investment_return}, cash_return = ${v.cash_return}, real_estate_return = ${v.real_estate_return},
      savings_rate = ${v.savings_rate}, savings_alloc_cash = ${v.savings_alloc_cash}, in_residence_real_return = ${v.in_residence_real_return},
      retire_age_wife = ${v.retire_age_wife}, retire_age_husband = ${v.retire_age_husband}, pension_start_age = ${v.pension_start_age},
      pension_auto = ${v.pension_auto}, pension_monthly_override = ${v.pension_monthly_override}, medical_buffer_today = ${v.medical_buffer_today}
    where id = ${id}
    returning id, name, is_default, updated_at
  `;
  return rows[0] || null;
}

export async function deleteScenario(id) {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`select is_default from asset_scenarios where id = ${id}`;
  if (!rows[0]) return { notFound: true };
  if (rows[0].is_default) return { forbidden: true };
  await sql`delete from asset_scenarios where id = ${id}`;
  return { ok: true };
}

export async function setDefaultScenario(id) {
  const sql = getSql();
  if (!sql) return null;
  await sql`update asset_scenarios set is_default = false where is_default = true`;
  const rows = await sql`update asset_scenarios set is_default = true where id = ${id} returning id`;
  return rows[0] ? { ok: true } : { notFound: true };
}
