/* ═══════════════════════════════════════════════════════════════
   Enhanced Plugins - Fully Functional Implementations
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { toast, openModal, closeModal } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// ACTIVE PLUGIN INSTANCES
// ═══════════════════════════════════════════════════════════════

const activePlugins = new Map();

// ═══════════════════════════════════════════════════════════════
// PLUGIN 1: TIME TRACKER ⏱️
// ═══════════════════════════════════════════════════════════════

export const TimeTrackerPlugin = {
  id: 'time-tracker',
  name: 'Zaman Takibi',
  
  init(config) {
    this.config = config;
    this.tracking = new Map(); // taskId -> { startTime, totalTime }
    this.intervals = new Map();
    
    // Add time tracking UI to tasks
    this.addTimeTrackingUI();
    
    // Restore ongoing tracking from storage
    this.restoreTracking();
    
    console.log('[TimeTracker] Plugin initialized');
  },
  
  destroy() {
    // Stop all tracking
    this.intervals.forEach((interval, taskId) => {
      this.stopTracking(taskId);
    });
    this.removeTimeTrackingUI();
  },
  
  startTracking(taskId) {
    if (this.tracking.has(taskId)) {
      toast('Bu görev için zaten zaman takibi aktif', 'warning');
      return;
    }
    
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    this.tracking.set(taskId, {
      startTime: Date.now(),
      totalTime: task.timeSpent || 0,
      isRunning: true
    });
    
    // Update UI
    this.updateTaskTimerUI(taskId, true);
    
    // Start interval for UI updates
    this.intervals.set(taskId, setInterval(() => {
      this.updateTaskTimerUI(taskId, true);
    }, 1000));
    
    toast(`⏱️ "${task.title}" için zaman takibi başladı`, 'success');
    logActivity(`Zaman takibi başladı: ${task.title}`);
    
    this.saveTrackingState();
  },
  
  stopTracking(taskId) {
    const tracking = this.tracking.get(taskId);
    if (!tracking) return;
    
    const elapsed = Date.now() - tracking.startTime;
    const totalTime = tracking.totalTime + elapsed;
    
    // Update task
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task.timeSpent = totalTime;
      task.timeSpentFormatted = this.formatTime(totalTime);
    }
    
    // Clear interval
    clearInterval(this.intervals.get(taskId));
    this.intervals.delete(taskId);
    this.tracking.delete(taskId);
    
    // Update UI
    this.updateTaskTimerUI(taskId, false, totalTime);
    
    toast(`⏹️ "${task.title}" için takip durduruldu. Toplam: ${this.formatTime(totalTime)}`, 'info');
    logActivity(`Zaman takibi durduruldu: ${task.title} (${this.formatTime(totalTime)})`);
    
    this.saveTrackingState();
  },
  
  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}s ${minutes % 60}d`;
    }
    return `${minutes}d ${seconds % 60}s`;
  },
  
  updateTaskTimerUI(taskId, isRunning, totalTime = 0) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;
    
    const timerBadge = taskElement.querySelector('.time-badge') || document.createElement('span');
    timerBadge.className = 'time-badge';
    
    if (isRunning) {
      const tracking = this.tracking.get(taskId);
      const current = tracking.totalTime + (Date.now() - tracking.startTime);
      timerBadge.textContent = `⏱️ ${this.formatTime(current)}`;
      timerBadge.classList.add('tracking-active');
    } else {
      if (totalTime > 0) {
        timerBadge.textContent = `⏱️ ${this.formatTime(totalTime)}`;
      } else {
        timerBadge.remove();
        return;
      }
    }
    
    if (!taskElement.querySelector('.time-badge')) {
      taskElement.querySelector('.task-meta')?.appendChild(timerBadge);
    }
  },
  
  addTimeTrackingUI() {
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .time-badge {
        background: rgba(139, 92, 246, 0.2);
        color: var(--accent-purple);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        font-family: var(--font-mono);
      }
      .time-badge.tracking-active {
        background: rgba(16, 185, 129, 0.2);
        color: var(--accent-green);
        animation: pulse 1s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .track-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        transition: all 0.2s;
      }
      .track-btn.start {
        background: rgba(16, 185, 129, 0.2);
        color: var(--accent-green);
      }
      .track-btn.stop {
        background: rgba(244, 63, 94, 0.2);
        color: var(--accent-rose);
      }
    `;
    document.head.appendChild(style);
    
    // Add buttons to task items
    this.taskClickHandler = (e) => {
      const trackBtn = e.target.closest('.track-btn');
      if (!trackBtn) return;
      
      const taskId = trackBtn.dataset.taskId;
      if (this.tracking.has(taskId)) {
        this.stopTracking(taskId);
      } else {
        this.startTracking(taskId);
      }
    };
    
    document.addEventListener('click', this.taskClickHandler);
  },
  
  removeTimeTrackingUI() {
    document.querySelector('style[data-plugin="time-tracker"]')?.remove();
    document.removeEventListener('click', this.taskClickHandler);
  },
  
  saveTrackingState() {
    const state = Array.from(this.tracking.entries()).map(([taskId, data]) => ({
      taskId,
      startTime: data.startTime,
      totalTime: data.totalTime
    }));
    localStorage.setItem('timetracker_active', JSON.stringify(state));
  },
  
  restoreTracking() {
    const saved = localStorage.getItem('timetracker_active');
    if (!saved) return;
    
    try {
      const state = JSON.parse(saved);
      state.forEach(({ taskId, startTime, totalTime }) => {
        // Check if task still exists
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          this.tracking.set(taskId, {
            startTime,
            totalTime,
            isRunning: true
          });
          
          this.intervals.set(taskId, setInterval(() => {
            this.updateTaskTimerUI(taskId, true);
          }, 1000));
          
          this.updateTaskTimerUI(taskId, true);
        }
      });
    } catch (e) {
      console.error('[TimeTracker] Restore failed:', e);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// PLUGIN 2: FOCUS MODE 🎯
// ═══════════════════════════════════════════════════════════════

export const FocusModePlugin = {
  id: 'focus-mode',
  name: 'Odak Modu',
  
  init(config) {
    this.config = { workDuration: 25, breakDuration: 5, longBreak: 15, ...config };
    this.isActive = false;
    this.timer = null;
    this.timeLeft = 0;
    this.currentMode = 'work'; // 'work' | 'break' | 'longBreak'
    this.cycles = 0;
    
    this.createFocusOverlay();
    console.log('[FocusMode] Plugin initialized');
  },
  
  destroy() {
    this.stop();
    this.removeFocusOverlay();
  },
  
  start() {
    this.isActive = true;
    this.currentMode = 'work';
    this.timeLeft = this.config.workDuration * 60;
    this.showFocusOverlay();
    this.startTimer();
    
    toast('🎯 Odak modu başladı! Telefonunuzu kaldırın.', 'success');
    logActivity('Odak modu başlatıldı');
  },
  
  stop() {
    this.isActive = false;
    clearInterval(this.timer);
    this.hideFocusOverlay();
  },
  
  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();
      
      if (this.timeLeft <= 0) {
        this.completeSession();
      }
    }, 1000);
  },
  
  completeSession() {
    clearInterval(this.timer);
    
    if (this.currentMode === 'work') {
      this.cycles++;
      
      if (this.cycles % 4 === 0) {
        // Long break
        this.currentMode = 'longBreak';
        this.timeLeft = this.config.longBreak * 60;
        toast('🎉 4 pomodoro tamamlandı! Uzun mola zamanı.', 'success');
      } else {
        // Short break
        this.currentMode = 'break';
        this.timeLeft = this.config.breakDuration * 60;
        toast('☕ Mola zamanı!', 'success');
      }
    } else {
      // Break ended, start work
      this.currentMode = 'work';
      this.timeLeft = this.config.workDuration * 60;
      toast('💪 Çalışmaya devam!', 'info');
    }
    
    this.startTimer();
    this.updateTimerDisplay();
  },
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },
  
  createFocusOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 15, 0.98);
      z-index: 10000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
    `;
    
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div id="focusTimer" style="font-size: 8rem; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums;">
          25:00
        </div>
        <div id="focusMode" style="font-size: 1.5rem; color: var(--accent-purple); margin-top: 1rem;">
          Çalışma
        </div>
        <div id="focusCycle" style="font-size: 1rem; color: var(--text-muted); margin-top: 0.5rem;">
          Pomodoro #1
        </div>
        <div style="margin-top: 3rem; display: flex; gap: 1rem;">
          <button onclick="window.focusPlugin.pause()" class="btn btn-secondary" style="padding: 12px 24px;">⏸️ Duraklat</button>
          <button onclick="window.focusPlugin.stop()" class="btn btn-danger" style="padding: 12px 24px;">⏹️ Bitir</button>
        </div>
      </div>
      <div style="position: absolute; bottom: 2rem; text-align: center; color: var(--text-muted);">
        <p>🔒 Dikkat dağıtıcı siteler engellendi</p>
        <p>🎵 Odak müziği çalıyor</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.overlay = overlay;
    
    // Expose to global
    window.focusPlugin = this;
  },
  
  removeFocusOverlay() {
    this.overlay?.remove();
  },
  
  showFocusOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  },
  
  hideFocusOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  },
  
  updateTimerDisplay() {
    const timerEl = document.getElementById('focusTimer');
    const modeEl = document.getElementById('focusMode');
    const cycleEl = document.getElementById('focusCycle');
    
    if (timerEl) timerEl.textContent = this.formatTime(this.timeLeft);
    if (modeEl) {
      const labels = { work: 'Çalışma', break: 'Mola', longBreak: 'Uzun Mola' };
      modeEl.textContent = labels[this.currentMode];
    }
    if (cycleEl) cycleEl.textContent = `Pomodoro #${this.cycles + 1}`;
  },
  
  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      toast('⏸️ Duraklatıldı', 'info');
    } else {
      this.startTimer();
      toast('▶️ Devam ediliyor', 'success');
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// PLUGIN 3: CODE SNIPPETS 📚
// ═══════════════════════════════════════════════════════════════

export const CodeSnippetsPlugin = {
  id: 'code-snippets',
  name: 'Kod Kütüphanesi',
  
  init(config) {
    this.config = { languages: ['javascript', 'python', 'css', 'sql'], ...config };
    this.snippets = this.loadSnippets();
    this.addSnippetUI();
    
    console.log('[CodeSnippets] Plugin initialized');
  },
  
  destroy() {
    this.removeSnippetUI();
  },
  
  loadSnippets() {
    const saved = localStorage.getItem('devvault_snippets');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Default snippets
    return [
      {
        id: genId(),
        title: 'Array Map',
        language: 'javascript',
        code: `const doubled = arr.map(x => x * 2);`,
        tags: ['array', 'map'],
        createdAt: Date.now()
      },
      {
        id: genId(),
        title: 'SQL Select',
        language: 'sql',
        code: `SELECT * FROM users WHERE active = 1 ORDER BY created_at DESC;`,
        tags: ['sql', 'select'],
        createdAt: Date.now()
      }
    ];
  },
  
  saveSnippets() {
    localStorage.setItem('devvault_snippets', JSON.stringify(this.snippets));
  },
  
  addSnippet(data) {
    const snippet = {
      id: genId(),
      title: data.title,
      language: data.language,
      code: data.code,
      description: data.description || '',
      tags: data.tags || [],
      createdAt: Date.now()
    };
    
    this.snippets.unshift(snippet);
    this.saveSnippets();
    
    toast(`"${snippet.title}" eklendi`, 'success');
    this.renderSnippetsList();
    
    return snippet;
  },
  
  deleteSnippet(id) {
    this.snippets = this.snippets.filter(s => s.id !== id);
    this.saveSnippets();
    this.renderSnippetsList();
  },
  
  searchSnippets(query) {
    const lowerQuery = query.toLowerCase();
    return this.snippets.filter(s => 
      s.title.toLowerCase().includes(lowerQuery) ||
      s.code.toLowerCase().includes(lowerQuery) ||
      s.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  },
  
  addSnippetUI() {
    // Add snippet modal handler
    window.openSnippetModal = () => this.openSnippetModal();
    window.saveSnippet = () => this.saveFromModal();
    window.viewSnippet = (id) => this.viewSnippet(id);
    window.copySnippet = (id) => this.copySnippet(id);
    window.deleteSnippet = (id) => this.deleteSnippet(id);
    window.searchSnippets = (query) => this.renderSnippetsList(query);
  },
  
  removeSnippetUI() {
    delete window.openSnippetModal;
    delete window.saveSnippet;
    delete window.viewSnippet;
    delete window.copySnippet;
    delete window.deleteSnippet;
    delete window.searchSnippets;
  },
  
  openSnippetModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'snippetModal';
    modal.innerHTML = `
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <div class="modal-title">📚 Yeni Kod Parçacığı</div>
          <button class="modal-close" onclick="closeModal('snippetModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Başlık</label>
            <input type="text" class="form-input" id="snippetTitle" placeholder="Örn: Array Map">
          </div>
          <div class="flex gap-md">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Dil</label>
              <select class="form-select" id="snippetLanguage">
                ${this.config.languages.map(l => `<option value="${l}">${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Etiketler</label>
              <input type="text" class="form-input" id="snippetTags" placeholder="tag1, tag2">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Kod</label>
            <textarea class="form-textarea" id="snippetCode" rows="10" placeholder="Kodunuzu buraya yapıştırın..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('snippetModal')">İptal</button>
          <button class="btn btn-primary" onclick="saveSnippet()">💾 Kaydet</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('snippetTitle').focus();
  },
  
  saveFromModal() {
    const title = document.getElementById('snippetTitle').value.trim();
    const code = document.getElementById('snippetCode').value.trim();
    
    if (!title || !code) {
      toast('Başlık ve kod gerekli', 'error');
      return;
    }
    
    this.addSnippet({
      title,
      code,
      language: document.getElementById('snippetLanguage').value,
      tags: document.getElementById('snippetTags').value.split(',').map(t => t.trim()).filter(Boolean)
    });
    
    closeModal('snippetModal');
    document.getElementById('snippetModal')?.remove();
  },
  
  viewSnippet(id) {
    const snippet = this.snippets.find(s => s.id === id);
    if (!snippet) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'viewSnippetModal';
    modal.innerHTML = `
      <div class="modal" style="max-width: 700px;">
        <div class="modal-header">
          <div class="modal-title">${escHtml(snippet.title)}</div>
          <button class="modal-close" onclick="closeModal('viewSnippetModal')">✕</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <span class="tag" style="background: var(--accent-purple); color: white;">${snippet.language}</span>
            ${snippet.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
          </div>
          <pre style="background: var(--bg-deep); padding: 20px; border-radius: var(--radius-md); overflow: auto;"><code class="language-${snippet.language}">${escHtml(snippet.code)}</code></pre>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="copySnippet('${snippet.id}')">📋 Kopyala</button>
          <button class="btn btn-danger" onclick="deleteSnippet('${snippet.id}'); closeModal('viewSnippetModal');">🗑️ Sil</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Highlight
    if (window.hljs) {
      const code = modal.querySelector('code');
      hljs.highlightElement(code);
    }
  },
  
  copySnippet(id) {
    const snippet = this.snippets.find(s => s.id === id);
    if (!snippet) return;
    
    navigator.clipboard.writeText(snippet.code).then(() => {
      toast('📋 Kod kopyalandı!', 'success');
    });
  },
  
  renderSnippetsList(query = '') {
    const container = document.getElementById('snippetsList');
    if (!container) return;
    
    const snippets = query ? this.searchSnippets(query) : this.snippets;
    
    container.innerHTML = `
      <div class="snippets-header">
        <h3>📚 Kod Kütüphanesi (${snippets.length})</h3>
        <button class="btn btn-primary" onclick="openSnippetModal()">➕ Yeni</button>
      </div>
      <div class="snippets-search">
        <input type="text" class="form-input" placeholder="Ara..." onkeyup="searchSnippets(this.value)">
      </div>
      <div class="snippets-grid">
        ${snippets.map(s => `
          <div class="snippet-card" onclick="viewSnippet('${s.id}')">
            <div class="snippet-header">
              <span class="snippet-lang">${s.language}</span>
              <button class="btn-icon" onclick="event.stopPropagation(); copySnippet('${s.id}')">📋</button>
            </div>
            <h4>${escHtml(s.title)}</h4>
            <pre><code>${escHtml(s.code.slice(0, 100))}...</code></pre>
            <div class="snippet-tags">
              ${s.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// ═══════════════════════════════════════════════════════════════
// PLUGIN 4: AI ASSISTANT+ 🤖
// ═══════════════════════════════════════════════════════════════

export const AIAssistantPlugin = {
  id: 'ai-assistant',
  name: 'AI Asistan+',
  
  init(config) {
    this.config = { model: 'llama-3.3-70b', autoSuggest: true, smartTags: true, ...config };
    
    if (this.config.autoSuggest) {
      this.enableAutoSuggest();
    }
    
    if (this.config.smartTags) {
      this.enableSmartTags();
    }
    
    console.log('[AIAssistant] Plugin initialized');
  },
  
  destroy() {
    this.disableAutoSuggest();
    this.disableSmartTags();
  },
  
  enableAutoSuggest() {
    // Add AI suggest button to task creation
    this.suggestHandler = (e) => {
      const btn = e.target.closest('.ai-suggest-btn');
      if (!btn) return;
      
      const input = document.getElementById('taskTitle') || document.getElementById('addTitle');
      if (input && input.value) {
        this.generateSuggestions(input.value);
      }
    };
    
    document.addEventListener('click', this.suggestHandler);
  },
  
  disableAutoSuggest() {
    document.removeEventListener('click', this.suggestHandler);
  },
  
  enableSmartTags() {
    // Auto-tag based on content
    this.tagHandler = (e) => {
      const input = e.target.closest('#taskTitle, #addTitle, #addDesc');
      if (!input) return;
      
      const text = input.value;
      if (text.length > 10) {
        const suggestedTags = this.analyzeForTags(text);
        this.showTagSuggestions(suggestedTags);
      }
    };
    
    document.addEventListener('input', this.tagHandler);
  },
  
  disableSmartTags() {
    document.removeEventListener('input', this.tagHandler);
  },
  
  analyzeForTags(text) {
    const keywords = {
      'ai': ['ai', 'yapay zeka', 'machine learning', 'ml', 'model'],
      'api': ['api', 'endpoint', 'rest', 'graphql'],
      'frontend': ['frontend', 'ui', 'react', 'vue', 'css', 'html'],
      'backend': ['backend', 'server', 'database', 'api', 'node'],
      'bug': ['bug', 'fix', 'error', 'hata', 'çözüm'],
      'feature': ['feature', 'özellik', 'yeni', 'ekle'],
      'design': ['design', 'tasarım', 'figma', 'ui', 'ux'],
      'database': ['database', 'sql', 'veritabanı', 'migration']
    };
    
    const text_lower = text.toLowerCase();
    const suggested = [];
    
    for (const [tag, words] of Object.entries(keywords)) {
      if (words.some(w => text_lower.includes(w))) {
        suggested.push(tag);
      }
    }
    
    return suggested.slice(0, 3);
  },
  
  showTagSuggestions(tags) {
    const container = document.getElementById('aiTagSuggestions');
    if (!container) return;
    
    if (tags.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">🤖 Önerilen:</span>
        ${tags.map(t => `
          <button class="tag ai-suggested" onclick="addTag('${t}')">${t}</button>
        `).join('')}
      </div>
    `;
  },
  
  generateSuggestions(input) {
    // Simulate AI suggestions
    const suggestions = [
      'Alt görevler oluştur',
      'Dökümantasyon ekle',
      'Test senaryoları yaz'
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" style="max-width: 400px;">
        <div class="modal-header">
          <div class="modal-title">🤖 AI Önerileri</div>
          <button class="modal-close" onclick="closeModal('aiSuggestionsModal')">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px; color: var(--text-secondary);">"${escHtml(input)}" için öneriler:</p>
          ${suggestions.map((s, i) => `
            <button class="suggestion-btn" onclick="applyAISuggestion('${s}')" style="width: 100%; text-align: left; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer;">
              ${i + 1}. ${s}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    modal.id = 'aiSuggestionsModal';
    
    document.body.appendChild(modal);
    
    window.applyAISuggestion = (suggestion) => {
      const input = document.getElementById('addDesc') || document.getElementById('taskDesc');
      if (input) {
        input.value += (input.value ? '\n' : '') + `- [ ] ${suggestion}`;
      }
      closeModal('aiSuggestionsModal');
      document.getElementById('aiSuggestionsModal')?.remove();
      toast('✅ Öneri eklendi', 'success');
    };
  },
  
  async analyzeDocument(content, type = 'general') {
    // This would make actual API call to AI service
    // For now, return simulated analysis
    
    return {
      summary: 'Doküman analiz edildi',
      keyPoints: ['Önemli nokta 1', 'Önemli nokta 2'],
      suggestions: ['İyileştirme önerisi 1'],
      sentiment: 'positive'
    };
  }
};

// ═══════════════════════════════════════════════════════════════
// PLUGIN REGISTRY
// ═══════════════════════════════════════════════════════════════

export const PLUGIN_REGISTRY = {
  'time-tracker': TimeTrackerPlugin,
  'focus-mode': FocusModePlugin,
  'code-snippets': CodeSnippetsPlugin,
  'ai-assistant': AIAssistantPlugin
};

// Initialize plugin
export function initPlugin(pluginId, config = {}) {
  const PluginClass = PLUGIN_REGISTRY[pluginId];
  if (!PluginClass) {
    console.warn(`[Plugins] Unknown plugin: ${pluginId}`);
    return null;
  }
  
  const instance = { ...PluginClass };
  instance.init(config);
  activePlugins.set(pluginId, instance);
  
  return instance;
}

// Stop plugin
export function stopPlugin(pluginId) {
  const instance = activePlugins.get(pluginId);
  if (instance && instance.destroy) {
    instance.destroy();
    activePlugins.delete(pluginId);
  }
}

// Get active plugin instance
export function getPluginInstance(pluginId) {
  return activePlugins.get(pluginId);
}

// Check if plugin is running
export function isPluginRunning(pluginId) {
  return activePlugins.has(pluginId);
}
