(() => {
  "use strict";

  const STORAGE_KEY = "today-sleepiness-records-v1";
  const VALID_STATUSES = ["awake", "sleepy", "very-sleepy"];
  const STATUS = {
    awake: { label: "清醒", emoji: "☀️", color: "var(--awake)" },
    sleepy: { label: "有点困", emoji: "🌥", color: "var(--sleepy)" },
    "very-sleepy": { label: "很困", emoji: "😴", color: "var(--very-sleepy)" },
  };

  const state = {
    records: loadRecords(),
    rangeDays: 7,
    lastAddedId: null,
    pendingDeleteId: null,
    deferredInstallPrompt: null,
    toastTimer: null,
  };

  const elements = {
    todayLabel: document.querySelector("#today-label"),
    pageLinks: [...document.querySelectorAll("[data-page-link]")],
    pages: [...document.querySelectorAll("[data-page]")],
    moodButtons: [...document.querySelectorAll("[data-status]")],
    recordFeedback: document.querySelector("#record-feedback"),
    recordFeedbackText: document.querySelector("#record-feedback-text"),
    undoButton: document.querySelector("#undo-button"),
    todayRecords: document.querySelector("#today-records"),
    todayCount: document.querySelector("#today-count"),
    rangeButtons: [...document.querySelectorAll("[data-days]")],
    historyRangeLabel: document.querySelector("#history-range-label"),
    historyRecords: document.querySelector("#history-records"),
    statsList: document.querySelector("#stats-list"),
    statsTotal: document.querySelector("#stats-total"),
    deleteDialog: document.querySelector("#delete-dialog"),
    deleteDialogCopy: document.querySelector("#delete-dialog-copy"),
    confirmDeleteButton: document.querySelector("#confirm-delete-button"),
    clearDialog: document.querySelector("#clear-dialog"),
    continueClearButton: document.querySelector("#continue-clear-button"),
    finalClearDialog: document.querySelector("#final-clear-dialog"),
    confirmClearButton: document.querySelector("#confirm-clear-button"),
    clearDataButton: document.querySelector("#clear-data-button"),
    exportCsvButton: document.querySelector("#export-csv-button"),
    exportJsonButton: document.querySelector("#export-json-button"),
    importFile: document.querySelector("#import-file"),
    installButton: document.querySelector("#install-button"),
    toast: document.querySelector("#toast"),
  };

  init();

  function init() {
    elements.todayLabel.textContent = formatHeaderDate(new Date());
    bindEvents();
    renderAll();
    showPage(location.hash === "#history" ? "history" : "home", false);
    registerServiceWorker();
  }

  function bindEvents() {
    elements.moodButtons.forEach((button) => {
      button.addEventListener("click", () => addRecord(button.dataset.status));
    });

    elements.undoButton.addEventListener("click", undoLastRecord);

    elements.pageLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showPage(link.dataset.pageLink);
      });
    });

    window.addEventListener("hashchange", () => {
      showPage(location.hash === "#history" ? "history" : "home", false);
    });

    elements.rangeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.rangeDays = Number(button.dataset.days);
        elements.rangeButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderHistory();
      });
    });

    elements.historyRecords.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-id]");
      if (button) requestDelete(button.dataset.deleteId);
    });

    elements.confirmDeleteButton.addEventListener("click", () => {
      if (state.pendingDeleteId) deleteRecord(state.pendingDeleteId);
      state.pendingDeleteId = null;
    });

    elements.clearDataButton.addEventListener("click", () => elements.clearDialog.showModal());
    elements.continueClearButton.addEventListener("click", () => {
      window.setTimeout(() => elements.finalClearDialog.showModal(), 0);
    });
    elements.confirmClearButton.addEventListener("click", clearAllRecords);
    elements.exportCsvButton.addEventListener("click", exportCsv);
    elements.exportJsonButton.addEventListener("click", exportJson);
    elements.importFile.addEventListener("change", importBackup);

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      elements.installButton.hidden = false;
    });

    elements.installButton.addEventListener("click", installApp);

    window.addEventListener("appinstalled", () => {
      state.deferredInstallPrompt = null;
      elements.installButton.hidden = true;
      showToast("已安装到设备");
    });
  }

  function addRecord(status) {
    if (!VALID_STATUSES.includes(status)) return;

    const now = new Date();
    const record = {
      id: createId(),
      timestamp: now.toISOString(),
      status,
    };

    state.records.push(record);
    state.lastAddedId = record.id;
    saveRecords();
    renderAll();

    elements.recordFeedbackText.textContent = `已记录：${formatMonthDay(now)} ${formatTime(now)}，${STATUS[status].label}`;
    elements.recordFeedback.hidden = false;
  }

  function undoLastRecord() {
    if (!state.lastAddedId) return;
    const before = state.records.length;
    state.records = state.records.filter((record) => record.id !== state.lastAddedId);
    state.lastAddedId = null;

    if (state.records.length !== before) {
      saveRecords();
      renderAll();
      elements.recordFeedback.hidden = true;
      showToast("已撤销本次记录");
    }
  }

  function requestDelete(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    state.pendingDeleteId = id;
    const date = new Date(record.timestamp);
    elements.deleteDialogCopy.textContent = `${formatMonthDay(date)} ${formatTime(date)}，${STATUS[record.status].label}。删除后无法恢复。`;
    elements.deleteDialog.showModal();
  }

  function deleteRecord(id) {
    const before = state.records.length;
    state.records = state.records.filter((record) => record.id !== id);
    if (state.records.length === before) return;
    if (state.lastAddedId === id) {
      state.lastAddedId = null;
      elements.recordFeedback.hidden = true;
    }
    saveRecords();
    renderAll();
    showToast("记录已删除");
  }

  function clearAllRecords() {
    state.records = [];
    state.lastAddedId = null;
    localStorage.removeItem(STORAGE_KEY);
    elements.recordFeedback.hidden = true;
    renderAll();
    showToast("全部记录已清空");
  }

  function renderAll() {
    renderToday();
    renderStats();
    renderHistory();
  }

  function renderToday() {
    const records = state.records
      .filter((record) => isSameLocalDay(new Date(record.timestamp), new Date()))
      .sort(sortNewestFirst);

    elements.todayCount.textContent = `${records.length} 次`;
    elements.todayCount.setAttribute("aria-label", `今天共有 ${records.length} 次记录`);

    if (!records.length) {
      elements.todayRecords.innerHTML = emptyState("今天还没有记录", "在上方点一下，第一条就记好了。");
      return;
    }

    elements.todayRecords.innerHTML = records.map((record) => recordRow(record, false)).join("");
  }

  function renderStats() {
    const recent = recordsWithinDays(7);
    const counts = Object.fromEntries(VALID_STATUSES.map((status) => [status, 0]));
    recent.forEach((record) => counts[record.status] += 1);
    const max = Math.max(...Object.values(counts), 1);

    elements.statsTotal.textContent = `共 ${recent.length} 次`;
    elements.statsList.innerHTML = VALID_STATUSES.map((status) => {
      const info = STATUS[status];
      const width = counts[status] === 0 ? 0 : Math.max((counts[status] / max) * 100, 5);
      return `
        <div class="stat-row" style="--status-color: ${info.color}; --bar-width: ${width}%">
          <span class="stat-label">${info.emoji} ${info.label}</span>
          <span class="stat-track" aria-hidden="true"><span class="stat-bar"></span></span>
          <strong class="stat-number" aria-label="${info.label} ${counts[status]} 次">${counts[status]}</strong>
        </div>`;
    }).join("");
  }

  function renderHistory() {
    const records = recordsWithinDays(state.rangeDays).sort(sortNewestFirst);
    elements.historyRangeLabel.textContent = `最近 ${state.rangeDays} 天`;

    if (!records.length) {
      elements.historyRecords.innerHTML = `<div class="history-group">${emptyState(`最近 ${state.rangeDays} 天没有记录`, "每次记录都会按日期出现在这里。")}</div>`;
      return;
    }

    const groups = new Map();
    records.forEach((record) => {
      const date = new Date(record.timestamp);
      const key = localDateKey(date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });

    elements.historyRecords.innerHTML = [...groups.entries()].map(([dateKey, group]) => {
      const date = parseLocalDateKey(dateKey);
      return `
        <section class="history-group" aria-labelledby="date-${dateKey}">
          <h4 class="history-date" id="date-${dateKey}">
            ${formatHistoryDate(date)}
            <span>${group.length} 次</span>
          </h4>
          <div>${group.map((record) => recordRow(record, true)).join("")}</div>
        </section>`;
    }).join("");
  }

  function recordRow(record, deletable) {
    const info = STATUS[record.status];
    const date = new Date(record.timestamp);
    return `
      <article class="record-item" style="--status-color: ${info.color}">
        <span class="record-dot" aria-hidden="true"></span>
        <div>
          <div class="record-status">${info.emoji} ${info.label}</div>
          <p class="record-meta">${formatFullLocalDate(date)}</p>
        </div>
        ${deletable
          ? `<button class="delete-record-button" type="button" data-delete-id="${escapeHtml(record.id)}" aria-label="删除 ${formatMonthDay(date)} ${formatTime(date)} 的${info.label}记录">删除</button>`
          : `<time class="record-time" datetime="${escapeHtml(record.timestamp)}">${formatTime(date)}</time>`}
      </article>`;
  }

  function showPage(pageName, updateHash = true) {
    const page = pageName === "history" ? "history" : "home";
    elements.pages.forEach((section) => {
      const active = section.dataset.page === page;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
    });
    elements.pageLinks.forEach((link) => {
      const active = link.dataset.pageLink === page;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (updateHash) history.replaceState(null, "", page === "home" ? "#home" : "#history");
    if (page === "history") renderHistory();
  }

  function loadRecords() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.filter(isValidRecord).map(normalizeRecord);
    } catch (error) {
      console.warn("无法读取本地记录", error);
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  }

  function isValidRecord(record) {
    return record
      && typeof record === "object"
      && VALID_STATUSES.includes(record.status)
      && !Number.isNaN(new Date(record.timestamp).getTime());
  }

  function normalizeRecord(record) {
    return {
      id: String(record.id || createId()),
      timestamp: new Date(record.timestamp).toISOString(),
      status: record.status,
    };
  }

  function recordsWithinDays(days) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return state.records.filter((record) => {
      const date = new Date(record.timestamp);
      return date >= start && date <= end;
    });
  }

  function exportCsv() {
    const header = ["id", "date", "time", "status", "timestamp"];
    const rows = state.records
      .slice()
      .sort(sortNewestFirst)
      .map((record) => {
        const date = new Date(record.timestamp);
        return [record.id, localDateKey(date), formatTime(date), STATUS[record.status].label, record.timestamp];
      });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadFile(`今天困不困-${localDateKey(new Date())}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
    showToast(`已导出 ${rows.length} 条记录`);
  }

  function exportJson() {
    const backup = {
      app: "今天困不困",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: state.records.slice().sort(sortNewestFirst),
    };
    downloadFile(`今天困不困-${localDateKey(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    showToast(`已备份 ${backup.records.length} 条记录`);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = file.name.toLowerCase().endsWith(".json") || file.type.includes("json")
        ? parseJsonBackup(text)
        : parseCsvBackup(text);

      const existingKeys = new Set(state.records.map(recordIdentity));
      const unique = imported.filter((record) => {
        const key = recordIdentity(record);
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      state.records.push(...unique);
      saveRecords();
      renderAll();
      showToast(unique.length ? `成功导入 ${unique.length} 条记录` : "没有发现新的记录");
    } catch (error) {
      console.warn("导入失败", error);
      showToast(error.message || "导入失败，请检查文件格式");
    } finally {
      event.target.value = "";
    }
  }

  function parseJsonBackup(text) {
    const parsed = JSON.parse(text.replace(/^\ufeff/, ""));
    const records = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(records)) throw new Error("JSON 中没有找到记录列表");
    const valid = records.filter(isValidRecord).map(normalizeRecord);
    if (!valid.length && records.length) throw new Error("JSON 中没有有效记录");
    return valid;
  }

  function parseCsvBackup(text) {
    const rows = parseCsvRows(text.replace(/^\ufeff/, ""));
    if (rows.length < 1) throw new Error("CSV 文件为空");

    const headers = rows[0].map((cell) => cell.trim().toLowerCase());
    const timestampIndex = headers.indexOf("timestamp");
    const statusIndex = headers.indexOf("status");
    const idIndex = headers.indexOf("id");
    const dateIndex = headers.indexOf("date");
    const timeIndex = headers.indexOf("time");
    if (statusIndex === -1 || (timestampIndex === -1 && dateIndex === -1)) {
      throw new Error("CSV 缺少 status 或日期列");
    }

    const labelToStatus = { 清醒: "awake", 有点困: "sleepy", 很困: "very-sleepy" };
    const records = rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
      const rawStatus = row[statusIndex]?.trim();
      const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : labelToStatus[rawStatus];
      const rawTimestamp = timestampIndex >= 0
        ? row[timestampIndex]
        : `${row[dateIndex]}T${timeIndex >= 0 && row[timeIndex] ? row[timeIndex] : "12:00"}:00`;
      const date = new Date(rawTimestamp);
      if (!status || Number.isNaN(date.getTime())) return null;
      return {
        id: idIndex >= 0 && row[idIndex] ? row[idIndex].trim() : createId(),
        timestamp: date.toISOString(),
        status,
      };
    }).filter(Boolean).filter(isValidRecord).map(normalizeRecord);

    if (!records.length && rows.length > 1) throw new Error("CSV 中没有有效记录");
    return records;
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    if (cell.length || row.length) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
    }
    return rows;
  }

  function recordIdentity(record) {
    return `${record.timestamp}|${record.status}`;
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function installApp() {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2600);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch((error) => {
        console.warn("Service Worker 注册失败", error);
      });
    });
  }

  function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function sortNewestFirst(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  }

  function isSameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatHeaderDate(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date);
  }

  function formatMonthDay(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }

  function formatHistoryDate(date) {
    const current = new Date();
    const yesterday = new Date();
    yesterday.setDate(current.getDate() - 1);
    const suffix = isSameLocalDay(date, current) ? "今天" : isSameLocalDay(date, yesterday) ? "昨天" : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
    return `${formatMonthDay(date)} · ${suffix}`;
  }

  function formatFullLocalDate(date) {
    return `${date.getFullYear()}年${formatMonthDay(date)} ${formatTime(date)}`;
  }

  function emptyState(title, copy) {
    return `<div class="empty-state"><strong>${title}</strong><span>${copy}</span></div>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
