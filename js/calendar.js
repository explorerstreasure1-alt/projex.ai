/* ═══════════════════════════════════════════════════════════════
   Calendar Module - Full Calendar & Event Management
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull, todayStr } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Calendar State
// ═══════════════════════════════════════════════════════════════

const CALENDAR_STORAGE_KEY = 'devvault_calendar';

let calendarState = {
  currentDate: new Date(),
  viewMode: 'month', // 'month' | 'week' | 'day' | 'agenda'
  events: [],
  selectedEvent: null,
  filters: {
    types: ['task', 'milestone', 'meeting', 'reminder'],
    showCompleted: true
  }
};

// ═══════════════════════════════════════════════════════════════
// Initialize Calendar
// ═══════════════════════════════════════════════════════════════

export function initCalendar() {
  loadCalendar();
  
  // Sync tasks as events
  syncTasksToEvents();
}

function syncTasksToEvents() {
  // Convert tasks with dates to calendar events
  state.tasks.forEach(task => {
    if (task.date && !calendarState.events.find(e => e.taskId === task.id)) {
      calendarState.events.push({
        id: genId(),
        taskId: task.id,
        title: task.title,
        date: task.date,
        type: 'task',
        priority: task.priority,
        status: task.completed ? 'completed' : 'pending',
        color: getPriorityColor(task.priority),
        allDay: true
      });
    }
  });
  
  saveCalendar();
}

// ═══════════════════════════════════════════════════════════════
// Event CRUD
// ═══════════════════════════════════════════════════════════════

export function createEvent(data) {
  const event = {
    id: genId(),
    title: data.title,
    description: data.description || '',
    date: data.date,
    time: data.time || null,
    duration: data.duration || 60, // minutes
    type: data.type || 'meeting',
    location: data.location || '',
    attendees: data.attendees || [],
    color: data.color || getEventTypeColor(data.type),
    allDay: data.allDay || false,
    recurring: data.recurring || null,
    reminders: data.reminders || [15], // minutes before
    createdAt: Date.now()
  };
  
  calendarState.events.push(event);
  saveCalendar();
  
  logActivity(`Etkinlik oluşturuldu: ${event.title}`);
  toast(`"${event.title}" eklendi`, 'success');
  
  renderCalendar();
  return event;
}

export function updateEvent(eventId, updates) {
  const event = calendarState.events.find(e => e.id === eventId);
  if (!event) return null;
  
  Object.assign(event, updates);
  saveCalendar();
  
  toast('Etkinlik güncellendi', 'success');
  renderCalendar();
  return event;
}

export function deleteEvent(eventId) {
  const event = calendarState.events.find(e => e.id === eventId);
  if (!event) return;
  
  if (!confirm(`"${event.title}" silmek istediğinize emin misiniz?`)) return;
  
  calendarState.events = calendarState.events.filter(e => e.id !== eventId);
  saveCalendar();
  
  logActivity(`Etkinlik silindi: ${event.title}`);
  toast('Etkinlik silindi', 'info');
  renderCalendar();
}

// ═══════════════════════════════════════════════════════════════
// Calendar Navigation
// ═══════════════════════════════════════════════════════════════

export function navigateMonth(delta) {
  calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + delta);
  renderCalendar();
}

export function navigateWeek(delta) {
  const newDate = new Date(calendarState.currentDate);
  newDate.setDate(newDate.getDate() + (delta * 7));
  calendarState.currentDate = newDate;
  renderCalendar();
}

export function navigateDay(delta) {
  calendarState.currentDate.setDate(calendarState.currentDate.getDate() + delta);
  renderCalendar();
}

export function goToToday() {
  calendarState.currentDate = new Date();
  renderCalendar();
}

export function setViewMode(mode) {
  calendarState.viewMode = mode;
  renderCalendar();
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderCalendar() {
  const container = document.getElementById('calendarView');
  if (!container) return;
  
  const view = calendarState.viewMode;
  
  container.innerHTML = `
    <div class="calendar-header">
      <div class="calendar-nav">
        <button class="btn btn-icon btn-ghost" onclick="navigateCalendar(-1)">◀</button>
        <button class="btn btn-secondary" onclick="goToToday()">Bugün</button>
        <button class="btn btn-icon btn-ghost" onclick="navigateCalendar(1)">▶</button>
      </div>
      
      <h2 class="calendar-title">${getCalendarTitle()}</h2>
      
      <div class="calendar-view-tabs">
        <button class="view-tab ${view === 'month' ? 'active' : ''}" onclick="setCalendarView('month')">Ay</button>
        <button class="view-tab ${view === 'week' ? 'active' : ''}" onclick="setCalendarView('week')">Hafta</button>
        <button class="view-tab ${view === 'day' ? 'active' : ''}" onclick="setCalendarView('day')">Gün</button>
        <button class="view-tab ${view === 'agenda' ? 'active' : ''}" onclick="setCalendarView('agenda')">Ajanda</button>
      </div>
    </div>
    
    <div class="calendar-body">
      ${view === 'month' ? renderMonthView() : ''}
      ${view === 'week' ? renderWeekView() : ''}
      ${view === 'day' ? renderDayView() : ''}
      ${view === 'agenda' ? renderAgendaView() : ''}
    </div>
  `;
}

function renderMonthView() {
  const year = calendarState.currentDate.getFullYear();
  const month = calendarState.currentDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();
  
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const today = todayStr();
  
  let html = `
    <div class="calendar-grid month">
      <div class="calendar-weekdays">
        ${dayNames.map(d => `<div class="weekday">${d}</div>`).join('')}
      </div>
      <div class="calendar-days">
  `;
  
  // Empty cells before first day
  for (let i = 0; i < (startDayOfWeek + 6) % 7; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  
  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = getEventsForDate(dateStr);
    const isToday = dateStr === today;
    
    html += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''}" 
           onclick="openDayModal('${dateStr}')">
        <div class="day-number">${day}</div>
        <div class="day-events">
          ${dayEvents.slice(0, 3).map(e => `
            <div class="day-event ${e.type}" style="background: ${e.color}" 
                 onclick="event.stopPropagation(); viewEvent('${e.id}')">
              ${escHtml(e.title.slice(0, 15))}
            </div>
          `).join('')}
          ${dayEvents.length > 3 ? `<div class="more-events">+${dayEvents.length - 3}</div>` : ''}
        </div>
      </div>
    `;
  }
  
  html += '</div></div>';
  return html;
}

function renderWeekView() {
  const startOfWeek = getStartOfWeek(calendarState.currentDate);
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const today = todayStr();
  
  return `
    <div class="calendar-grid week">
      ${dayNames.map((dayName, index) => {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + index);
        const dateStr = date.toISOString().split('T')[0];
        const dayEvents = getEventsForDate(dateStr);
        const isToday = dateStr === today;
        
        return `
          <div class="week-column ${isToday ? 'today' : ''}">
            <div class="week-header">
              <div class="week-day-name">${dayName}</div>
              <div class="week-day-number">${date.getDate()}</div>
            </div>
            <div class="week-events">
              ${renderTimeSlots(dayEvents, dateStr)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTimeSlots(events, dateStr) {
  const slots = [];
  
  for (let hour = 8; hour <= 20; hour++) {
    const hourEvents = events.filter(e => {
      if (!e.time) return false;
      const eventHour = parseInt(e.time.split(':')[0]);
      return eventHour === hour;
    });
    
    slots.push({
      hour: `${hour}:00`,
      events: hourEvents
    });
  }
  
  return slots.map(slot => `
    <div class="time-slot" onclick="openCreateEventModal('${dateStr}', '${slot.hour}')">
      <div class="slot-label">${slot.hour}</div>
      ${slot.events.map(e => `
        <div class="slot-event ${e.type}" style="background: ${e.color}"
             onclick="event.stopPropagation(); viewEvent('${e.id}')">
          ${escHtml(e.title.slice(0, 20))}
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderDayView() {
  const dateStr = calendarState.currentDate.toISOString().split('T')[0];
  const dayEvents = getEventsForDate(dateStr).sort((a, b) => {
    if (!a.time) return -1;
    if (!b.time) return 1;
    return a.time.localeCompare(b.time);
  });
  
  return `
    <div class="day-view">
      <div class="day-header">
        <h3>${formatDateFull(dateStr)}</h3>
        <button class="btn btn-primary" onclick="openCreateEventModal('${dateStr}')">
          ➕ Etkinlik Ekle
        </button>
      </div>
      <div class="day-timeline">
        ${dayEvents.length ? dayEvents.map(event => `
          <div class="day-event-item ${event.type}" style="border-left-color: ${event.color}">
            <div class="event-time">${event.time || 'Tüm gün'}</div>
            <div class="event-content">
              <h4>${escHtml(event.title)}</h4>
              <p>${escHtml(event.description || '')}</p>
              ${event.location ? `<div class="event-location">📍 ${escHtml(event.location)}</div>` : ''}
            </div>
            <div class="event-actions">
              <button class="btn-icon" onclick="viewEvent('${event.id}')">👁️</button>
              <button class="btn-icon" onclick="deleteEvent('${event.id}')">🗑️</button>
            </div>
          </div>
        `).join('') : `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <p>Bu gün için etkinlik yok</p>
            <button class="btn btn-secondary" onclick="openCreateEventModal('${dateStr}')">
              Etkinlik Ekle
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderAgendaView() {
  // Group events by date
  const grouped = {};
  const sortedEvents = [...calendarState.events].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  sortedEvents.forEach(event => {
    if (!grouped[event.date]) {
      grouped[event.date] = [];
    }
    grouped[event.date].push(event);
  });
  
  const dates = Object.keys(grouped).sort();
  
  return `
    <div class="agenda-view">
      ${dates.map(date => `
        <div class="agenda-day">
          <div class="agenda-date">
            <span class="day-name">${getDayName(date)}</span>
            <span class="full-date">${formatDateFull(date)}</span>
          </div>
          <div class="agenda-events">
            ${grouped[date].map(event => `
              <div class="agenda-event ${event.type}" style="border-left-color: ${event.color}">
                <div class="event-time-badge">${event.time || 'Tüm gün'}</div>
                <div class="event-details">
                  <h4>${escHtml(event.title)}</h4>
                  <p>${escHtml(event.description?.slice(0, 60) || '')}</p>
                </div>
                <div class="event-type-badge ${event.type}">${getEventTypeLabel(event.type)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function getEventsForDate(dateStr) {
  return calendarState.events.filter(e => {
    if (e.date !== dateStr) return false;
    if (!calendarState.filters.types.includes(e.type)) return false;
    if (e.status === 'completed' && !calendarState.filters.showCompleted) return false;
    return true;
  });
}

function getCalendarTitle() {
  const date = calendarState.currentDate;
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  
  if (calendarState.viewMode === 'month') {
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  } else if (calendarState.viewMode === 'week') {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.getDate()} - ${end.getDate()} ${months[end.getMonth()]}`;
  } else if (calendarState.viewMode === 'day') {
    return formatDateFull(date.toISOString().split('T')[0]);
  }
  return 'Ajanda';
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getDayName(dateStr) {
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

function getPriorityColor(priority) {
  const colors = {
    critical: '#f43f5e',
    high: '#f59e0b',
    medium: '#8b5cf6',
    low: '#10b981'
  };
  return colors[priority] || '#8b5cf6';
}

function getEventTypeColor(type) {
  const colors = {
    task: '#8b5cf6',
    milestone: '#f43f5e',
    meeting: '#06b6d4',
    reminder: '#f59e0b',
    event: '#10b981'
  };
  return colors[type] || '#8b5cf6';
}

function getEventTypeLabel(type) {
  const labels = {
    task: 'Görev',
    milestone: 'Kilometre Taşı',
    meeting: 'Toplantı',
    reminder: 'Hatırlatıcı',
    event: 'Etkinlik'
  };
  return labels[type] || type;
}

// ═══════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════

export function openCreateEventModal(dateStr, timeStr = null) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'createEventModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <div class="modal-title">📅 Yeni Etkinlik</div>
        <button class="modal-close" onclick="closeModal('createEventModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Başlık</label>
          <input type="text" class="form-input" id="eventTitle" placeholder="Etkinlik başlığı...">
        </div>
        
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-textarea" id="eventDesc" placeholder="Etkinlik açıklaması..."></textarea>
        </div>
        
        <div class="flex gap-md">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Tarih</label>
            <input type="date" class="form-input" id="eventDate" value="${dateStr}">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Saat</label>
            <input type="time" class="form-input" id="eventTime" value="${timeStr || ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Tür</label>
          <select class="form-select" id="eventType">
            <option value="meeting">💼 Toplantı</option>
            <option value="task">📋 Görev</option>
            <option value="milestone">🎯 Kilometre Taşı</option>
            <option value="reminder">🔔 Hatırlatıcı</option>
            <option value="event">🎉 Etkinlik</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Konum</label>
          <input type="text" class="form-input" id="eventLocation" placeholder="Konum (opsiyonel)">
        </div>
        
        <div class="form-check">
          <input type="checkbox" id="eventAllDay">
          <label for="eventAllDay">Tüm gün etkinliği</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('createEventModal')">İptal</button>
        <button class="btn btn-primary" onclick="saveNewEvent()">💾 Kaydet</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('eventTitle').focus();
}

export function viewEvent(eventId) {
  const event = calendarState.events.find(e => e.id === eventId);
  if (!event) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'viewEventModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header" style="border-left: 4px solid ${event.color}; padding-left: 20px;">
        <div class="modal-title">${escHtml(event.title)}</div>
        <button class="modal-close" onclick="closeModal('viewEventModal')">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <span class="event-type-badge ${event.type}">${getEventTypeLabel(event.type)}</span>
          <span style="color: var(--text-muted); margin-left: 8px;">
            ${formatDateFull(event.date)}
            ${event.time ? `• ${event.time}` : ''}
          </span>
        </div>
        
        ${event.description ? `
          <div class="form-group">
            <label class="form-label">Açıklama</label>
            <p style="color: var(--text-secondary); line-height: 1.6;">${escHtml(event.description)}</p>
          </div>
        ` : ''}
        
        ${event.location ? `
          <div class="form-group">
            <label class="form-label">Konum</label>
            <p>📍 ${escHtml(event.location)}</p>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="deleteEvent('${event.id}'); closeModal('viewEventModal');">🗑️ Sil</button>
        <button class="btn btn-primary" onclick="closeModal('viewEventModal')">Kapat</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

export function openDayModal(dateStr) {
  const dayEvents = getEventsForDate(dateStr);
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'dayModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <div class="modal-title">📅 ${formatDateFull(dateStr)}</div>
        <button class="modal-close" onclick="closeModal('dayModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="day-events-list">
          ${dayEvents.length ? dayEvents.map(event => `
            <div class="day-event-item ${event.type}" style="border-left-color: ${event.color}">
              <div class="event-time">${event.time || 'Tüm gün'}</div>
              <div class="event-title">${escHtml(event.title)}</div>
              <button class="btn-icon" onclick="viewEvent('${event.id}')">👁️</button>
            </div>
          `).join('') : '<p class="empty-text">Bu gün için etkinlik yok</p>'}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="openCreateEventModal('${dateStr}')">➕ Etkinlik Ekle</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.navigateCalendar = (delta) => {
  if (calendarState.viewMode === 'month') {
    navigateMonth(delta);
  } else if (calendarState.viewMode === 'week') {
    navigateWeek(delta);
  } else {
    navigateDay(delta);
  }
};

window.renderCalendar = renderCalendar;
window.goToToday = goToToday;
window.setCalendarView = setViewMode;
window.openCreateEventModal = openCreateEventModal;
window.openDayModal = openDayModal;
window.viewEvent = viewEvent;
window.deleteEvent = deleteEvent;

window.saveNewEvent = () => {
  const title = document.getElementById('eventTitle').value.trim();
  if (!title) {
    toast('Başlık gerekli', 'error');
    return;
  }
  
  const date = document.getElementById('eventDate').value;
  if (!date) {
    toast('Tarih gerekli', 'error');
    return;
  }
  
  createEvent({
    title,
    description: document.getElementById('eventDesc').value.trim(),
    date,
    time: document.getElementById('eventTime').value || null,
    type: document.getElementById('eventType').value,
    location: document.getElementById('eventLocation').value.trim(),
    allDay: document.getElementById('eventAllDay').checked
  });
  
  closeModal('createEventModal');
  document.getElementById('createEventModal')?.remove();
};

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadCalendar() {
  const saved = getStorage(CALENDAR_STORAGE_KEY, '{}');
  if (saved.events) {
    calendarState.events = saved.events;
    calendarState.viewMode = saved.viewMode || 'month';
  }
}

function saveCalendar() {
  setStorage(CALENDAR_STORAGE_KEY, {
    events: calendarState.events,
    viewMode: calendarState.viewMode
  });
}

// Export
export function getCalendarEvents() {
  return [...calendarState.events];
}

export function getEventsForRange(startDate, endDate) {
  return calendarState.events.filter(e => {
    return e.date >= startDate && e.date <= endDate;
  });
}
