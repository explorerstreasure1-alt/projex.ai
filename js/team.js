/* ═══════════════════════════════════════════════════════════════
   Team Module - Multi-user & Collaboration
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';

// ═══════════════════════════════════════════════════════════════
// Team State
// ═══════════════════════════════════════════════════════════════

const TEAM_STORAGE_KEY = 'devvault_team';
const CURRENT_USER_KEY = 'devvault_current_user';

let teamState = {
  currentUser: null,
  members: [],
  workspace: {
    id: 'default',
    name: 'Kişisel Çalışma Alanı',
    type: 'personal'
  },
  workspaces: [],
  activityLog: [],
  isOnline: true
};

// ═══════════════════════════════════════════════════════════════
// Initialize Team Module
// ═══════════════════════════════════════════════════════════════

export function initTeam() {
  loadTeamState();
  
  // If no current user, create default
  if (!teamState.currentUser) {
    createDefaultUser();
  }
  
  renderTeamSection();
  renderWorkspaceSwitcher();
  updateOnlineStatus(true);
}

// ═══════════════════════════════════════════════════════════════
// User Management
// ═══════════════════════════════════════════════════════════════

function createDefaultUser() {
  const user = {
    id: genId(),
    name: 'Ben',
    email: '',
    role: 'owner',
    avatar: generateAvatar('Ben'),
    color: generateUserColor(),
    status: 'online',
    joinedAt: Date.now()
  };
  
  teamState.currentUser = user;
  teamState.members = [user];
  saveTeamState();
}

export function createUser(name, email, role = 'member') {
  const user = {
    id: genId(),
    name,
    email,
    role,
    avatar: generateAvatar(name),
    color: generateUserColor(),
    status: 'offline',
    joinedAt: Date.now()
  };
  
  teamState.members.push(user);
  saveTeamState();
  
  logActivity(`${name} ekibe eklendi`);
  renderTeamSection();
  
  toast(`${name} ekibe eklendi`, 'success');
  return user;
}

export function removeUser(userId) {
  const user = teamState.members.find(m => m.id === userId);
  if (!user) return;
  
  if (user.role === 'owner') {
    toast('Proje sahibi kaldırılamaz', 'error');
    return;
  }
  
  teamState.members = teamState.members.filter(m => m.id !== userId);
  saveTeamState();
  
  logActivity(`${user.name} ekipten çıkarıldı`);
  renderTeamSection();
  
  toast(`${user.name} ekipten çıkarıldı`, 'info');
}

export function updateUserStatus(userId, status) {
  const member = teamState.members.find(m => m.id === userId);
  if (member) {
    member.status = status;
    member.lastSeen = Date.now();
    saveTeamState();
    renderTeamSection();
  }
}

function generateAvatar(name) {
  return name.charAt(0).toUpperCase();
}

function generateUserColor() {
  const colors = ['#7c6aff', '#10d48a', '#f59e0b', '#ff4f6a', '#38bdf8', '#c084fc', '#fb923c'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ═══════════════════════════════════════════════════════════════
// Workspace Management
// ═══════════════════════════════════════════════════════════════

export function createWorkspace(name, type = 'team') {
  const workspace = {
    id: genId(),
    name,
    type,
    ownerId: teamState.currentUser?.id,
    members: [teamState.currentUser?.id],
    createdAt: Date.now()
  };
  
  teamState.workspaces.push(workspace);
  saveTeamState();
  
  toast(`"${name}" çalışma alanı oluşturuldu`, 'success');
  return workspace;
}

export function switchWorkspace(workspaceId) {
  const workspace = teamState.workspaces.find(w => w.id === workspaceId) || teamState.workspace;
  teamState.workspace = workspace;
  saveTeamState();
  
  renderWorkspaceSwitcher();
  logActivity(`"${workspace.name}" çalışma alanına geçildi`);
  
  // Reload data for new workspace
  // In real app, this would fetch workspace-specific data
  toast(`"${workspace.name}" çalışma alanına geçildi`, 'success');
}

// ═══════════════════════════════════════════════════════════════
// Activity Log
// ═══════════════════════════════════════════════════════════════

export function logActivity(message, type = 'info') {
  const activity = {
    id: genId(),
    message,
    type,
    userId: teamState.currentUser?.id,
    userName: teamState.currentUser?.name,
    timestamp: Date.now()
  };
  
  teamState.activityLog.unshift(activity);
  
  // Keep last 50 activities
  if (teamState.activityLog.length > 50) {
    teamState.activityLog = teamState.activityLog.slice(0, 50);
  }
  
  saveTeamState();
  
  // Broadcast to other team members (in real app)
  broadcastActivity(activity);
}

function broadcastActivity(activity) {
  // In a real app with WebSocket/Supabase, this would broadcast
  console.log('[Activity]', activity);
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderTeamSection() {
  const container = document.getElementById('teamSection');
  if (!container) return;
  
  const members = teamState.members;
  const currentUser = teamState.currentUser;
  
  container.innerHTML = `
    <div class="team-header">
      <span class="team-label">Ekip</span>
      <span class="team-count">${members.length}</span>
    </div>
    <div class="team-list">
      ${members.map(member => renderTeamMember(member, member.id === currentUser?.id)).join('')}
    </div>
    <div class="add-member-btn" onclick="openAddMemberModal()">
      <span>＋</span> <span>Ekip üyesi ekle</span>
    </div>
  `;
}

function renderTeamMember(member, isCurrentUser) {
  const statusClass = member.status || 'offline';
  const isOnline = statusClass === 'online';
  
  return `
    <div class="team-member" onclick="showMemberProfile('${member.id}')" title="${isCurrentUser ? 'Siz' : member.name}">
      <div class="member-avatar ${statusClass}" style="background: ${member.color}">
        ${escHtml(member.avatar)}
      </div>
      <div class="member-info">
        <div class="member-name">${escHtml(member.name)} ${isCurrentUser ? '(Siz)' : ''}</div>
        <div class="member-role">${getRoleLabel(member.role)}</div>
      </div>
      <div class="member-status ${statusClass}"></div>
    </div>
  `;
}

function getRoleLabel(role) {
  const labels = {
    owner: 'Proje Sahibi',
    admin: 'Yönetici',
    member: 'Üye',
    viewer: 'Görüntüleyici'
  };
  return labels[role] || role;
}

export function renderWorkspaceSwitcher() {
  const container = document.getElementById('workspaceSwitcher');
  if (!container) return;
  
  const current = teamState.workspace;
  const workspaces = teamState.workspaces;
  
  container.innerHTML = `
    <div class="workspace-switcher" id="workspaceDropdown" onclick="toggleWorkspaceDropdown()">
      <div class="workspace-header">
        <div class="workspace-icon">${escHtml(current.name.charAt(0))}</div>
        <div class="workspace-info">
          <div class="workspace-name">${escHtml(current.name)}</div>
          <div class="workspace-type">${getWorkspaceTypeLabel(current.type)}</div>
        </div>
        <span class="workspace-dropdown">▼</span>
      </div>
      <div class="workspace-list">
        ${workspaces.map(ws => `
          <div class="workspace-item ${ws.id === current.id ? 'active' : ''}" onclick="switchWorkspace('${ws.id}'); event.stopPropagation();">
            <div class="workspace-icon" style="background: ${ws.id === current.id ? 'var(--accent)' : 'var(--border)'}">${escHtml(ws.name.charAt(0))}</div>
            <div class="workspace-info">
              <div class="workspace-name">${escHtml(ws.name)}</div>
              <div class="workspace-type">${getWorkspaceTypeLabel(ws.type)}</div>
            </div>
          </div>
        `).join('')}
        <div class="workspace-item" onclick="openCreateWorkspaceModal(); event.stopPropagation();">
          <div class="workspace-icon" style="background: var(--green-dim); color: var(--green)">＋</div>
          <div class="workspace-info">
            <div class="workspace-name" style="color: var(--green)">Yeni Çalışma Alanı</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getWorkspaceTypeLabel(type) {
  const labels = {
    personal: 'Kişisel',
    team: 'Ekip',
    company: 'Şirket'
  };
  return labels[type] || type;
}

export function renderActivityFeed() {
  const container = document.getElementById('activityFeed');
  if (!container) return;
  
  const activities = teamState.activityLog.slice(0, 10);
  
  if (!activities.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.8rem;">
        Henüz aktivite yok
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    ${activities.map(activity => `
      <div class="activity-item">
        <div class="activity-avatar" style="background: ${getUserColor(activity.userId)}">
          ${escHtml(getUserAvatar(activity.userId))}
        </div>
        <div class="activity-content">
          <div class="activity-text">${escHtml(activity.message)}</div>
          <div class="activity-time">${formatDateFull(activity.timestamp)}</div>
        </div>
      </div>
    `).join('')}
  `;
}

function getUserColor(userId) {
  const member = teamState.members.find(m => m.id === userId);
  return member?.color || '#7c6aff';
}

function getUserAvatar(userId) {
  const member = teamState.members.find(m => m.id === userId);
  return member?.avatar || '?';
}

// ═══════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════

export function openAddMemberModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'addMemberModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 420px">
      <div class="modal-header">
        <div class="modal-title">Ekip Üyesi Ekle</div>
        <button class="modal-close" onclick="closeModal('addMemberModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">İsim</label>
          <input type="text" class="form-input" id="newMemberName" placeholder="Ekip üyesinin adı...">
        </div>
        <div class="form-group">
          <label class="form-label">E-posta</label>
          <input type="email" class="form-input" id="newMemberEmail" placeholder="ornek@sirket.com">
        </div>
        <div class="form-group">
          <label class="form-label">Rol</label>
          <select class="form-select" id="newMemberRole">
            <option value="member">Üye - Görevleri yönetebilir</option>
            <option value="admin">Yönetici - Tüm ayarları değiştirebilir</option>
            <option value="viewer">Görüntüleyici - Sadece görüntüleyebilir</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('addMemberModal')">İptal</button>
        <button class="btn btn-primary" onclick="addNewMember()">➕ Ekle</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('newMemberName')?.focus();
}

export function openCreateWorkspaceModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'createWorkspaceModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 420px">
      <div class="modal-header">
        <div class="modal-title">Yeni Çalışma Alanı</div>
        <button class="modal-close" onclick="closeModal('createWorkspaceModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Çalışma Alanı Adı</label>
          <input type="text" class="form-input" id="newWorkspaceName" placeholder="Örn: Yazılım Ekibi">
        </div>
        <div class="form-group">
          <label class="form-label">Tür</label>
          <select class="form-select" id="newWorkspaceType">
            <option value="team">Ekip - Ortak projeler</option>
            <option value="company">Şirket - Tüm departmanlar</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('createWorkspaceModal')">İptal</button>
        <button class="btn btn-primary" onclick="createNewWorkspace()">➕ Oluştur</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('newWorkspaceName')?.focus();
}

export function showMemberProfile(memberId) {
  const member = teamState.members.find(m => m.id === memberId);
  if (!member) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'memberProfileModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 360px">
      <div class="modal-header">
        <div class="modal-title">Ekip Üyesi</div>
        <button class="modal-close" onclick="closeModal('memberProfileModal')">✕</button>
      </div>
      <div class="modal-body" style="text-align: center; padding: 30px">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: ${member.color}; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #fff; margin: 0 auto 16px;">
          ${escHtml(member.avatar)}
        </div>
        <h3 style="font-family: 'Syne', sans-serif; font-weight: 700; margin-bottom: 4px;">${escHtml(member.name)}</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">${getRoleLabel(member.role)}</p>
        ${member.email ? `<p style="color: var(--text-dim); font-size: 0.75rem;">${escHtml(member.email)}</p>` : ''}
        <div style="margin-top: 20px; display: flex; gap: 8px; justify-content: center;">
          <span class="priority-badge ${member.status === 'online' ? 'pb-low' : 'pb-none'}">
            ${member.status === 'online' ? '🟢 Çevrimiçi' : '⚪ Çevrimdışı'}
          </span>
        </div>
      </div>
      ${member.id !== teamState.currentUser?.id && teamState.currentUser?.role === 'owner' ? `
        <div class="modal-footer">
          <button class="btn btn-danger" onclick="removeTeamMember('${member.id}')">🗑️ Ekipten Çıkar</button>
        </div>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════
// Global Functions for onclick handlers
// ═══════════════════════════════════════════════════════════════

window.openAddMemberModal = openAddMemberModal;
window.openCreateWorkspaceModal = openCreateWorkspaceModal;
window.showMemberProfile = showMemberProfile;

window.addNewMember = () => {
  const name = document.getElementById('newMemberName')?.value.trim();
  const email = document.getElementById('newMemberEmail')?.value.trim();
  const role = document.getElementById('newMemberRole')?.value || 'member';
  
  if (!name) {
    toast('İsim gerekli', 'error');
    return;
  }
  
  createUser(name, email, role);
  closeModal('addMemberModal');
  document.getElementById('addMemberModal')?.remove();
};

window.createNewWorkspace = () => {
  const name = document.getElementById('newWorkspaceName')?.value.trim();
  const type = document.getElementById('newWorkspaceType')?.value || 'team';
  
  if (!name) {
    toast('Çalışma alanı adı gerekli', 'error');
    return;
  }
  
  createWorkspace(name, type);
  closeModal('createWorkspaceModal');
  document.getElementById('createWorkspaceModal')?.remove();
};

window.removeTeamMember = (memberId) => {
  removeUser(memberId);
  closeModal('memberProfileModal');
  document.getElementById('memberProfileModal')?.remove();
};

window.toggleWorkspaceDropdown = () => {
  const dropdown = document.getElementById('workspaceDropdown');
  dropdown?.classList.toggle('open');
};

window.switchWorkspace = (workspaceId) => {
  switchWorkspace(workspaceId);
};

// ═══════════════════════════════════════════════════════════════
// Storage & Persistence
// ═══════════════════════════════════════════════════════════════

function loadTeamState() {
  const saved = getStorage(TEAM_STORAGE_KEY, '{}');
  if (saved && Object.keys(saved).length > 0) {
    teamState = { ...teamState, ...saved };
  }
}

function saveTeamState() {
  setStorage(TEAM_STORAGE_KEY, teamState);
}

export function updateOnlineStatus(online) {
  teamState.isOnline = online;
  if (teamState.currentUser) {
    updateUserStatus(teamState.currentUser.id, online ? 'online' : 'offline');
  }
}

// Handle page visibility changes
 document.addEventListener('visibilitychange', () => {
  updateOnlineStatus(!document.hidden);
});

// Export team state for other modules
export function getCurrentUser() {
  return teamState.currentUser;
}

export function getTeamMembers() {
  return teamState.members;
}

export function getCurrentWorkspace() {
  return teamState.workspace;
}
