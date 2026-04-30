const DISTRICT_POINTS = {
  "中山区": [121.6689, 38.9175],
  "西岗区": [121.6125, 38.9147],
  "沙河口区": [121.5947, 38.9048],
  "甘井子区": [121.5255, 38.9529],
  "旅顺口区": [121.2618, 38.8517],
  "金州区": [121.7826, 39.0525],
  "普兰店区": [121.9705, 39.4017],
  "瓦房店市": [121.9796, 39.6271],
  "庄河市": [122.9672, 39.6895],
  "长海县": [122.5886, 39.2727],
  "高新区": [121.5251, 38.8622],
  "开发区": [121.7824, 39.0504],
  "未注明": [121.6147, 38.914]
};

const state = {
  all: Array.isArray(window.TUTOR_DATA) ? window.TUTOR_DATA : [],
  filtered: [],
  activeId: null,
  map: null,
  markers: [],
  markersById: new Map(),
  geocoder: null,
  amapReady: false
};

const els = {
  welcomeNotice: document.querySelector("#welcomeNotice"),
  noticeClose: document.querySelector("#noticeClose"),
  summary: document.querySelector("#summary"),
  amapKey: document.querySelector("#amapKey"),
  amapSecurity: document.querySelector("#amapSecurity"),
  saveKey: document.querySelector("#saveKey"),
  subjectFilter: document.querySelector("#subjectFilter"),
  gradeFilter: document.querySelector("#gradeFilter"),
  districtFilter: document.querySelector("#districtFilter"),
  salaryMin: document.querySelector("#salaryMin"),
  salaryMax: document.querySelector("#salaryMax"),
  idQuery: document.querySelector("#idQuery"),
  keyword: document.querySelector("#keyword"),
  resetFilters: document.querySelector("#resetFilters"),
  cards: document.querySelector("#cards"),
  resultCount: document.querySelector("#resultCount"),
  map: document.querySelector("#map"),
  mapStatus: document.querySelector("#mapStatus")
};

function getGradeType(item) {
  const grade = String(item.grade || "");
  const raw = String(item.raw || "");
  const text = `${grade} ${raw}`;
  if (/高[一二三123]|高中|高考/.test(text)) return "high";
  if (/初[一二三123]|初中|中考/.test(text)) return "middle";
  if (/小[一二三四五六123456]|小学|一年级|二年级|三年级|四年级|五年级|六年级/.test(text)) return "primary";
  return "other";
}

function getGradeClass(item) {
  return `grade-${getGradeType(item)}`;
}

function getGradeColor(item) {
  return {
    primary: "#2f9e44",
    middle: "#1f6feb",
    high: "#d64545",
    other: "#7a869a"
  }[getGradeType(item)];
}

function getPublicConfig() {
  return window.PUBLIC_MAP_CONFIG || {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function fillSelect(select, label, values) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = `全部${label}`;
  select.appendChild(all);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function initFilters() {
  fillSelect(
    els.subjectFilter,
    "科目",
    unique(state.all.flatMap((item) => item.subjects || []))
  );
  fillSelect(els.gradeFilter, "年级", unique(state.all.map((item) => item.grade)));
  fillSelect(els.districtFilter, "分区", unique(state.all.map((item) => item.district)));

  [
    els.subjectFilter,
    els.gradeFilter,
    els.districtFilter,
    els.salaryMin,
    els.salaryMax,
    els.idQuery,
    els.keyword
  ].forEach((el) => el.addEventListener("input", applyFilters));

  els.resetFilters.addEventListener("click", () => {
    [
      els.subjectFilter,
      els.gradeFilter,
      els.districtFilter,
      els.salaryMin,
      els.salaryMax,
      els.idQuery,
      els.keyword
    ].forEach((el) => {
      el.value = "";
    });
    applyFilters();
  });
}

function applyFilters() {
  const subject = els.subjectFilter.value;
  const grade = els.gradeFilter.value;
  const district = els.districtFilter.value;
  const min = Number(els.salaryMin.value || 0);
  const max = Number(els.salaryMax.value || 0);
  const idQuery = els.idQuery.value.trim().toLowerCase();
  const keyword = els.keyword.value.trim().toLowerCase();

  state.filtered = state.all.filter((item) => {
    const subjects = item.subjects || [];
    const haystack = `${item.id} ${item.address} ${item.district} ${item.grade} ${subjects.join(" ")} ${item.salary} ${item.note} ${item.raw}`.toLowerCase();
    const salaryMin = Number(item.salaryMin || item.salaryMax || 0);
    const salaryMax = Number(item.salaryMax || item.salaryMin || 0);

    if (subject && !subjects.includes(subject)) return false;
    if (grade && item.grade !== grade) return false;
    if (district && item.district !== district) return false;
    if (idQuery && !String(item.id).toLowerCase().includes(idQuery)) return false;
    if (keyword && !haystack.includes(keyword)) return false;
    if (min && salaryMax && salaryMax < min) return false;
    if (max && salaryMin && salaryMin > max) return false;
    return true;
  });

  if (!state.filtered.some((item) => item.id === state.activeId)) {
    state.activeId = null;
  }
  renderCards();
  renderMap();
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function renderCards() {
  els.resultCount.textContent = `${state.filtered.length} 条`;
  els.summary.textContent = state.all.length
    ? `已载入 ${state.all.length} 条需求，当前显示 ${state.filtered.length} 条`
    : "还没有解析到家教需求，请先保存 Word 内容并运行解析脚本";

  if (!state.filtered.length) {
    els.cards.innerHTML = `<div class="empty">没有匹配结果。可以放宽筛选条件，或确认 Word 文档里是否已经保存内容。</div>`;
    return;
  }

  els.cards.innerHTML = state.filtered
    .map((item) => {
      const active = item.id === state.activeId ? " active" : "";
      const tags = [
        item.district,
        item.grade,
        ...(item.subjects || [])
      ].filter(Boolean);
      const gradeColor = getGradeColor(item);
      return `
        <article class="card${active}" data-id="${escapeText(item.id)}">
          <div class="card-top">
            <span class="serial" style="--grade-color: ${gradeColor}">${escapeText(item.id)}</span>
            <span class="salary">${escapeText(item.salary || "薪资未注明")}</span>
          </div>
          <p class="address">${escapeText(item.address || "地址未注明")}</p>
          <div class="meta">${tags.map((tag) => `<span class="tag">${escapeText(tag)}</span>`).join("")}</div>
          <p class="note">${escapeText(item.note || "无额外备注")}</p>
        </article>
      `;
    })
    .join("");

  els.cards.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      setActiveTask(card.dataset.id, { centerMap: true, scrollList: false });
    });
  });
}

