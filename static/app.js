/**
 * Frontend logic for FileSorter Modern Interface
 * Connects directly to the pure Python HTTP server API
 */

// Application State
const state = {
  currentDirectory: "",
  files: [],
  categories: {},
  systemInfo: null,
  activeFilterCategory: "ALL",
  searchQuery: "",
  canUndo: false,
  isScanning: false,
  isOrganizing: false,
};

// Category UI mappings
const CATEGORY_COLORS = {
  "Images": "#a371f7",
  "Documents": "#388bfd",
  "Video": "#f778ba",
  "Audio": "#d29922",
  "Archives": "#3fb950",
  "Code & Data": "#39d3f2",
  "Executables": "#f0883e",
  "Others": "#8b949e"
};

const CATEGORY_ICONS = {
  "Images": "🖼️",
  "Documents": "📄",
  "Video": "🎬",
  "Audio": "🎵",
  "Archives": "📦",
  "Code & Data": "💻",
  "Executables": "⚙️",
  "Others": "📁"
};

// DOM References
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const statusPill = document.getElementById("status-pill");
const statusText = document.getElementById("status-text");

// Input & Chips
const dirInput = document.getElementById("directory-input");
const btnBrowseDemo = document.getElementById("btn-browse-demo");
const chipDemo = document.getElementById("chip-demo");
const chipWorkspace = document.getElementById("chip-workspace");
const chipDesktop = document.getElementById("chip-desktop");
const chipDownloads = document.getElementById("chip-downloads");

// KPI Elements
const kpiTotalFiles = document.getElementById("kpi-total-files");
const kpiTotalSize = document.getElementById("kpi-total-size");
const kpiCategoriesCount = document.getElementById("kpi-categories-count");
const kpiEngineStatus = document.getElementById("kpi-engine-status");
const tableHint = document.getElementById("table-hint");

// Distribution Elements
const distributionSection = document.getElementById("distribution-section");
const categoryProgressBar = document.getElementById("category-progress-bar");
const categoryPills = document.getElementById("category-pills");
const categorySummaryPill = document.getElementById("category-summary-pill");

// Table & Filtering
const filterSearch = document.getElementById("filter-search");
const filterCategory = document.getElementById("filter-category");
const fileTableBody = document.getElementById("file-table-body");
const btnEmptyDemo = document.getElementById("btn-empty-demo");

// Action Sidebar
const btnScan = document.getElementById("btn-scan");
const btnDryRun = document.getElementById("btn-dryrun");
const btnOrganize = document.getElementById("btn-organize");
const btnUndo = document.getElementById("btn-undo");
const btnCreateSamples = document.getElementById("btn-create-samples");

// Progress & Steps
const sidebarProgress = document.getElementById("sidebar-progress");
const progressLabel = document.getElementById("progress-label");
const progressBarFill = document.getElementById("progress-bar-fill");
const guideStep1 = document.getElementById("guide-step1");
const guideStep2 = document.getElementById("guide-step2");
const guideStep3 = document.getElementById("guide-step3");

// Modal & Toast
const modalOverlay = document.getElementById("modal-overlay");
const modalBody = document.getElementById("modal-body");
const modalCancel = document.getElementById("modal-cancel");
const modalConfirm = document.getElementById("modal-confirm");
const toastEl = document.getElementById("toast");

// Log & Rules
const logConsole = document.getElementById("log-console");
const btnClearLogs = document.getElementById("btn-clear-logs");
const rulesContent = document.getElementById("rules-content");

let pendingModalAction = null;

// ---------------------------------------------------------------------------
// Theme Management
// ---------------------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem("filesorter_theme") || "dark";
  setTheme(savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlEl.getAttribute("data-theme") || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });
}

function setTheme(theme) {
  htmlEl.setAttribute("data-theme", theme);
  localStorage.setItem("filesorter_theme", theme);
  if (themeIcon) {
    themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
  }
}

