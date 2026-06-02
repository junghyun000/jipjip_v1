import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || "127.0.0.1";
let dbSqlPromise = null;

const knownListings = {
  "https://naver.me/G8ffF2Tq": {
    name: "등촌코오롱 101동",
    articleNumber: "2628930751",
    price: 83000,
    recentDeal: 74500,
    supplyArea: 88.52,
    exclusiveArea: 59.99,
    floor: "9/19층",
    direction: "북서향",
    rooms: 2,
    maintenance: "15만원",
    households: "191세대 (해당 면적 45세대)",
    parking: "203대 (세대당 1.06대)",
    realtorPhone: "02-3661-1110",
    description:
      "입주, 올수리, 거실 작은방 확장, 방2, 증미역/가양역 이용. 지하 주차장 엘리베이터 연결.",
    moveInDate: "즉시입주 협의 가능",
  },
  "https://naver.me/5p00ihEe": {
    name: "삼성하나로 101동",
    articleNumber: "2629579499",
    price: 80000,
    recentDeal: 74000,
    supplyArea: 79.99,
    exclusiveArea: 59.26,
    floor: "고/15층",
    direction: "남동향",
    rooms: 2,
    maintenance: "16만원",
    households: "178세대 (해당 면적 96세대)",
    parking: "130대 (세대당 0.73대)",
    realtorPhone: "02-3663-4946 / 010-9198-4841",
    description:
      "급매, 로얄층/로얄라인, 2026년 10월 초순 입주 협의 가능. 염동초/염창중 학군, 강서둘레길·한강공원·안양천, 홈플러스·하나로마트, 9호선 염창급행역/등촌역 도보 10~15분.",
    moveInDate: "2026년 10월 초순 협의 가능",
  },
  "https://naver.me/5WUUFLbF": {
    name: "벽산늘푸른 102동",
    articleNumber: "2628015513",
    price: 90000,
    recentDeal: 80800,
    supplyArea: 79.72,
    exclusiveArea: 59.97,
    floor: "9/15층",
    direction: "남서향",
    rooms: 3,
    maintenance: "10만원",
    households: "206세대 (해당 면적 105세대)",
    parking: "173대 (세대당 0.83대)",
    realtorPhone: "02-3664-0300 / 010-9133-4004",
    description:
      "남향, 샷시 포함 특올수리, 정상 입주 가능. 9호선 증미역 역세권, 한강공원·증미산 근처.",
    moveInDate: "즉시입주",
  },
  "https://naver.me/FG33itv4": {
    name: "벽산늘푸른 102동",
    articleNumber: "2624633836",
    price: 86500,
    recentDeal: 80800,
    supplyArea: 79.72,
    exclusiveArea: 59.97,
    floor: "고/15층",
    direction: "남향",
    rooms: 3,
    maintenance: "13만원",
    households: "206세대 (해당 면적 105세대)",
    parking: "173대 (세대당 0.8대)",
    realtorPhone: "02-3661-5905",
    description: "2027년 9월 30일 입주 협의 가능.",
    moveInDate: "2027년 09월 30일 협의 가능",
  },
  "https://naver.me/5RAADV79": {
    name: "벽산늘푸른 102동",
    articleNumber: "2628775648",
    price: 85000,
    recentDeal: 80800,
    supplyArea: 79.72,
    exclusiveArea: 59.97,
    floor: "3/15층",
    direction: "남서향",
    rooms: 3,
    maintenance: "15만원",
    households: "206세대 (해당 면적 105세대)",
    parking: "173대 (세대당 0.83대)",
    realtorPhone: "02-3661-5905",
    description: "남서향집. 즉시입주 협의 가능.",
    moveInDate: "즉시입주 협의 가능",
  },
  "https://naver.me/xHEE9Umf": {
    name: "등촌월드메르디앙 101동",
    articleNumber: "2629124575",
    price: 100000,
    recentDeal: 83300,
    supplyArea: 75.8,
    exclusiveArea: 59.79,
    floor: "5/15층",
    direction: "남동향",
    rooms: 3,
    maintenance: "18만원",
    households: "145세대 (해당 면적 55세대)",
    parking: "146대 (세대당 1대)",
    realtorPhone: "02-2659-0519",
    description: "최근 샷시 포함 특올수리, 확장형. CJ부지 개발호재, 지하주차장 엘리베이터 연결 편리.",
    moveInDate: "즉시입주 협의 가능",
  },
  "https://naver.me/54KKdFOQ": {
    name: "등촌현대2차 201동",
    articleNumber: "2626023501",
    price: 82000,
    recentDeal: 77500,
    supplyArea: 105.79,
    exclusiveArea: 84.95,
    floor: "고/17층",
    direction: "남동향",
    rooms: 3,
    maintenance: "20만원",
    households: "89세대 (해당 면적 31세대)",
    parking: "79대 (세대당 0.88대)",
    realtorPhone: "02-3662-9662",
    description: "소유주 확인 매물. 세안고 매매. 샤시교체, 내부 부분수리. 집 보실 분은 미리 연락 필요.",
    moveInDate: "2027년 06월 하순 협의 가능",
  },
  "https://naver.me/IDkkw0q5": {
    name: "등촌현대2차 201동",
    articleNumber: "2625903091",
    price: 82000,
    recentDeal: 77500,
    supplyArea: 105.79,
    exclusiveArea: 84.95,
    floor: "15/17층",
    direction: "남서향",
    rooms: 3,
    maintenance: "25만원",
    households: "89세대 (해당 면적 31세대)",
    parking: "79대 (세대당 0.88대)",
    realtorPhone: "02-3664-4886",
    description: "2027년 6월 중순 입주 협의 가능.",
    moveInDate: "2027년 06월 중순 협의 가능",
  },
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/naver-import") {
      await handleNaverImport(url, res);
      return;
    }
    if (url.pathname === "/api/listings" && req.method === "GET") {
      await handleListListings(res);
      return;
    }
    if (url.pathname.startsWith("/api/listings/") && req.method === "PUT") {
      await handleUpsertListing(req, url, res);
      return;
    }
    if (url.pathname.startsWith("/api/listings/") && req.method === "DELETE") {
      await handleDeleteListing(url, res);
      return;
    }
    await serveStatic(url, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}).listen(port, host, () => {
  console.log(`JIPJIP running at http://${host}:${port}/`);
});

