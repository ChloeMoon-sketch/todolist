import { isFirebaseEnabled, activeConfig } from "./firebase-config.js";
import { DatabaseService } from "./store.js";
import { AuthService } from "./auth.js";

// ==========================================
// Application State
// ==========================================
let currentUser = null;
let userEvents = [];
let currentDate = new Date(); // The month we are currently viewing
let selectedDate = new Date(); // The date highlighted for agenda
let activeView = "calendarView";
let dbUnsubscribe = null;

// Filtering & Sorting State
let taskFilters = {
  status: "all", // all, pending, completed
  category: "all", // all, Work, Personal, etc.
  search: "",
  sort: "time-asc" // time-asc, time-desc, priority-desc
};

// ==========================================
// DOM Elements
// ==========================================
const DOM = {
  // Navigation & View containers
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view-content"),
  mainViewTitle: document.getElementById("mainViewTitle"),
  sidebarUserProfile: document.getElementById("sidebarUserProfile"),
  
  // Theme & Banner
  demoBanner: document.getElementById("demoBanner"),
  btnConnectFirebase: document.getElementById("btnConnectFirebase"),
  btnThemeToggle: document.getElementById("btnThemeToggle"),
  themeIconSun: document.getElementById("themeIconSun"),
  themeIconMoon: document.getElementById("themeIconMoon"),
  
  // Top bar search and add
  universalSearch: document.getElementById("universalSearch"),
  btnOpenAddModal: document.getElementById("btnOpenAddModal"),
  
  // Calendar View Elements
  calendarNavControls: document.getElementById("calendarNavControls"),
  btnPrevMonth: document.getElementById("btnPrevMonth"),
  btnNextMonth: document.getElementById("btnNextMonth"),
  currentMonthYear: document.getElementById("currentMonthYear"),
  calendarGrid: document.getElementById("calendarGrid"),
  selectedDateBadge: document.getElementById("selectedDateBadge"),
  agendaList: document.getElementById("agendaList"),
  
  // Tasks View Elements
  filterBtns: document.querySelectorAll(".filter-btn"),
  filterCategory: document.getElementById("filterCategory"),
  sortOrder: document.getElementById("sortOrder"),
  tasksListGrid: document.getElementById("tasksListGrid"),
  
  // Stats View Elements
  statsTotalEvents: document.getElementById("statsTotalEvents"),
  statsCompletedEvents: document.getElementById("statsCompletedEvents"),
  statsCompletionRate: document.getElementById("statsCompletionRate"),
  statsProgressCircle: document.getElementById("statsProgressCircle"),
  statsProgressPercent: document.getElementById("statsProgressPercent"),
  statsCategoryBars: document.getElementById("statsCategoryBars"),
  
  // Settings View Elements
  firebaseStatusIndicator: document.getElementById("firebaseStatusIndicator"),
  firebaseStatusText: document.getElementById("firebaseStatusText"),
  firebaseConfigForm: document.getElementById("firebaseConfigForm"),
  cfgApiKey: document.getElementById("cfgApiKey"),
  cfgAuthDomain: document.getElementById("cfgAuthDomain"),
  cfgProjectId: document.getElementById("cfgProjectId"),
  cfgStorageBucket: document.getElementById("cfgStorageBucket"),
  cfgAppId: document.getElementById("cfgAppId"),
  btnResetConfig: document.getElementById("btnResetConfig"),
  btnClearLocalData: document.getElementById("btnClearLocalData"),
  
  // Auth Elements
  authModalOverlay: document.getElementById("authModalOverlay"),
  authAlert: document.getElementById("authAlert"),
  authLoginForm: document.getElementById("authLoginForm"),
  authSignupForm: document.getElementById("authSignupForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  regName: document.getElementById("regName"),
  regEmail: document.getElementById("regEmail"),
  regPassword: document.getElementById("regPassword"),
  btnGoogleAuth: document.getElementById("btnGoogleAuth"),
  btnToggleAuthMode: document.getElementById("btnToggleAuthMode"),
  btnToggleAuthModeBack: document.getElementById("btnToggleAuthModeBack"),
  btnGuestAuth: document.getElementById("btnGuestAuth"),
  btnLogout: document.getElementById("btnLogout"),
  userAvatar: document.getElementById("userAvatar"),
  userName: document.getElementById("userName"),
  userEmail: document.getElementById("userEmail"),
  
  // Event Form Modal
  eventModalOverlay: document.getElementById("eventModalOverlay"),
  eventModalTitle: document.getElementById("eventModalTitle"),
  eventForm: document.getElementById("eventForm"),
  eventFormId: document.getElementById("eventFormId"),
  evtTitle: document.getElementById("evtTitle"),
  evtDesc: document.getElementById("evtDesc"),
  evtDate: document.getElementById("evtDate"),
  evtStartTime: document.getElementById("evtStartTime"),
  evtEndTime: document.getElementById("evtEndTime"),
  btnCloseEventModal: document.getElementById("btnCloseEventModal")
};

// Category custom properties helpers
const CATEGORIES = {
  Work: { label: "업무", color: "var(--cat-work)", light: "rgba(168,85,247,0.15)" },
  Personal: { label: "개인", color: "var(--cat-personal)", light: "rgba(236,72,153,0.15)" },
  Health: { label: "건강", color: "var(--cat-health)", light: "rgba(16,185,129,0.15)" },
  Study: { label: "공부", color: "var(--cat-study)", light: "rgba(14,165,233,0.15)" },
  Finance: { label: "쇼핑", color: "var(--cat-finance)", light: "rgba(245,158,11,0.15)" },
  Other: { label: "기타", color: "var(--cat-other)", light: "rgba(244,63,94,0.15)" }
};

const PRIORITIES = {
  low: { label: "낮음", color: "var(--priority-low)" },
  medium: { label: "보통", color: "var(--priority-medium)" },
  high: { label: "높음", color: "var(--priority-high)" }
};

// ==========================================
// Initialization & Authentication Listeners
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Icons
  lucide.createIcons();
  
  // 2. Initialize Theme
  initTheme();
  
  // 3. Render Firebase Settings Config
  initSettingsConfig();

  // 4. Subscribe to auth state changes
  AuthService.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      updateUserProfileUI(user);
      DOM.authModalOverlay.classList.remove("active");
      DOM.sidebarUserProfile.style.display = "flex";
      
      // Load real-time database listener
      if (dbUnsubscribe) dbUnsubscribe();
      dbUnsubscribe = DatabaseService.subscribeToEvents(user.uid, (events) => {
        userEvents = events;
        refreshViews();
      });
    } else {
      currentUser = null;
      userEvents = [];
      if (dbUnsubscribe) {
        dbUnsubscribe();
        dbUnsubscribe = null;
      }
      DOM.sidebarUserProfile.style.display = "none";
      DOM.authModalOverlay.classList.add("active"); // Force login overlay
      resetAuthForm();
    }
  });

  // 5. Setup Action Handlers
  setupEventListeners();
});