// ---------------------------------------------------------------------------
// Logging & Toast
// ---------------------------------------------------------------------------
function addLog(message, type = "system") {
  if (!logConsole) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span>${escapeHtml(message)}</span>`;
  logConsole.appendChild(entry);
  logConsole.scrollTop = logConsole.scrollHeight;
}

let toastTimer = null;
function showToast(message, type = "info") {
  if (!toastEl) return;
  clearTimeout(toastTimer);

  const iconMap = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };

  toastEl.innerHTML = `<span>${iconMap[type] || "ℹ️"}</span><span>${escapeHtml(message)}</span>`;
  toastEl.className = `toast toast-${type} show`;

  toastTimer = setTimeout(() => {
    toastEl.className = "toast";
  }, 3800);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ---------------------------------------------------------------------------
// Progress & Status Indicators
// ---------------------------------------------------------------------------
function setServerStatus(status, type = "ready") {
  if (!statusText || !statusPill) return;
  statusText.textContent = status;

  if (type === "busy") {
    statusPill.style.background = "var(--yellow-dim)";
    statusPill.style.borderColor = "var(--yellow-border)";
    statusPill.style.color = "var(--yellow)";
  } else if (type === "offline") {
    statusPill.style.background = "var(--red-dim)";
    statusPill.style.borderColor = "var(--red)";
    statusPill.style.color = "var(--red)";
  } else {
    statusPill.style.background = "var(--green-dim)";
    statusPill.style.borderColor = "var(--green-border)";
    statusPill.style.color = "var(--green)";
  }
}

function setProgress(active, label = "Processing...", percent = 100) {
  if (!sidebarProgress) return;
  if (active) {
    sidebarProgress.style.display = "block";
    progressLabel.textContent = label;
    progressBarFill.style.width = `${percent}%`;
    setServerStatus("Working...", "busy");
  } else {
    sidebarProgress.style.display = "none";
    setServerStatus("Ready", "ready");
  }
}

function updateStepGuide(step) {
  // step 1 = Select folder, 2 = Scan files, 3 = Organize
  guideStep1.className = "guide-item";
  guideStep2.className = "guide-item";
  guideStep3.className = "guide-item";

  if (step === 1) {
    guideStep1.classList.add("guide-active");
  } else if (step === 2) {
    guideStep1.classList.add("guide-done");
    guideStep2.classList.add("guide-active");
  } else if (step === 3) {
    guideStep1.classList.add("guide-done");
    guideStep2.classList.add("guide-done");
    guideStep3.classList.add("guide-done");
  }
}

// ---------------------------------------------------------------------------
// Backend API Interactions
// ---------------------------------------------------------------------------
async function fetchSystemInfo() {
  if (window.location.protocol === "file:") {
    setServerStatus("Server Offline", "offline");
    showToast("Server not running. Run 'python app.py' and visit http://localhost:8000", "warning");
    addLog("Notice: You opened index.html directly as a file. Please start the Python server with 'python app.py' to enable sorting.", "warning");
    const banner = document.getElementById("server-offline-banner");
    if (banner) banner.style.display = "block";
    return;
  }

  try {
    const res = await fetch("/api/system-info");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    state.systemInfo = data;

    if (data.demo_dir && !dirInput.value) {
      dirInput.value = data.demo_dir;
      state.currentDirectory = data.demo_dir;
    }

    renderCategoryRules(data.default_categories);
    setServerStatus("Connected", "ready");
    addLog(`Connected to Python engine. Demo directory preset: ${data.demo_dir}`, "system");
    updateStepGuide(1);
  } catch (err) {
    setServerStatus("Offline", "offline");
    addLog(`Backend connection error: ${err.message}`, "error");
    showToast("Could not communicate with Python backend server.", "error");
    const banner = document.getElementById("server-offline-banner");
    if (banner) banner.style.display = "block";
  }
}

async function scanDirectory() {
  const dir = dirInput.value.trim();
  if (!dir) {
    showToast("Please enter or select a folder path to scan.", "warning");
    dirInput.focus();
    return;
  }

  showSkeletonTable();
  setProgress(true, "Scanning directory metadata...", 75);
  addLog(`[Python API] Scanning directory: "${dir}"...`, "system");

  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: dir })
    });

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || "Directory scan failed.");
    }

    const data = result.data;
    state.currentDirectory = data.directory;
    state.files = data.files || [];
    state.categories = data.categories || {};
    state.canUndo = !!data.can_undo;

    updateUI();
    updateStepGuide(2);
    showToast(`Scan complete: ${data.total_files} file(s) categorized.`, "success");
    addLog(`Scan finished. ${data.total_files} file(s) found (${data.total_size_formatted}).`, "success");
  } catch (err) {
    showToast(err.message, "error");
    addLog(`Scan Error: ${err.message}`, "error");
    renderEmptyState("Scan encountered an error", err.message);
  } finally {
    setProgress(false);
  }
}

async function organizeFiles(dryRun = false) {
  const dir = dirInput.value.trim();
  if (!dir) {
    showToast("Target directory path is required.", "warning");
    return;
  }

  if (state.files.length === 0) {
    showToast("No files to organize. Scan a folder with files first.", "warning");
    return;
  }

  const modeText = dryRun ? "Dry Run Preview" : "Sorting Files";
  setProgress(true, `${modeText}...`, 90);
  addLog(`[Python API] Starting ${modeText} in "${dir}"...`, dryRun ? "warning" : "system");

  try {
    const res = await fetch("/api/organize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: dir, dry_run: dryRun })
    });

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || "Operation failed.");
    }

    const data = result.data;
    state.canUndo = !!data.can_undo;
    btnUndo.disabled = !state.canUndo;

    if (dryRun) {
      showToast(`Dry run complete: ${data.total_organized} file(s) previewed safely.`, "info");
      addLog(`[Dry Run] Simulated moving ${data.total_organized} file(s). No files were modified.`, "warning");
    } else {
      showToast(`Success! Organized ${data.total_organized} file(s) into category folders.`, "success");
      addLog(`Success! ${data.total_organized} file(s) sorted cleanly into categorized subfolders.`, "success");
      updateStepGuide(3);
      // Re-scan to update folder status
      await scanDirectory();
    }
  } catch (err) {
    showToast(err.message, "error");
    addLog(`Organization Error: ${err.message}`, "error");
  } finally {
    setProgress(false);
  }
}

async function undoOrganization() {
  const dir = dirInput.value.trim();
  if (!dir) return;

  setProgress(true, "Restoring files...", 80);
  addLog(`[Python API] Requesting rollback/undo in "${dir}"...`, "warning");

  try {
    const res = await fetch("/api/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: dir })
    });

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || result.data?.message || "Undo failed.");
    }

    const data = result.data;
    showToast(data.message || "Rollback completed.", "success");
    addLog(`Undo successful: Restored ${data.restored_count} file(s) and removed empty category folders.`, "success");

    state.canUndo = false;
    btnUndo.disabled = true;

    await scanDirectory();
  } catch (err) {
    showToast(err.message, "error");
    addLog(`Undo Error: ${err.message}`, "error");
  } finally {
    setProgress(false);
  }
}

async function generateSampleFiles() {
  const dir = dirInput.value.trim() || state.systemInfo?.demo_dir;
  setProgress(true, "Generating sample test files...", 60);
  addLog(`[Python API] Creating dummy mock files in "${dir}"...`, "system");

  try {
    const res = await fetch("/api/create-samples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: dir })
    });

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to generate sample files.");
    }

    dirInput.value = result.data.sample_dir;
    showToast(`Created ${result.data.created_count} sample test files! Scanning now...`, "success");
    addLog(`Generated ${result.data.created_count} diverse test files (.pdf, .jpg, .py, .mp3, .zip, etc.).`, "success");

    await scanDirectory();
  } catch (err) {
    showToast(err.message, "error");
    addLog(`Sample Creation Error: ${err.message}`, "error");
  } finally {
    setProgress(false);
  }
}

// ---------------------------------------------------------------------------
// Confirmation Modal
// ---------------------------------------------------------------------------
function openConfirmModal(message, onConfirm) {
  if (modalBody) modalBody.innerHTML = message;
  pendingModalAction = onConfirm;
  if (modalOverlay) modalOverlay.style.display = "flex";
}

function closeConfirmModal() {
  if (modalOverlay) modalOverlay.style.display = "none";
  pendingModalAction = null;
}

// ---------------------------------------------------------------------------
// UI Rendering & Updates
// ---------------------------------------------------------------------------
function updateUI() {
  const totalFiles = state.files.length;
  const totalBytes = state.files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  const activeCats = Object.keys(state.categories).filter(c => state.categories[c].count > 0);

  // Animated KPI Updates
  animateValue(kpiTotalFiles, totalFiles);
  kpiTotalSize.textContent = formatBytes(totalBytes);
  animateValue(kpiCategoriesCount, activeCats.length);
  kpiEngineStatus.textContent = totalFiles > 0 ? "Scanned" : "Idle";
  kpiEngineStatus.style.color = totalFiles > 0 ? "var(--green)" : "var(--cyan)";

  if (tableHint) {
    tableHint.textContent = totalFiles > 0 
      ? `${totalFiles} file(s) found in ${state.currentDirectory}` 
      : "No files detected in target directory";
  }

  // Undo button status
  btnUndo.disabled = !state.canUndo;

  // Render Category Breakdown
  renderDistribution(totalFiles);

  // Populate Dropdown
  populateCategoryFilter(activeCats);

  // Render Table
  renderFileTable();
}

function animateValue(el, target) {
  if (!el) return;
  const current = parseInt(el.textContent, 10) || 0;
  if (isNaN(current) || current === target) {
    el.textContent = target;
    return;
  }

  const diff = target - current;
  const step = diff > 0 ? 1 : -1;
  let val = current;
  const timer = setInterval(() => {
    val += step;
    el.textContent = val;
    if (val === target) clearInterval(timer);
  }, 20);
}

function renderDistribution(totalFiles) {
  if (!distributionSection || !categoryProgressBar || !categoryPills) return;

  categoryProgressBar.innerHTML = "";
  categoryPills.innerHTML = "";

  if (totalFiles === 0) {
    distributionSection.style.display = "none";
    return;
  }

  distributionSection.style.display = "block";
  if (categorySummaryPill) {
    categorySummaryPill.textContent = `${totalFiles} total file(s)`;
  }

  Object.entries(state.categories).forEach(([category, data]) => {
    if (data.count === 0) return;

    const percent = ((data.count / totalFiles) * 100).toFixed(1);
    const color = CATEGORY_COLORS[category] || CATEGORY_COLORS["Others"];
    const icon = CATEGORY_ICONS[category] || "📁";

    // Progress bar segment
    const segment = document.createElement("div");
    segment.className = "dist-segment";
    segment.style.width = `${percent}%`;
    segment.style.backgroundColor = color;
    segment.title = `${category}: ${data.count} file(s) (${percent}%)`;
    categoryProgressBar.appendChild(segment);

    // Legend Pill
    const pill = document.createElement("div");
    pill.className = "cat-pill";
    pill.innerHTML = `
      <span class="cat-dot" style="background-color: ${color};"></span>
      <span>${icon} ${escapeHtml(category)}</span>
      <span class="cat-pill-count">${data.count}</span>
    `;
    categoryPills.appendChild(pill);
  });
}

function populateCategoryFilter(activeCategories) {
  if (!filterCategory) return;
  const currentVal = filterCategory.value;
  filterCategory.innerHTML = `<option value="ALL">All Categories (${state.files.length})</option>`;

  activeCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${state.categories[cat]?.count || 0})`;
    filterCategory.appendChild(opt);
  });

  if (activeCategories.includes(currentVal)) {
    filterCategory.value = currentVal;
  }
}

