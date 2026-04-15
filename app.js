/* =====================================================
   RoutineFlow — App Logic (app.js)
   ===================================================== */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  TASKS:   'rf_tasks',
  HISTORY: 'rf_history',
  STATS:   'rf_stats',
};

const TIME_GROUPS = [
  { id: 'morning',   label: '🌅 Morning',   emoji: '🌅' },
  { id: 'afternoon', label: '☀️ Afternoon', emoji: '☀️' },
  { id: 'evening',   label: '🌙 Evening',   emoji: '🌙' },
  { id: 'anytime',   label: '⏰ Anytime',   emoji: '⏰' },
];

const EMOJI_PRESETS = [
  '🏃','🧘','💧','☕','📚','✍️','🎯','💊','🛏️','🍎',
  '🧹','🏋️','🧠','🎵','🐕','🌱','💻','🙏','🚿','🌍',
  '🥗','🎨','📝','⚡','🎶','🤸','🛁','🌊','🔋','💌',
];

const QUOTES = [
  '"Small steps every day lead to giant leaps over time."',
  '"You don\'t rise to the level of your goals, you fall to the level of your systems."',
  '"Consistency is the hallmark of the undefeatable."',
  '"Motivation gets you started. Habit keeps you going."',
  '"Every action you take is a vote for the person you wish to become."',
  '"The secret of your future is hidden in your daily routine."',
  '"Success is nothing more than a few simple disciplines practiced every day."',
  '"Build the routine. Trust the process."',
];

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  tasks:       [],   // { id, name, emoji, time, note, order }
  history:     {},   // { 'YYYY-MM-DD': { taskId: bool } }
  stats: {
    streak: 0,
    bestStreak: 0,
    totalDone: 0,
    daysTracked: 0,
  },
  editingTaskId: null,
  selectedEmoji:  null,
  currentView: 'today',
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayChecks() {
  return state.history[todayKey()] || {};
}

function setTodayCheck(taskId, value) {
  const k = todayKey();
  if (!state.history[k]) state.history[k] = {};
  state.history[k][taskId] = value;
  saveData();
}

// ─── Persistence ─────────────────────────────────────────────────────────────
function saveData() {
  localStorage.setItem(STORAGE_KEYS.TASKS,   JSON.stringify(state.tasks));
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
  localStorage.setItem(STORAGE_KEYS.STATS,   JSON.stringify(state.stats));
}

function loadData() {
  try {
    const tasks   = localStorage.getItem(STORAGE_KEYS.TASKS);
    const history = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const stats   = localStorage.getItem(STORAGE_KEYS.STATS);
    if (tasks)   state.tasks   = JSON.parse(tasks);
    if (history) state.history = JSON.parse(history);
    if (stats)   state.stats   = JSON.parse(stats);
  } catch(e) { console.warn('Failed to load storage:', e); }
}

