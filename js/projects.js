/* ═══════════════════════════════════════════════════════════════
   Projects Module - Comprehensive Project Management
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull, todayStr } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Project State
// ═══════════════════════════════════════════════════════════════

const PROJECTS_STORAGE_KEY = 'devvault_projects';
const MILESTONES_STORAGE_KEY = 'devvault_milestones';

let projectsState = {
  projects: [],
  currentProject: null,
  milestones: [],
  sprints: [],
  filters: {
    status: 'all',
    priority: 'all',
    owner: 'all'
  }
};

// ═══════════════════════════════════════════════════════════════
// Initialize Projects
// ═══════════════════════════════════════════════════════════════

export function initProjects() {
  loadProjects();
  
  // Create default project if none exists
  if (!projectsState.projects.length) {
    createDefaultProject();
  }
}

function createDefaultProject() {
  const project = {
    id: genId(),
    name: 'Örnek Proje',
    description: 'Proje yönetimi özelliklerini keşfedin',
    status: 'active',
    priority: 'high',
    startDate: todayStr(),
    endDate: null,
    budget: 0,
    spent: 0,
    owner: 'Ben',
    members: [],
    color: '#8b5cf6',
    tags: ['örnek'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  projectsState.projects.push(project);
  projectsState.currentProject = project;
  saveProjects();
}

// ═══════════════════════════════════════════════════════════════
// Project CRUD
// ═══════════════════════════════════════════════════════════════

export function createProject(data) {
  const project = {
    id: genId(),
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    priority: data.priority || 'medium',
    startDate: data.startDate || todayStr(),
    endDate: data.endDate || null,
    budget: data.budget || 0,
    spent: 0,
    owner: data.owner || 'Ben',
    members: data.members || [],
    color: data.color || generateProjectColor(),
    tags: data.tags || [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  projectsState.projects.push(project);
  saveProjects();
  logActivity(`Yeni proje oluşturuldu: ${project.name}`);
  
  toast(`"${project.name}" projesi oluşturuldu`, 'success');
  return project;
}

export function updateProject(projectId, updates) {
  const project = projectsState.projects.find(p => p.id === projectId);
  if (!project) return null;
  
  Object.assign(project, updates, { updatedAt: Date.now() });
  saveProjects();
  
  toast('Proje güncellendi', 'success');
  return project;
}

export function deleteProject(projectId) {
  const project = projectsState.projects.find(p => p.id === projectId);
  if (!project) return;
  
  if (!confirm(`"${project.name}" projesini silmek istediğinize emin misiniz?`)) return;
  
  projectsState.projects = projectsState.projects.filter(p => p.id !== projectId);
  
  // Remove associated milestones
  projectsState.milestones = projectsState.milestones.filter(m => m.projectId !== projectId);
  
  saveProjects();
  saveMilestones();
  logActivity(`Proje silindi: ${project.name}`);
  
  toast('Proje silindi', 'info');
  renderProjectsList();
}

export function switchProject(projectId) {
  const project = projectsState.projects.find(p => p.id === projectId);
  if (project) {
    projectsState.currentProject = project;
    saveProjects();
    renderProjectsList();
    renderProjectDetail();
    logActivity(`Proje değiştirildi: ${project.name}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Milestones
// ═══════════════════════════════════════════════════════════════

export function createMilestone(data) {
  const milestone = {
    id: genId(),
    projectId: data.projectId,
    title: data.title,
    description: data.description || '',
    dueDate: data.dueDate,
    status: data.status || 'pending',
    color: data.color || '#8b5cf6',
    createdAt: Date.now()
  };
  
  projectsState.milestones.push(milestone);
  saveMilestones();
  
  toast(`Kilometre taşı eklendi: ${milestone.title}`, 'success');
  return milestone;
}

export function updateMilestone(milestoneId, updates) {
  const milestone = projectsState.milestones.find(m => m.id === milestoneId);
  if (milestone) {
    Object.assign(milestone, updates);
    saveMilestones();
    renderProjectDetail();
  }
}

export function deleteMilestone(milestoneId) {
  projectsState.milestones = projectsState.milestones.filter(m => m.id !== milestoneId);
  saveMilestones();
  renderProjectDetail();
}

// ═══════════════════════════════════════════════════════════════
// Sprints (Agile)
// ═══════════════════════════════════════════════════════════════

export function createSprint(data) {
  const sprint = {
    id: genId(),
    projectId: data.projectId,
    name: data.name,
    goal: data.goal || '',
    startDate: data.startDate,
    endDate: data.endDate,
    status: 'planning',
    velocity: 0,
    storyPoints: {
      planned: 0,
      completed: 0
    },
    tasks: [],
    createdAt: Date.now()
  };
  
  projectsState.sprints.push(sprint);
  saveSprints();
  
  toast(`Sprint oluşturuldu: ${sprint.name}`, 'success');
  return sprint;
}

export function startSprint(sprintId) {
  const sprint = projectsState.sprints.find(s => s.id === sprintId);
  if (sprint) {
    sprint.status = 'active';
    sprint.startDate = todayStr();
    saveSprints();
    toast(`Sprint başlatıldı: ${sprint.name}`, 'success');
    renderSprints();
  }
}

export function completeSprint(sprintId) {
  const sprint = projectsState.sprints.find(s => s.id === sprintId);
  if (sprint) {
    sprint.status = 'completed';
    sprint.endDate = todayStr();
    saveSprints();
    logActivity(`Sprint tamamlandı: ${sprint.name}`);
    toast(`Sprint tamamlandı!`, 'success');
    renderSprints();
  }
}

// ═══════════════════════════════════════════════════════════════
// Budget & Time Tracking
// ═══════════════════════════════════════════════════════════════

export function addExpense(projectId, amount, description) {
  const project = projectsState.projects.find(p => p.id === projectId);
  if (project) {
    project.spent += amount;
    
    // Add expense record
    if (!project.expenses) project.expenses = [];
    project.expenses.push({
      id: genId(),
      amount,
      description,
      date: todayStr(),
      createdAt: Date.now()
    });
    
    saveProjects();
    toast(`Harcama eklendi: ₺${amount}`, 'info');
    renderProjectDetail();
  }
}

export function getProjectStats(projectId) {
  const project = projectsState.projects.find(p => p.id === projectId);
  if (!project) return null;
  
  const milestones = projectsState.milestones.filter(m => m.projectId === projectId);
  const sprints = projectsState.sprints.filter(s => s.projectId === projectId);
  const tasks = state.tasks.filter(t => t.projectId === projectId);
  
  return {
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter(m => m.status === 'completed').length,
    totalSprints: sprints.length,
    activeSprints: sprints.filter(s => s.status === 'active').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.completed).length,
    progress: tasks.length ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0,
    budgetUsed: project.budget ? Math.round((project.spent / project.budget) * 100) : 0,
    remainingBudget: project.budget - project.spent
  };
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderProjectsList() {
  const container = document.getElementById('projectsList');
  if (!container) return;
  
  const projects = projectsState.projects;
  const current = projectsState.currentProject;
  
  container.innerHTML = `
    <div class="projects-header">
      <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700;">
        📁 Projeler (${projects.length})
      </h2>
      <button class="btn btn-primary" onclick="openCreateProjectModal()">
        ➕ Yeni Proje
      </button>
    </div>
    
    <div class="projects-grid">
      ${projects.map(project => {
        const stats = getProjectStats(project.id);
        const isActive = current?.id === project.id;
        
        return `
          <div class="project-card ${isActive ? 'active' : ''}" onclick="switchProject('${project.id}')">
            <div class="project-color" style="background: ${project.color}"></div>
            <div class="project-info">
              <h3 class="project-name">${escHtml(project.name)}</h3>
              <p class="project-desc">${escHtml(project.description.slice(0, 60))}...</p>
              <div class="project-meta">
                <span class="project-status ${project.status}">${getStatusLabel(project.status)}</span>
                <span class="project-progress">${stats?.progress || 0}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${stats?.progress || 0}%; background: ${project.color}"></div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderProjectDetail() {
  const container = document.getElementById('projectDetail');
  if (!container) return;
  
  const project = projectsState.currentProject;
  if (!project) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <h3 class="empty-title">Proje Seçilmedi</h3>
        <p class="empty-desc">Detayları görüntülemek için bir proje seçin.</p>
      </div>
    `;
    return;
  }
  
  const stats = getProjectStats(project.id);
  const milestones = projectsState.milestones.filter(m => m.projectId === project.id);
  const sprints = projectsState.sprints.filter(s => s.projectId === project.id);
  
  container.innerHTML = `
    <div class="project-detail-header" style="border-left-color: ${project.color}">
      <div>
        <h2 style="font-family: var(--font-display); font-size: 2rem; font-weight: 700; margin-bottom: 8px;">
          ${escHtml(project.name)}
        </h2>
        <p style="color: var(--text-secondary);">${escHtml(project.description)}</p>
      </div>
      <div class="project-actions">
        <button class="btn btn-secondary" onclick="openEditProjectModal('${project.id}')">✏️ Düzenle</button>
        <button class="btn btn-danger" onclick="deleteProject('${project.id}')">🗑️ Sil</button>
      </div>
    </div>
    
    <div class="project-stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats?.progress || 0}%</div>
        <div class="stat-label">Tamamlanma</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats?.totalTasks || 0}</div>
        <div class="stat-label">Görevler</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${milestones.length}</div>
        <div class="stat-label">Kilometre Taşları</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${sprints.length}</div>
        <div class="stat-label">Sprintler</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">₺${project.spent.toLocaleString()}</div>
        <div class="stat-label">Harcama</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatDateFull(project.startDate)}</div>
        <div class="stat-label">Başlangıç</div>
      </div>
    </div>
    
    <div class="project-sections">
      <div class="project-section">
        <div class="section-header">
          <h3>🎯 Kilometre Taşları</h3>
          <button class="btn btn-sm btn-secondary" onclick="openAddMilestoneModal('${project.id}')">➕ Ekle</button>
        </div>
        <div class="milestones-list">
          ${milestones.length ? milestones.map(m => `
            <div class="milestone-item ${m.status}">
              <div class="milestone-color" style="background: ${m.color}"></div>
              <div class="milestone-info">
                <div class="milestone-title">${escHtml(m.title)}</div>
                <div class="milestone-date">${formatDateFull(m.dueDate)}</div>
              </div>
              <button class="btn-icon" onclick="deleteMilestone('${m.id}')">✕</button>
            </div>
          `).join('') : '<p class="empty-text">Henüz kilometre taşı yok</p>'}
        </div>
      </div>
      
      <div class="project-section">
        <div class="section-header">
          <h3>🏃 Sprintler</h3>
          <button class="btn btn-sm btn-secondary" onclick="openCreateSprintModal('${project.id}')">➕ Ekle</button>
        </div>
        <div class="sprints-list">
          ${sprints.length ? sprints.map(s => `
            <div class="sprint-item ${s.status}">
              <div class="sprint-info">
                <div class="sprint-name">${escHtml(s.name)}</div>
                <div class="sprint-goal">${escHtml(s.goal.slice(0, 50))}...</div>
                <div class="sprint-meta">
                  <span>${formatDateFull(s.startDate)} - ${formatDateFull(s.endDate)}</span>
                  <span class="sprint-status">${getSprintStatusLabel(s.status)}</span>
                </div>
              </div>
              <div class="sprint-actions">
                ${s.status === 'planning' ? `<button class="btn btn-sm btn-primary" onclick="startSprint('${s.id}')">▶ Başlat</button>` : ''}
                ${s.status === 'active' ? `<button class="btn btn-sm btn-success" onclick="completeSprint('${s.id}')">✓ Tamamla</button>` : ''}
              </div>
            </div>
          `).join('') : '<p class="empty-text">Henüz sprint yok</p>'}
        </div>
      </div>
    </div>
  `;
}

export function renderSprints() {
  const container = document.getElementById('sprintsView');
  if (!container) return;
  
  const sprints = projectsState.sprints;
  const activeSprint = sprints.find(s => s.status === 'active');
  
  container.innerHTML = `
    <div class="sprints-header">
      <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700;">
        🏃 Sprintler
      </h2>
      ${activeSprint ? `
        <div class="active-sprint-banner">
          <span>🟢 Aktif: ${escHtml(activeSprint.name)}</span>
          <span>${calculateSprintRemaining(activeSprint)} gün kaldı</span>
        </div>
      ` : ''}
    </div>
    
    <div class="sprints-board">
      ${['planning', 'active', 'completed'].map(status => `
        <div class="sprint-column">
          <div class="column-header">
            <span>${getSprintColumnLabel(status)}</span>
            <span class="column-count">${sprints.filter(s => s.status === status).length}</span>
          </div>
          <div class="column-content">
            ${sprints.filter(s => s.status === status).map(sprint => `
              <div class="sprint-card ${sprint.status}">
                <h4>${escHtml(sprint.name)}</h4>
                <p>${escHtml(sprint.goal.slice(0, 60))}...</p>
                <div class="sprint-stats">
                  <span>${sprint.storyPoints.completed}/${sprint.storyPoints.planned} SP</span>
                  <span>${formatDateFull(sprint.endDate)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function generateProjectColor() {
  const colors = ['#8b5cf6', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getStatusLabel(status) {
  const labels = {
    active: 'Aktif',
    completed: 'Tamamlandı',
    paused: 'Duraklatıldı',
    cancelled: 'İptal'
  };
  return labels[status] || status;
}

function getSprintStatusLabel(status) {
  const labels = {
    planning: 'Planlama',
    active: 'Devam Ediyor',
    completed: 'Tamamlandı'
  };
  return labels[status] || status;
}

function getSprintColumnLabel(status) {
  const labels = {
    planning: '📋 Planlama',
    active: '🏃 Aktif',
    completed: '✅ Tamamlanan'
  };
  return labels[status] || status;
}

function calculateSprintRemaining(sprint) {
  if (!sprint.endDate) return 0;
  const end = new Date(sprint.endDate);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ═══════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════

export function openCreateProjectModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'createProjectModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 560px;">
      <div class="modal-header">
        <div class="modal-title">➕ Yeni Proje</div>
        <button class="modal-close" onclick="closeModal('createProjectModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Proje Adı</label>
          <input type="text" class="form-input" id="projectName" placeholder="Proje adı...">
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-textarea" id="projectDesc" placeholder="Proje açıklaması..."></textarea>
        </div>
        <div class="flex gap-md">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Başlangıç Tarihi</label>
            <input type="date" class="form-input" id="projectStart">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Bitiş Tarihi (Opsiyonel)</label>
            <input type="date" class="form-input" id="projectEnd">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Bütçe (₺)</label>
          <input type="number" class="form-input" id="projectBudget" placeholder="0">
        </div>
        <div class="flex gap-md">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Öncelik</label>
            <select class="form-select" id="projectPriority">
              <option value="low">🔵 Düşük</option>
              <option value="medium" selected>🟢 Orta</option>
              <option value="high">🟠 Yüksek</option>
              <option value="critical">🔴 Kritik</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Renk</label>
            <input type="color" class="form-input" id="projectColor" value="#8b5cf6">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('createProjectModal')">İptal</button>
        <button class="btn btn-primary" onclick="saveNewProject()">💾 Oluştur</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('projectStart').value = todayStr();
  document.getElementById('projectName').focus();
}

export function openAddMilestoneModal(projectId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'addMilestoneModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 420px;">
      <div class="modal-header">
        <div class="modal-title">🎯 Kilometre Taşı Ekle</div>
        <button class="modal-close" onclick="closeModal('addMilestoneModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Başlık</label>
          <input type="text" class="form-input" id="milestoneTitle" placeholder="Örn: v1.0 Release">
        </div>
        <div class="form-group">
          <label class="form-label">Hedef Tarih</label>
          <input type="date" class="form-input" id="milestoneDate">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('addMilestoneModal')">İptal</button>
        <button class="btn btn-primary" onclick="saveMilestone('${projectId}')">➕ Ekle</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('milestoneTitle').focus();
}

export function openCreateSprintModal(projectId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'createSprintModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <div class="modal-title">🏃 Sprint Oluştur</div>
        <button class="modal-close" onclick="closeModal('createSprintModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Sprint Adı</label>
          <input type="text" class="form-input" id="sprintName" placeholder="Örn: Sprint 1">
        </div>
        <div class="form-group">
          <label class="form-label">Sprint Hedefi</label>
          <textarea class="form-textarea" id="sprintGoal" placeholder="Bu sprint'te ne başarmak istiyorsunuz?"></textarea>
        </div>
        <div class="flex gap-md">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Başlangıç</label>
            <input type="date" class="form-input" id="sprintStart">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Bitiş</label>
            <input type="date" class="form-input" id="sprintEnd">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('createSprintModal')">İptal</button>
        <button class="btn btn-primary" onclick="saveSprint('${projectId}')">➕ Oluştur</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('sprintName').focus();
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.openCreateProjectModal = openCreateProjectModal;
window.openAddMilestoneModal = openAddMilestoneModal;
window.openCreateSprintModal = openCreateSprintModal;
window.switchProject = switchProject;
window.deleteProject = deleteProject;
window.startSprint = startSprint;
window.completeSprint = completeSprint;
window.deleteMilestone = deleteMilestone;

window.saveNewProject = () => {
  const name = document.getElementById('projectName').value.trim();
  if (!name) {
    toast('Proje adı gerekli', 'error');
    return;
  }
  
  createProject({
    name,
    description: document.getElementById('projectDesc').value.trim(),
    startDate: document.getElementById('projectStart').value,
    endDate: document.getElementById('projectEnd').value || null,
    budget: parseInt(document.getElementById('projectBudget').value) || 0,
    priority: document.getElementById('projectPriority').value,
    color: document.getElementById('projectColor').value
  });
  
  closeModal('createProjectModal');
  document.getElementById('createProjectModal').remove();
  renderProjectsList();
};

window.saveMilestone = (projectId) => {
  const title = document.getElementById('milestoneTitle').value.trim();
  if (!title) {
    toast('Başlık gerekli', 'error');
    return;
  }
  
  createMilestone({
    projectId,
    title,
    dueDate: document.getElementById('milestoneDate').value
  });
  
  closeModal('addMilestoneModal');
  document.getElementById('addMilestoneModal').remove();
  renderProjectDetail();
};

window.saveSprint = (projectId) => {
  const name = document.getElementById('sprintName').value.trim();
  if (!name) {
    toast('Sprint adı gerekli', 'error');
    return;
  }
  
  createSprint({
    projectId,
    name,
    goal: document.getElementById('sprintGoal').value.trim(),
    startDate: document.getElementById('sprintStart').value,
    endDate: document.getElementById('sprintEnd').value
  });
  
  closeModal('createSprintModal');
  document.getElementById('createSprintModal').remove();
  renderProjectDetail();
};

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadProjects() {
  const saved = getStorage(PROJECTS_STORAGE_KEY, '{}');
  if (saved.projects) {
    projectsState.projects = saved.projects;
    projectsState.currentProject = saved.currentProject;
  }
  
  const savedMilestones = getStorage(MILESTONES_STORAGE_KEY, '[]');
  projectsState.milestones = savedMilestones;
  
  const savedSprints = getStorage('devvault_sprints', '[]');
  projectsState.sprints = savedSprints;
}

function saveProjects() {
  setStorage(PROJECTS_STORAGE_KEY, {
    projects: projectsState.projects,
    currentProject: projectsState.currentProject
  });
}

function saveMilestones() {
  setStorage(MILESTONES_STORAGE_KEY, projectsState.milestones);
}

function saveSprints() {
  setStorage('devvault_sprints', projectsState.sprints);
}

// Window exports for index.html
window.renderProjectsList = renderProjectsList;
window.renderProjectDetail = renderProjectDetail;

// Exports
export function getCurrentProject() {
  return projectsState.currentProject;
}

export function getAllProjects() {
  return projectsState.projects;
}

export function getProjectById(id) {
  return projectsState.projects.find(p => p.id === id);
}
