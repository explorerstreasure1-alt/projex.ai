/* ═══════════════════════════════════════════════════════════════
   Pro Timeline - 7 Day Canva-Style View
═══════════════════════════════════════════════════════════════ */

import { state, getTasksForDate } from './state.js';
import { todayStr, formatDate, escHtml } from './utils.js';
import { openAddTaskModal } from './tasks.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Timeline State
// ═══════════════════════════════════════════════════════════════

let timelineState = {
  currentWeek: 0, // 0 = current week, -1 = last week, 1 = next week
  selectedDay: todayStr(),
  viewMode: 'week', // 'week', 'day'
  timeSlotDuration: 60 // minutes
};

// ═══════════════════════════════════════════════════════════════
// Initialize Timeline
// ═══════════════════════════════════════════════════════════════

export function initProTimeline() {
  renderProTimeline();
  renderQuickActions();
}

// ═══════════════════════════════════════════════════════════════
// Render 7-Day Timeline
// ═══════════════════════════════════════════════════════════════

export function renderProTimeline() {
  const container = document.getElementById('proTimeline');
  if (!container) return;
  
  const weekDates = getWeekDates(timelineState.currentWeek);
  const today = todayStr();
  
  container.innerHTML = `
    <div class="timeline-container">
      <div class="timeline-header">
        <div class="timeline-title">
          📅 ${getWeekLabel()}
        </div>
        <div class="timeline-nav">
          <button class="timeline-nav-btn" onclick="changeWeek(-1)" title="Önceki hafta">◀</button>
          <button class="timeline-nav-btn" onclick="changeWeek(0)" title="Bugün">●</button>
          <button class="timeline-nav-btn" onclick="changeWeek(1)" title="Sonraki hafta">▶</button>
        </div>
      </div>
      
      <div class="timeline-grid">
        ${renderTimeLabels()}
        ${weekDates.map(date => renderDayColumn(date, date === today)).join('')}
      </div>
    </div>
  `;
}

