/* ═══════════════════════════════════════════════════════════════
   State - Application State Management
═══════════════════════════════════════════════════════════════ */

import { getItems, getTasks, getVoiceHistory, getGroqKey, getCopiesCount } from './storage.js';
import { todayStr } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// Application State
// ═══════════════════════════════════════════════════════════════

export const state = {
  // Data
  items: [],
  tasks: [],
  voiceHistory: [],
  
  // Filters & View State
  activeFilter: 'all',
  activeTagFilter: null,
  currentView: 'grid',
  currentMainTab: 'vault',
  urgentMode: false,
  selectedDay: todayStr(),
  
  // Edit State
  currentEditId: null,
  currentDetailId: null,
  currentTaskId: null,
  
  // Form State
  currentType: 'project',
  currentTags: [],
  currentTaskTags: [],
  currentPriority: 'medium',
  currentStatus: 'todo',
  currentSubtasks: [],
  
  // Voice State
  voiceMode: 'new',
  outputType: 'project',
  isRecording: false,
  isPaused: false,
  recordSeconds: 0,
  groqApiKey: '',
  currentAiResult: '',
  transcriptEditMode: false,
  finalTranscript: '',
  interimTranscript: '',
  
  // Stats
  totalCopies: 0,
  
  // Media (not persisted)
  mediaRecorder: null,
  audioChunks: [],
  recognition: null,
  audioContext: null,
  analyser: null,
  animFrameId: null,
  recordTimer: null
};

// ═══════════════════════════════════════════════════════════════
// Initialize State
// ═══════════════════════════════════════════════════════════════

export function initState() {
  state.items = getItems();
  state.tasks = getTasks();
  state.voiceHistory = getVoiceHistory();
  state.groqApiKey = getGroqKey();
  state.totalCopies = getCopiesCount();
  state.selectedDay = todayStr();
}

// ═══════════════════════════════════════════════════════════════
// State Getters
// ═══════════════════════════════════════════════════════════════

export function getItemById(id) {
  return state.items.find(i => i.id === id);
}

export function getTaskById(id) {
  return state.tasks.find(t => t.id === id);
}

export function getVoiceHistoryEntry(id) {
  return state.voiceHistory.find(h => h.id === id);
}

export function getTasksForProject(projectId) {
  return state.tasks.filter(t => t.projectId === projectId);
}

export function getTasksForDate(date) {
  return state.tasks.filter(t => t.date === date);
}

export function getAllTags() {
  const tags = {};
  state.items.forEach(item => {
    (item.tags || []).forEach(tag => {
      tags[tag] = (tags[tag] || 0) + 1;
    });
  });
  return Object.entries(tags).sort((a, b) => b[1] - a[1]);
}

export function getProjects() {
  return state.items.filter(i => i.type === 'project');
}

// ═══════════════════════════════════════════════════════════════
// State Setters
// ═══════════════════════════════════════════════════════════════

export function setFilter(filter) {
  state.activeFilter = filter;
}

export function setTagFilter(tag) {
  state.activeTagFilter = tag === state.activeTagFilter ? null : tag;
}

export function setView(view) {
  state.currentView = view;
}

export function setMainTab(tab) {
  state.currentMainTab = tab;
  state.urgentMode = false;
}

export function setSelectedDay(day) {
  state.selectedDay = day;
}

export function setVoiceMode(mode) {
  state.voiceMode = mode;
}

export function setOutputType(type) {
  state.outputType = type;
}

export function setRecording(recording) {
  state.isRecording = recording;
}

export function setPaused(paused) {
  state.isPaused = paused;
}

export function setType(type) {
  state.currentType = type;
}

export function setEditId(id) {
  state.currentEditId = id;
}

export function setDetailId(id) {
  state.currentDetailId = id;
}

export function setTaskId(id) {
  state.currentTaskId = id;
}

// ═══════════════════════════════════════════════════════════════
// Data Mutations
// ═══════════════════════════════════════════════════════════════

export function addItem(item) {
  state.items.unshift(item);
}

export function updateItem(id, updates) {
  const index = state.items.findIndex(i => i.id === id);
  if (index >= 0) {
    state.items[index] = { ...state.items[index], ...updates, updatedAt: Date.now() };
    return true;
  }
  return false;
}

export function deleteItem(id) {
  const index = state.items.findIndex(i => i.id === id);
  if (index >= 0) {
    state.items.splice(index, 1);
    // Delete associated tasks
    state.tasks = state.tasks.filter(t => t.projectId !== id);
    return true;
  }
  return false;
}

export function addTask(task) {
  state.tasks.unshift(task);
}

export function updateTask(id, updates) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index >= 0) {
    state.tasks[index] = { ...state.tasks[index], ...updates, updatedAt: Date.now() };
    return true;
  }
  return false;
}

export function deleteTask(id) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index >= 0) {
    state.tasks.splice(index, 1);
    return true;
  }
  return false;
}

export function addVoiceHistory(entry) {
  state.voiceHistory.unshift(entry);
  if (state.voiceHistory.length > 50) {
    state.voiceHistory.pop();
  }
}

export function clearVoiceHistory() {
  state.voiceHistory = [];
}

// ═══════════════════════════════════════════════════════════════
// Filter Logic
// ═══════════════════════════════════════════════════════════════

export function getFilteredItems(query = '') {
  const q = query.toLowerCase().trim();
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  
  let filtered = [...state.items];
  
  // Apply type filter
  if (state.activeFilter === 'favorites') {
    filtered = filtered.filter(i => i.favorite);
  } else if (state.activeFilter === 'recent') {
    filtered = filtered.filter(i => (now - i.createdAt) < week);
  } else if (state.activeFilter !== 'all') {
    filtered = filtered.filter(i => i.type === state.activeFilter);
  }
  
  // Apply tag filter
  if (state.activeTagFilter) {
    filtered = filtered.filter(i => (i.tags || []).includes(state.activeTagFilter));
  }
  
  // Apply search query
  if (q) {
    filtered = filtered.filter(i => 
      i.title.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q) ||
      (i.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  
  return filtered;
}

export function getUrgentTasks() {
  return state.tasks.filter(t => 
    ['critical', 'high'].includes(t.priority) &&
    t.status !== 'done' &&
    !t.completed
  );
}

// ═══════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════

export function getStats() {
  const today = todayStr();
  const todayTasks = state.tasks.filter(t => t.date === today);
  const doneToday = todayTasks.filter(t => t.status === 'done' || t.completed);
  
  return {
    vault: {
      total: state.items.length,
      projects: state.items.filter(i => i.type === 'project').length,
      instructions: state.items.filter(i => i.type === 'instruction').length,
      codes: state.items.filter(i => i.type === 'code').length,
      favorites: state.items.filter(i => i.favorite).length
    },
    tasks: {
      total: state.tasks.length,
      today: todayTasks.length,
      doneToday: doneToday.length,
      urgent: getUrgentTasks().length,
      inProgress: state.tasks.filter(t => t.status === 'inprogress').length,
      completed: state.tasks.filter(t => t.status === 'done' || t.completed).length
    },
    progress: todayTasks.length ? Math.round((doneToday.length / todayTasks.length) * 100) : 0
  };
}