// ==========================================
// Theme Management
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem("app_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  toggleThemeIcon(savedTheme);
}

function toggleThemeIcon(theme) {
  if (theme === "dark") {
    DOM.themeIconSun.style.display = "block";
    DOM.themeIconMoon.style.display = "none";
  } else {
    DOM.themeIconSun.style.display = "none";
    DOM.themeIconMoon.style.display = "block";
  }
}

// ==========================================
// Event Listeners Setup
// ==========================================
function setupEventListeners() {
  // Navigation switching
  DOM.navItems.forEach(item => {
    item.addEventListener("click", () => {
      DOM.navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      const target = item.getAttribute("data-target");
      activeView = target;
      
      DOM.views.forEach(v => v.classList.remove("active"));
      document.getElementById(target).classList.add("active");
      
      // Change title / headers
      updateHeaderForView(target);
      refreshViews();
    });
  });

  // Theme Toggle Click
  DOM.btnThemeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("app_theme", next);
    toggleThemeIcon(next);
  });

  // Banner direct navigation to settings
  DOM.btnConnectFirebase.addEventListener("click", () => {
    DOM.navSettings.click();
  });

  // Calendar controls
  DOM.btnPrevMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    refreshViews();
  });

  DOM.btnNextMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    refreshViews();
  });

  // Search input filter
  DOM.universalSearch.addEventListener("input", (e) => {
    taskFilters.search = e.target.value.toLowerCase().trim();
    refreshViews();
  });

  // Task list status filter
  DOM.filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      taskFilters.status = btn.getAttribute("data-filter");
      refreshViews();
    });
  });

  // Task list category and sort selector
  DOM.filterCategory.addEventListener("change", (e) => {
    taskFilters.category = e.target.value;
    refreshViews();
  });

  DOM.sortOrder.addEventListener("change", (e) => {
    taskFilters.sort = e.target.value;
    refreshViews();
  });

  // Add event dialog opening
  DOM.btnOpenAddModal.addEventListener("click", () => {
    openEventModal();
  });

  DOM.btnCloseEventModal.addEventListener("click", () => {
    DOM.eventModalOverlay.classList.remove("active");
  });

  // Event modal form submit
  DOM.eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const eventId = DOM.eventFormId.value;
    const eventData = {
      title: DOM.evtTitle.value.trim(),
      description: DOM.evtDesc.value.trim(),
      date: DOM.evtDate.value,
      startTime: DOM.evtStartTime.value,
      endTime: DOM.evtEndTime.value,
      category: document.querySelector('input[name="evtCategory"]:checked').value,
      priority: document.querySelector('input[name="evtPriority"]:checked').value,
      completed: eventId ? userEvents.find(ev => ev.id === eventId)?.completed || false : false,
      userId: currentUser.uid
    };

    try {
      if (eventId) {
        // Edit mode
        await DatabaseService.updateEvent(eventId, eventData);
      } else {
        // Add mode
        await DatabaseService.addEvent(eventData);
      }
      DOM.eventModalOverlay.classList.remove("active");
    } catch (err) {
      alert("일정을 저장하지 못했습니다: " + err.message);
    }
  });

  // Authentication Switch Views
  DOM.btnToggleAuthMode.addEventListener("click", () => {
    DOM.authLoginForm.style.display = "none";
    DOM.authSignupForm.style.display = "flex";
    DOM.authModalTitle.textContent = "새 계정 만들기";
  });

  DOM.btnToggleAuthModeBack.addEventListener("click", () => {
    DOM.authSignupForm.style.display = "none";
    DOM.authLoginForm.style.display = "flex";
    DOM.authModalTitle.textContent = "로그인";
  });

  // Auth Submit Handlers
  DOM.authLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const email = DOM.authEmail.value.trim();
    const password = DOM.authPassword.value;

    try {
      await AuthService.login(email, password);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  DOM.authSignupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const name = DOM.regName.value.trim();
    const email = DOM.regEmail.value.trim();
    const password = DOM.regPassword.value;

    try {
      await AuthService.signUp(email, password, name);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  DOM.btnGoogleAuth.addEventListener("click", async () => {
    showAuthError("");
    try {
      await AuthService.loginWithGoogle();
    } catch (err) {
      showAuthError(err.message);
    }
  });

  DOM.btnGuestAuth.addEventListener("click", async () => {
    showAuthError("");
    try {
      await AuthService.login("demo@example.com", "demo1234");
    } catch (err) {
      showAuthError(err.message);
    }
  });

  DOM.btnLogout.addEventListener("click", async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      await AuthService.logout();
    }
  });

  // Settings Configuration Form Submit
  DOM.firebaseConfigForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newConfig = {
      apiKey: DOM.cfgApiKey.value.trim(),
      authDomain: DOM.cfgAuthDomain.value.trim(),
      projectId: DOM.cfgProjectId.value.trim(),
      storageBucket: DOM.cfgStorageBucket.value.trim(),
      messagingSenderId: activeConfig.messagingSenderId || "", // Keep fallback if not set
      appId: DOM.cfgAppId.value.trim()
    };

    if (newConfig.apiKey && newConfig.projectId) {
      localStorage.setItem("firebase_custom_config", JSON.stringify(newConfig));
      alert("새로운 설정이 저장되었습니다. 설정을 반영하기 위해 브라우저를 새로고침합니다.");
      window.location.reload();
    } else {
      alert("최소한 API Key와 Project ID를 모두 기입해 주세요.");
    }
  });

  // Reset Configuration
  DOM.btnResetConfig.addEventListener("click", () => {
    if (confirm("Firebase 설정을 초기화하고 기본 설정으로 복원하시겠습니까?")) {
      localStorage.removeItem("firebase_custom_config");
      window.location.reload();
    }
  });

  // Reset Local Demo Data
  DOM.btnClearLocalData.addEventListener("click", () => {
    if (confirm("로컬 데모용 일정을 모두 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) {
      localStorage.removeItem("schedule_events");
      alert("로컬 데이터가 완전히 지워졌습니다.");
      if (!isFirebaseEnabled) {
        window.location.reload();
      }
    }
  });
}

