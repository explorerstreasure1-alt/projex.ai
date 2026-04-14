/* ═══════════════════════════════════════════════════════════════
   Utils - Helper Functions
═══════════════════════════════════════════════════════════════ */

/**
 * Generate unique ID
 */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Escape HTML to prevent XSS
 */
export function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format timestamp to date string (Turkish)
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format timestamp to full date string
 */
export function formatDateFull(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format seconds to MM:SS
 */
export function fmtSecs(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Highlight search query in text
 */
export function highlightText(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<span class="highlight-match">$1</span>');
}

/**
 * Extract title from markdown text
 */
export function extractTitle(text) {
  if (!text) return null;
  const match = text.match(/^#+\s+(.{5,60})/m) || text.match(/^(.{10,60})/m);
  return match ? match[1].replace(/[#*`]/g, '').trim().slice(0, 60) : null;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
  if (!inThrottle) {
    func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get week start date
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Group array by key
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Sort by priority
 */
export function sortByPriority(a, b, priorityKey = 'priority') {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
  return priorityOrder[a[priorityKey]] - priorityOrder[b[priorityKey]];
}

/**
 * Count words in text
 */
export function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w).length;
}

/**
 * Truncate text
 */
export function truncate(text, maxLength = 100, suffix = '…') {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + suffix;
}

/**
 * Slugify text
 */
export function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

/**
 * Parse duration string to minutes
 */
export function parseDuration(str) {
  if (!str) return 0;
  const hours = str.match(/(\d+)\s*saat/i);
  const mins = str.match(/(\d+)\s*dk/i);
  return (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0);
}