// ─── Streak Computation ───────────────────────────────────────────────────────
function computeStreak() {
  if (state.tasks.length === 0) return;

  const sortedDays = Object.keys(state.history).sort().reverse();
  if (sortedDays.length === 0) { state.stats.streak = 0; return; }

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDays.length; i++) {
    const dayKey = cursor.toISOString().slice(0, 10);
    const dayData = state.history[dayKey];

    // If day has no data, stop (except today — it might be in progress)
    if (!dayData) {
      if (i === 0) { cursor.setDate(cursor.getDate() - 1); continue; } // skip today if no data yet
      break;
    }

    // Check if ALL tasks were checked that day
    const done = Object.keys(dayData).filter(k => dayData[k]).length;
    const total = state.tasks.length;
    if (total > 0 && done >= total) {
      streak++;
    } else if (i > 0) {
      // gap in the streak
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  state.stats.streak = streak;
  state.stats.bestStreak = Math.max(state.stats.bestStreak, streak);
  state.stats.daysTracked = Object.keys(state.history).length;

  // Count total done across ALL days
  let total = 0;
  for (const day of Object.values(state.history)) {
    total += Object.values(day).filter(Boolean).length;
  }
  state.stats.totalDone = total;
  saveData();
}

// ─── Render: Today View ───────────────────────────────────────────────────────
function renderToday() {
  const checks = getTodayChecks();
  const groups = document.getElementById('routine-groups');
  const emptyEl = document.getElementById('today-empty');

  groups.innerHTML = '';

  if (state.tasks.length === 0) {
    emptyEl.style.display = 'block';
    document.querySelector('#view-today .progress-card').style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  document.querySelector('#view-today .progress-card').style.display = '';

  // Compute progress
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => checks[t.id]).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-subtitle').textContent = `${done} of ${total} task${total !== 1 ? 's' : ''} done`;

  // Badges per group
  const badges = document.getElementById('progress-badges');
  badges.innerHTML = '';
  TIME_GROUPS.forEach(g => {
    const groupTasks = state.tasks.filter(t => t.time === g.id);
    if (groupTasks.length === 0) return;
    const groupDone = groupTasks.filter(t => checks[t.id]).length;
    const b = document.createElement('div');
    b.className = `badge badge-${g.id}`;
    b.textContent = `${g.emoji} ${groupDone}/${groupTasks.length}`;
    badges.appendChild(b);
  });

  // Render groups
  TIME_GROUPS.forEach(g => {
    const groupTasks = state.tasks.filter(t => t.time === g.id);
    if (groupTasks.length === 0) return;

    const groupDone = groupTasks.filter(t => checks[t.id]).length;
    const card = document.createElement('div');
    card.className = 'glass-card group-card';

    card.innerHTML = `
      <div class="group-header">
        <span class="group-badge ${g.id}">${g.label}</span>
        <span class="group-count">${groupDone}/${groupTasks.length}</span>
      </div>
      <div class="task-list" id="list-${g.id}"></div>
    `;
    groups.appendChild(card);

    const list = card.querySelector(`#list-${g.id}`);
    groupTasks.forEach((task, idx) => {
      const isDone = !!checks[task.id];
      const item = document.createElement('div');
      item.className = `task-item${isDone ? ' done' : ''}`;
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `${task.name}${isDone ? ', completed' : ''}`);
      item.setAttribute('data-task-id', task.id);
      item.style.animationDelay = `${idx * 0.05}s`;

      item.innerHTML = `
        <div class="task-checkbox">
          <span class="task-checkbox-check">✓</span>
        </div>
        <div class="task-emoji">${task.emoji || '✦'}</div>
        <div class="task-info">
          <div class="task-name">${escapeHtml(task.name)}</div>
          ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}
        </div>
      `;

      item.addEventListener('click', () => toggleTask(task.id));
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTask(task.id); } });
      list.appendChild(item);
    });
  });
}

function toggleTask(taskId) {
  const checks = getTodayChecks();
  const newVal = !checks[taskId];
  setTodayCheck(taskId, newVal);
  computeStreak();
  renderToday();
  renderSidebarStreak();

  // Pulse animation
  const item = document.querySelector(`[data-task-id="${taskId}"]`);
  if (item) { item.classList.add('pulse'); setTimeout(() => item.classList.remove('pulse'), 300); }

  // Celebration
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => getTodayChecks()[t.id]).length;
  if (done === total && total > 0 && newVal) showCelebration();
}

// ─── Render: Manage View ──────────────────────────────────────────────────────
function renderManage() {
  const groups = document.getElementById('manage-groups');
  const emptyEl = document.getElementById('manage-empty');
  groups.innerHTML = '';

  if (state.tasks.length === 0) {
    emptyEl.style.display = 'block'; return;
  }
  emptyEl.style.display = 'none';

  TIME_GROUPS.forEach(g => {
    const groupTasks = state.tasks.filter(t => t.time === g.id);
    if (groupTasks.length === 0) return;

    const card = document.createElement('div');
    card.className = 'glass-card group-card';
    card.innerHTML = `
      <div class="group-header">
        <span class="group-badge ${g.id}">${g.label}</span>
        <span class="group-count">${groupTasks.length} task${groupTasks.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="task-list"></div>
    `;
    groups.appendChild(card);

    const list = card.querySelector('.task-list');
    groupTasks.forEach(task => {
      const item = document.createElement('div');
      item.className = 'manage-task-item';
      item.innerHTML = `
        <div class="task-emoji">${task.emoji || '✦'}</div>
        <div class="manage-task-info">
          <div class="manage-task-name">${escapeHtml(task.name)}</div>
          ${task.note ? `<div class="manage-task-note">${escapeHtml(task.note)}</div>` : ''}
        </div>
        <div class="manage-actions">
          <button class="icon-btn edit" title="Edit task" onclick="openEditModal('${task.id}')">✎</button>
          <button class="icon-btn delete" title="Delete task" onclick="confirmDeleteTask('${task.id}')">✕</button>
        </div>
      `;
      list.appendChild(item);
    });
  });
}

