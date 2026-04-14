/* ═══════════════════════════════════════════════════════════════
   UI - UI Helpers, Toast, Modal Operations
═══════════════════════════════════════════════════════════════ */

import { escHtml } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// Toast Notifications
// ═══════════════════════════════════════════════════════════════

export function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  
  toastEl.innerHTML = `
    <span style="font-size:1.1rem">${icon}</span>
    <span>${escHtml(message)}</span>
  `;
  
  container.appendChild(toastEl);
  
  // Auto remove
  setTimeout(() => {
    toastEl.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
// Modal Operations
// ═══════════════════════════════════════════════════════════════

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('open');
  });
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════
// Tab Switching
// ═══════════════════════════════════════════════════════════════

export function switchMainTab(tab) {
  const views = ['vault', 'tasks', 'kanban', 'voice'];
  const tabMap = {
    vault: 'active',
    tasks: 'active-green',
    kanban: 'active-amber',
    voice: 'active-red'
  };
  
  // Hide all views
  views.forEach(view => {
    const el = document.getElementById(`${view}View`);
    const btn = document.getElementById(`${view}Tab`);
    
    if (el) {
      el.style.display = 'none';
      el.classList.remove('visible');
    }
    if (btn) {
      btn.className = 'main-tab';
    }
  });
  
  // Show selected view
  const selectedView = document.getElementById(`${tab}View`);
  const selectedTab = document.getElementById(`${tab}Tab`);
  
  if (selectedView) {
    selectedView.style.display = tab === 'vault' ? '' : 'flex';
    selectedView.classList.add('visible');
  }
  
  if (selectedTab) {
    selectedTab.className = `main-tab ${tabMap[tab] || ''}`;
  }
  
  return tab;
}

// ═══════════════════════════════════════════════════════════════
// View Toggle
// ═══════════════════════════════════════════════════════════════

export function setView(view) {
  const gridBtn = document.getElementById('gridViewBtn');
  const listBtn = document.getElementById('listViewBtn');
  const cardsGrid = document.getElementById('cardsGrid');
  
  if (gridBtn) gridBtn.classList.toggle('active', view === 'grid');
  if (listBtn) listBtn.classList.toggle('active', view === 'list');
  if (cardsGrid) cardsGrid.className = `cards-grid${view === 'list' ? ' list-view' : ''}`;
  
  return view;
}

// ═══════════════════════════════════════════════════════════════
// Loading States
// ═══════════════════════════════════════════════════════════════

export function showLoading(elementId, message = 'Yükleniyor...') {
  const el = document.getElementById(elementId);
  if (el) {
    el.dataset.originalContent = el.innerHTML;
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px">
        <div class="ai-spinner-ring"></div>
        <span style="font-size:0.8rem;color:var(--text-muted)">${escHtml(message)}</span>
      </div>
    `;
  }
}

export function hideLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el && el.dataset.originalContent) {
    el.innerHTML = el.dataset.originalContent;
    delete el.dataset.originalContent;
  }
}

// ═══════════════════════════════════════════════════════════════
// Form Helpers
// ═══════════════════════════════════════════════════════════════

export function getFormValue(inputId, defaultValue = '') {
  const el = document.getElementById(inputId);
  return el ? el.value.trim() : defaultValue;
}

export function setFormValue(inputId, value) {
  const el = document.getElementById(inputId);
  if (el) el.value = value;
}

export function clearForm(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.querySelectorAll('input, textarea, select').forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });
  }
}

export function updateCharCounter(textareaId, counterId, maxLength = null) {
  const textarea = document.getElementById(textareaId);
  const counter = document.getElementById(counterId);
  
  if (textarea && counter) {
    const len = textarea.value.length;
    counter.textContent = maxLength ? `${len}/${maxLength}` : `${len} karakter`;
    
    if (maxLength && len > maxLength) {
      counter.style.color = 'var(--red)';
    } else {
      counter.style.color = 'var(--text-muted)';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Tag Input Management
// ═══════════════════════════════════════════════════════════════

export function initTagInput(inputId, listId, tagsArray, onChange) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  
  if (!input || !list) return;
  
  function renderTags() {
    list.innerHTML = tagsArray.map(tag => `
      <span class="tag-item">
        ${escHtml(tag)}
        <button type="button" class="tag-remove" data-tag="${escHtml(tag)}">×</button>
      </span>
    `).join('');
    
    // Add remove handlers
    list.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        const index = tagsArray.indexOf(tag);
        if (index > -1) {
          tagsArray.splice(index, 1);
          renderTags();
          if (onChange) onChange(tagsArray);
        }
      });
    });
  }
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.value.trim();
      if (value && !tagsArray.includes(value)) {
        tagsArray.push(value);
        input.value = '';
        renderTags();
        if (onChange) onChange(tagsArray);
      }
    } else if (e.key === 'Backspace' && !input.value && tagsArray.length) {
      tagsArray.pop();
      renderTags();
      if (onChange) onChange(tagsArray);
    }
  });
  
  renderTags();
  
  return {
    render: renderTags,
    clear: () => {
      tagsArray.length = 0;
      renderTags();
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// Animation Helpers
// ═══════════════════════════════════════════════════════════════

export function animateValue(elementId, from, to, duration = 500, suffix = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (to - from) * easeProgress);
    
    el.textContent = current + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

export function highlightElement(elementId, duration = 1000) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.transition = 'background-color 0.3s';
    el.style.backgroundColor = 'var(--accent-dim)';
    
    setTimeout(() => {
      el.style.backgroundColor = '';
    }, duration);
  }
}

// ═══════════════════════════════════════════════════════════════
// Confirmation Dialog
// ═══════════════════════════════════════════════════════════════

export function confirmAction(message, onConfirm, onCancel = null) {
  const modal = document.getElementById('confirmModal');
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  const textEl = modal?.querySelector('.confirm-text');
  
  if (textEl) {
    textEl.textContent = message;
  }
  
  // Remove old listeners
  const newBtn = confirmBtn?.cloneNode(true);
  if (confirmBtn && newBtn) {
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', () => {
      closeModal('confirmModal');
      if (onConfirm) onConfirm();
    });
  }
  
  openModal('confirmModal');
}

// ═══════════════════════════════════════════════════════════════
// Scroll Helpers
// ═══════════════════════════════════════════════════════════════

export function scrollToElement(elementId, behavior = 'smooth') {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior, block: 'center' });
  }
}

export function scrollToTop(containerId) {
  const el = document.getElementById(containerId);
  if (el) {
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
