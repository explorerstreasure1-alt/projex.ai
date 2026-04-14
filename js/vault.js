/* ═══════════════════════════════════════════════════════════════
   Vault Module - Projects, Instructions, Code Snippets
═══════════════════════════════════════════════════════════════ */

import { state, addItem, updateItem, deleteItem, getFilteredItems, setFilter, setTagFilter } from './state.js';
import { saveItems, incrementCopies } from './storage.js';
import { genId, escHtml, formatDate, highlightText, copyToClipboard } from './utils.js';
import { toast, confirmAction, openModal, closeModal } from './ui.js';

// ═══════════════════════════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════════════════════════

export function renderCards(query = '') {
  const filtered = getFilteredItems(query);
  const grid = document.getElementById('cardsGrid');
  const resultInfo = document.getElementById('resultInfo');
  const sectionTitle = document.getElementById('sectionTitle');
  
  // Update result info
  if (resultInfo) {
    if (query || state.activeTagFilter) {
      resultInfo.style.display = '';
      resultInfo.textContent = `${filtered.length} sonuç`;
    } else {
      resultInfo.style.display = 'none';
    }
  }
  
  // Update section title
  if (sectionTitle) {
    const titles = {
      all: 'Tüm Kayıtlar',
      project: 'Projeler',
      instruction: 'AI Talimatları',
      code: 'Kod Parçacıkları',
      favorites: 'Favoriler',
      recent: 'Son 7 Gün'
    };
    sectionTitle.textContent = titles[state.activeFilter] || 'Kayıtlar';
  }
  
  // Render grid
  if (!grid) return;
  
  if (!filtered.length) {
    const icon = query ? '🔍' : '📭';
    const title = query ? 'Sonuç bulunamadı' : 'Henüz kayıt yok';
    const sub = query ? `"${escHtml(query)}" için sonuç yok.` : 'Yeni kayıt eklemek için + Kayıt butonunu kullanın.';
    
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-sub">${sub}</div>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(item => renderCard(item, query)).join('');
}

export function renderCard(item, query = '') {
  const typeIcon = item.type === 'project' ? '📁' : 
                   item.type === 'instruction' ? '🤖' : '💻';
  const date = formatDate(item.updatedAt || item.createdAt);
  const preview = query ? 
    highlightText(escHtml(item.content.slice(0, 200)), query) : 
    escHtml(item.content.slice(0, 200));
  const isCode = item.type === 'code';
  
  // Task progress bar for projects
  let taskBar = '';
  if (item.type === 'project') {
    const projectTasks = state.tasks.filter(t => t.projectId === item.id);
    if (projectTasks.length) {
      const done = projectTasks.filter(t => t.status === 'done' || t.completed).length;
      const pct = Math.round((done / projectTasks.length) * 100);
      taskBar = `
        <div class="card-task-bar">
          <div class="card-task-bar-inner">
            <div class="card-task-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="card-task-bar-text">${done}/${projectTasks.length} görev</span>
        </div>
      `;
    }
  }
  
  // Tags
  const tags = (item.tags || []).slice(0, 3).map(t => 
    `<span class="tag">${escHtml(t)}</span>`
  ).join('');
  
  // Language badge for code
  const langBadge = isCode && item.language ? 
    `<span class="tag" style="background:var(--amber-dim);color:var(--amber)">${escHtml(item.language)}</span>` : '';
  
  // AI badge
  const aiBadge = item.aiGenerated ? 
    `<span class="ai-badge">🎙️ AI</span>` : '';
  
  // Title with highlight
  const title = query ? 
    highlightText(escHtml(item.title), query) : 
    escHtml(item.title);
  
  return `
    <div class="card type-${item.type} ${item.favorite ? 'favorited' : ''}" 
         onclick="window.openDetail('${item.id}')">
      <div class="card-header">
        <div class="card-type-badge">${typeIcon}</div>
        <div class="card-title-wrap">
          <div class="card-title" title="${escHtml(item.title)}">${title}</div>
          <div class="card-meta">${date}${item.language ? ' · ' + escHtml(item.language) : ''}</div>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="card-action-btn ${item.favorite ? 'fav-active' : ''}" 
                  onclick="window.toggleFavorite('${item.id}')" title="Favori">⭐</button>
          <button class="card-action-btn" 
                  onclick="window.copyItem('${item.id}', this)" title="Kopyala">📋</button>
          ${item.type === 'project' ? 
            `<button class="card-action-btn" 
                    onclick="window.openAddTaskForProject('${item.id}');event.stopPropagation()" 
                    title="Görev Ekle" style="color:var(--green)">＋</button>` : ''}
          <button class="card-action-btn" 
                  onclick="window.editItem('${item.id}');event.stopPropagation()" 
                  title="Düzenle">✏️</button>
          <button class="card-action-btn" 
                  onclick="window.confirmDelete('${item.id}');event.stopPropagation()" 
                  title="Sil" style="color:var(--red)">🗑️</button>
        </div>
      </div>
      ${taskBar}
      <div class="card-preview ${isCode ? 'code-preview' : ''}">
        ${preview}${item.content.length > 200 ? '…' : ''}
      </div>
      <div class="card-footer">
        ${langBadge}${tags}${aiBadge}
        ${item.usageCount ? `<span class="usage-counter">📋 ${item.usageCount}</span>` : ''}
      </div>
    </div>
  `;
}

export function renderSidebarTags() {
  const container = document.getElementById('sidebarTags');
  if (!container) return;
  
  const tags = {};
  state.items.forEach(item => {
    (item.tags || []).forEach(tag => {
      tags[tag] = (tags[tag] || 0) + 1;
    });
  });
  
  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  
  container.innerHTML = sorted.map(([tag, count]) => `
    <span class="tag-chip ${state.activeTagFilter === tag ? 'active' : ''}" 
          onclick="window.setTagFilter('${escHtml(tag)}')">
      ${escHtml(tag)} <span style="opacity:0.6">${count}</span>
    </span>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════════════════════════════

export function openAddModal(type = 'project') {
  state.currentType = type;
  state.currentEditId = null;
  state.currentTags = [];
  
  // Reset form
  document.getElementById('itemTitle').value = '';
  document.getElementById('itemContent').value = '';
  document.getElementById('charCounter').textContent = '0 karakter';
  document.getElementById('tagsList').innerHTML = '';
  document.getElementById('tagInput').value = '';
  
  // Show/hide language selector
  const langGroup = document.getElementById('langGroup');
  if (langGroup) {
    langGroup.style.display = type === 'code' ? 'block' : 'none';
  }
  
  // Update modal title
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    const titles = { project: 'Yeni Proje', instruction: 'Yeni AI Talimatı', code: 'Yeni Kod Parçacığı' };
    modalTitle.textContent = titles[type] || 'Yeni Kayıt';
  }
  
  // Update type tabs
  updateTypeTabs(type);
  
  openModal('addModal');
}

export function openEditModal(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) {
    toast('Kayıt bulunamadı', 'error');
    return;
  }
  
  state.currentEditId = id;
  state.currentType = item.type;
  state.currentTags = [...(item.tags || [])];
  
  // Fill form
  document.getElementById('itemTitle').value = item.title;
  document.getElementById('itemContent').value = item.content;
  document.getElementById('charCounter').textContent = `${item.content.length} karakter`;
  
  // Update type tabs
  updateTypeTabs(item.type);
  
  // Show/hide language selector
  const langGroup = document.getElementById('langGroup');
  if (langGroup) {
    langGroup.style.display = item.type === 'code' ? 'block' : 'none';
    
    // Select language
    if (item.language) {
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent === item.language);
      });
      document.getElementById('customLang').value = '';
    }
  }
  
  // Update modal title
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.textContent = 'Kaydı Düzenle';
  }
  
  // Render tags
  renderTagsList();
  
  openModal('addModal');
}

export function saveVaultItem() {
  const title = document.getElementById('itemTitle').value.trim();
  const content = document.getElementById('itemContent').value.trim();
  
  if (!title) {
    toast('Başlık gerekli', 'error');
    return;
  }
  if (!content) {
    toast('İçerik gerekli', 'error');
    return;
  }
  
  // Get language for code items
  let language = '';
  if (state.currentType === 'code') {
    const selectedLang = document.querySelector('.lang-btn.selected');
    language = selectedLang ? selectedLang.textContent : document.getElementById('customLang')?.value || '';
  }
  
  const now = Date.now();
  
  if (state.currentEditId) {
    // Update existing
    updateItem(state.currentEditId, {
      title,
      content,
      language,
      tags: state.currentTags,
      updatedAt: now
    });
    toast('Kayıt güncellendi', 'success');
  } else {
    // Create new
    addItem({
      id: genId(),
      type: state.currentType,
      title,
      content,
      language,
      tags: state.currentTags,
      favorite: false,
      aiGenerated: false,
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    });
    toast('Yeni kayıt eklendi', 'success');
  }
  
  saveItems(state.items);
  closeModal('addModal');
  renderCards();
  renderSidebarTags();
  updateBadges();
}

export function confirmDeleteItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  
  confirmAction(
    `"${item.title}" kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
    () => {
      deleteItem(id);
      saveItems(state.items);
      renderCards();
      renderSidebarTags();
      updateBadges();
      toast('Kayıt silindi', 'info');
    }
  );
}

// ═══════════════════════════════════════════════════════════════
// Item Actions
// ═══════════════════════════════════════════════════════════════

export async function copyItem(id, btn) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  
  const success = await copyToClipboard(item.content);
  
  if (success) {
    // Update usage count
    updateItem(id, { usageCount: (item.usageCount || 0) + 1 });
    saveItems(state.items);
    incrementCopies();
    
    // Visual feedback
    if (btn) {
      btn.classList.add('copy-success');
      btn.textContent = '✓';
      setTimeout(() => {
        btn.classList.remove('copy-success');
        btn.textContent = '📋';
      }, 1500);
    }
    
    toast('İçerik kopyalandı', 'success');
    updateStats();
  } else {
    toast('Kopyalama başarısız', 'error');
  }
}

