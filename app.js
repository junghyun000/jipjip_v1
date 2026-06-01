const STORAGE_KEY = "jipjip:listings:v1";

const naverListingImports = {
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
    recentDeal: 84000,
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
    recentDeal: 84000,
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
    name: "벽산늘푸른 102동",
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
    description: "즉시입주 협의 가능.",
    moveInDate: "즉시입주 협의 가능",
  },
  "https://naver.me/54KKdFOQ": {
    name: "등촌월드메르디앙 101동",
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
    realtorPhone: "02-3662-9662 / 02-3664-4886",
    description: "소유주 확인 매물. 2027년 6월 하순 입주 협의 가능.",
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

const statuses = ["미방문", "방문예정", "방문완료", "보류", "제외", "협상중", "계약검토"];
const checklistItems = [
  "채광과 방향이 실제로 괜찮은가?",
  "소음이 심하지 않은가?",
  "집 내부 상태가 괜찮은가? (누수, 곰팡이, 샷시, 바닥, 벽지)",
  "단지 관리 상태가 괜찮은가? (복도, 엘리베이터, 주차장, 분리수거장)",
  "주차가 실제로 불편하지 않은가?",
  "주변 생활환경이 괜찮은가? (지하철, 버스, 마트, 학교, 병원)",
  "입주 일정과 협의 조건이 맞는가?",
  "가격 협상 여지가 있는가?",
];
const ratingFields = [
  ["location", "입지"],
  ["building", "단지/건물 상태"],
  ["interior", "세대 내부 상태"],
  ["price", "가격 만족도"],
  ["preference", "최종 선호도"],
];

function createSampleListings() {
  return Object.entries(naverListingImports).map(([naverUrl, listing]) => ({
    id: crypto.randomUUID(),
    status: naverUrl === "https://naver.me/G8ffF2Tq" ? "방문예정" : "미방문",
    visitDate: "",
    visited: false,
    ...listing,
    naverUrl,
    desiredPrice: "",
    negotiablePrice: "",
    offerPrice: "",
    moveInMemo: "",
    checklist: Array(checklistItems.length).fill(false),
    ratings: {
      location: "",
      building: "",
      interior: "",
      price: "",
      preference: "",
    },
    memo: "",
  }));
}

let listings = loadListings();
let selectedId = null;

const els = {
  rows: document.querySelector("#listingRows"),
  count: document.querySelector("#listingCount"),
  detail: document.querySelector("#detailPanel"),
  statusFilter: document.querySelector("#statusFilter"),
  visitDateFilter: document.querySelector("#visitDateFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  dialog: document.querySelector("#listingDialog"),
  form: document.querySelector("#listingForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  deleteListingButton: document.querySelector("#deleteListingButton"),
  submitListingButton: document.querySelector("#submitListingButton"),
};

function loadListings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(stored) && stored.length > 0 ? enrichListingsFromNaverImports(stored) : createSampleListings();
  } catch {
    return createSampleListings();
  }
}

function saveListings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}

function enrichListingsFromNaverImports(items) {
  return items.map((listing) => {
    const imported = getImportedNaverListing(listing.naverUrl);
    if (!imported) return listing;
    return mergeImportedListing(listing, imported);
  });
}

function getImportedNaverListing(url) {
  const normalized = normalizeNaverUrl(url);
  return normalized ? naverListingImports[normalized] : null;
}

function mergeImportedListing(listing, imported) {
  const next = { ...listing };
  Object.entries(imported).forEach(([key, value]) => {
    if (
      next[key] === "" ||
      next[key] === null ||
      next[key] === undefined ||
      next[key] === "네이버 매물" ||
      (key === "name" && isPlaceholderName(next[key]))
    ) {
      next[key] = value;
    }
  });
  return next;
}

