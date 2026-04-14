/* ═══════════════════════════════════════════════════════════════
   Reports Module - Analytics & Productivity Reports
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull, todayStr } from './utils.js';
import { toast, openModal } from './ui.js';
import { getCalendarEvents, getEventsForRange } from './calendar.js';
import { getAllProjects, getProjectStats } from './projects.js';

// ═══════════════════════════════════════════════════════════════
// Reports State
// ═══════════════════════════════════════════════════════════════

const REPORTS_STORAGE_KEY = 'devvault_reports';

let reportsState = {
  savedReports: [],
  dateRange: {
    start: getDateOffset(-30),
    end: todayStr()
  },
  currentReport: 'overview'
};

// ═══════════════════════════════════════════════════════════════
// Initialize Reports
// ═══════════════════════════════════════════════════════════════

export function initReports() {
  loadReports();
}

function getDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════
// Report Generators
// ═══════════════════════════════════════════════════════════════

export function generateOverviewReport() {
  const startDate = reportsState.dateRange.start;
  const endDate = reportsState.dateRange.end;
  
  // Task statistics
  const tasks = state.tasks;
  const tasksInRange = tasks.filter(t => t.date >= startDate && t.date <= endDate);
  
  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    byPriority: {
      critical: tasks.filter(t => t.priority === 'critical').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    },
    completionRate: tasks.length ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0
  };
  
  // Vault statistics
  const vaultItems = state.items;
  const recentItems = vaultItems.filter(i => {
    const created = new Date(i.createdAt).toISOString().split('T')[0];
    return created >= startDate && created <= endDate;
  });
  
  const vaultStats = {
    total: vaultItems.length,
    recent: recentItems.length,
    byType: {
      project: vaultItems.filter(i => i.type === 'project').length,
      instruction: vaultItems.filter(i => i.type === 'instruction').length,
      code: vaultItems.filter(i => i.type === 'code').length
    },
    favorites: vaultItems.filter(i => i.favorite).length
  };
  
  // Productivity score
  const productivityScore = calculateProductivityScore(taskStats, vaultStats);
  
  return {
    type: 'overview',
    title: 'Genel Bakış',
    dateRange: { start: startDate, end: endDate },
    taskStats,
    vaultStats,
    productivityScore,
    generatedAt: Date.now()
  };
}

export function generateTasksReport() {
  const tasks = state.tasks;
  const startDate = reportsState.dateRange.start;
  const endDate = reportsState.dateRange.end;
  
  // Daily task completion
  const dailyStats = {};
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayTasks = tasks.filter(t => t.date === dateStr);
    
    dailyStats[dateStr] = {
      total: dayTasks.length,
      completed: dayTasks.filter(t => t.completed).length,
      byPriority: {
        critical: dayTasks.filter(t => t.priority === 'critical').length,
        high: dayTasks.filter(t => t.priority === 'high').length,
        medium: dayTasks.filter(t => t.priority === 'medium').length,
        low: dayTasks.filter(t => t.priority === 'low').length
      }
    };
  }
  
  // Burndown data
  const totalTasks = tasks.filter(t => t.date >= startDate && t.date <= endDate).length;
  const completedTasks = tasks.filter(t => t.date >= startDate && t.date <= endDate && t.completed).length;
  
  return {
    type: 'tasks',
    title: 'Görev Analizi',
    dateRange: reportsState.dateRange,
    summary: {
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0
    },
    dailyStats,
    burndown: generateBurndownData(tasks, startDate, endDate),
    generatedAt: Date.now()
  };
}

export function generateTimeReport() {
  const events = getCalendarEvents();
  const startDate = reportsState.dateRange.start;
  const endDate = reportsState.dateRange.end;
  
  const rangeEvents = events.filter(e => e.date >= startDate && e.date <= endDate);
  
  // Time by category
  const timeByCategory = {};
  rangeEvents.forEach(event => {
    const duration = event.duration || 60;
    timeByCategory[event.type] = (timeByCategory[event.type] || 0) + duration;
  });
  
  // Daily time distribution
  const dailyTime = {};
  rangeEvents.forEach(event => {
    if (!dailyTime[event.date]) {
      dailyTime[event.date] = 0;
    }
    dailyTime[event.date] += event.duration || 60;
  });
  
  return {
    type: 'time',
    title: 'Zaman Analizi',
    dateRange: reportsState.dateRange,
    summary: {
      totalEvents: rangeEvents.length,
      totalTime: Object.values(timeByCategory).reduce((a, b) => a + b, 0),
      averagePerDay: Math.round(Object.values(dailyTime).reduce((a, b) => a + b, 0) / Object.keys(dailyTime).length || 0)
    },
    timeByCategory,
    dailyTime,
    generatedAt: Date.now()
  };
}

export function generateProjectsReport() {
  const projects = getAllProjects();
  
  const projectStats = projects.map(p => {
    const stats = getProjectStats(p.id);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      progress: stats?.progress || 0,
      budgetUsed: stats?.budgetUsed || 0,
      totalTasks: stats?.totalTasks || 0,
      completedTasks: stats?.completedTasks || 0
    };
  });
  
  return {
    type: 'projects',
    title: 'Proje Raporu',
    summary: {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
      totalSpent: projects.reduce((sum, p) => sum + (p.spent || 0), 0)
    },
    projects: projectStats,
    generatedAt: Date.now()
  };
}

export function generateTeamReport() {
  // This would integrate with team module
  // For now, return placeholder structure
  return {
    type: 'team',
    title: 'Ekip Performansı',
    summary: {
      totalMembers: 1,
      activeMembers: 1,
      tasksPerMember: state.tasks.length,
      completionRate: 0
    },
    generatedAt: Date.now()
  };
}

// ═══════════════════════════════════════════════════════════════
// Report Data Helpers
// ═══════════════════════════════════════════════════════════════

function calculateProductivityScore(taskStats, vaultStats) {
  const taskScore = Math.min(taskStats.completionRate, 100);
  const vaultScore = Math.min(vaultStats.recent * 5, 50); // 10 items = 50 points
  const consistencyScore = 50; // Placeholder
  
  return Math.round((taskScore + vaultScore + consistencyScore) / 2);
}

function generateBurndownData(tasks, startDate, endDate) {
  const data = [];
  let remaining = tasks.filter(t => t.date >= startDate && t.date <= endDate).length;
  
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const completed = tasks.filter(t => t.date === dateStr && t.completed).length;
    remaining -= completed;
    
    data.push({
      date: dateStr,
      remaining: Math.max(0, remaining),
      completed
    });
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderReports() {
  const container = document.getElementById('reportsView');
  if (!container) return;
  
  const report = generateOverviewReport();
  
  container.innerHTML = `
    <div class="reports-header">
      <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700;">
        📊 Raporlar & Analitik
      </h2>
      <div class="reports-actions">
        <div class="date-range-picker">
          <input type="date" class="form-input" id="reportStart" value="${reportsState.dateRange.start}">
          <span>-</span>
          <input type="date" class="form-input" id="reportEnd" value="${reportsState.dateRange.end}">
          <button class="btn btn-secondary" onclick="updateReportRange()">🔄 Güncelle</button>
        </div>
        <button class="btn btn-primary" onclick="exportReport()">📥 İndir</button>
      </div>
    </div>
    
    <div class="reports-tabs">
      <button class="report-tab active" onclick="switchReport('overview')">Genel Bakış</button>
      <button class="report-tab" onclick="switchReport('tasks')">Görevler</button>
      <button class="report-tab" onclick="switchReport('time')">Zaman</button>
      <button class="report-tab" onclick="switchReport('projects')">Projeler</button>
    </div>
    
    <div class="reports-content">
      ${renderOverviewReport(report)}
    </div>
  `;
}

function renderOverviewReport(report) {
  return `
    <div class="report-overview">
      <!-- Productivity Score -->
      <div class="score-card">
        <div class="score-header">
          <h3>🎯 Verimlilik Skoru</h3>
          <div class="score-value" style="color: ${getScoreColor(report.productivityScore)}">${report.productivityScore}</div>
        </div>
        <div class="score-bar">
          <div class="score-fill" style="width: ${report.productivityScore}%; background: ${getScoreColor(report.productivityScore)}"></div>
        </div>
        <p class="score-desc">${getScoreDescription(report.productivityScore)}</p>
      </div>
      
      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card-large">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <div class="stat-value-large">${report.taskStats.total}</div>
            <div class="stat-label">Toplam Görev</div>
            <div class="stat-sub">${report.taskStats.completed} tamamlandı • ${report.taskStats.completionRate}%</div>
          </div>
        </div>
        
        <div class="stat-card-large">
          <div class="stat-icon">⚡</div>
          <div class="stat-content">
            <div class="stat-value-large">${report.vaultStats.total}</div>
            <div class="stat-label">Vault Kaydı</div>
            <div class="stat-sub">${report.vaultStats.recent} yeni • ${report.vaultStats.favorites} favori</div>
          </div>
        </div>
        
        <div class="stat-card-large">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-value-large">${getCalendarEvents().length}</div>
            <div class="stat-label">Etkinlik</div>
            <div class="stat-sub">Bu ay planlanmış</div>
          </div>
        </div>
      </div>
      
      <!-- Priority Distribution -->
      <div class="chart-section">
        <h4>📊 Öncelik Dağılımı</h4>
        <div class="priority-chart">
          ${renderPriorityBars(report.taskStats.byPriority)}
        </div>
      </div>
      
      <!-- Activity Timeline -->
      <div class="chart-section">
        <h4>📈 Son 7 Gün Aktivitesi</h4>
        <div class="activity-chart">
          ${renderActivityChart()}
        </div>
      </div>
    </div>
  `;
}

function renderTasksReport() {
  const report = generateTasksReport();
  
  return `
    <div class="report-tasks">
      <div class="report-summary-cards">
        <div class="summary-card">
          <div class="summary-value">${report.summary.totalTasks}</div>
          <div class="summary-label">Toplam</div>
        </div>
        <div class="summary-card success">
          <div class="summary-value">${report.summary.completedTasks}</div>
          <div class="summary-label">Tamamlandı</div>
        </div>
        <div class="summary-card warning">
          <div class="summary-value">${report.summary.pendingTasks}</div>
          <div class="summary-label">Bekleyen</div>
        </div>
        <div class="summary-card primary">
          <div class="summary-value">%${report.summary.completionRate}</div>
          <div class="summary-label">Tamamlanma</div>
        </div>
      </div>
      
      <div class="burndown-section">
        <h4>📉 Burndown Chart</h4>
        <div class="burndown-chart">
          ${renderBurndownChart(report.burndown)}
        </div>
      </div>
    </div>
  `;
}

function renderTimeReport() {
  const report = generateTimeReport();
  
  return `
    <div class="report-time">
      <div class="time-summary">
        <div class="time-total">
          <div class="time-value">${Math.round(report.summary.totalTime / 60)}s ${report.summary.totalTime % 60}d</div>
          <div class="time-label">Toplam Zaman</div>
        </div>
        <div class="time-average">
          <div class="time-value">${Math.round(report.summary.averagePerDay / 60)}s</div>
          <div class="time-label">Günlük Ortalama</div>
        </div>
      </div>
      
      <div class="time-by-category">
        <h4>⏱️ Kategori Bazında Zaman</h4>
        ${Object.entries(report.timeByCategory).map(([type, minutes]) => `
          <div class="category-bar">
            <span class="category-label">${getCategoryLabel(type)}</span>
            <div class="category-progress">
              <div class="category-fill" style="width: ${(minutes / report.summary.totalTime) * 100}%"></div>
            </div>
            <span class="category-time">${Math.round(minutes / 60)}s</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderProjectsReport() {
  const report = generateProjectsReport();
  
  return `
    <div class="report-projects">
      <div class="projects-summary">
        <div class="summary-row">
          <span>Aktif Projeler</span>
          <span class="value">${report.summary.activeProjects}</span>
        </div>
        <div class="summary-row">
          <span>Tamamlanan Projeler</span>
          <span class="value">${report.summary.completedProjects}</span>
        </div>
        <div class="summary-row">
          <span>Toplam Bütçe</span>
          <span class="value">₺${report.summary.totalBudget.toLocaleString()}</span>
        </div>
        <div class="summary-row">
          <span>Harcanan</span>
          <span class="value">₺${report.summary.totalSpent.toLocaleString()}</span>
        </div>
      </div>
      
      <div class="projects-list">
        ${report.projects.map(p => `
          <div class="project-report-item">
            <div class="project-info">
              <h4>${escHtml(p.name)}</h4>
              <span class="project-status ${p.status}">${p.status}</span>
            </div>
            <div class="project-metrics">
              <div class="metric">
                <span class="metric-value">%${p.progress}</span>
                <span class="metric-label">İlerleme</span>
              </div>
              <div class="metric">
                <span class="metric-value">${p.completedTasks}/${p.totalTasks}</span>
                <span class="metric-label">Görevler</span>
              </div>
            </div>
            <div class="project-bar">
              <div class="project-fill" style="width: ${p.progress}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Chart Renderers
// ═══════════════════════════════════════════════════════════════

function renderPriorityBars(priorities) {
  const colors = {
    critical: '#f43f5e',
    high: '#f59e0b',
    medium: '#8b5cf6',
    low: '#10b981'
  };
  
  const labels = {
    critical: 'Kritik',
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük'
  };
  
  const total = Object.values(priorities).reduce((a, b) => a + b, 0);
  
  return Object.entries(priorities).map(([priority, count]) => `
    <div class="priority-bar-item">
      <div class="priority-info">
        <span class="priority-dot" style="background: ${colors[priority]}"></span>
        <span class="priority-name">${labels[priority]}</span>
        <span class="priority-count">${count}</span>
      </div>
      <div class="priority-progress">
        <div class="priority-fill" style="width: ${total ? (count / total) * 100 : 0}%; background: ${colors[priority]}"></div>
      </div>
    </div>
  `).join('');
}

function renderActivityChart() {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().split('T')[0]);
  }
  
  return last7Days.map(date => {
    const tasks = state.tasks.filter(t => t.date === date).length;
    const completed = state.tasks.filter(t => t.date === date && t.completed).length;
    const height = Math.max(10, tasks * 20);
    
    return `
      <div class="chart-bar-container">
        <div class="chart-bar" style="height: ${height}px; background: ${completed === tasks && tasks > 0 ? 'var(--accent-green)' : 'var(--accent-purple)'}">
          ${tasks > 0 ? `<span class="bar-value">${tasks}</span>` : ''}
        </div>
        <span class="bar-label">${date.slice(5)}</span>
      </div>
    `;
  }).join('');
}

function renderBurndownChart(data) {
  if (!data.length) return '<p>Veri yok</p>';
  
  const max = Math.max(...data.map(d => d.remaining));
  
  return `
    <div class="burndown-svg">
      <svg viewBox="0 0 ${data.length * 40} 200" preserveAspectRatio="none">
        <!-- Grid lines -->
        ${[0, 50, 100, 150, 200].map(y => `
          <line x1="0" y1="${y}" x2="${data.length * 40}" y2="${y}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        `).join('')}
        
        <!-- Burndown line -->
        <polyline
          fill="none"
          stroke="#8b5cf6"
          stroke-width="3"
          points="${data.map((d, i) => `${i * 40 + 20},${200 - (d.remaining / max) * 180}`).join(' ')}"
        />
        
        <!-- Data points -->
        ${data.map((d, i) => `
          <circle
            cx="${i * 40 + 20}"
            cy="${200 - (d.remaining / max) * 180}"
            r="4"
            fill="#8b5cf6"
          />
        `).join('')}
      </svg>
    </div>
    <div class="burndown-legend">
      <div class="legend-item">
        <span class="legend-color" style="background: #8b5cf6"></span>
        <span>Kalan görevler</span>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function getScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#8b5cf6';
  return '#f43f5e';
}

function getScoreDescription(score) {
  if (score >= 80) return 'Mükemmel! Çok verimlisiniz.';
  if (score >= 60) return 'İyi gidiyorsunuz. Biraz daha çaba!';
  if (score >= 40) return 'Ortalama. Daha fazla görev tamamlayın.';
  return 'Düşük verimlilik. Hedeflerinizi gözden geçirin.';
}

function getCategoryLabel(type) {
  const labels = {
    task: 'Görevler',
    meeting: 'Toplantılar',
    milestone: 'Kilometre Taşları',
    reminder: 'Hatırlatıcılar'
  };
  return labels[type] || type;
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.switchReport = (type) => {
  reportsState.currentReport = type;
  
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  const content = document.querySelector('.reports-content');
  
  switch(type) {
    case 'overview':
      content.innerHTML = renderOverviewReport(generateOverviewReport());
      break;
    case 'tasks':
      content.innerHTML = renderTasksReport();
      break;
    case 'time':
      content.innerHTML = renderTimeReport();
      break;
    case 'projects':
      content.innerHTML = renderProjectsReport();
      break;
  }
};

window.updateReportRange = () => {
  const start = document.getElementById('reportStart').value;
  const end = document.getElementById('reportEnd').value;
  
  if (start && end) {
    reportsState.dateRange = { start, end };
    renderReports();
    toast('Rapor güncellendi', 'success');
  }
};

window.exportReport = () => {
  const report = generateOverviewReport();
  const reportText = generateReportText(report);
  
  const blob = new Blob([reportText], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapor-${todayStr()}.md`;
  a.click();
  
  URL.revokeObjectURL(url);
  toast('Rapor indirildi', 'success');
};

function generateReportText(report) {
  return `# DevVault Pro Raporu

**Tarih:** ${formatDateFull(todayStr())}  
**Dönem:** ${formatDateFull(report.dateRange.start)} - ${formatDateFull(report.dateRange.end)}

## 📊 Genel Bakış

- **Verimlilik Skoru:** ${report.productivityScore}/100
- **Toplam Görev:** ${report.taskStats.total}
- **Tamamlanan:** ${report.taskStats.completed} (%${report.taskStats.completionRate})
- **Vault Kayıtları:** ${report.vaultStats.total}

## 📋 Görev Özeti

| Öncelik | Sayı |
|---------|------|
| Kritik | ${report.taskStats.byPriority.critical} |
| Yüksek | ${report.taskStats.byPriority.high} |
| Orta | ${report.taskStats.byPriority.medium} |
| Düşük | ${report.taskStats.byPriority.low} |

---
*DevVault Pro tarafından otomatik oluşturuldu*
`;
}

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadReports() {
  const saved = getStorage(REPORTS_STORAGE_KEY, '{}');
  if (saved.dateRange) {
    reportsState.dateRange = saved.dateRange;
  }
}

function saveReports() {
  setStorage(REPORTS_STORAGE_KEY, {
    dateRange: reportsState.dateRange
  });
}

// Export
export function getProductivityScore() {
  return generateOverviewReport().productivityScore;
}

export function getWeeklyReport() {
  const start = getDateOffset(-7);
  const end = todayStr();
  
  const originalRange = reportsState.dateRange;
  reportsState.dateRange = { start, end };
  const report = generateOverviewReport();
  reportsState.dateRange = originalRange;
  
  return report;
}