function getPoint(item, index) {
  if (item.lng && item.lat) return [Number(item.lng), Number(item.lat)];
  const base = DISTRICT_POINTS[item.district] || DISTRICT_POINTS["未注明"];
  const offset = ((index % 9) - 4) * 0.006;
  return [base[0] + offset, base[1] - offset * 0.7];
}

function renderOfflineMap() {
  els.map.innerHTML = `<div class="offline-map" aria-label="离线近似地图"></div>`;
  const box = els.map.querySelector(".offline-map");
  const points = state.filtered.map(getPoint);
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  const minLng = Math.min(...lngs, 121.1);
  const maxLng = Math.max(...lngs, 123.1);
  const minLat = Math.min(...lats, 38.75);
  const maxLat = Math.max(...lats, 39.75);

  state.filtered.forEach((item, index) => {
    const point = getPoint(item, index);
    const marker = document.createElement("button");
    marker.className = `offline-marker ${getGradeClass(item)}${item.id === state.activeId ? " active" : ""}`;
    marker.style.left = `${((point[0] - minLng) / (maxLng - minLng || 1)) * 86 + 7}%`;
    marker.style.top = `${(1 - (point[1] - minLat) / (maxLat - minLat || 1)) * 82 + 9}%`;
    marker.title = `${item.id} ${item.address}`;
    marker.textContent = String(item.id);
    marker.setAttribute("aria-label", `${item.id} ${item.address}`);
    marker.addEventListener("click", () => {
      setActiveTask(item.id, { centerMap: true, scrollList: true });
    });
    box.appendChild(marker);
  });

  els.mapStatus.textContent = "当前是无 Key 的近似地图。填写高德 Web JS API Key 后，可显示真实地图并尝试解析详细地址。";
}

function clearAmapMarkers() {
  if (state.map && state.markers.length) {
    state.map.remove(state.markers);
  }
  state.markers = [];
  state.markersById = new Map();
}

function createAmapMarkerContent(item) {
  const marker = document.createElement("div");
  marker.className = `map-marker ${getGradeClass(item)}${item.id === state.activeId ? " active" : ""}`;
  marker.title = `${item.id} ${item.address || ""}`;
  marker.setAttribute("aria-label", marker.title);
  const label = document.createElement("span");
  label.textContent = String(item.id);
  marker.appendChild(label);
  return marker;
}

function getMarkerOffset(item) {
  return item.id === state.activeId ? new AMap.Pixel(-28, -28) : new AMap.Pixel(-23, -23);
}

function renderAmap() {
  if (!state.map) {
    state.map = new AMap.Map("map", {
      center: [121.6147, 38.914],
      zoom: 11,
      viewMode: "2D"
    });
    state.geocoder = new AMap.Geocoder({ city: "大连市" });
  }

  clearAmapMarkers();
  const points = [];
  state.filtered.forEach((item, index) => {
    const point = getPoint(item, index);
    points.push(point);
    const marker = new AMap.Marker({
      position: point,
      title: `${item.id} ${item.address}`,
      content: createAmapMarkerContent(item),
      offset: getMarkerOffset(item)
    });
    marker.on("click", () => {
      setActiveTask(item.id, { centerMap: true, scrollList: true });
    });
    state.markers.push(marker);
    state.markersById.set(item.id, marker);

    if (!item.lng && !item.lat && state.geocoder && item.address && item.address !== "大连市") {
      item._geocoding = true;
      state.geocoder.getLocation(item.address, (status, result) => {
        const location = result?.geocodes?.[0]?.location;
        if (status === "complete" && location) {
          item.lng = location.lng;
          item.lat = location.lat;
          marker.setPosition([item.lng, item.lat]);
          if (!state.activeId && state.filtered.length > 1) {
            state.map.setFitView(state.markers, false, [50, 50, 50, 50]);
          }
        }
        item._geocoding = false;
      });
    }
  });
  state.map.add(state.markers);

  if (points.length) {
    state.map.setFitView(state.markers, false, [50, 50, 50, 50]);
  }
  els.mapStatus.textContent = "已加载高德地图。当前坐标优先使用已解析坐标，缺坐标时按行政区近似展示。";
}

