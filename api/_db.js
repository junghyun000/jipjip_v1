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