export function toggleFavorite(id) {
  const item = state.items.find(i => i.id === id);
  if (item) {
    updateItem(id, { favorite: !item.favorite });
    saveItems(state.items);
    renderCards();
    updateBadges();
    toast(item.favorite ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════
// Detail View
// ═══════════════════════════════════════════════════════════════

export function openDetail(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  
  state.currentDetailId = id;
  
  const typeIcon = item.type === 'project' ? '📁' : 
                   item.type === 'instruction' ? '🤖' : '💻';
  
  document.getElementById('detailTypeIcon').textContent = typeIcon;
  document.getElementById('detailTitle').textContent = item.title;
  
  // Stats
  const statsHtml = `
    <span class="detail-stat">📅 ${formatDate(item.updatedAt)}</span>
    <span class="detail-stat">👁️ ${item.usageCount || 0} kopyalama</span>
    ${item.language ? `<span class="detail-stat">💻 ${item.language}</span>` : ''}
    ${item.aiGenerated ? '<span class="detail-stat">🎙️ AI Üretimi</span>' : ''}
  `;
  document.getElementById('detailStats').innerHTML = statsHtml;
  
  // Content
  const contentWrap = document.getElementById('detailContentWrap');
  if (item.type === 'code') {
    contentWrap.innerHTML = `
      <div class="detail-content code-content">
        <pre><code class="language-${item.language?.toLowerCase() || 'javascript'}">${escHtml(item.content)}</code></pre>
      </div>
    `;
    // Trigger syntax highlighting
    if (window.hljs) {
      contentWrap.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
  } else {
    contentWrap.innerHTML = `<div class="detail-content">${escHtml(item.content)}</div>`;
  }
  
  // Tags
  const tagsWrap = document.getElementById('detailTagsWrap');
  tagsWrap.innerHTML = (item.tags || []).map(t => 
    `<span class="tag">${escHtml(t)}</span>`
  ).join('');
  
  openModal('detailModal');
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function updateTypeTabs(type) {
  document.querySelectorAll('.type-tab').forEach(tab => {
    tab.className = 'type-tab';
  });
  const activeTab = document.getElementById(`tab-${type}`);
  if (activeTab) {
    activeTab.className = `type-tab active-${type}`;
  }
}

function renderTagsList() {
  const list = document.getElementById('tagsList');
  if (!list) return;
  
  list.innerHTML = state.currentTags.map(tag => `
    <span class="tag-item">
      ${escHtml(tag)}
      <button type="button" class="tag-remove" onclick="window.removeTag('${escHtml(tag)}')">×</button>
    </span>
  `).join('');
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
    'badge-recent': state.items.filter(i => (now - i.createdAt) < week).length
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

// ═══════════════════════════════════════════════════════════════
// Export for Global Access
// ═══════════════════════════════════════════════════════════════

window.openDetail = openDetail;
window.editItem = openEditModal;
window.confirmDelete = confirmDeleteItem;
window.copyItem = copyItem;
window.toggleFavorite = toggleFavorite;
window.setFilter = (filter) => { setFilter(filter); renderCards(); updateBadges(); };
window.setTagFilter = (tag) => { setTagFilter(tag); renderCards(); renderSidebarTags(); };
window.removeTag = (tag) => {
  const idx = state.currentTags.indexOf(tag);
  if (idx > -1) {
    state.currentTags.splice(idx, 1);
    renderTagsList();
  }
};