async function handleNaverImport(url, res) {
  const targetUrl = url.searchParams.get("url") || "";
  const normalized = normalizeNaverUrl(targetUrl);
  const known = knownListings[normalized];
  if (known) {
    sendJson(res, 200, { ...known, naverUrl: targetUrl });
    return;
  }

  const resolvedUrl = await resolveUrl(targetUrl);
  const articleNumber = extractArticleNumberFromUrl(resolvedUrl) || extractArticleNumberFromUrl(targetUrl);
  if (!articleNumber) {
    sendJson(res, 200, { name: "네이버 매물", naverUrl: targetUrl });
    return;
  }

  sendJson(res, 200, {
    name: `네이버 매물 ${articleNumber}`,
    articleNumber,
    naverUrl: targetUrl,
  });
}

async function handleListListings(res) {
  const sql = await getDatabase();
  if (!sql) {
    sendJson(res, 503, { error: "DATABASE_URL is not configured" });
    return;
  }

  const rows = await sql`
    select *
    from listings
    order by coalesce(visit_date, date '9999-12-31') asc, created_at asc
  `;
  sendJson(res, 200, rows.map(fromDbRow));
}

async function handleUpsertListing(req, url, res) {
  const sql = await getDatabase();
  if (!sql) {
    sendJson(res, 503, { error: "DATABASE_URL is not configured" });
    return;
  }

  const id = decodeURIComponent(url.pathname.split("/").pop() || "");
  const body = await readJsonBody(req);
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
  sendJson(res, 200, { ok: true });
}

