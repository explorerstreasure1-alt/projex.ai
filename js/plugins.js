/* ═══════════════════════════════════════════════════════════════
   Plugin System - Extensible Features
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { toast } from './ui.js';

// ═══════════════════════════════════════════════════════════════
// Plugin Registry
// ═══════════════════════════════════════════════════════════════

const PLUGINS_STORAGE_KEY = 'devvault_plugins';

export const BUILTIN_PLUGINS = [
  {
    id: 'github-sync',
    name: 'GitHub Sync',
    description: 'Projeleri GitHub repo ile senkronize et',
    icon: '🐙',
    category: 'integration',
    isPro: true,
    enabled: false,
    config: {
      repo: '',
      token: '',
      autoSync: false
    }
  },
  {
    id: 'slack-notify',
    name: 'Slack Bildirim',
    description: 'Slack kanalına görev güncellemeleri gönder',
    icon: '💬',
    category: 'integration',
    isPro: true,
    enabled: false,
    config: {
      webhook: '',
      channel: ''
    }
  },
  {
    id: 'time-tracker',
    name: 'Zaman Takibi',
    description: 'Görevler için otomatik zaman takibi',
    icon: '⏱️',
    category: 'productivity',
    isPro: false,
    enabled: false,
    config: {
      autoStart: true,
      billable: false,
      hourlyRate: 0
    }
  },
  {
    id: 'sprint-planner',
    name: 'Sprint Planlayıcı',
    description: 'Agile sprint yönetimi ve velocity takibi',
    icon: '📊',
    category: 'project',
    isPro: true,
    enabled: false,
    config: {
      sprintDuration: 14,
      storyPoints: true
    }
  },
  {
    id: 'code-snippets',
    name: 'Kod Kütüphanesi',
    description: 'Kod parçacıkları koleksiyonu ve arama',
    icon: '📚',
    category: 'development',
    isPro: false,
    enabled: true,
    config: {
      languages: ['javascript', 'python', 'css'],
      gistSync: false
    }
  },
  {
    id: 'ai-assistant',
    name: 'AI Asistan+',
    description: 'Gelişmiş AI özellikleri ve otomasyon',
    icon: '🤖',
    category: 'ai',
    isPro: true,
    enabled: false,
    config: {
      model: 'llama-3.3-70b',
      autoSuggest: true,
      smartTags: true
    }
  },
  {
    id: 'calendar-sync',
    name: 'Takvim Senkronizasyonu',
    description: 'Google/Outlook takvimi ile görev senkronizasyonu',
    icon: '📅',
    category: 'integration',
    isPro: true,
    enabled: false,
    config: {
      provider: 'google',
      syncDirection: 'both'
    }
  },
  {
    id: 'analytics',
    name: 'Gelişmiş Analitik',
    description: 'Verimlilik raporları ve trend analizi',
    icon: '📈',
    category: 'productivity',
    isPro: true,
    enabled: false,
    config: {
      reports: ['daily', 'weekly', 'monthly'],
      exportFormat: 'pdf'
    }
  },
  {
    id: 'focus-mode',
    name: 'Odak Modu',
    description: 'Pomodoro tekniği ve dikkat dağıtıcı engelleme',
    icon: '🎯',
    category: 'productivity',
    isPro: false,
    enabled: false,
    config: {
      workDuration: 25,
      breakDuration: 5,
      longBreak: 15
    }
  },
  {
    id: 'api-connector',
    name: 'API Bağlayıcı',
    description: 'Özel API entegrasyonları (REST/WebSocket)',
    icon: '🔌',
    category: 'integration',
    isPro: true,
    enabled: false,
    config: {
      endpoints: [],
      authType: 'bearer'
    }
  },
  {
    id: 'custom-theme',
    name: 'Özel Tema',
    description: 'Tema renkleri ve marka özelleştirme',
    icon: '🎨',
    category: 'customization',
    isPro: false,
    enabled: false,
    config: {
      primaryColor: '#7c6aff',
      logo: '',
      font: 'DM Sans'
    }
  },
  {
    id: 'backup-auto',
    name: 'Otomatik Yedekleme',
    description: 'Buluta otomatik yedekleme ve kurtarma',
    icon: '☁️',
    category: 'security',
    isPro: true,
    enabled: false,
    config: {
      frequency: 'daily',
      retention: 30,
      provider: 'supabase'
    }
  }
];

let installedPlugins = [];
let activeHooks = {};

// ═══════════════════════════════════════════════════════════════
// Plugin Manager
// ═══════════════════════════════════════════════════════════════

export function initPlugins() {
  loadPlugins();
  renderPluginSection();
}

export function getPlugin(id) {
  return BUILTIN_PLUGINS.find(p => p.id === id) || installedPlugins.find(p => p.id === id);
}

export function isPluginEnabled(id) {
  const plugin = getPlugin(id);
  return plugin?.enabled || false;
}

export function enablePlugin(id) {
  const plugin = getPlugin(id);
  if (!plugin) return;
  
  // Check Pro requirement
  if (plugin.isPro && !isProUser()) {
    toast('Bu eklenti Pro plan gerektirir', 'error');
    return;
  }
  
  plugin.enabled = true;
  savePlugins();
  
  // Execute plugin init if available
  if (plugin.init) {
    plugin.init(plugin.config);
  }
  
  // Trigger hooks
  triggerHook('plugin:enabled', { pluginId: id });
  
  toast(`${plugin.name} etkinleştirildi`, 'success');
  renderPluginSection();
}

export function disablePlugin(id) {
  const plugin = getPlugin(id);
  if (!plugin) return;
  
  plugin.enabled = false;
  savePlugins();
  
  // Execute plugin cleanup if available
  if (plugin.destroy) {
    plugin.destroy();
  }
  
  triggerHook('plugin:disabled', { pluginId: id });
  
  toast(`${plugin.name} devre dışı bırakıldı`, 'info');
  renderPluginSection();
}

export function togglePlugin(id) {
  const plugin = getPlugin(id);
  if (!plugin) return;
  
  if (plugin.enabled) {
    disablePlugin(id);
  } else {
    enablePlugin(id);
  }
}

export function configurePlugin(id, config) {
  const plugin = getPlugin(id);
  if (!plugin) return;
  
  plugin.config = { ...plugin.config, ...config };
  savePlugins();
  
  // Re-initialize if enabled
  if (plugin.enabled && plugin.init) {
    plugin.init(plugin.config);
  }
  
  toast(`${plugin.name} yapılandırması güncellendi`, 'success');
}

// ═══════════════════════════════════════════════════════════════
// Hook System
// ═══════════════════════════════════════════════════════════════

export function registerHook(hookName, callback, priority = 10) {
  if (!activeHooks[hookName]) {
    activeHooks[hookName] = [];
  }
  
  activeHooks[hookName].push({ callback, priority });
  activeHooks[hookName].sort((a, b) => a.priority - b.priority);
}

export function unregisterHook(hookName, callback) {
  if (!activeHooks[hookName]) return;
  
  activeHooks[hookName] = activeHooks[hookName].filter(h => h.callback !== callback);
}

export function triggerHook(hookName, data = {}) {
  if (!activeHooks[hookName]) return data;
  
  let result = data;
  for (const hook of activeHooks[hookName]) {
    try {
      result = hook.callback(result) || result;
    } catch (err) {
      console.error(`Hook error (${hookName}):`, err);
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderPluginSection() {
  const container = document.getElementById('pluginSection');
  if (!container) return;
  
  const categories = groupByCategory(BUILTIN_PLUGINS);
  
  container.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-label" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Eklentiler</span>
        <span style="font-size: 0.6rem; color: var(--text-muted);">${BUILTIN_PLUGINS.filter(p => p.enabled).length}/${BUILTIN_PLUGINS.length}</span>
      </div>
      <div class="plugin-grid">
        ${BUILTIN_PLUGINS.map(plugin => renderPluginCard(plugin)).join('')}
      </div>
    </div>
  `;
}

function renderPluginCard(plugin) {
  const isEnabled = plugin.enabled;
  const isLocked = plugin.isPro && !isProUser();
  
  return `
    <div class="plugin-card ${isEnabled ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
         onclick="${isLocked ? 'showProUpgrade()' : `togglePlugin('${plugin.id}')`}">
      <div class="plugin-icon">${plugin.icon}</div>
      <div class="plugin-name">${plugin.name} ${plugin.isPro ? '<span style="color: var(--amber); font-size: 0.6rem;">PRO</span>' : ''}</div>
      <div class="plugin-desc">${plugin.description}</div>
      <div class="plugin-toggle" onclick="event.stopPropagation()">
        <div class="toggle-switch ${isEnabled ? 'active' : ''} ${isLocked ? 'disabled' : ''}" 
             onclick="${isLocked ? 'showProUpgrade()' : `togglePlugin('${plugin.id}')`}"></div>
      </div>
    </div>
  `;
}

function groupByCategory(plugins) {
  return plugins.reduce((acc, plugin) => {
    if (!acc[plugin.category]) {
      acc[plugin.category] = [];
    }
    acc[plugin.category].push(plugin);
    return acc;
  }, {});
}

// ═══════════════════════════════════════════════════════════════
// Plugin API for Developers
// ═══════════════════════════════════════════════════════════════

export class PluginAPI {
  constructor(pluginId) {
    this.id = pluginId;
    this.plugin = getPlugin(pluginId);
  }
  
  // Get plugin configuration
  getConfig() {
    return this.plugin?.config || {};
  }
  
  // Update configuration
  setConfig(key, value) {
    const newConfig = { ...this.getConfig(), [key]: value };
    configurePlugin(this.id, newConfig);
  }
  
  // Register hooks
  on(event, callback, priority = 10) {
    registerHook(`${this.id}:${event}`, callback, priority);
  }
  
  // Show notification
  notify(message, type = 'info') {
    toast(`[${this.plugin?.name}] ${message}`, type);
  }
  
  // Access app state (read-only)
  getState() {
    return { ...state };
  }
  
  // Add menu item
  addMenuItem(label, icon, action) {
    triggerHook('ui:addMenuItem', { pluginId: this.id, label, icon, action });
  }
  
  // Add toolbar button
  addToolbarButton(label, icon, action) {
    triggerHook('ui:addToolbarButton', { pluginId: this.id, label, icon, action });
  }
}

// ═══════════════════════════════════════════════════════════════
// Pro Plan Check
// ═══════════════════════════════════════════════════════════════

function isProUser() {
  // Check if user has Pro plan
  const plan = getStorage('devvault_plan', '{}');
  return plan?.type === 'pro' && plan?.expiry > Date.now();
}

export function showProUpgrade() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'proUpgradeModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 600px">
      <div class="modal-header">
        <div class="modal-title">⭐ Pro Plan'a Yükselt</div>
        <button class="modal-close" onclick="closeModal('proUpgradeModal')">✕</button>
      </div>
      <div class="modal-body">
        <p style="text-align: center; color: var(--text-dim); margin-bottom: 20px;">
          Ekip çalışması ve gelişmiş özellikler için Pro Plan'a geçin
        </p>
        <div class="pro-features-grid">
          <div class="pro-feature-card">
            <div class="pro-feature-icon">👥</div>
            <div class="pro-feature-title">Ekip Yönetimi</div>
            <div class="pro-feature-desc">Sınırsız ekip üyesi ve roller</div>
            <span class="pro-feature-badge">PRO</span>
          </div>
          <div class="pro-feature-card">
            <div class="pro-feature-icon">🔌</div>
            <div class="pro-feature-title">10+ Eklenti</div>
            <div class="pro-feature-desc">Gelişmiş entegrasyonlar ve otomasyon</div>
            <span class="pro-feature-badge">PRO</span>
          </div>
          <div class="pro-feature-card">
            <div class="pro-feature-icon">☁️</div>
            <div class="pro-feature-title">Bulut Yedekleme</div>
            <div class="pro-feature-desc">Otomatik yedekleme ve senkronizasyon</div>
            <span class="pro-feature-badge">PRO</span>
          </div>
          <div class="pro-feature-card">
            <div class="pro-feature-icon">🎙️</div>
            <div class="pro-feature-title">Sınırsız Ses AI</div>
            <div class="pro-feature-desc"> limitsiz sesli dokümantasyon</div>
            <span class="pro-feature-badge">PRO</span>
          </div>
          <div class="pro-feature-card">
            <div class="pro-feature-icon">📊</div>
            <div class="pro-feature-title">Analitik</div>
            <div class="pro-feature-desc">Detaylı verimlilik raporları</div>
            <span class="pro-feature-badge">PRO</span>
          </div>
          <div class="pro-feature-card">
            <div class="pro-feature-icon">🤖</div>
            <div class="pro-feature-title">Gelişmiş AI</div>
            <div class="pro-feature-desc">Premium AI modelleri ve özellikler</div>
            <span class="pro-feature-badge">PRO</span>
          </div>
        </div>
        
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <div style="font-weight: 700; font-size: 1.1rem;">Pro Plan</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Aylık ödeme</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">₺199</div>
              <div style="font-size: 0.65rem; color: var(--text-muted);">/ay</div>
            </div>
          </div>
          <button class="btn btn-primary" style="width: 100%;" onclick="upgradeToPro()">🚀 Pro Plan'a Geç</button>
        </div>
        
        <div style="text-align: center; margin-top: 16px;">
          <span style="font-size: 0.7rem; color: var(--text-muted);">7 gün ücretsiz deneme • İstediğiniz zaman iptal edin</span>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.togglePlugin = (id) => {
  togglePlugin(id);
};

window.showProUpgrade = () => {
  showProUpgrade();
};

window.upgradeToPro = () => {
  // Simulate upgrade
  const plan = {
    type: 'pro',
    expiry: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days trial
    trial: true
  };
  setStorage('devvault_plan', plan);
  
  closeModal('proUpgradeModal');
  toast('🎉 Pro Plan aktif! 7 gün ücretsiz deneme başladı.', 'success');
  
  // Refresh to unlock features
  setTimeout(() => location.reload(), 1500);
};

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadPlugins() {
  const saved = getStorage(PLUGINS_STORAGE_KEY, '[]');
  if (saved && saved.length > 0) {
    // Merge saved state with builtin plugins
    saved.forEach(savedPlugin => {
      const builtin = BUILTIN_PLUGINS.find(p => p.id === savedPlugin.id);
      if (builtin) {
        builtin.enabled = savedPlugin.enabled;
        builtin.config = { ...builtin.config, ...savedPlugin.config };
      }
    });
  }
}

function savePlugins() {
  const pluginState = BUILTIN_PLUGINS.map(p => ({
    id: p.id,
    enabled: p.enabled,
    config: p.config
  }));
  setStorage(PLUGINS_STORAGE_KEY, pluginState);
}

// ═══════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════

export function initPluginSystem() {
  initPlugins();
  
  // Register core hooks
  registerHook('task:created', (data) => {
    // Notify enabled plugins
    BUILTIN_PLUGINS.filter(p => p.enabled).forEach(plugin => {
      if (plugin.onTaskCreated) {
        plugin.onTaskCreated(data);
      }
    });
    return data;
  });
  
  registerHook('vault:updated', (data) => {
    BUILTIN_PLUGINS.filter(p => p.enabled).forEach(plugin => {
      if (plugin.onVaultUpdated) {
        plugin.onVaultUpdated(data);
      }
    });
    return data;
  });
}