// ==========================================
// Authentication State UI Helpers
// ==========================================
function updateUserProfileUI(user) {
  DOM.userName.textContent = user.displayName || "USER";
  DOM.userEmail.textContent = user.email;
  DOM.userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`;

  // Manage Demo status indicators
  if (user.isDemo) {
    DOM.demoBanner.classList.remove("hidden");
  } else {
    DOM.demoBanner.classList.add("hidden");
  }
}

function showAuthError(msg) {
  if (msg) {
    DOM.authAlert.textContent = msg;
    DOM.authAlert.classList.add("active");
  } else {
    DOM.authAlert.textContent = "";
    DOM.authAlert.classList.remove("active");
  }
}

function resetAuthForm() {
  DOM.authEmail.value = "";
  DOM.authPassword.value = "";
  DOM.regName.value = "";
  DOM.regEmail.value = "";
  DOM.regPassword.value = "";
  showAuthError("");
  DOM.authSignupForm.style.display = "none";
  DOM.authLoginForm.style.display = "flex";
  DOM.authModalTitle.textContent = "로그인";

  // If Firebase is disabled, hide Google login option
  if (!isFirebaseEnabled) {
    DOM.btnGoogleAuth.style.display = "none";
    DOM.googleDivider.style.display = "none";
  } else {
    DOM.btnGoogleAuth.style.display = "flex";
    DOM.googleDivider.style.display = "flex";
  }
}

// ==========================================
// Settings Details Helpers
// ==========================================
function initSettingsConfig() {
  if (isFirebaseEnabled) {
    DOM.firebaseStatusIndicator.className = "status-indicator success";
    DOM.firebaseStatusText.textContent = `연동 완료 (Project ID: ${activeConfig.projectId})`;
  } else {
    DOM.firebaseStatusIndicator.className = "status-indicator warn";
    DOM.firebaseStatusText.textContent = "오프라인 데모 모드 (로컬 저장소)";
  }

  // Pre-populate fields
  DOM.cfgApiKey.value = activeConfig.apiKey || "";
  DOM.cfgAuthDomain.value = activeConfig.authDomain || "";
  DOM.cfgProjectId.value = activeConfig.projectId || "";
  DOM.cfgStorageBucket.value = activeConfig.storageBucket || "";
  DOM.cfgAppId.value = activeConfig.appId || "";
}

// ==========================================
// Views Orchestrator & Headers updating
// ==========================================
function updateHeaderForView(viewName) {
  if (viewName === "calendarView") {
    DOM.mainViewTitle.textContent = "캘린더 일정";
    DOM.calendarNavControls.style.display = "flex";
  } else {
    DOM.calendarNavControls.style.display = "none";
    if (viewName === "tasksView") {
      DOM.mainViewTitle.textContent = "할 일 체크리스트";
    } else if (viewName === "statsView") {
      DOM.mainViewTitle.textContent = "통계 대시보드";
    } else if (viewName === "settingsView") {
      DOM.mainViewTitle.textContent = "환경설정";
    }
  }
}

function refreshViews() {
  // Re-run icons loader
  lucide.createIcons();
  
  if (activeView === "calendarView") {
    renderCalendar();
    renderAgenda();
  } else if (activeView === "tasksView") {
    renderTasksView();
  } else if (activeView === "statsView") {
    renderStatsView();
  }
}

// ==========================================
// 1. Calendar View Logic
// ==========================================
function renderCalendar() {
  DOM.calendarGrid.innerHTML = "";
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  
  DOM.currentMonthYear.textContent = `${year}년 ${month + 1}월`;
  
  // First day of current month
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Previous month total days to fill starting offset
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  
  // Total slots to show (6 rows * 7 columns = 42 slots)
  const totalSlots = 42;
  
  let gridHTML = "";
  
  // 1. Render Previous Month offset days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    gridHTML += `<div class="calendar-day empty">
      <span class="day-number">${prevMonthTotalDays - i}</span>
    </div>`;
  }
  
  // 2. Render Current Month days
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = formatDateString(year, month, day);
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const isSelected = selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
    
    // Find events matching this day
    const dayEvents = userEvents.filter(e => e.date === dateStr);
    
    // Create mini preview for events
    let eventsMarkup = "";
    dayEvents.slice(0, 3).forEach(evt => {
      const catInfo = CATEGORIES[evt.category] || CATEGORIES.Other;
      const completionClass = evt.completed ? "completed" : "";
      eventsMarkup += `
        <div class="mini-event ${completionClass}" style="background-color: ${catInfo.color}">
          ${escapeHTML(evt.title)}
        </div>
      `;
    });
    
    if (dayEvents.length > 3) {
      eventsMarkup += `<div class="mini-event" style="background-color: rgba(255,255,255,0.08); text-align:center; font-size:0.65rem;">+${dayEvents.length - 3}개 더보기</div>`;
    }
    
    const todayClass = isToday ? "today" : "";
    const selectedClass = isSelected ? "selected" : "";
    
    gridHTML += `
      <div class="calendar-day ${todayClass} ${selectedClass}" data-date="${dateStr}">
        <span class="day-number">${day}</span>
        <div class="day-events">${eventsMarkup}</div>
      </div>
    `;
  }
  
  // 3. Render Next Month offset days
  const remainingSlots = totalSlots - (firstDayIndex + totalDays);
  for (let day = 1; day <= remainingSlots; day++) {
    gridHTML += `<div class="calendar-day empty">
      <span class="day-number">${day}</span>
    </div>`;
  }
  
  DOM.calendarGrid.innerHTML = gridHTML;
  
  // Setup click listeners for active calendar cells
  const days = DOM.calendarGrid.querySelectorAll(".calendar-day:not(.empty)");
  days.forEach(dayEl => {
    dayEl.addEventListener("click", () => {
      const selectedStr = dayEl.getAttribute("data-date");
      selectedDate = new Date(selectedStr);
      
      // Update styling
      DOM.calendarGrid.querySelectorAll(".calendar-day").forEach(d => d.classList.remove("selected"));
      dayEl.classList.add("selected");
      
      renderAgenda();
    });
  });
}

function renderAgenda() {
  const dateStr = formatDateString(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  
  // Format Date Badge Text
  const options = { month: 'short', day: 'numeric', weekday: 'short' };
  DOM.selectedDateBadge.textContent = selectedDate.toLocaleDateString('ko-KR', options);
  
  // Get matching events
  const dayEvents = userEvents.filter(e => e.date === dateStr);
  
  if (dayEvents.length === 0) {
    DOM.agendaList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="sparkles"></i>
        <span>이 날엔 등록된 일정이 없습니다.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  let agendaHTML = "";
  dayEvents.forEach(evt => {
    const cat = CATEGORIES[evt.category] || CATEGORIES.Other;
    const prio = PRIORITIES[evt.priority] || PRIORITIES.medium;
    const completedClass = evt.completed ? "completed" : "";
    const checkIcon = evt.completed ? "check-circle" : "circle";
    
    agendaHTML += `
      <div class="agenda-card ${completedClass}" style="--cat-color: ${cat.color}" data-id="${evt.id}">
        <div class="agenda-header">
          <span class="agenda-time">${evt.startTime} - ${evt.endTime}</span>
          <div class="agenda-actions">
            <button class="action-icon-btn check btn-toggle-complete" title="완료 여부 변경">
              <i data-lucide="${checkIcon}" style="color: ${evt.completed ? '#10b981' : 'var(--text-muted)'}"></i>
            </button>
            <button class="action-icon-btn btn-edit-event" title="수정">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="action-icon-btn delete btn-delete-event" title="삭제">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
        <div class="agenda-title">${escapeHTML(evt.title)}</div>
        ${evt.description ? `<div class="agenda-desc">${escapeHTML(evt.description)}</div>` : ""}
        
        <div class="agenda-meta">
          <span class="category-tag" style="background-color: ${cat.color};">${cat.label}</span>
          <span class="priority-badge">
            <span class="priority-dot" style="--priority-color: ${prio.color}"></span>
            <span style="color: ${prio.color}">${prio.label}</span>
          </span>
        </div>
      </div>
    `;
  });
  
  DOM.agendaList.innerHTML = agendaHTML;
  lucide.createIcons();
  setupAgendaCardHandlers();
}

function setupAgendaCardHandlers() {
  const cards = DOM.agendaList.querySelectorAll(".agenda-card");
  cards.forEach(card => {
    const eventId = card.getAttribute("data-id");
    
    // 1. Toggle Complete
    card.querySelector(".btn-toggle-complete").addEventListener("click", async (e) => {
      e.stopPropagation();
      const currentVal = card.classList.contains("completed");
      await DatabaseService.updateEvent(eventId, { completed: !currentVal });
    });
    
    // 2. Edit event click
    card.querySelector(".btn-edit-event").addEventListener("click", (e) => {
      e.stopPropagation();
      openEventModal(eventId);
    });
    
    // 3. Delete event click
    card.querySelector(".btn-delete-event").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("이 일정을 정말 삭제하시겠습니까?")) {
        await DatabaseService.deleteEvent(eventId, currentUser.uid);
      }
    });
  });
}

// ==========================================
// 2. Task List View Logic
// ==========================================
function renderTasksView() {
  // Apply Search, Category, Status and Sort Filters
  let filtered = [...userEvents];
  
  // Search title & description
  if (taskFilters.search) {
    filtered = filtered.filter(e => 
      e.title.toLowerCase().includes(taskFilters.search) || 
      e.description.toLowerCase().includes(taskFilters.search)
    );
  }
  
  // Status filter
  if (taskFilters.status === "pending") {
    filtered = filtered.filter(e => !e.completed);
  } else if (taskFilters.status === "completed") {
    filtered = filtered.filter(e => e.completed);
  }
  
  // Category filter
  if (taskFilters.category !== "all") {
    filtered = filtered.filter(e => e.category === taskFilters.category);
  }
  
  // Sorting
  filtered.sort((a, b) => {
    if (taskFilters.sort === "time-asc") {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    } else if (taskFilters.sort === "time-desc") {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.startTime.localeCompare(a.startTime);
    } else if (taskFilters.sort === "priority-desc") {
      const order = { high: 3, medium: 2, low: 1 };
      return (order[b.priority] || 0) - (order[a.priority] || 0);
    }
    return 0;
  });
  
  if (filtered.length === 0) {
    DOM.tasksListGrid.innerHTML = `
      <div class="empty-state" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--border-radius-lg);">
        <i data-lucide="check-square"></i>
        <span>일치하는 일정이 없습니다.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  let listHTML = "";
  filtered.forEach(evt => {
    const cat = CATEGORIES[evt.category] || CATEGORIES.Other;
    const prio = PRIORITIES[evt.priority] || PRIORITIES.medium;
    const completedClass = evt.completed ? "completed" : "";
    const checkIconMarkup = evt.completed ? `<i data-lucide="check"></i>` : "";
    
    // Format date text nicely
    const dateFormatted = new Date(evt.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
    
    listHTML += `
      <div class="task-list-card ${completedClass}" data-id="${evt.id}">
        <div class="task-left">
          <div class="checkbox-custom btn-toggle-complete" title="완료 여부 변경">
            ${checkIconMarkup}
          </div>
          <div class="task-details-main">
            <div class="task-title">${escapeHTML(evt.title)}</div>
            ${evt.description ? `<div class="task-desc-sub">${escapeHTML(evt.description)}</div>` : ""}
            <div style="display: flex; gap: 8px; margin-top: 4px; align-items: center;">
              <span class="category-tag" style="background-color: ${cat.color}; font-size: 0.68rem; padding: 1px 6px;">${cat.label}</span>
              <span class="priority-badge" style="font-size: 0.65rem;">
                <span class="priority-dot" style="--priority-color: ${prio.color}; width: 5px; height: 5px;"></span>
                <span style="color: ${prio.color}">${prio.label}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div class="task-right">
          <div class="task-date-info">
            <span class="task-date">${dateFormatted}</span>
            <span class="task-time">${evt.startTime} - ${evt.endTime}</span>
          </div>
          <div class="task-actions">
            <button class="action-icon-btn btn-edit-event" title="수정">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="action-icon-btn delete btn-delete-event" title="삭제">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  DOM.tasksListGrid.innerHTML = listHTML;
  lucide.createIcons();
  setupTaskListCardHandlers();
}

function setupTaskListCardHandlers() {
  const cards = DOM.tasksListGrid.querySelectorAll(".task-list-card");
  cards.forEach(card => {
    const eventId = card.getAttribute("data-id");
    
    card.querySelector(".btn-toggle-complete").addEventListener("click", async (e) => {
      e.stopPropagation();
      const currentVal = card.classList.contains("completed");
      await DatabaseService.updateEvent(eventId, { completed: !currentVal });
    });
    
    card.querySelector(".btn-edit-event").addEventListener("click", (e) => {
      e.stopPropagation();
      openEventModal(eventId);
    });
    
    card.querySelector(".btn-delete-event").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("이 일정을 정말 삭제하시겠습니까?")) {
        await DatabaseService.deleteEvent(eventId, currentUser.uid);
      }
    });
  });
}

// ==========================================
// 3. Stats Dashboard View Logic
// ==========================================
function renderStatsView() {
  const total = userEvents.length;
  const completed = userEvents.filter(e => e.completed).length;
  const pending = total - completed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  DOM.statsTotalEvents.textContent = total;
  DOM.statsCompletedEvents.textContent = completed;
  DOM.statsCompletionRate.textContent = `${rate}%`;
  
  DOM.statsProgressPercent.textContent = `${rate}%`;
  
  // Update circular SVG path
  // Circumference of radius 70 circle is 2 * PI * r = 439.8
  const strokeDashOffset = 439.8 - (rate / 100) * 439.8;
  DOM.statsProgressCircle.style.strokeDasharray = "439.8";
  DOM.statsProgressCircle.style.strokeDashoffset = strokeDashOffset;
  
  // Category Breakdown calculations
  const categoriesCount = { Work: 0, Personal: 0, Health: 0, Study: 0, Finance: 0, Other: 0 };
  userEvents.forEach(e => {
    if (categoriesCount[e.category] !== undefined) {
      categoriesCount[e.category]++;
    } else {
      categoriesCount.Other++;
    }
  });
  
  // Build category progress bars dynamically
  let barsHTML = "";
  Object.keys(categoriesCount).forEach(key => {
    const count = categoriesCount[key];
    const catInfo = CATEGORIES[key] || CATEGORIES.Other;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    
    barsHTML += `
      <div class="bar-item">
        <div class="bar-labels">
          <span style="color: ${catInfo.color}">${catInfo.label}</span>
          <span style="color: var(--text-secondary)">${count}개 (${pct}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; --bar-color: ${catInfo.color}"></div>
        </div>
      </div>
    `;
  });
  
  DOM.statsCategoryBars.innerHTML = barsHTML;
}

// ==========================================
// Form Modals Orchestrator
// ==========================================
function openEventModal(eventId = null) {
  DOM.eventForm.reset();
  DOM.eventFormId.value = "";
  
  if (eventId) {
    // Edit existing event
    const event = userEvents.find(e => e.id === eventId);
    if (!event) return;
    
    DOM.eventModalTitle.textContent = "일정 수정";
    DOM.eventFormId.value = event.id;
    DOM.evtTitle.value = event.title;
    DOM.evtDesc.value = event.description || "";
    DOM.evtDate.value = event.date;
    DOM.evtStartTime.value = event.startTime;
    DOM.evtEndTime.value = event.endTime;
    
    // Setup category input checked
    const catRadio = document.querySelector(`input[name="evtCategory"][value="${event.category}"]`);
    if (catRadio) catRadio.checked = true;
    
    // Setup priority checked
    const prioRadio = document.querySelector(`input[name="evtPriority"][value="${event.priority}"]`);
    if (prioRadio) prioRadio.checked = true;
  } else {
    // Add mode
    DOM.eventModalTitle.textContent = "새 일정 추가";
    
    // Default to selected date
    const yStr = selectedDate.getFullYear();
    const mStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(selectedDate.getDate()).padStart(2, '0');
    DOM.evtDate.value = `${yStr}-${mStr}-${dStr}`;
    DOM.evtStartTime.value = "09:00";
    DOM.evtEndTime.value = "10:00";
  }
  
  DOM.eventModalOverlay.classList.add("active");
  lucide.createIcons();
}

// ==========================================
// Formatting & Escaping Helpers
// ==========================================
function formatDateString(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
