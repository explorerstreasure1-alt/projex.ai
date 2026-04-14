/* ═══════════════════════════════════════════════════════════════
   Enhanced Pomodoro - Advanced Focus Timer & Productivity
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, formatTime } from './utils.js';
import { toast } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Pomodoro State
// ═══════════════════════════════════════════════════════════════

const POMODORO_STORAGE_KEY = 'devvault_pomodoro';

let pomoState = {
  isRunning: false,
  isPaused: false,
  mode: 'work', // 'work' | 'shortBreak' | 'longBreak'
  timeLeft: 25 * 60,
  totalSessions: 0,
  completedSessions: 0,
  todaySessions: 0,
  currentTask: null,
  settings: {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    soundEnabled: true,
    notificationEnabled: true
  },
  stats: {
    daily: [],
    weekly: [],
    totalFocusTime: 0,
    streakDays: 0,
    lastActiveDate: null
  },
  tasks: [],
  history: []
};

// Timer interval
let timerInterval = null;

// ═══════════════════════════════════════════════════════════════
// Initialize Pomodoro
// ═══════════════════════════════════════════════════════════════

export function initEnhancedPomodoro() {
  loadPomodoro();
  
  // Update streak
  updateStreak();
  
  // Create widget
  createPomodoroWidget();
  
  console.log('[Pomodoro] Enhanced module initialized');
}

function updateStreak() {
  const today = new Date().toDateString();
  const lastActive = pomoState.stats.lastActiveDate;
  
  if (lastActive) {
    const lastDate = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      pomoState.stats.streakDays++;
    } else if (diffDays > 1) {
      // Streak broken
      pomoState.stats.streakDays = 0;
    }
  }
  
  pomoState.stats.lastActiveDate = today;
  savePomodoro();
}

// ═══════════════════════════════════════════════════════════════
// Timer Controls
// ═══════════════════════════════════════════════════════════════

export function startPomodoro(taskId = null) {
  if (pomoState.isRunning) return;
  
  pomoState.isRunning = true;
  pomoState.isPaused = false;
  pomoState.currentTask = taskId;
  
  // Set initial time based on mode
  setTimeForMode();
  
  // Start timer
  timerInterval = setInterval(() => {
    if (!pomoState.isPaused) {
      pomoState.timeLeft--;
      updatePomodoroDisplay();
      
      if (pomoState.timeLeft <= 0) {
        completeSession();
      }
    }
  }, 1000);
  
  // Visual feedback
  showFocusOverlay();
  updateWidgetState('running');
  
  toast(`🍅 ${getModeLabel()} başladı!`, 'success');
  logActivity(`Pomodoro başlatıldı: ${getModeLabel()}`);
  
  savePomodoro();
}

export function pausePomodoro() {
  if (!pomoState.isRunning) return;
  
  pomoState.isPaused = !pomoState.isPaused;
  
  updateWidgetState(pomoState.isPaused ? 'paused' : 'running');
  toast(pomoState.isPaused ? '⏸️ Duraklatıldı' : '▶️ Devam ediyor', 'info');
  
  savePomodoro();
}

export function stopPomodoro() {
  if (!pomoState.isRunning) return;
  
  clearInterval(timerInterval);
  pomoState.isRunning = false;
  pomoState.isPaused = false;
  
  // Log as cancelled
  addToHistory({
    mode: pomoState.mode,
    duration: getDurationForMode() - pomoState.timeLeft,
    completed: false,
    taskId: pomoState.currentTask
  });
  
  hideFocusOverlay();
  updateWidgetState('idle');
  toast('⏹️ Pomodoro durduruldu', 'info');
  
  savePomodoro();
}

export function resetPomodoro() {
  stopPomodoro();
  pomoState.mode = 'work';
  pomoState.timeLeft = pomoState.settings.workDuration * 60;
  updatePomodoroDisplay();
}

export function skipSession() {
  if (!pomoState.isRunning) return;
  
  completeSession(true);
}

function completeSession(skipped = false) {
  clearInterval(timerInterval);
  pomoState.isRunning = false;
  
  const duration = getDurationForMode();
  
  if (!skipped) {
    // Update stats
    pomoState.totalSessions++;
    pomoState.completedSessions++;
    pomoState.stats.totalFocusTime += duration;
    
    if (pomoState.mode === 'work') {
      pomoState.todaySessions++;
    }
    
    // Add to history
    addToHistory({
      mode: pomoState.mode,
      duration: duration,
      completed: true,
      taskId: pomoState.currentTask,
      timestamp: Date.now()
    });
    
    // Celebrate
    celebrateCompletion();
  }
  
  // Determine next mode
  if (pomoState.mode === 'work') {
    pomoState.totalSessions++;
    
    if (pomoState.totalSessions % pomoState.settings.sessionsBeforeLongBreak === 0) {
      pomoState.mode = 'longBreak';
      toast('🎉 4 pomodoro tamamlandı! Uzun mola zamanı.', 'success');
    } else {
      pomoState.mode = 'shortBreak';
      toast('✅ Pomodoro tamamlandı! Kısa mola.', 'success');
    }
  } else {
    pomoState.mode = 'work';
    toast('☕ Mola bitti! Yeni pomodoro.', 'info');
  }
  
  setTimeForMode();
  updatePomodoroDisplay();
  hideFocusOverlay();
  updateWidgetState('idle');
  
  // Auto-start next if enabled
  if (pomoState.settings.autoStartBreaks && pomoState.mode !== 'work') {
    setTimeout(() => startPomodoro(), 2000);
  } else if (pomoState.settings.autoStartPomodoros && pomoState.mode === 'work') {
    setTimeout(() => startPomodoro(), 2000);
  }
  
  savePomodoro();
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function setTimeForMode() {
  switch (pomoState.mode) {
    case 'work':
      pomoState.timeLeft = pomoState.settings.workDuration * 60;
      break;
    case 'shortBreak':
      pomoState.timeLeft = pomoState.settings.shortBreakDuration * 60;
      break;
    case 'longBreak':
      pomoState.timeLeft = pomoState.settings.longBreakDuration * 60;
      break;
  }
}

function getDurationForMode() {
  switch (pomoState.mode) {
    case 'work':
      return pomoState.settings.workDuration * 60;
    case 'shortBreak':
      return pomoState.settings.shortBreakDuration * 60;
    case 'longBreak':
      return pomoState.settings.longBreakDuration * 60;
    default:
      return 25 * 60;
  }
}

function getModeLabel() {
  const labels = {
    work: 'Çalışma',
    shortBreak: 'Kısa Mola',
    longBreak: 'Uzun Mola'
  };
  return labels[pomoState.mode] || 'Çalışma';
}

function getModeEmoji() {
  const emojis = {
    work: '🍅',
    shortBreak: '☕',
    longBreak: '🧘'
  };
  return emojis[pomoState.mode] || '🍅';
}

function formatTimeDisplay(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// ═══════════════════════════════════════════════════════════════
// UI Widget
// ═══════════════════════════════════════════════════════════════

function createPomodoroWidget() {
  // Remove existing widget
  document.getElementById('pomodoroWidget')?.remove();
  
  const widget = document.createElement('div');
  widget.id = 'pomodoroWidget';
  widget.className = 'pomodoro-widget';
  
  widget.innerHTML = `
    <div class="pomo-header">
      <span class="pomo-icon">${getModeEmoji()}</span>
      <span class="pomo-mode">${getModeLabel()}</span>
    </div>
    <div class="pomo-timer" id="pomoTimer">${formatTimeDisplay(pomoState.timeLeft)}</div>
    <div class="pomo-progress">
      <div class="pomo-progress-bar" id="pomoProgress"></div>
    </div>
    <div class="pomo-stats">
      <span>🔥 ${pomoState.stats.streakDays} gün</span>
      <span>✅ ${pomoState.todaySessions} today</span>
    </div>
    <div class="pomo-controls">
      <button class="pomo-btn ${pomoState.isRunning && !pomoState.isPaused ? 'active' : ''}" 
              id="pomoStartBtn" onclick="togglePomodoro()" title="Başlat/Duraklat">
        ${pomoState.isRunning && !pomoState.isPaused ? '⏸️' : '▶️'}
      </button>
      <button class="pomo-btn" onclick="stopPomodoro()" title="Durdur">
        ⏹️
      </button>
      <button class="pomo-btn" onclick="resetPomodoro()" title="Sıfırla">
        🔄
      </button>
      <button class="pomo-btn" onclick="openPomodoroSettings()" title="Ayarlar">
        ⚙️
      </button>
    </div>
    <button class="pomo-expand" onclick="openPomodoroDashboard()">
      📊 Detaylar
    </button>
  `;
  
  document.body.appendChild(widget);
  updatePomodoroDisplay();
  
  // Global functions
  window.togglePomodoro = () => {
    if (pomoState.isRunning) {
      pausePomodoro();
    } else {
      startPomodoro();
    }
  };
  
  window.stopPomodoro = stopPomodoro;
  window.resetPomodoro = resetPomodoro;
  window.openPomodoroSettings = openPomodoroSettings;
  window.openPomodoroDashboard = openPomodoroDashboard;
}

function updatePomodoroDisplay() {
  const timer = document.getElementById('pomoTimer');
  const progress = document.getElementById('pomoProgress');
  
  if (timer) {
    timer.textContent = formatTimeDisplay(pomoState.timeLeft);
    timer.className = 'pomo-timer ' + pomoState.mode;
  }
  
  if (progress) {
    const total = getDurationForMode();
    const percent = ((total - pomoState.timeLeft) / total) * 100;
    progress.style.width = `${percent}%`;
  }
}

function updateWidgetState(state) {
  const btn = document.getElementById('pomoStartBtn');
  if (btn) {
    btn.innerHTML = state === 'running' ? '⏸️' : '▶️';
    btn.classList.toggle('active', state === 'running');
  }
}

// ═══════════════════════════════════════════════════════════════
// Focus Overlay
// ═══════════════════════════════════════════════════════════════

function showFocusOverlay() {
  // Remove existing
  document.getElementById('focusOverlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'focusOverlay';
  overlay.className = 'focus-overlay';
  
  overlay.innerHTML = `
    <div class="focus-content">
      <div class="focus-timer-large" id="focusTimerLarge">
        ${formatTimeDisplay(pomoState.timeLeft)}
      </div>
      <div class="focus-mode">${getModeEmoji()} ${getModeLabel()}</div>
      <div class="focus-session">Pomodoro #${pomoState.totalSessions + 1}</div>
      <div class="focus-quote">${getRandomQuote()}</div>
      <div class="focus-controls">
        <button class="focus-btn" onclick="togglePomodoro()">
          ${pomoState.isPaused ? '▶️ Devam' : '⏸️ Duraklat'}
        </button>
        <button class="focus-btn secondary" onclick="stopPomodoro()">⏹️ Bitir</button>
      </div>
    </div>
    <button class="focus-minimize" onclick="hideFocusOverlay()">_</button>
  `;
  
  document.body.appendChild(overlay);
  
  // Update timer
  const updateLargeTimer = setInterval(() => {
    const el = document.getElementById('focusTimerLarge');
    if (el && pomoState.isRunning) {
      el.textContent = formatTimeDisplay(pomoState.timeLeft);
    } else {
      clearInterval(updateLargeTimer);
    }
  }, 1000);
  
  window.hideFocusOverlay = () => {
    overlay.classList.add('minimized');
  };
}

function hideFocusOverlay() {
  document.getElementById('focusOverlay')?.remove();
}

function getRandomQuote() {
  const quotes = [
    'Odaklan, verimli ol! 🎯',
    'Bir adım daha yaklaşıyorsun! 💪',
    'Mükemmel iş çıkarıyorsun! ⭐',
    'Konsantrasyon gücüdür! 🧠',
    'Bugün harika bir gün! ☀️',
    'Kendine inan! 🌟',
    'Azimle çalış! 🔥'
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function celebrateCompletion() {
  // Confetti effect
  const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];
  
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        top: -10px;
        z-index: 99999;
        animation: confetti-fall 2s ease-out forwards;
      `;
      document.body.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 2000);
    }, i * 50);
  }
  
  // Add confetti animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes confetti-fall {
      to {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// Settings Modal
// ═══════════════════════════════════════════════════════════════

function openPomodoroSettings() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'pomoSettingsModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <div class="modal-title">⚙️ Pomodoro Ayarları</div>
        <button class="modal-close" onclick="closeModal('pomoSettingsModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Çalışma Süresi (dk)</label>
          <input type="number" class="form-input" id="settingWork" value="${pomoState.settings.workDuration}" min="1" max="60">
        </div>
        <div class="form-group">
          <label class="form-label">Kısa Mola (dk)</label>
          <input type="number" class="form-input" id="settingShortBreak" value="${pomoState.settings.shortBreakDuration}" min="1" max="30">
        </div>
        <div class="form-group">
          <label class="form-label">Uzun Mola (dk)</label>
          <input type="number" class="form-input" id="settingLongBreak" value="${pomoState.settings.longBreakDuration}" min="1" max="60">
        </div>
        <div class="form-group">
          <label class="form-label">Uzun Moladan Önce Seans</label>
          <input type="number" class="form-input" id="settingSessions" value="${pomoState.settings.sessionsBeforeLongBreak}" min="2" max="10">
        </div>
        <div class="form-check">
          <input type="checkbox" id="settingAutoBreaks" ${pomoState.settings.autoStartBreaks ? 'checked' : ''}>
          <label for="settingAutoBreaks">Molaları otomatik başlat</label>
        </div>
        <div class="form-check">
          <input type="checkbox" id="settingSound" ${pomoState.settings.soundEnabled ? 'checked' : ''}>
          <label for="settingSound">Ses bildirimleri</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('pomoSettingsModal')">İptal</button>
        <button class="btn btn-primary" onclick="savePomodoroSettings()">💾 Kaydet</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  window.savePomodoroSettings = () => {
    pomoState.settings = {
      workDuration: parseInt(document.getElementById('settingWork').value) || 25,
      shortBreakDuration: parseInt(document.getElementById('settingShortBreak').value) || 5,
      longBreakDuration: parseInt(document.getElementById('settingLongBreak').value) || 15,
      sessionsBeforeLongBreak: parseInt(document.getElementById('settingSessions').value) || 4,
      autoStartBreaks: document.getElementById('settingAutoBreaks').checked,
      autoStartPomodoros: false,
      soundEnabled: document.getElementById('settingSound').checked,
      notificationEnabled: true
    };
    
    // Reset timer with new settings
    setTimeForMode();
    updatePomodoroDisplay();
    
    savePomodoro();
    closeModal('pomoSettingsModal');
    document.getElementById('pomoSettingsModal')?.remove();
    
    toast('⚙️ Ayarlar kaydedildi', 'success');
  };
}

// ═══════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════

function openPomodoroDashboard() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'pomoDashboardModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 700px;">
      <div class="modal-header">
        <div class="modal-title">📊 Pomodoro İstatistikleri</div>
        <button class="modal-close" onclick="closeModal('pomoDashboardModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="pomo-stats-grid">
          <div class="pomo-stat-card">
            <div class="pomo-stat-value">${pomoState.todaySessions}</div>
            <div class="pomo-stat-label">Bugün</div>
          </div>
          <div class="pomo-stat-card">
            <div class="pomo-stat-value">${pomoState.completedSessions}</div>
            <div class="pomo-stat-label">Toplam</div>
          </div>
          <div class="pomo-stat-card">
            <div class="pomo-stat-value">${Math.floor(pomoState.stats.totalFocusTime / 60)}</div>
            <div class="pomo-stat-label">Dakika</div>
          </div>
          <div class="pomo-stat-card">
            <div class="pomo-stat-value">${pomoState.stats.streakDays}</div>
            <div class="pomo-stat-label">Gün Seri</div>
          </div>
        </div>
        
        <h4 style="margin: var(--space-lg) 0 var(--space-md);">📈 Haftalık İlerleme</h4>
        <div class="pomo-weekly-chart">
          ${renderWeeklyChart()}
        </div>
        
        <h4 style="margin: var(--space-lg) 0 var(--space-md);">🕐 Son Seanslar</h4>
        <div class="pomo-history">
          ${renderHistory()}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function renderWeeklyChart() {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const today = new Date().getDay();
  
  return days.map((day, index) => {
    // Get sessions for this day (simulated)
    const sessions = Math.floor(Math.random() * 8);
    const height = sessions * 10;
    
    return `
      <div class="weekly-day">
        <div class="weekly-bar" style="height: ${height}px;"></div>
        <span class="weekly-label">${day}</span>
      </div>
    `;
  }).join('');
}

function renderHistory() {
  if (!pomoState.history.length) {
    return '<p class="empty-text">Henüz kayıt yok</p>';
  }
  
  return pomoState.history.slice(-10).reverse().map(h => `
    <div class="history-item">
      <span class="history-mode">${h.mode === 'work' ? '🍅' : '☕'}</span>
      <span class="history-duration">${Math.floor(h.duration / 60)} dk</span>
      <span class="history-time">${new Date(h.timestamp).toLocaleTimeString('tr-TR')}</span>
      <span class="history-status ${h.completed ? 'completed' : 'cancelled'}">
        ${h.completed ? '✅' : '❌'}
      </span>
    </div>
  `).join('');
}

function addToHistory(session) {
  pomoState.history.push(session);
  if (pomoState.history.length > 100) {
    pomoState.history = pomoState.history.slice(-100);
  }
}

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadPomodoro() {
  const saved = getStorage(POMODORO_STORAGE_KEY, '{}');
  if (saved.settings) {
    pomoState.settings = { ...pomoState.settings, ...saved.settings };
    pomoState.stats = { ...pomoState.stats, ...saved.stats };
    pomoState.history = saved.history || [];
    pomoState.todaySessions = saved.todaySessions || 0;
    pomoState.totalSessions = saved.totalSessions || 0;
    pomoState.completedSessions = saved.completedSessions || 0;
  }
  
  // Reset daily stats if new day
  const today = new Date().toDateString();
  if (saved.lastActiveDate !== today) {
    pomoState.todaySessions = 0;
  }
  
  setTimeForMode();
}

function savePomodoro() {
  setStorage(POMODORO_STORAGE_KEY, {
    settings: pomoState.settings,
    stats: pomoState.stats,
    history: pomoState.history,
    todaySessions: pomoState.todaySessions,
    totalSessions: pomoState.totalSessions,
    completedSessions: pomoState.completedSessions,
    lastActiveDate: new Date().toDateString()
  });
}

// Export
export function getPomodoroStats() {
  return {
    today: pomoState.todaySessions,
    total: pomoState.completedSessions,
    focusTime: pomoState.stats.totalFocusTime,
    streak: pomoState.stats.streakDays
  };
}