function renderTimeLabels() {
  const slots = [];
  for (let hour = 8; hour <= 20; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  
  return `
    <div class="timeline-time-labels">
      <div style="height: 40px;"></div> <!-- Day header spacer -->
      ${slots.map(time => `
        <div class="time-slot-label">${time}</div>
      `).join('')}
    </div>
  `;
}

function renderDayColumn(date, isToday) {
  const dateObj = new Date(date);
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const dayName = dayNames[(dateObj.getDay() + 6) % 7]; // Monday start
  const dayNumber = dateObj.getDate();
  
  const tasks = getTasksForDate(date);
  const isSelected = date === timelineState.selectedDay;
  
  // Time slots with tasks
  const slots = [];
  for (let hour = 8; hour <= 20; hour++) {
    const slotTasks = tasks.filter(t => {
      if (!t.time) return false;
      const taskHour = parseInt(t.time.split(':')[0]);
      return taskHour === hour;
    });
    
    slots.push({
      hour,
      tasks: slotTasks
    });
  }
  
  return `
    <div class="timeline-day">
      <div class="day-header ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
           onclick="selectTimelineDay('${date}')">
        <div class="day-name">${dayName}</div>
        <div class="day-number">${dayNumber}</div>
        <div class="day-tasks-count">${tasks.length} görev</div>
      </div>
      ${slots.map(slot => renderTimeSlot(date, slot.hour, slot.tasks)).join('')}
    </div>
  `;
}

function renderTimeSlot(date, hour, tasks) {
  const hasTask = tasks.length > 0;
  const taskPreview = hasTask ? tasks[0].title.slice(0, 15) + (tasks[0].title.length > 15 ? '...' : '') : '';
  
  return `
    <div class="time-slot ${hasTask ? 'has-task' : ''}" 
         onclick="createTaskAtTime('${date}', ${hour})"
         title="${hasTask ? tasks.map(t => t.title).join(', ') : `${hour}:00 - Görev ekle`}">
      ${hasTask ? `<div class="time-slot-task">${escHtml(taskPreview)}</div>` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Quick Actions
// ═══════════════════════════════════════════════════════════════

function renderQuickActions() {
  const container = document.getElementById('quickActions');
  if (!container) return;
  
  container.innerHTML = `
    <button class="quick-action-btn" onclick="quickCreateTask()">
      <span class="quick-action-icon">⚡</span>
      <span class="quick-action-label">Hızlı Görev</span>
    </button>
    <button class="quick-action-btn" onclick="startFocusMode()">
      <span class="quick-action-icon">🎯</span>
      <span class="quick-action-label">Odak Modu</span>
    </button>
    <button class="quick-action-btn" onclick="createMeeting()">
      <span class="quick-action-icon">📅</span>
      <span class="quick-action-label">Toplantı</span>
    </button>
    <button class="quick-action-btn" onclick="openVoiceQuick()">
      <span class="quick-action-icon">🎙️</span>
      <span class="quick-action-label">Ses Notu</span>
    </button>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function getWeekDates(weekOffset) {
  const dates = [];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday
  
  // Start from Monday of current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) + (weekOffset * 7));
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }
  
  return dates;
}

function getWeekLabel() {
  if (timelineState.currentWeek === 0) return 'Bu Hafta';
  if (timelineState.currentWeek === -1) return 'Geçen Hafta';
  if (timelineState.currentWeek === 1) return 'Gelecek Hafta';
  if (timelineState.currentWeek > 1) return `${timelineState.currentWeek} Hafta Sonra`;
  return `${Math.abs(timelineState.currentWeek)} Hafta Önce`;
}

// ═══════════════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════════════

export function changeWeek(offset) {
  if (offset === 0) {
    timelineState.currentWeek = 0;
    timelineState.selectedDay = todayStr();
  } else {
    timelineState.currentWeek += offset;
  }
  
  renderProTimeline();
  logActivity(`Timeline: ${getWeekLabel()} görüntülendi`);
}

export function selectTimelineDay(date) {
  timelineState.selectedDay = date;
  state.selectedDay = date; // Sync with main state
  renderProTimeline();
  
  // Refresh task view if visible
  const tasksView = document.getElementById('tasksView');
  if (tasksView?.classList.contains('visible')) {
    // Trigger tasks view refresh
    if (window.renderTasksView) {
      window.renderTasksView();
    }
  }
}

export function createTaskAtTime(date, hour) {
  const time = `${hour.toString().padStart(2, '0')}:00`;
  
  // Pre-fill task modal with date and time
  openAddTaskModal(null, 'todo');
  
  // Set date and time
  setTimeout(() => {
    const dateInput = document.getElementById('taskDate');
    const timeInput = document.getElementById('taskTime');
    
    if (dateInput) dateInput.value = date;
    if (timeInput) timeInput.value = time;
  }, 100);
  
  logActivity(`${date} ${time} için görev oluşturuluyor`);
}

// ═══════════════════════════════════════════════════════════════
// Quick Action Functions
// ═══════════════════════════════════════════════════════════════

window.quickCreateTask = () => {
  openAddTaskModal();
  logActivity('Hızlı görev oluşturuldu');
};

window.startFocusMode = () => {
  // Check if focus mode plugin is enabled
  if (window.isPluginEnabled && window.isPluginEnabled('focus-mode')) {
    toast('Odak modu başlatılıyor...', 'success');
    // Trigger focus mode
  } else {
    toast('Odak Modu eklentisini etkinleştirin', 'error');
  }
};

window.createMeeting = () => {
  openAddTaskModal(null, 'todo');
  
  setTimeout(() => {
    const titleInput = document.getElementById('taskTitle');
    if (titleInput) titleInput.value = 'Toplantı: ';
  }, 100);
  
  logActivity('Toplantı oluşturuldu');
};

window.openVoiceQuick = () => {
  window.switchMainTab('voice');
  logActivity('Ses notu oluşturuluyor');
};

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.changeWeek = (offset) => changeWeek(offset);
window.selectTimelineDay = (date) => selectTimelineDay(date);
window.createTaskAtTime = (date, hour) => createTaskAtTime(date, hour);

// ═══════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════

export function getTimelineState() {
  return { ...timelineState };
}

export function setTimelineWeek(weekOffset) {
  timelineState.currentWeek = weekOffset;
  renderProTimeline();
}