async function handleDeleteListing(url, res) {
  const sql = await getDatabase();
  if (!sql) {
    sendJson(res, 503, { error: "DATABASE_URL is not configured" });
    return;
  }

  const id = decodeURIComponent(url.pathname.split("/").pop() || "");
  await sql`delete from listings where id = ${id}`;
  sendJson(res, 200, { ok: true });
}

async function getDatabase() {
  if (!process.env.DATABASE_URL) return null;
  if (!dbSqlPromise) {
    dbSqlPromise = import("@neondatabase/serverless").then(({ neon }) => neon(process.env.DATABASE_URL));
  }
  return dbSqlPromise;
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
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
  return String(value).slice(0, 10);
}

function formatTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
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

async function serveStatic(url, res) {
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, rawPath));
  if (!filePath.startsWith(root)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const contents = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(contents);
  } catch {
    sendText(res, 404, "Not found");
  }
}

async function resolveUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      },
    });
    return response.url || url;
  } catch {
    return url;
  }
}

function normalizeNaverUrl(url) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function extractArticleNumberFromUrl(url) {
  try {
    const parsed = new URL(url);
    const directArticleNumber =
      parsed.searchParams.get("articleNumber") ||
      parsed.searchParams.get("articleId") ||
      parsed.pathname.match(/\/articles\/(\d+)/)?.[1];
    if (directArticleNumber) return directArticleNumber;

    const layer = parsed.searchParams.get("layer");
    if (!layer) return "";
    const layers = JSON.parse(decompressFromEncodedURIComponent(layer) || "[]");
    return layers.find((item) => item?.id === "article_detail")?.params?.articleId || "";
  } catch {
    return "";
  }
}

function decompressFromEncodedURIComponent(input) {
  if (input == null) return "";
  if (input === "") return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const source = input.replace(/ /g, "+");
  const getNextValue = (index) => alphabet.indexOf(source.charAt(index));
  return decompress(source.length, 32, getNextValue);
}

function decompress(length, resetValue, getNextValue) {
  const dictionary = [0, 1, 2];
  const data = { val: getNextValue(0), position: resetValue, index: 1 };
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let result = [];
  let bits = readBits(2, data, resetValue, getNextValue);
  let c;

  if (bits === 0) c = String.fromCharCode(readBits(8, data, resetValue, getNextValue));
  else if (bits === 1) c = String.fromCharCode(readBits(16, data, resetValue, getNextValue));
  else if (bits === 2) return "";

  dictionary[3] = c;
  let w = c;
  result.push(c);

  while (true) {
    if (data.index > length) return "";
    let entry;
    c = readBits(numBits, data, resetValue, getNextValue);

    if (c === 0) {
      dictionary[dictSize++] = String.fromCharCode(readBits(8, data, resetValue, getNextValue));
      c = dictSize - 1;
      enlargeIn -= 1;
    } else if (c === 1) {
      dictionary[dictSize++] = String.fromCharCode(readBits(16, data, resetValue, getNextValue));
      c = dictSize - 1;
      enlargeIn -= 1;
    } else if (c === 2) {
      return result.join("");
    }

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }

    if (dictionary[c]) entry = dictionary[c];
    else if (c === dictSize) entry = w + w.charAt(0);
    else return null;

    result.push(entry);
    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn -= 1;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }
  }
}

function readBits(bitCount, data, resetValue, getNextValue) {
  let bits = 0;
  let power = 1;
  const maxpower = Math.pow(2, bitCount);
  while (power !== maxpower) {
    const resb = data.val & data.position;
    data.position >>= 1;
    if (data.position === 0) {
      data.position = resetValue;
      data.val = getNextValue(data.index++);
    }
    bits |= (resb > 0 ? 1 : 0) * power;
    power <<= 1;
  }
  return bits;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}