// ─── Render: Stats View ───────────────────────────────────────────────────────
function renderStats() {
  document.getElementById('stat-streak').textContent     = state.stats.streak;
  document.getElementById('stat-total-done').textContent = state.stats.totalDone;
  document.getElementById('stat-days-tracked').textContent = state.stats.daysTracked;
  document.getElementById('stat-best-streak').textContent = state.stats.bestStreak;

  // Weekly bars (last 7 days)
  const weeklyCont = document.getElementById('weekly-bars');
  weeklyCont.innerHTML = '';
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayData = state.history[key] || {};
    const total = state.tasks.length;
    const done  = total > 0 ? Object.values(dayData).filter(Boolean).length : 0;
    const pct   = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    const wrap = document.createElement('div');
    wrap.className = 'weekly-bar-wrap';
    wrap.innerHTML = `
      <div class="weekly-bar-track">
        <div class="weekly-bar-fill" style="height:${pct}%"></div>
      </div>
      <div class="weekly-bar-label">${days[d.getDay()]}</div>
    `;
    weeklyCont.appendChild(wrap);
  }

  // Per-task completion rates
  const rateCont = document.getElementById('task-rates');
  rateCont.innerHTML = '';
  if (state.tasks.length === 0) {
    rateCont.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No tasks added yet.</p>';
    return;
  }
  const daysCount = Object.keys(state.history).length || 1;
  state.tasks.forEach(task => {
    let taskDone = 0;
    Object.values(state.history).forEach(day => { if (day[task.id]) taskDone++; });
    const pct = Math.round((taskDone / daysCount) * 100);
    const row = document.createElement('div');
    row.className = 'task-rate-row';
    row.innerHTML = `
      <div class="task-rate-emoji">${task.emoji || '✦'}</div>
      <div class="task-rate-name">${escapeHtml(task.name)}</div>
      <div class="task-rate-bar-track"><div class="task-rate-bar-fill" style="width:${pct}%"></div></div>
      <div class="task-rate-pct">${pct}%</div>
    `;
    rateCont.appendChild(row);
  });
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function renderSidebarStreak() {
  document.getElementById('sidebar-streak-count').textContent = state.stats.streak;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebarOnOutside(e) {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('hamburger-btn');
  if (window.innerWidth <= 720 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !btn.contains(e.target)) {
    sidebar.classList.remove('open');
  }
}

// ─── View Switching ───────────────────────────────────────────────────────────
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById(`nav-${view}`).classList.add('active');

  if (view === 'today')  renderToday();
  if (view === 'manage') renderManage();
  if (view === 'stats')  renderStats();

  // Close sidebar on mobile
  if (window.innerWidth <= 720) document.getElementById('sidebar').classList.remove('open');
}

// ─── Modal: Add/Edit Task ─────────────────────────────────────────────────────
function buildEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  EMOJI_PRESETS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `emoji-btn${state.selectedEmoji === em ? ' selected' : ''}`;
    btn.textContent = em;
    btn.setAttribute('aria-label', `Select emoji ${em}`);
    btn.onclick = () => {
      state.selectedEmoji = em;
      document.getElementById('task-emoji').value = em;
      buildEmojiGrid();
    };
    grid.appendChild(btn);
  });
}

function openAddModal() {
  state.editingTaskId = null;
  state.selectedEmoji = '🎯';
  document.getElementById('modal-title').textContent  = 'Add New Task';
  document.getElementById('modal-save-btn').textContent = 'Add Task';
  document.getElementById('task-form').reset();
  document.getElementById('task-emoji').value = '🎯';
  document.getElementById('r-morning').checked = true;
  buildEmojiGrid();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('task-name').focus(), 100);
}

function openEditModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  state.editingTaskId = taskId;
  state.selectedEmoji = task.emoji;
  document.getElementById('modal-title').textContent  = 'Edit Task';
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('task-name').value  = task.name;
  document.getElementById('task-emoji').value = task.emoji || '';
  document.getElementById('task-note').value  = task.note || '';
  const radioEl = document.querySelector(`input[name="task-time"][value="${task.time}"]`);
  if (radioEl) radioEl.checked = true;
  buildEmojiGrid();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('task-name').focus(), 100);
}

function closeAddModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  state.editingTaskId = null;
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeAddModal();
}

function saveTask(e) {
  e.preventDefault();
  const name  = document.getElementById('task-name').value.trim();
  const emoji = document.getElementById('task-emoji').value.trim() || state.selectedEmoji || '✦';
  const time  = document.querySelector('input[name="task-time"]:checked')?.value || 'anytime';
  const note  = document.getElementById('task-note').value.trim();

  if (!name) return;

  if (state.editingTaskId) {
    // Edit existing
    const idx = state.tasks.findIndex(t => t.id === state.editingTaskId);
    if (idx !== -1) {
      state.tasks[idx] = { ...state.tasks[idx], name, emoji, time, note };
    }
  } else {
    // New task
    const task = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      name, emoji, time, note,
      createdAt: new Date().toISOString(),
    };
    state.tasks.push(task);
  }

  saveData();
  closeAddModal();
  renderManage();
  renderToday();
}