function updateAmapMarkerHighlight() {
  if (!state.amapReady || !window.AMap) return;
  state.filtered.forEach((item) => {
    const marker = state.markersById.get(item.id);
    if (!marker) return;
    marker.setContent(createAmapMarkerContent(item));
    marker.setOffset(getMarkerOffset(item));
    marker.setzIndex(item.id === state.activeId ? 120 : 100);
  });
}

function scrollActiveCardIntoView() {
  if (!state.activeId) return;
  const activeCard = els.cards.querySelector(`.card[data-id="${CSS.escape(state.activeId)}"]`);
  if (!activeCard) return;
  activeCard.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function setActiveTask(id, options = {}) {
  const { centerMap = false, scrollList = false } = options;
  if (!id || state.activeId === id) {
    if (centerMap) focusActiveMarker();
    if (scrollList) scrollActiveCardIntoView();
    return;
  }
  state.activeId = id;
  renderCards();
  updateAmapMarkerHighlight();
  if (!state.amapReady) {
    renderMap();
  }
  if (scrollList) {
    scrollActiveCardIntoView();
  }
  if (centerMap) {
    focusActiveMarker();
  }
}

function renderMap() {
  if (!state.filtered.length) {
    els.map.innerHTML = `<div class="offline-map"></div>`;
    els.mapStatus.textContent = "没有可展示的点位。";
    return;
  }
  if (state.amapReady && window.AMap) {
    renderAmap();
  } else {
    renderOfflineMap();
  }
}

function focusActiveMarker() {
  if (!state.activeId) return;
  const activeIndex = state.filtered.findIndex((item) => item.id === state.activeId);
  if (activeIndex < 0) return;
  const active = state.filtered[activeIndex];
  if (state.amapReady && state.map) {
    const marker = state.markersById.get(active.id);
    const position = marker ? marker.getPosition() : getPoint(active, activeIndex);
    state.map.setZoomAndCenter(Math.max(state.map.getZoom(), 14), position);
  } else {
    renderMap();
  }
}

function loadAmap(key) {
  if (!key) {
    renderMap();
    return;
  }
  const securityJsCode = els.amapSecurity.value.trim();
  if (securityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode
    };
  }
  if (window.AMap) {
    state.amapReady = true;
    renderMap();
    return;
  }
  window.onAmapReady = () => {
    state.amapReady = true;
    renderMap();
  };
  const script = document.createElement("script");
  script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&callback=onAmapReady&plugin=AMap.Geocoder`;
  script.onerror = () => {
    state.amapReady = false;
    els.mapStatus.textContent = "高德地图加载失败，请检查 Key、安全密钥、域名白名单、网络或高德 JS API 服务是否开通。";
    renderOfflineMap();
  };
  document.head.appendChild(script);
}

function initKeyBox() {
  const publicConfig = getPublicConfig();
  const urlKey = new URLSearchParams(location.search).get("amap_key");
  const urlSecurity = new URLSearchParams(location.search).get("amap_security");
  const savedKey = localStorage.getItem("amap_key") || "";
  const savedSecurity = localStorage.getItem("amap_security_code") || "";
  els.amapKey.value = urlKey || savedKey || publicConfig.amapKey || "";
  els.amapSecurity.value = urlSecurity || savedSecurity || publicConfig.amapSecurityCode || "";
  if (publicConfig.hideKeyInputs && !new URLSearchParams(location.search).has("show_keys")) {
    document.querySelector(".keybox")?.classList.add("hidden");
  }
  els.saveKey.addEventListener("click", () => {
    localStorage.setItem("amap_key", els.amapKey.value.trim());
    localStorage.setItem("amap_security_code", els.amapSecurity.value.trim());
    location.reload();
  });
  if (location.protocol === "file:") {
    els.mapStatus.textContent = "当前用 file:// 打开，高德鉴权可能无法识别域名。建议用 README 里的本地服务器方式或 GitHub Pages 打开。";
  }
  loadAmap(els.amapKey.value.trim());
}

function initNotice() {
  if (!els.welcomeNotice || !els.noticeClose) return;
  els.noticeClose.addEventListener("click", () => {
    els.welcomeNotice.classList.add("hidden");
  });
  els.welcomeNotice.addEventListener("click", (event) => {
    if (event.target === els.welcomeNotice) {
      els.welcomeNotice.classList.add("hidden");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.welcomeNotice.classList.add("hidden");
    }
  });
}

function init() {
  initNotice();
  initFilters();
  initKeyBox();
  applyFilters();
}

init();
