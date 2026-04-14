/* ═══════════════════════════════════════════════════════════════
   App - Main Application Entry Point
═══════════════════════════════════════════════════════════════ */

import { initState, state, setMainTab, setView, setFilter, setTagFilter } from './state.js';
import { initVoiceView, saveGroqApiKey, setMode, setOutput } from './voice.js';
import { renderCards, renderSidebarTags, openAddModal, openEditModal, saveVaultItem, confirmDeleteItem, copyItem, toggleFavorite, openDetail } from './vault.js';
import { renderTasksView, openAddTaskModal, saveTask, quickAddTask, selectDay, showUrgentTasks } from './tasks.js';
import { renderKanban } from './kanban.js';
import { initTeam, renderTeamSection, renderWorkspaceSwitcher, logActivity } from './team.js';
import { initPluginSystem, renderPluginSection, showProUpgrade } from './plugins.js';
import { initProTimeline, renderProTimeline } from './protimeline.js';
import { initProjects, renderProjectsList, renderProjectDetail, renderSprints, openCreateProjectModal } from './projects.js';
import { initFiles, renderFiles, openUploadModal, openNewFolderModal } from './files.js';
import { initCalendar, renderCalendar, openCreateEventModal } from './calendar.js';
import { initReports, renderReports, generateOverviewReport } from './reports.js';
import { initPlugin, stopPlugin, isPluginRunning, PLUGIN_REGISTRY } from './plugins-full.js';
import { saveItems, saveTasks, exportAllData, importData, getGroqKey, saveGroqKey } from './storage.js';
import { todayStr, escHtml } from './utils.js';
import { toast, openModal, closeModal, switchMainTab, confirmAction, setView as setViewUI } from './ui.js';

// ═══════════════════════════════════════════════════════════════
// Initialize Application
// ═══════════════════════════════════════════════════════════════

function init() {
  // Load state from storage
  initState();
  
  // Initialize Core features
  initTeam();
  initPluginSystem();
  initProTimeline();
  
  // Initialize New Modules
  initProjects();
  initFiles();
  initCalendar();
  initReports();
  
  // Initialize Enhanced Plugins
  initEnhancedPlugins();
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initial render
  renderAll();
  
  // Show welcome message
  console.log('🚀 DevVault Pro v3.0 initialized');
  console.log('⭐ Tüm modüller aktif: Projects, Files, Calendar, Reports');
  console.log('🔌 Tam fonksiyonel eklentiler: Time Tracker, Focus Mode, Code Snippets, AI Assistant');
  
  // Check for first visit
  if (!state.items.length && !state.tasks.length) {
    setTimeout(() => {
      toast('👋 Hoş geldin! Yeni kayıt eklemek için + Kayıt butonunu kullan.', 'info', 5000);
    }, 1000);
  }
  
  // Log team activity
  logActivity('DevVault Pro v3.0 başlatıldı');
}

// Initialize enhanced plugins with full functionality
function initEnhancedPlugins() {
  // Get enabled plugins from storage
  const enabledPlugins = JSON.parse(localStorage.getItem('devvault_plugins_enabled') || '[]');
  
  enabledPlugins.forEach(({ id, config }) => {
    if (PLUGIN_REGISTRY[id]) {
      initPlugin(id, config);
      console.log(`[Plugins] ${id} initialized`);
    }
  });
  
  // Always init code snippets (free feature)
  if (!enabledPlugins.find(p => p.id === 'code-snippets')) {
    initPlugin('code-snippets', { languages: ['javascript', 'python', 'css', 'sql', 'typescript'] });
  }
}

// ═══════════════════════════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════════════════════════

function renderAll() {
  updateBadges();
  updateStats();
  updateSidebarProgress();
  renderSidebarTags();
  renderCards();
  
  // Render Pro features
  renderTeamSection();
  renderWorkspaceSwitcher();
  renderPluginSection();
  renderProTimeline();
  
  // Render New Modules
  renderProjectsList();
  renderFiles();
  renderCalendar();
  renderReports();
  
  // Render active view
  if (state.currentMainTab === 'tasks') {
    renderTasksView();
  } else if (state.currentMainTab === 'kanban') {
    renderKanban();
  } else if (state.currentMainTab === 'voice') {
    initVoiceView();
  } else if (state.currentMainTab === 'projects') {
    renderProjectDetail();
  }
}

function updateBadges() {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  
  const badges = {
    'badge-all': state.items.length,
    'badge-project': state.items.filter(i => i.type === 'project').length,
    'badge-instruction': state.items.filter(i => i.type === 'instruction').length,
    'badge-code': state.items.filter(i => i.type === 'code').length,
    'badge-favorites': state.items.filter(i => i.favorite).length,
    'badge-recent': state.items.filter(i => (now - i.createdAt) < week).length,
    'badge-tasks': state.tasks.filter(t => t.status !== 'done' && !t.completed).length,
    'badge-kanban-progress': state.tasks.filter(t => t.status === 'inprogress').length,
    'badge-urgent': state.tasks.filter(t => 
      ['critical', 'high'].includes(t.priority) && t.status !== 'done' && !t.completed
    ).length
  };
  
  Object.entries(badges).forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
}