function formatWon(value) {
  const number = Number(value);
  if (!number) return "-";
  const eok = Math.floor(number / 10000);
  const man = number % 10000;
  if (eok && man) return `${eok}억 ${man.toLocaleString()}만원`;
  if (eok) return `${eok}억`;
  return `${man.toLocaleString()}만원`;
}

function toPyeong(squareMeters) {
  const number = Number(squareMeters);
  return number ? `${(number / 3.3058).toFixed(1)}평` : "-";
}

function getFilteredListings() {
  const visitDate = els.visitDateFilter.value;
  const status = els.statusFilter.value;

  return listings
    .filter((listing) => !visitDate || listing.visitDate === visitDate)
    .filter((listing) => !status || listing.status === status)
    .sort(sortListings);
}

function matchesPrice(price, band) {
  if (!band) return true;
  const value = Number(price);
  if (band === "under70000") return value < 70000;
  if (band === "70000-80000") return value >= 70000 && value < 80000;
  if (band === "80000-90000") return value >= 80000 && value < 90000;
  if (band === "90000-110000") return value >= 90000 && value < 110000;
  if (band === "over110000") return value >= 110000;
  return true;
}

function matchesArea(area, band) {
  if (!band) return true;
  if (band === "under20") return area < 20;
  if (band === "20-30") return area >= 20 && area < 30;
  if (band === "30-40") return area >= 30 && area < 40;
  if (band === "over40") return area >= 40;
  return true;
}

function sortListings(a, b) {
  const sort = els.sortSelect.value;
  if (sort === "priceAsc") return compareNumbers(a.price, b.price);
  if (sort === "priceDesc") return compareNumbers(b.price, a.price);
  if (sort === "nameAsc") return compareNames(a.name, b.name);
  if (sort === "recentDealDesc") return compareNumbers(b.recentDeal, a.recentDeal);
  if (sort === "preferenceDesc") return Number(b.ratings.preference) - Number(a.ratings.preference);
  if (sort === "statusAsc") return statuses.indexOf(a.status) - statuses.indexOf(b.status);
  return (a.visitDate || "9999-99-99").localeCompare(b.visitDate || "9999-99-99");
}

function compareNumbers(a, b) {
  const left = Number(a);
  const right = Number(b);
  const leftEmpty = !Number.isFinite(left) || left <= 0;
  const rightEmpty = !Number.isFinite(right) || right <= 0;
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  return left - right;
}

function compareNames(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

function render() {
  const filtered = getFilteredListings();
  els.count.textContent = `${filtered.length}개 매물`;
  els.rows.innerHTML = filtered.map(renderRow).join("");

  document.querySelectorAll("[data-row-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      selectedId = row.dataset.rowId;
      render();
    });
  });

  renderDetail();
}

