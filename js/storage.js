/* ═══════════════════════════════════════════════════════════════
   Storage - localStorage Operations
═══════════════════════════════════════════════════════════════ */

import { STORAGE_KEYS } from './config.js';

/**
 * Generic get from localStorage
 */
export function getStorage(key, defaultValue = '[]') {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : JSON.parse(defaultValue);
  } catch (err) {
    console.error(`Error reading ${key}:`, err);
    return JSON.parse(defaultValue);
  }
}

/**
 * Generic set to localStorage
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Error saving ${key}:`, err);
    return false;
  }
}

/**
 * Get vault items
 */
export function getItems() {
  return getStorage(STORAGE_KEYS.ITEMS, '[]');
}

/**
 * Save vault items
 */
export function saveItems(items) {
  return setStorage(STORAGE_KEYS.ITEMS, items);
}

/**
 * Get tasks
 */
export function getTasks() {
  return getStorage(STORAGE_KEYS.TASKS, '[]');
}

/**
 * Save tasks
 */
export function saveTasks(tasks) {
  return setStorage(STORAGE_KEYS.TASKS, tasks);
}

/**
 * Get voice history
 */
export function getVoiceHistory() {
  return getStorage(STORAGE_KEYS.VOICE_HISTORY, '[]');
}

/**
 * Save voice history
 */
export function saveVoiceHistory(history) {
  return setStorage(STORAGE_KEYS.VOICE_HISTORY, history);
}

/**
 * Get Groq API key
 */
export function getGroqKey() {
  return localStorage.getItem(STORAGE_KEYS.GROQ_KEY) || '';
}

/**
 * Save Groq API key
 */
export function saveGroqKey(key) {
  localStorage.setItem(STORAGE_KEYS.GROQ_KEY, key);
}

/**
 * Get total copies count
 */
export function getCopiesCount() {
  return parseInt(localStorage.getItem(STORAGE_KEYS.COPIES) || '0', 10);
}

/**
 * Increment copies count
 */
export function incrementCopies() {
  const current = getCopiesCount();
  localStorage.setItem(STORAGE_KEYS.COPIES, (current + 1).toString());
  return current + 1;
}

/**
 * Export all data
 */
export function exportAllData() {
  return {
    items: getItems(),
    tasks: getTasks(),
    voiceHistory: getVoiceHistory(),
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
}

/**
 * Import data (merge with existing)
 */
export function importData(data) {
  if (!data) return false;
  
  try {
    // Merge items
    if (data.items && Array.isArray(data.items)) {
      const existing = getItems();
      const merged = [...existing];
      
      data.items.forEach(newItem => {
        const existingIndex = merged.findIndex(i => i.id === newItem.id);
        if (existingIndex >= 0) {
          // Update if newer
          if (newItem.updatedAt > merged[existingIndex].updatedAt) {
            merged[existingIndex] = newItem;
          }
        } else {
          merged.push(newItem);
        }
      });
      
      saveItems(merged);
    }
    
    // Merge tasks
    if (data.tasks && Array.isArray(data.tasks)) {
      const existing = getTasks();
      const merged = [...existing];
      
      data.tasks.forEach(newTask => {
        const existingIndex = merged.findIndex(t => t.id === newTask.id);
        if (existingIndex >= 0) {
          if (newTask.updatedAt > merged[existingIndex].updatedAt) {
            merged[existingIndex] = newTask;
          }
        } else {
          merged.push(newTask);
        }
      });
      
      saveTasks(merged);
    }
    
    // Merge voice history
    if (data.voiceHistory && Array.isArray(data.voiceHistory)) {
      const existing = getVoiceHistory();
      const merged = [...existing, ...data.voiceHistory];
      // Sort by date and limit
      merged.sort((a, b) => b.createdAt - a.createdAt);
      saveVoiceHistory(merged.slice(0, 50));
    }
    
    return true;
  } catch (err) {
    console.error('Import error:', err);
    return false;
  }
}

/**
 * Clear all data
 */
export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Check storage quota
 */
export function checkStorage() {
  try {
    const used = new Blob(Object.values(localStorage)).size;
    const limit = 5 * 1024 * 1024; // 5MB typical limit
    return {
      used,
      limit,
      percentage: (used / limit) * 100,
      available: limit - used
    };
  } catch {
    return { used: 0, limit: 0, percentage: 0, available: 0 };
  }
}