function updateStats() {
  const stats = {
    'stat-projects': state.items.filter(i => i.type === 'project').length,
    'stat-instructions': state.items.filter(i => i.type === 'instruction').length,
    'stat-codes': state.items.filter(i => i.type === 'code').length,
    'stat-copies': state.totalCopies,
    'stat-done': state.tasks.filter(t => t.status === 'done' || t.completed).length
  };
  
  Object.entries(stats).forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
}

function updateSidebarProgress() {
  const todayTasks = state.tasks.filter(t => t.date === todayStr());
  const done = todayTasks.filter(t => t.status === 'done' || t.completed).length;
  const pct = todayTasks.length ? Math.round((done / todayTasks.length) * 100) : 0;
  
  const pctEl = document.getElementById('progressPct');
  const fill = document.getElementById('progressFill');
  
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (fill) fill.style.width = `${pct}%`;
}

// ═══════════════════════════════════════════════════════════════
// Tab Switching
// ═══════════════════════════════════════════════════════════════

function switchTab(tab) {
  setMainTab(tab);
  switchMainTab(tab);
  
  if (tab === 'tasks') {
    renderTasksView();
  } else if (tab === 'kanban') {
    renderKanban();
  } else if (tab === 'voice') {
    initVoiceView();
  }
}

// ═══════════════════════════════════════════════════════════════
// Search & Filter
// ═══════════════════════════════════════════════════════════════

function handleSearch() {
  const query = document.getElementById('searchInput')?.value || '';
  renderCards(query);
}

function handleFilter(filter) {
  setFilter(filter);
  renderCards();
  updateBadges();
  
  // Update active nav item
  document.querySelectorAll('.nav-item[data-filter]').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === filter);
  });
}

function handleTagFilter(tag) {
  setTagFilter(tag);
  renderCards();
  renderSidebarTags();
}

function handleSort() {
  renderCards();
}

function setView(view) {
  state.currentView = view;
  setViewUI(view);
  renderCards();
}

// ═══════════════════════════════════════════════════════════════
// Import/Export
// ═══════════════════════════════════════════════════════════════