function renderRow(listing) {
  const area = `${toPyeong(listing.supplyArea)} / 전용 ${listing.exclusiveArea || "-"}㎡`;
  const finalScore = listing.ratings?.preference;
  const finalScoreLabel = finalScore ? `★ ${finalScore}/5` : "점수 -";
  const articleNumber = escapeHtml(listing.articleNumber || "-");
  const articleNumberCell = listing.naverUrl
    ? `<a class="external-link" href="${escapeAttr(listing.naverUrl)}" target="_blank" rel="noreferrer">${articleNumber}</a>`
    : articleNumber;
  const realtorPhoneCell = listing.realtorPhone
    ? `<a class="phone-link" href="tel:${escapeAttr(normalizePhone(listing.realtorPhone))}">${escapeHtml(listing.realtorPhone)}</a>`
    : "-";
  const listMeta = [
    listing.floor,
    listing.direction,
    listing.rooms ? `방 ${listing.rooms}` : "",
    listing.maintenance ? `관리비 ${listing.maintenance}` : "",
  ].filter(Boolean);
  return `
    <tr data-row-id="${listing.id}" class="${listing.id === selectedId ? "is-selected" : ""}">
      <td data-label="상태" class="status-cell"><span class="status-pill" data-status="${listing.status}">${listing.status}</span></td>
      <td data-label="최종점수" class="score-cell ${finalScore ? "" : "is-empty-score"}">${escapeHtml(finalScoreLabel)}</td>
      <td data-label="임장일" class="visit-cell">${listing.visitDate || "-"}</td>
      <td data-label="단지명 / 매물명" class="name-cell">
        <strong>${escapeHtml(listing.name)}</strong>
        <span class="mobile-meta">${escapeHtml(listMeta.join(" · ") || "상세 정보 확인")}</span>
      </td>
      <td data-label="매물번호" class="article-cell">${articleNumberCell}</td>
      <td data-label="매매가" class="price-cell">${formatWon(listing.price)}</td>
      <td data-label="평형 / 전용면적" class="area-cell">${area}</td>
      <td data-label="층수" class="floor-cell">${escapeHtml(listing.floor || "-")}</td>
      <td data-label="향" class="direction-cell">${escapeHtml(listing.direction || "-")}</td>
      <td data-label="방" class="rooms-cell">${listing.rooms || "-"}</td>
      <td data-label="관리비" class="maintenance-cell">${escapeHtml(listing.maintenance || "-")}</td>
      <td data-label="최근 실거래가" class="deal-cell">${formatWon(listing.recentDeal)}</td>
      <td data-label="세대수" class="households-cell">${escapeHtml(listing.households || "-")}</td>
      <td data-label="주차" class="parking-cell">${escapeHtml(listing.parking || "-")}</td>
      <td data-label="부동산 전화" class="phone-cell">${realtorPhoneCell}</td>
      <td data-label="매물소개" class="description-cell">${escapeHtml(listing.description || "-")}</td>
      <td data-label="링크" class="link-cell">${listing.naverUrl ? `<a class="external-link" href="${escapeAttr(listing.naverUrl)}" target="_blank" rel="noreferrer">열기</a>` : "-"}</td>
    </tr>
  `;
}