// ─── Delete Task ──────────────────────────────────────────────────────────────
function confirmDeleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('confirm-icon').textContent = '🗑️';
  document.getElementById('confirm-title').textContent = 'Delete Task?';
  document.getElementById('confirm-body').textContent = `"${task.name}" will be removed from all routines.`;
  const btn = document.getElementById('confirm-yes-btn');
  btn.onclick = () => { deleteTask(taskId); closeConfirmModal(); };
  document.getElementById('confirm-overlay').classList.add('open');
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  // Clean from history
  Object.keys(state.history).forEach(day => { delete state.history[day][taskId]; });
  saveData();
  computeStreak();
  renderManage();
  renderToday();
  renderSidebarStreak();
}

// ─── Reset Day ────────────────────────────────────────────────────────────────
function confirmResetDay() {
  document.getElementById('confirm-icon').textContent = '↺';
  document.getElementById('confirm-title').textContent = 'Reset Today?';
  document.getElementById('confirm-body').textContent = 'This will uncheck all tasks for today.';
  const btn = document.getElementById('confirm-yes-btn');
  btn.onclick = () => { resetDay(); closeConfirmModal(); };
  document.getElementById('confirm-overlay').classList.add('open');
}

function resetDay() {
  state.history[todayKey()] = {};
  saveData();
  computeStreak();
  renderToday();
  renderSidebarStreak();
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function closeConfirmModal() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

function closeConfirm(e) {
  if (e.target === document.getElementById('confirm-overlay')) closeConfirmModal();
}

// ─── Celebration ──────────────────────────────────────────────────────────────
function showCelebration() {
  const overlay = document.getElementById('celebrate-overlay');
  const confWrap = document.getElementById('confetti-wrap');
  overlay.style.display = 'flex';
  confWrap.innerHTML = '';

  const colors = ['#7c6dfa','#fa6d9e','#6df5c8','#f7b731','#fd9644','#fff'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top  = '-20px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width  = (6 + Math.random() * 10) + 'px';
    piece.style.height = (6 + Math.random() * 10) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration = (1.5 + Math.random() * 2.5) + 's';
    piece.style.animationDelay    = (Math.random() * 0.8) + 's';
    confWrap.appendChild(piece);
  }

  setTimeout(() => { overlay.style.display = 'none'; }, 4000);
}

// ─── Header Clock ─────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('live-time').textContent = `${h}:${m}`;
}

function updateDate() {
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('date-day').textContent  = days[now.getDay()];
  document.getElementById('date-full').textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// ─── Quote Rotation ───────────────────────────────────────────────────────────
function setRandomQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('motivational-quote').querySelector('p').textContent = q;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// ─── Seed Example Data ────────────────────────────────────────────────────────
function seedExamples() {
  if (state.tasks.length > 0) return; // Already has data
  const examples = [
    { name: 'Morning meditation',   emoji: '🧘', time: 'morning',   note: '10 minutes' },
    { name: 'Drink a glass of water', emoji: '💧', time: 'morning', note: 'Right after waking up' },
    { name: 'Exercise',             emoji: '🏃', time: 'morning',   note: '30 min workout' },
    { name: 'Read a chapter',       emoji: '📚', time: 'afternoon', note: 'Non-fiction' },
    { name: 'Healthy lunch',        emoji: '🥗', time: 'afternoon', note: '' },
    { name: 'Journal',              emoji: '✍️', time: 'evening',   note: '5 minutes' },
    { name: 'No screens after 9pm', emoji: '🌙', time: 'evening',   note: '' },
    { name: 'Take vitamins',        emoji: '💊', time: 'anytime',   note: '' },
  ];
  examples.forEach(ex => {
    state.tasks.push({
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      ...ex,
      createdAt: new Date().toISOString(),
    });
  });
  saveData();
}

// ─── Emoji input sync ────────────────────────────────────────────────────────
function bindEmojiInput() {
  document.getElementById('task-emoji').addEventListener('input', function() {
    state.selectedEmoji = this.value.trim() || null;
    buildEmojiGrid();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadData();
  seedExamples();
  computeStreak();

  updateDate();
  updateClock();
  setInterval(updateClock, 30000);
  setRandomQuote();

  renderSidebarStreak();
  switchView('today');

  bindEmojiInput();
  document.addEventListener('click', closeSidebarOnOutside);

  // Celebrate overlay closes on click
  document.getElementById('celebrate-overlay').addEventListener('click', () => {
    document.getElementById('celebrate-overlay').style.display = 'none';
  });
}

document.addEventListener('DOMContentLoaded', init);