function exportData() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `devvault-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
  toast('Veriler dışa aktarıldı 📤', 'success');
}

function openImportModal() {
  openModal('importModal');
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const success = importData(data);
      
      if (success) {
        // Reload state
        initState();
        renderAll();
        toast('Veriler içe aktarıldı 📥', 'success');
        closeModal('importModal');
      } else {
        toast('İçe aktarma başarısız', 'error');
      }
    } catch (err) {
      console.error('Import error:', err);
      toast('Geçersiz dosya formatı', 'error');
    }
  };
  reader.readAsText(file);
  
  // Reset input
  event.target.value = '';
}

// ═══════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ═══════════════════════════════════════════════════════════════

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K - Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
    
    // Ctrl/Cmd + N - New record
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openAddModal('project');
    }
    
    // Escape - Close modals
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay.open');
      if (openModal) {
        closeModal(openModal.id);
      }
    }
    
    // Tab switching with numbers
    if (e.altKey) {
      switch (e.key) {
        case '1': e.preventDefault(); switchTab('vault'); break;
        case '2': e.preventDefault(); switchTab('tasks'); break;
        case '3': e.preventDefault(); switchTab('kanban'); break;
        case '4': e.preventDefault(); switchTab('voice'); break;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════════════════════════

function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  // Sort select
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSort);
  }
  
  // File drop zone
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent)';
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '';
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            importData(data);
            initState();
            renderAll();
            toast('Veriler içe aktarıldı 📥', 'success');
          } catch {
            toast('Geçersiz dosya formatı', 'error');
          }
        };
        reader.readAsText(file);
      }
    });
  }
  
  // Content char counter
  const itemContent = document.getElementById('itemContent');
  if (itemContent) {
    itemContent.addEventListener('input', () => {
      const counter = document.getElementById('charCounter');
      if (counter) {
        counter.textContent = `${itemContent.value.length} karakter`;
      }
    });
  }
  
  // Quick task input
  const quickTaskInput = document.getElementById('quickTaskInput');
  if (quickTaskInput) {
    quickTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        quickAddTask();
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

// Make functions globally accessible for onclick handlers
window.switchMainTab = switchTab;
window.setFilter = handleFilter;
window.setTagFilter = handleTagFilter;
window.setView = setView;
window.openAddModal = openAddModal;
window.openAddTaskModal = openAddTaskModal;
window.openImportModal = openImportModal;
window.exportData = exportData;
window.handleFileImport = handleFileImport;
window.saveItem = saveVaultItem;
window.saveTask = saveTask;
window.quickAddTask = quickAddTask;
window.selectDay = selectDay;
window.showUrgentTasks = showUrgentTasks;
window.closeModal = closeModal;

// Vault functions
window.openDetail = openDetail;
window.editItem = openEditModal;
window.confirmDelete = confirmDeleteItem;
window.copyItem = copyItem;
window.toggleFavorite = toggleFavorite;
window.selectType = (type) => {
  state.currentType = type;
  document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active-project', 'active-instruction', 'active-code'));
  document.getElementById(`tab-${type}`)?.classList.add(`active-${type}`);
  document.getElementById('langGroup').style.display = type === 'code' ? 'block' : 'none';
};

window.selectLang = (lang) => {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === lang);
  });
  document.getElementById('customLang').value = '';
};

// Tag management
window.removeTag = (tag) => {
  const idx = state.currentTags.indexOf(tag);
  if (idx > -1) {
    state.currentTags.splice(idx, 1);
    document.getElementById('tagsList').innerHTML = state.currentTags.map(t => `
      <span class="tag-item">${escHtml(t)} <button class="tag-remove" onclick="window.removeTag('${escHtml(t)}')">×</button></span>
    `).join('');
  }
};

// Task functions
window.selectPriority = (p) => {
  state.currentPriority = p;
  document.querySelectorAll('.priority-opt').forEach(opt => {
    opt.className = 'priority-opt';
    if (opt.dataset.p === p) opt.classList.add(`selected-${p}`);
  });
};

window.selectStatus = (s) => {
  state.currentStatus = s;
  document.querySelectorAll('.status-opt').forEach(opt => {
    opt.className = 'status-opt';
    if (opt.dataset.s === s) opt.classList.add(`selected-${s}`);
  });
};

window.addSubtask = () => {
  const input = document.getElementById('subtaskInput');
  const value = input?.value.trim();
  if (value) {
    state.currentSubtasks.push({ title: value, done: false });
    input.value = '';
    document.getElementById('subtaskList').innerHTML = state.currentSubtasks.map((st, idx) => `
      <div class="subtask-item">
        <input type="checkbox" ${st.done ? 'checked' : ''} onchange="window.toggleSubtask(${idx})">
        <span class="subtask-title ${st.done ? 'done' : ''}">${escHtml(st.title)}</span>
        <button onclick="window.removeSubtask(${idx})">×</button>
      </div>
    `).join('');
  }
};

window.toggleSubtask = (idx) => {
  if (state.currentSubtasks[idx]) {
    state.currentSubtasks[idx].done = !state.currentSubtasks[idx].done;
  }
};

window.removeSubtask = (idx) => {
  state.currentSubtasks.splice(idx, 1);
};

// Tag input handlers
const tagInput = document.getElementById('tagInput');
if (tagInput) {
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = e.target.value.trim();
      if (value && !state.currentTags.includes(value)) {
        state.currentTags.push(value);
        e.target.value = '';
        document.getElementById('tagsList').innerHTML = state.currentTags.map(t => `
          <span class="tag-item">${escHtml(t)} <button class="tag-remove" onclick="window.removeTag('${escHtml(t)}')">×</button></span>
        `).join('');
      }
    }
  });
}

// Task tag input
const taskTagInput = document.getElementById('taskTagInput');
if (taskTagInput) {
  taskTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = e.target.value.trim();
      if (value && !state.currentTaskTags.includes(value)) {
        state.currentTaskTags.push(value);
        e.target.value = '';
        document.getElementById('taskTagsList').innerHTML = state.currentTaskTags.map(t => `
          <span class="tag-item">${escHtml(t)} <button class="tag-remove" onclick="window.removeTaskTag('${escHtml(t)}')">×</button></span>
        `).join('');
      }
    }
  });
}

window.removeTaskTag = (tag) => {
  const idx = state.currentTaskTags.indexOf(tag);
  if (idx > -1) {
    state.currentTaskTags.splice(idx, 1);
    document.getElementById('taskTagsList').innerHTML = state.currentTaskTags.map(t => `
      <span class="tag-item">${escHtml(t)} <button class="tag-remove" onclick="window.removeTaskTag('${escHtml(t)}')">×</button></span>
    `).join('');
  }
};

// ═══════════════════════════════════════════════════════════════
// Pro Feature Globals
// ═══════════════════════════════════════════════════════════════

window.showProUpgrade = showProUpgrade;
window.togglePlugin = (id) => {
  // Handled by plugins.js
};
window.isPluginEnabled = (id) => {
  // Handled by plugins.js
};

// ═══════════════════════════════════════════════════════════════
// Start Application
// ═══════════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