function renderDetail() {
  const listing = listings.find((item) => item.id === selectedId);
  document.body.classList.toggle("detail-open", Boolean(listing));
  if (!listing) {
    els.detail.innerHTML = `
      <div class="empty-detail">
        <strong>매물을 선택하세요</strong>
        <p>행을 클릭하면 임장 일정, 체크리스트, 협상 정보, 평가, 메모를 편집할 수 있습니다.</p>
      </div>
    `;
    return;
  }

  els.detail.innerHTML = `
    <div class="detail-content">
      <div class="detail-title-row">
        <div>
          <h2>${escapeHtml(listing.name)}</h2>
          <span class="status-pill" data-status="${listing.status}">${listing.status}</span>
        </div>
        <div class="detail-actions">
          <button class="ghost-button close-detail-button" type="button" id="closeDetailButton">목록</button>
          <button class="ghost-button" type="button" id="editListingButton">기본정보 수정</button>
          <button class="ghost-button danger-button" type="button" id="deleteDetailButton">삭제</button>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-item"><span>매매가</span><strong>${formatWon(listing.price)}</strong></div>
        <div class="summary-item"><span>최근 실거래가</span><strong>${formatWon(listing.recentDeal)}</strong></div>
        <div class="summary-item"><span>면적</span><strong>${toPyeong(listing.supplyArea)} / ${listing.exclusiveArea || "-"}㎡</strong></div>
        <div class="summary-item"><span>층 / 향</span><strong>${escapeHtml(listing.floor || "-")} · ${escapeHtml(listing.direction || "-")}</strong></div>
        <div class="summary-item full-span"><span>부동산 전화</span><strong>${listing.realtorPhone ? `<a class="phone-link" href="tel:${escapeAttr(normalizePhone(listing.realtorPhone))}">${escapeHtml(listing.realtorPhone)}</a>` : "-"}</strong></div>
      </div>

      <h3>임장 일정</h3>
      <div class="detail-form-grid">
        ${selectField("status", "임장 상태", listing.status, statuses)}
        ${inputField("visitDate", "임장 예정일", listing.visitDate, "date")}
        <label class="checkbox-label full-span">
          <input id="visitedInput" data-detail-field="visited" type="checkbox" ${listing.visited ? "checked" : ""} />
          실제 방문 완료
        </label>
      </div>

      <h3>협상 정보</h3>
      <div class="detail-form-grid">
        ${inputField("desiredPrice", "희망 매수가", listing.desiredPrice)}
        ${inputField("negotiablePrice", "네고 가능 금액", listing.negotiablePrice)}
        ${inputField("offerPrice", "실제 제안 금액", listing.offerPrice)}
        ${inputField("moveInDate", "입주 협의 가능일", listing.moveInDate)}
        ${textareaField("moveInMemo", "입주 협의 메모", listing.moveInMemo)}
      </div>

      <h3>임장 체크리스트</h3>
      <div class="checklist">
        ${checklistItems
          .map(
            (item, index) => `
              <label>
                <input data-checklist-index="${index}" type="checkbox" ${listing.checklist?.[index] ? "checked" : ""} />
                ${escapeHtml(item)}
              </label>
            `,
          )
          .join("")}
      </div>

      <h3>5점 평가</h3>
      <div class="rating-grid">
        ${ratingFields
          .map(
            ([key, label]) => `
              <label for="rating-${key}">${label}</label>
              <select id="rating-${key}" data-rating-field="${key}">
                <option value="">선택</option>
                ${[1, 2, 3, 4, 5]
                  .map((score) => `<option value="${score}" ${String(listing.ratings?.[key] || "") === String(score) ? "selected" : ""}>${score}</option>`)
                  .join("")}
              </select>
            `,
          )
          .join("")}
      </div>

      <h3>자유 메모</h3>
      ${textareaField("memo", "메모", listing.memo)}
    </div>
  `;

  document.querySelector("#closeDetailButton").addEventListener("click", () => {
    selectedId = null;
    render();
  });
  document.querySelector("#editListingButton").addEventListener("click", () => openDialog(listing));
  document.querySelector("#deleteDetailButton").addEventListener("click", () => {
    if (!confirm("이 매물을 삭제할까요?")) return;
    deleteListingById(listing.id);
  });
  bindDetailInputs(listing);
}

function selectField(field, label, value, options) {
  return `
    <label>${label}
      <select data-detail-field="${field}">
        ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </label>
  `;
}

function inputField(field, label, value, type = "text") {
  return `<label>${label}<input data-detail-field="${field}" type="${type}" value="${escapeAttr(value || "")}" /></label>`;
}

function textareaField(field, label, value) {
  return `<label class="full-span">${label}<textarea data-detail-field="${field}" rows="4">${escapeHtml(value || "")}</textarea></label>`;
}

function bindDetailInputs(listing) {
  document.querySelectorAll("[data-detail-field]").forEach((input) => {
    input.addEventListener("input", () => {
      listing[input.dataset.detailField] = input.type === "checkbox" ? input.checked : input.value;
      saveListings();
    });
    input.addEventListener("change", () => {
      const field = input.dataset.detailField;
      listing[field] = input.type === "checkbox" ? input.checked : input.value;
      saveListings();
      if (["status", "visitDate"].includes(field)) render();
    });
  });

  document.querySelectorAll("[data-checklist-index]").forEach((input) => {
    input.addEventListener("change", () => {
      listing.checklist = listing.checklist || Array(checklistItems.length).fill(false);
      listing.checklist[Number(input.dataset.checklistIndex)] = input.checked;
      saveListings();
    });
  });

  document.querySelectorAll("[data-rating-field]").forEach((input) => {
    input.addEventListener("change", () => {
      listing.ratings = listing.ratings || {};
      listing.ratings[input.dataset.ratingField] = input.value;
      saveListings();
      if (input.dataset.ratingField === "preference") render();
    });
  });
}