function renderFileTable() {
  if (!fileTableBody) return;
  const query = state.searchQuery.toLowerCase();
  const selectedCat = state.activeFilterCategory;

  const filtered = state.files.filter(file => {
    const matchesQuery = file.name.toLowerCase().includes(query) || file.extension.toLowerCase().includes(query);
    const matchesCategory = (selectedCat === "ALL") || (file.category === selectedCat);
    return matchesQuery && matchesCategory;
  });

  fileTableBody.innerHTML = "";

  if (filtered.length === 0) {
    renderEmptyState(
      state.files.length === 0 ? "No files detected" : "No matches found",
      state.files.length === 0 
        ? "This directory is either empty or all files have already been organized into folders." 
        : "Try clearing your search query or choosing 'All Categories'."
    );
    return;
  }

  filtered.forEach(file => {
    const icon = CATEGORY_ICONS[file.category] || "📁";
    const badgeCategoryClass = `cat-badge--${file.category.replace(/[^a-zA-Z]/g, '')}`;
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div class="fname-cell">
          <span class="fname-icon">${icon}</span>
          <span class="fname-text" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        </div>
      </td>
      <td><span class="ext-tag">${escapeHtml(file.extension)}</span></td>
      <td>
        <span class="cat-badge ${badgeCategoryClass}">
          ${escapeHtml(file.category)}
        </span>
      </td>
      <td style="font-variant-numeric: tabular-nums;">${escapeHtml(file.size_formatted)}</td>
      <td><span class="dest-tag">/${escapeHtml(file.category)}/</span></td>
      <td class="mod-date">${escapeHtml(file.modified)}</td>
    `;
    fileTableBody.appendChild(tr);
  });
}

function renderEmptyState(heading, body) {
  if (!fileTableBody) return;
  fileTableBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="6">
        <div class="empty-state">
          <div class="empty-art">📂</div>
          <h3 class="empty-heading">${escapeHtml(heading)}</h3>
          <p class="empty-body">${escapeHtml(body)}</p>
          <button class="btn btn-primary" id="btn-empty-demo">✨ Try Demo Folder</button>
        </div>
      </td>
    </tr>
  `;

  const btn = document.getElementById("btn-empty-demo");
  if (btn) {
    btn.addEventListener("click", () => {
      if (state.systemInfo?.demo_dir) {
        dirInput.value = state.systemInfo.demo_dir;
        scanDirectory();
      }
    });
  }
}

function showSkeletonTable() {
  if (!fileTableBody) return;
  fileTableBody.innerHTML = Array(4).fill(0).map(() => `
    <tr>
      <td><div class="skeleton" style="height: 20px; width: 140px;"></div></td>
      <td><div class="skeleton" style="height: 20px; width: 45px;"></div></td>
      <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
      <td><div class="skeleton" style="height: 20px; width: 60px;"></div></td>
      <td><div class="skeleton" style="height: 20px; width: 90px;"></div></td>
      <td><div class="skeleton" style="height: 20px; width: 100px;"></div></td>
    </tr>
  `).join("");
}

function renderCategoryRules(categories) {
  if (!rulesContent || !categories) return;
  rulesContent.innerHTML = "";

  Object.entries(categories).forEach(([name, exts]) => {
    const icon = CATEGORY_ICONS[name] || "📁";
    const box = document.createElement("div");
    box.className = "rule-box";
    box.innerHTML = `
      <div class="rule-name">${icon} ${escapeHtml(name)}</div>
      <div class="rule-exts">${exts.map(e => `<code>${escapeHtml(e)}</code>`).join(" ")}</div>
    `;
    rulesContent.appendChild(box);
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// ---------------------------------------------------------------------------
// Event Listeners Setup
// ---------------------------------------------------------------------------
function initEventListeners() {
  // Main Action Buttons
  btnScan?.addEventListener("click", () => scanDirectory());
  btnDryRun?.addEventListener("click", () => organizeFiles(true));
  btnUndo?.addEventListener("click", () => undoOrganization());
  btnCreateSamples?.addEventListener("click", () => generateSampleFiles());

  // Organize Now with confirmation modal
  btnOrganize?.addEventListener("click", () => {
    const count = state.files.length;
    if (count === 0) {
      showToast("Scan a folder with files before organizing.", "warning");
      return;
    }

    const modalMsg = `Are you sure you want to sort and move <strong>${count} file(s)</strong> into category subfolders?<br><br>Don't worry — an automatic undo manifest is created so you can reverse this anytime with one click!`;
    openConfirmModal(modalMsg, () => organizeFiles(false));
  });

  // Modal actions
  modalCancel?.addEventListener("click", closeConfirmModal);
  modalConfirm?.addEventListener("click", () => {
    if (typeof pendingModalAction === "function") {
      pendingModalAction();
    }
    closeConfirmModal();
  });
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeConfirmModal();
  });

  // Quick Folder Shortcut Chips
  btnBrowseDemo?.addEventListener("click", () => {
    if (state.systemInfo?.demo_dir) {
      dirInput.value = state.systemInfo.demo_dir;
      scanDirectory();
    }
  });

  chipDemo?.addEventListener("click", () => {
    if (state.systemInfo?.demo_dir) {
      dirInput.value = state.systemInfo.demo_dir;
      scanDirectory();
    }
  });

  chipWorkspace?.addEventListener("click", () => {
    if (state.systemInfo?.base_dir) {
      dirInput.value = state.systemInfo.base_dir;
      scanDirectory();
    }
  });

  chipDesktop?.addEventListener("click", () => {
    if (state.systemInfo?.desktop_dir) {
      dirInput.value = state.systemInfo.desktop_dir;
      scanDirectory();
    }
  });

  chipDownloads?.addEventListener("click", () => {
    if (state.systemInfo?.downloads_dir) {
      dirInput.value = state.systemInfo.downloads_dir;
      scanDirectory();
    }
  });

  // Table filters
  filterSearch?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderFileTable();
  });

  filterCategory?.addEventListener("change", (e) => {
    state.activeFilterCategory = e.target.value;
    renderFileTable();
  });

  // Clear logs
  btnClearLogs?.addEventListener("click", () => {
    if (logConsole) {
      logConsole.innerHTML = `
        <div class="log-entry log-system">
          <span class="log-time">[System]</span>
          <span>Logs cleared.</span>
        </div>
      `;
    }
  });

  // Enter key inside directory input
  dirInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      scanDirectory();
    }
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initEventListeners();
  fetchSystemInfo();
});
