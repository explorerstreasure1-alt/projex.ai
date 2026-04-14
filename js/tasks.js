/* ═══════════════════════════════════════════════════════════════
   Tasks Module - Task Management
═══════════════════════════════════════════════════════════════ */

import { state, addTask, updateTask, deleteTask, setSelectedDay, getTasksForDate, getUrgentTasks } from './state.js';
import { saveTasks, saveItems } from './storage.js';
import { genId, escHtml, formatDate, formatDateFull, todayStr, fmtSecs, PRIORITY_ORDER } from './utils.js';
import { DAY_NAMES, KANBAN_COLS } from './config.js';
import { toast, confirmAction, openModal, closeModal, switchMainTab } from './ui.js';
import { renderCards } from './vault.js';

// ═══════════════════════════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════════════════════════

export function renderTasksView() {
  buildDaySelector();
  renderTaskColumns();
  renderRightPanel();
}

function buildDaySelector() {
  const container = document.getElementById('daySelector');
  if (!container) return;
  
  const today = new Date();
  const days = [];
  
  for (let i = -3; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  
  container.innerHTML = days.map(d => {
    const str = d.toISOString().slice(0, 10);
    const isToday = str === todayStr();
    const isSelected = str === state.selectedDay;
    const hasTasks = state.tasks.some(t => t.date === str);
    
    return `
      <button class="day-btn ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasTasks ? 'has-tasks' : ''}" 
              onclick="window.selectDay('${str}')">
        <span class="day-name">${DAY_NAMES[d.getDay()]}</span>
        <span class="day-num">${d.getDate()}</span>
        <span class="day-dot"></span>
      </button>
    `;
  }).join('');
}

function renderTaskColumns() {
  const container = document.getElementById('taskColumnsWrap');
  if (!container) return;
  
  // If urgent mode, show urgent tasks
  const tasks = state.urgentMode ? 
    getUrgentTasks() : 
    getTasksForDate(state.selectedDay);
  
  // Group by status
  const statusGroups = {
    todo: tasks.filter(t => !t.completed && t.status === 'todo'),
    inprogress: tasks.filter(t => !t.completed && t.status === 'inprogress'),
    review: tasks.filter(t => !t.completed && t.status === 'review'),
    done: tasks.filter(t => t.completed || t.status === 'done')
  };
  
  const titles = {
    todo: '📌 Bekliyor',
    inprogress: '⚡ Devam Ediyor',
    review: '👀 İnceleme',
    done: '✅ Tamamlandı'
  };
  
  container.innerHTML = Object.entries(statusGroups).map(([status, groupTasks]) => `
    <div class="task-column">
      <div class="task-column-header">
        <span class="task-column-title">${titles[status]}</span>
        <span class="task-column-count">${groupTasks.length}</span>
      </div>
      <div class="task-column-body">
        ${groupTasks.length ? groupTasks.map(t => renderTaskItem(t)).join('') : 
          '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.75rem">Görev yok</div>'}
        ${status !== 'done' ? `
          <div class="add-task-inline" onclick="window.openAddTaskForStatus('${status}')">
            <span>＋</span> <span>Görev ekle</span>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function renderTaskItem(task) {
  const priorityBadge = renderPriorityBadge(task.priority);
  const project = state.items.find(i => i.id === task.projectId);
  
  return `
    <div class="task-item ${task.completed ? 'completed' : ''}" onclick="window.openTaskDetail('${task.id}')">
      <div class="task-check ${task.completed ? 'checked' : ''}" 
           onclick="event.stopPropagation();window.toggleTask('${task.id}')">
        ${task.completed ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">${escHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escHtml(task.description)}</div>` : ''}
        <div class="task-meta-row">
          ${priorityBadge}
          ${task.time ? `<span class="task-time">🕐 ${task.time}</span>` : ''}
          ${project ? `<span class="task-project-tag">${escHtml(project.title.slice(0, 20))}</span>` : ''}
        </div>
      </div>
      <div class="task-item-actions" onclick="event.stopPropagation()">
        <button class="task-action-btn" onclick="window.editTask('${task.id}')" title="Düzenle">✏️</button>
        <button class="task-action-btn" onclick="window.confirmDeleteTask('${task.id}')" title="Sil" style="color:var(--red)">🗑️</button>
      </div>
    </div>
  `;
}

function renderPriorityBadge(priority) {
  const labels = {
    critical: '🔴 Kritik',
    high: '🟠 Yüksek',
    medium: '🟡 Orta',
    low: '🟢 Düşük',
    none: '⚪ Yok'
  };
  
  const classes = {
    critical: 'pb-critical',
    high: 'pb-high',
    medium: 'pb-medium',
    low: 'pb-low',
    none: 'pb-none'
  };
  
  return `<span class="priority-badge ${classes[priority] || 'pb-none'}">${labels[priority] || '⚪'}</span>`;
}

function renderRightPanel() {
  // Big progress
  const today = todayStr();
  const todayTasks = state.tasks.filter(t => t.date === today);
  const doneTasks = todayTasks.filter(t => t.completed || t.status === 'done');
  const pct = todayTasks.length ? Math.round((doneTasks.length / todayTasks.length) * 100) : 0;
  
  const circle = document.getElementById('progressCircle');
  const pctEl = document.getElementById('bigProgressPct');
  const label = document.getElementById('bigProgressLabel');
  
  if (circle) {
    const circumference = 2 * Math.PI * 34;
    const offset = circumference - (pct / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (label) label.textContent = `${doneTasks.length} / ${todayTasks.length} görev`;
  
  // Stats
  const urgent = getUrgentTasks();
  
  const stats = {
    todayTotal: todayTasks.length,
    todayDone: doneTasks.length,
    todayInProgress: todayTasks.filter(t => t.status === 'inprogress').length,
    todayUrgent: urgent.filter(t => t.date === today).length
  };
  
  Object.entries(stats).forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
  
  // Upcoming tasks
  const upcoming = document.getElementById('upcomingTasks');
  if (upcoming) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    
    const upcomingTasks = state.tasks
      .filter(t => t.date >= today && !t.completed && t.status !== 'done')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    
    upcoming.innerHTML = upcomingTasks.length ? upcomingTasks.map(t => {
      const dateLabel = t.date === today ? 'Bugün' : t.date === tomorrowStr ? 'Yarın' : formatDate(t.date);
      return `
        <div class="upcoming-item" onclick="window.openTaskDetail('${t.id}')">
          <div class="upcoming-dot" style="background:var(--${t.priority === 'critical' ? 'red' : t.priority === 'high' ? 'orange' : t.priority === 'low' ? 'green' : 'amber'})"></div>
          <div class="upcoming-info">
            <div class="upcoming-title">${escHtml(t.title)}</div>
            <div class="upcoming-sub">${dateLabel}</div>
          </div>
          <span class="upcoming-badge">${t.time || ''}</span>
        </div>
      `;
    }).join('') : '<div style="padding:10px;color:var(--text-muted);font-size:0.75rem;text-align:center">Yaklaşan görev yok</div>';
  }
}

// ═══════════════════════════════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════════════════════════════

export function openAddTaskModal(projectId = null, status = 'todo') {
  state.currentTaskId = null;
  state.currentTaskTags = [];
  state.currentPriority = 'medium';
  state.currentStatus = status;
  state.currentSubtasks = [];
  
  // Reset form
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskDate').value = state.selectedDay;
  document.getElementById('taskTime').value = '';
  document.getElementById('taskEstimate').value = '';
  document.getElementById('subtaskList').innerHTML = '';
  document.getElementById('subtaskInput').value = '';
  document.getElementById('taskTagsList').innerHTML = '';
  document.getElementById('taskTagInput').value = '';
  
  // Populate project select
  populateProjectSelect(projectId);
  
  // Update priority selector
  updatePrioritySelector('medium');
  
  // Update status selector
  updateStatusSelector(status);
  
  // Update modal title
  document.getElementById('taskModalTitle').textContent = 'Yeni Görev Ekle';
  
  openModal('taskModal');
}

export function openEditTaskModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) {
    toast('Görev bulunamadı', 'error');
    return;
  }
  
  state.currentTaskId = id;
  state.currentTaskTags = [...(task.tags || [])];
  state.currentPriority = task.priority || 'medium';
  state.currentStatus = task.status || 'todo';
  state.currentSubtasks = [...(task.subtasks || [])];
  
  // Fill form
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskDate').value = task.date || todayStr();
  document.getElementById('taskTime').value = task.time || '';
  document.getElementById('taskEstimate').value = task.estimate || '';
  
  // Populate project select
  populateProjectSelect(task.projectId);
  
  // Update selectors
  updatePrioritySelector(state.currentPriority);
  updateStatusSelector(state.currentStatus);
  
  // Render subtasks
  renderSubtasks();
  
  // Update modal title
  document.getElementById('taskModalTitle').textContent = 'Görevi Düzenle';
  
  openModal('taskModal');
}

export function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const date = document.getElementById('taskDate').value || todayStr();
  const time = document.getElementById('taskTime').value;
  const estimate = document.getElementById('taskEstimate').value.trim();
  const projectId = document.getElementById('taskProject')?.value || '';
  
  if (!title) {
    toast('Görev başlığı gerekli', 'error');
    return;
  }
  
  const now = Date.now();
  
  if (state.currentTaskId) {
    // Update existing
    updateTask(state.currentTaskId, {
      title,
      description,
      date,
      time,
      estimate,
      projectId,
      priority: state.currentPriority,
      status: state.currentStatus,
      tags: state.currentTaskTags,
      subtasks: state.currentSubtasks
    });
    toast('Görev güncellendi', 'success');
  } else {
    // Create new
    addTask({
      id: genId(),
      title,
      description,
      date,
      time,
      estimate,
      projectId,
      priority: state.currentPriority,
      status: state.currentStatus,
      completed: false,
      tags: state.currentTaskTags,
      subtasks: state.currentSubtasks,
      createdAt: now,
      updatedAt: now
    });
    toast('Görev eklendi', 'success');
  }
  
  saveTasks(state.tasks);
  closeModal('taskModal');
  renderTasksView();
  updateTaskBadges();
}

export function quickAddTask() {
  const title = document.getElementById('quickTaskInput').value.trim();
  if (!title) {
    toast('Görev başlığı gerekli', 'error');
    return;
  }
  
  const priority = document.getElementById('quickPriority').value;
  
  addTask({
    id: genId(),
    title,
    description: '',
    date: state.selectedDay,
    time: '',
    estimate: '',
    projectId: '',
    priority,
    status: 'todo',
    completed: false,
    tags: [],
    subtasks: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  saveTasks(state.tasks);
  document.getElementById('quickTaskInput').value = '';
  renderTasksView();
  updateTaskBadges();
  toast('Görev eklendi', 'success');
}

export function confirmDeleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  confirmAction(
    `"${task.title}" görevini silmek istediğinizden emin misiniz?`,
    () => {
      deleteTask(id);
      saveTasks(state.tasks);
      renderTasksView();
      updateTaskBadges();
      toast('Görev silindi', 'info');
    }
  );
}

// ═══════════════════════════════════════════════════════════════
// Task Actions
// ═══════════════════════════════════════════════════════════════

export function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  const newCompleted = !task.completed;
  updateTask(id, {
    completed: newCompleted,
    status: newCompleted ? 'done' : task.status === 'done' ? 'todo' : task.status
  });
  
  saveTasks(state.tasks);
  renderTasksView();
  updateTaskBadges();
  
  if (newCompleted) {
    toast('Görev tamamlandı', 'success');
  }
}

export function selectDay(day) {
  setSelectedDay(day);
  state.urgentMode = false;
  renderTasksView();
}

export function showUrgentTasks() {
  state.urgentMode = true;
  switchMainTab('tasks');
  renderTasksView();
}

// ═══════════════════════════════════════════════════════════════
// Detail View
// ═══════════════════════════════════════════════════════════════

export function openTaskDetail(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  document.getElementById('taskDetailTitle').textContent = task.title;
  
  const project = state.items.find(i => i.id === task.projectId);
  
  const html = `
    ${task.description ? `<p style="margin-bottom:12px;color:var(--text-dim);line-height:1.6">${escHtml(task.description)}</p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      ${renderPriorityBadge(task.priority)}
      ${task.status ? `<span class="tag">Durum: ${task.status}</span>` : ''}
      ${task.date ? `<span class="tag">📅 ${formatDate(task.date)}</span>` : ''}
      ${task.time ? `<span class="tag">🕐 ${task.time}</span>` : ''}
      ${task.estimate ? `<span class="tag">⏱️ ${task.estimate}</span>` : ''}
      ${project ? `<span class="tag">📁 ${escHtml(project.title)}</span>` : ''}
    </div>
    ${task.subtasks?.length ? `
      <div style="margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px;font-size:0.8rem">Alt Görevler</div>
        ${task.subtasks.map(st => `
          <div class="subtask-item">
            <div class="subtask-check ${st.done ? 'checked' : ''}">${st.done ? '✓' : ''}</div>
            <span class="subtask-title ${st.done ? 'done' : ''}">${escHtml(st.title)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    ${task.tags?.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${task.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
      </div>
    ` : ''}
  `;
  
  document.getElementById('taskDetailBody').innerHTML = html;
  openModal('taskDetailModal');
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function populateProjectSelect(selectedId = null) {
  const select = document.getElementById('taskProject');
  if (!select) return;
  
  const projects = state.items.filter(i => i.type === 'project');
  
  select.innerHTML = `
    <option value="">— Proje seç —</option>
    ${projects.map(p => `
      <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>
        ${escHtml(p.title)}
      </option>
    `).join('')}
  `;
}

function updatePrioritySelector(priority) {
  document.querySelectorAll('.priority-opt').forEach(opt => {
    opt.className = 'priority-opt';
    if (opt.dataset.p === priority) {
      opt.classList.add(`selected-${priority}`);
    }
  });
}

function updateStatusSelector(status) {
  document.querySelectorAll('.status-opt').forEach(opt => {
    opt.className = 'status-opt';
    if (opt.dataset.s === status) {
      opt.classList.add(`selected-${status}`);
    }
  });
}

function renderSubtasks() {
  const list = document.getElementById('subtaskList');
  if (!list) return;
  
  list.innerHTML = state.currentSubtasks.map((st, idx) => `
    <div class="subtask-item" style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg);border-radius:4px">
      <input type="checkbox" ${st.done ? 'checked' : ''} 
             onchange="window.toggleSubtask(${idx})" style="cursor:pointer">
      <span style="flex:1;font-size:0.8rem;${st.done ? 'text-decoration:line-through;opacity:0.6' : ''}">${escHtml(st.title)}</span>
      <button onclick="window.removeSubtask(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px">×</button>
    </div>
  `).join('');
}

function updateTaskBadges() {
  const badges = {
    'badge-tasks': state.tasks.filter(t => t.status !== 'done' && !t.completed).length,
    'badge-kanban-progress': state.tasks.filter(t => t.status === 'inprogress').length,
    'badge-urgent': getUrgentTasks().length
  };
  
  Object.entries(badges).forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
}

// ═══════════════════════════════════════════════════════════════
// Export for Global Access
// ═══════════════════════════════════════════════════════════════

window.openAddTaskModal = openAddTaskModal;
window.openAddTaskForProject = (projectId) => openAddTaskModal(projectId, 'todo');
window.openAddTaskForStatus = (status) => openAddTaskModal(null, status);
window.editTask = openEditTaskModal;
window.confirmDeleteTask = confirmDeleteTask;
window.toggleTask = toggleTask;
window.openTaskDetail = openTaskDetail;
window.selectDay = selectDay;
window.showUrgentTasks = showUrgentTasks;
window.saveTask = saveTask;
window.quickAddTask = quickAddTask;

window.selectPriority = (p) => {
  state.currentPriority = p;
  updatePrioritySelector(p);
};

window.selectStatus = (s) => {
  state.currentStatus = s;
  updateStatusSelector(s);
};

window.addSubtask = () => {
  const input = document.getElementById('subtaskInput');
  const value = input?.value.trim();
  if (value) {
    state.currentSubtasks.push({ title: value, done: false });
    input.value = '';
    renderSubtasks();
  }
};

window.toggleSubtask = (idx) => {
  if (state.currentSubtasks[idx]) {
    state.currentSubtasks[idx].done = !state.currentSubtasks[idx].done;
    renderSubtasks();
  }
};

window.removeSubtask = (idx) => {
  state.currentSubtasks.splice(idx, 1);
  renderSubtasks();
};