function openDialog(listing = null) {
  const isAdding = !listing;
  els.form.reset();
  els.form.classList.toggle("is-link-only", isAdding);
  els.dialogTitle.textContent = listing ? "매물 수정" : "네이버 링크 추가";
  els.submitListingButton.textContent = listing ? "저장" : "불러오기";
  els.deleteListingButton.hidden = !listing;
  document.querySelectorAll(".manual-field input, .manual-field textarea").forEach((input) => {
    input.disabled = isAdding;
  });
  document.querySelector("#nameInput").required = !isAdding;
  document.querySelector("#naverUrlInput").required = isAdding;
  document.querySelector("#listingIdInput").value = listing?.id || "";
  document.querySelector("#nameInput").value = listing?.name || "";
  document.querySelector("#articleNumberInput").value = listing?.articleNumber || "";
  document.querySelector("#priceInput").value = listing?.price || "";
  document.querySelector("#recentDealInput").value = listing?.recentDeal || "";
  document.querySelector("#supplyAreaInput").value = listing?.supplyArea || "";
  document.querySelector("#exclusiveAreaInput").value = listing?.exclusiveArea || "";
  document.querySelector("#floorInput").value = listing?.floor || "";
  document.querySelector("#directionInput").value = listing?.direction || "";
  document.querySelector("#roomsInput").value = listing?.rooms || "";
  document.querySelector("#maintenanceInput").value = listing?.maintenance || "";
  document.querySelector("#householdsInput").value = listing?.households || "";
  document.querySelector("#parkingInput").value = listing?.parking || "";
  document.querySelector("#realtorPhoneInput").value = listing?.realtorPhone || "";
  document.querySelector("#naverUrlInput").value = listing?.naverUrl || "";
  document.querySelector("#descriptionInput").value = listing?.description || "";
  els.dialog.showModal();
}

async function saveDialogListing(event) {
  event.preventDefault();
  const id = document.querySelector("#listingIdInput").value || crypto.randomUUID();
  const existing = listings.find((item) => item.id === id);
  const naverUrlInput = document.querySelector("#naverUrlInput");
  const naverUrl = naverUrlInput.value.trim();
  if (naverUrl && !isNaverRealEstateUrl(naverUrl)) {
    naverUrlInput.setCustomValidity("네이버부동산 링크만 추가할 수 있습니다.");
    naverUrlInput.reportValidity();
    return;
  }
  naverUrlInput.setCustomValidity("");
  if (!existing) {
    const imported = await importNaverListing(naverUrl);
    const next = {
      id,
      status: "미방문",
      visitDate: "",
      visited: false,
      name: buildNameFromUrl(naverUrl),
      articleNumber: "",
      price: "",
      recentDeal: "",
      supplyArea: "",
      exclusiveArea: "",
      floor: "",
      direction: "",
      rooms: "",
      maintenance: "",
      households: "",
      parking: "",
      realtorPhone: "",
      description: "",
      naverUrl,
      desiredPrice: "",
      negotiablePrice: "",
      offerPrice: "",
      moveInDate: "",
      moveInMemo: "",
      checklist: Array(checklistItems.length).fill(false),
      ratings: { location: "", building: "", interior: "", price: "", preference: "" },
      memo: "",
    };
    listings = [imported ? mergeImportedListing(next, imported) : next, ...listings];
    selectedId = null;
    saveListings();
    els.dialog.close();
    render();
    return;
  }

  const next = {
    ...existing,
    name: document.querySelector("#nameInput").value.trim(),
    articleNumber: document.querySelector("#articleNumberInput").value.trim(),
    price: Number(document.querySelector("#priceInput").value) || "",
    recentDeal: Number(document.querySelector("#recentDealInput").value) || "",
    supplyArea: Number(document.querySelector("#supplyAreaInput").value) || "",
    exclusiveArea: Number(document.querySelector("#exclusiveAreaInput").value) || "",
    floor: document.querySelector("#floorInput").value.trim(),
    direction: document.querySelector("#directionInput").value.trim(),
    rooms: Number(document.querySelector("#roomsInput").value) || "",
    maintenance: document.querySelector("#maintenanceInput").value.trim(),
    households: document.querySelector("#householdsInput").value.trim(),
    parking: document.querySelector("#parkingInput").value.trim(),
    realtorPhone: document.querySelector("#realtorPhoneInput").value.trim(),
    naverUrl,
    description: document.querySelector("#descriptionInput").value.trim(),
  };

  listings = listings.map((item) => (item.id === id ? next : item));
  selectedId = id;
  saveListings();
  els.dialog.close();
  render();
}

function deleteSelectedListing() {
  const id = document.querySelector("#listingIdInput").value;
  deleteListingById(id);
  els.dialog.close();
}

function deleteListingById(id) {
  listings = listings.filter((item) => item.id !== id);
  selectedId = null;
  saveListings();
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function buildNameFromUrl(url) {
  const imported = getImportedNaverListing(url);
  if (imported?.name) return imported.name;
  const articleNumber = extractArticleNumberFromUrl(url);
  if (articleNumber) return `네이버 매물 ${articleNumber}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("naver")) return "네이버 매물";
  } catch {
    return "네이버 매물";
  }
  return "네이버 매물";
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

async function importNaverListing(url) {
  const localImported = getImportedNaverListing(url);
  if (localImported) return localImported;

  const articleNumber = extractArticleNumberFromUrl(url);
  const imported = articleNumber
    ? {
        name: `네이버 매물 ${articleNumber}`,
        articleNumber,
      }
    : null;

  try {
    const response = await fetch(`/api/naver-import?url=${encodeURIComponent(url)}`);
    if (!response.ok) return imported;
    const data = await response.json();
    if (!data || data.error) return imported;
    return mergeImportedListing(imported || {}, data);
  } catch {
    return imported;
  }
}

async function hydrateImportedListings() {
  let changed = false;
  for (const listing of listings) {
    if (!listing.naverUrl || (listing.articleNumber && !isPlaceholderName(listing.name))) continue;
    const imported = await importNaverListing(listing.naverUrl);
    if (!imported) continue;
    const merged = mergeImportedListing(listing, imported);
    if (JSON.stringify(merged) !== JSON.stringify(listing)) {
      Object.assign(listing, merged);
      changed = true;
    }
  }

  if (changed) {
    saveListings();
    render();
  }
}

function isPlaceholderName(value) {
  return String(value || "") === "네이버 매물" || String(value || "").startsWith("네이버 매물 ");
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
  const getNextValue = (index) => alphabet.indexOf(input.replace(/ /g, "+").charAt(index));
  return decompress(input.length, 32, getNextValue);
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

function isNaverRealEstateUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "naver.me" || hostname === "land.naver.com" || hostname.endsWith(".land.naver.com");
  } catch {
    return false;
  }
}

function init() {
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    els.statusFilter.append(option);
  });

  document.querySelector("#addListingButton").addEventListener("click", () => openDialog());
  document.querySelector("#naverUrlInput").addEventListener("input", (event) => {
    event.target.setCustomValidity("");
  });
  document.querySelector("#closeDialogButton").addEventListener("click", () => els.dialog.close());
  document.querySelector("#cancelDialogButton").addEventListener("click", () => els.dialog.close());
  document.querySelector("#resetSampleButton").addEventListener("click", () => {
    listings = createSampleListings();
    selectedId = null;
    saveListings();
    render();
  });
  els.form.addEventListener("submit", saveDialogListing);
  els.deleteListingButton.addEventListener("click", deleteSelectedListing);

  [
    els.statusFilter,
    els.visitDateFilter,
    els.sortSelect,
  ].forEach((input) => {
    input.addEventListener("input", render);
    input.addEventListener("change", render);
  });

  render();
  hydrateImportedListings();
}

init();
