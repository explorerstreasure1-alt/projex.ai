/* ═══════════════════════════════════════════════════════════════
   Meetings Module - Video Conferencing & Collaboration
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull, formatTime } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Meetings State
// ═══════════════════════════════════════════════════════════════

const MEETINGS_STORAGE_KEY = 'devvault_meetings';

let meetingsState = {
  rooms: [],
  activeRoom: null,
  isRecording: false,
  recordingStartTime: null,
  participants: [],
  screenShares: [],
  currentUser: { id: 'user_1', name: 'Ben', avatar: '👤' }
};

// ═══════════════════════════════════════════════════════════════
// Initialize Meetings
// ═══════════════════════════════════════════════════════════════

export function initMeetings() {
  loadMeetings();
  
  if (!meetingsState.rooms.length) {
    createDefaultRooms();
  }
  
  console.log('[Meetings] Module initialized');
}

function createDefaultRooms() {
  createMeetingRoom({
    name: 'Günlük Stand-up',
    type: 'scheduled',
    schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], time: '09:00' }
  });
  
  createMeetingRoom({
    name: 'Sprint Planning',
    type: 'permanent',
    maxParticipants: 20
  });
  
  createMeetingRoom({
    name: 'Tasarım Review',
    type: 'permanent',
    maxParticipants: 10
  });
}

// ═══════════════════════════════════════════════════════════════
// Room Management
// ═══════════════════════════════════════════════════════════════

export function createMeetingRoom(data) {
  const room = {
    id: genId(),
    name: data.name,
    type: data.type || 'instant', // 'instant' | 'scheduled' | 'permanent'
    password: data.password || null,
    maxParticipants: data.maxParticipants || 50,
    participants: [],
    isActive: false,
    createdAt: Date.now(),
    schedule: data.schedule || null,
    settings: {
      muteOnEntry: true,
      waitingRoom: false,
      recording: false,
      chat: true,
      screenShare: true,
      ...data.settings
    }
  };
  
  meetingsState.rooms.push(room);
  saveMeetings();
  
  toast(`🏢 "${room.name}" odası oluşturuldu`, 'success');
  return room;
}

export function deleteMeetingRoom(roomId) {
  meetingsState.rooms = meetingsState.rooms.filter(r => r.id !== roomId);
  saveMeetings();
  renderMeetingsList();
}

export function joinMeetingRoom(roomId, password = null) {
  const room = meetingsState.rooms.find(r => r.id === roomId);
  if (!room) {
    toast('Oda bulunamadı', 'error');
    return;
  }
  
  if (room.password && room.password !== password) {
    toast('Yanlış şifre', 'error');
    return;
  }
  
  if (room.participants.length >= room.maxParticipants) {
    toast('Oda dolu', 'error');
    return;
  }
  
  // Add participant
  const participant = {
    id: meetingsState.currentUser.id,
    name: meetingsState.currentUser.name,
    avatar: meetingsState.currentUser.avatar,
    isHost: room.participants.length === 0,
    isMuted: room.settings.muteOnEntry,
    isVideoOn: false,
    isScreenSharing: false,
    joinedAt: Date.now()
  };
  
  room.participants.push(participant);
  room.isActive = true;
  meetingsState.activeRoom = room;
  
  saveMeetings();
  
  // Open meeting interface
  openMeetingInterface(room);
  
  toast(`🏢 "${room.name}" odasına katıldınız`, 'success');
  logActivity(`Toplantıya katıldı: ${room.name}`);
  
  // Simulate other participants joining
  simulateParticipants(room);
}

export function leaveMeetingRoom() {
  if (!meetingsState.activeRoom) return;
  
  const room = meetingsState.activeRoom;
  room.participants = room.participants.filter(p => p.id !== meetingsState.currentUser.id);
  
  if (room.participants.length === 0) {
    room.isActive = false;
    stopRecording();
  }
  
  meetingsState.activeRoom = null;
  saveMeetings();
  
  closeModal('meetingModal');
  document.getElementById('meetingModal')?.remove();
  
  toast('Toplantıdan ayrıldınız', 'info');
}

// ═══════════════════════════════════════════════════════════════
// Recording Functions
// ═══════════════════════════════════════════════════════════════

export function startRecording() {
  if (!meetingsState.activeRoom) return;
  
  meetingsState.isRecording = true;
  meetingsState.recordingStartTime = Date.now();
  
  toast('🔴 Kayıt başladı', 'success');
  logActivity(`Kayıt başlatıldı: ${meetingsState.activeRoom.name}`);
  
  updateRecordingUI();
  
  // Simulate recording chunks
  meetingsState.recordingChunks = [];
}

export function stopRecording() {
  if (!meetingsState.isRecording) return;
  
  const duration = Date.now() - meetingsState.recordingStartTime;
  
  meetingsState.isRecording = false;
  meetingsState.recordingStartTime = null;
  
  // Save recording
  const recording = {
    id: genId(),
    roomId: meetingsState.activeRoom?.id,
    roomName: meetingsState.activeRoom?.name,
    duration: duration,
    date: new Date().toISOString(),
    participants: meetingsState.activeRoom?.participants.map(p => p.name) || []
  };
  
  const recordings = getStorage('devvault_recordings', []);
  recordings.push(recording);
  setStorage('devvault_recordings', recordings);
  
  toast(`⏹️ Kayıt durduruldu. Süre: ${formatDuration(duration)}`, 'success');
  logActivity(`Kayıt tamamlandı: ${recording.roomName}`);
  
  updateRecordingUI();
}

export function pauseRecording() {
  meetingsState.isRecording = false;
  toast('⏸️ Kayıt duraklatıldı', 'info');
  updateRecordingUI();
}

// ═══════════════════════════════════════════════════════════════
// Screen Sharing
// ═══════════════════════════════════════════════════════════════

export async function startScreenShare() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: true
    });
    
    meetingsState.screenStream = stream;
    
    // Update participant
    const me = meetingsState.activeRoom?.participants.find(p => p.id === meetingsState.currentUser.id);
    if (me) {
      me.isScreenSharing = true;
    }
    
    toast('🖥️ Ekran paylaşımı başladı', 'success');
    updateMeetingGrid();
    
    stream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };
  } catch (err) {
    toast('Ekran paylaşımı başarısız', 'error');
    console.error('Screen share error:', err);
  }
}

export function stopScreenShare() {
  if (meetingsState.screenStream) {
    meetingsState.screenStream.getTracks().forEach(track => track.stop());
    meetingsState.screenStream = null;
  }
  
  const me = meetingsState.activeRoom?.participants.find(p => p.id === meetingsState.currentUser.id);
  if (me) {
    me.isScreenSharing = false;
  }
  
  toast('🖥️ Ekran paylaşımı durduruldu', 'info');
  updateMeetingGrid();
}

// ═══════════════════════════════════════════════════════════════
// Meeting Controls
// ═══════════════════════════════════════════════════════════════

export function toggleMute() {
  const me = meetingsState.activeRoom?.participants.find(p => p.id === meetingsState.currentUser.id);
  if (me) {
    me.isMuted = !me.isMuted;
    updateParticipantUI(me);
    toast(me.isMuted ? '🎤 Mikrofon kapalı' : '🎤 Mikrofon açık', 'info');
  }
}

export function toggleVideo() {
  const me = meetingsState.activeRoom?.participants.find(p => p.id === meetingsState.currentUser.id);
  if (me) {
    me.isVideoOn = !me.isVideoOn;
    updateParticipantUI(me);
    toast(me.isVideoOn ? '📹 Kamera açık' : '📹 Kamera kapalı', 'info');
  }
}

export function toggleHand() {
  const me = meetingsState.activeRoom?.participants.find(p => p.id === meetingsState.currentUser.id);
  if (me) {
    me.hasHandRaised = !me.hasHandRaised;
    updateParticipantUI(me);
    toast(me.hasHandRaised ? '✋ El kaldırıldı' : '👇 El indirildi', 'info');
  }
}

// ═══════════════════════════════════════════════════════════════
// UI Rendering
// ═══════════════════════════════════════════════════════════════

export function renderMeetingsList() {
  const container = document.getElementById('meetingsList');
  if (!container) return;
  
  container.innerHTML = `
    <div class="meetings-header">
      <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700;">
        🏢 Toplantı Odaları
      </h2>
      <button class="btn btn-primary" onclick="openCreateMeetingModal()">
        ➕ Yeni Oda
      </button>
    </div>
    
    <div class="meetings-grid">
      ${meetingsState.rooms.map(room => renderRoomCard(room)).join('')}
    </div>
    
    <div class="recordings-section" style="margin-top: var(--space-xl);">
      <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: var(--space-md);">
        🎙️ Kayıtlar
      </h3>
      ${renderRecordingsList()}
    </div>
  `;
}

function renderRoomCard(room) {
  return `
    <div class="meeting-room-card ${room.isActive ? 'active' : ''}">
      <div class="room-header">
        <div class="room-avatar">${room.type === 'scheduled' ? '📅' : '🏢'}</div>
        <div class="room-status ${room.isActive ? 'live' : ''}">
          ${room.isActive ? '● CANLI' : '● Bekliyor'}
        </div>
      </div>
      <h3 class="room-name">${escHtml(room.name)}</h3>
      <div class="room-meta">
        <span>👥 ${room.participants.length}/${room.maxParticipants}</span>
        ${room.settings.recording ? '<span>🔴 REC</span>' : ''}
      </div>
      <div class="room-actions">
        <button class="btn btn-primary" onclick="joinMeetingRoom('${room.id}')">
          ${room.isActive ? 'Katıl' : 'Başlat'}
        </button>
        ${room.participants.length === 0 ? `<button class="btn btn-ghost" onclick="deleteMeetingRoom('${room.id}')">🗑️</button>` : ''}
      </div>
    </div>
  `;
}

function renderRecordingsList() {
  const recordings = getStorage('devvault_recordings', []);
  
  if (!recordings.length) {
    return '<p class="empty-text">Henüz kayıt yok</p>';
  }
  
  return `
    <div class="recordings-list">
      ${recordings.slice(-5).reverse().map(rec => `
        <div class="recording-item">
          <div class="recording-info">
            <span class="recording-icon">🎙️</span>
            <div>
              <div class="recording-name">${escHtml(rec.roomName)}</div>
              <div class="recording-meta">${new Date(rec.date).toLocaleDateString('tr-TR')} • ${formatDuration(rec.duration)}</div>
            </div>
          </div>
          <div class="recording-actions">
            <button class="btn-icon" onclick="playRecording('${rec.id}')">▶️</button>
            <button class="btn-icon" onclick="downloadRecording('${rec.id}')">⬇️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openMeetingInterface(room) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open meeting-overlay';
  modal.id = 'meetingModal';
  
  modal.innerHTML = `
    <div class="meeting-container">
      <div class="meeting-header">
        <div class="meeting-info">
          <h3>${escHtml(room.name)}</h3>
          <span class="meeting-participants">${room.participants.length} katılımcı</span>
        </div>
        <div class="meeting-actions">
          ${room.settings.recording ? `
            <button class="btn-icon ${meetingsState.isRecording ? 'recording' : ''}" onclick="toggleRecording()" title="Kayıt">
              🔴
            </button>
          ` : ''}
          <button class="btn-icon" onclick="toggleMeetingInfo()" title="Bilgi">ℹ️</button>
          <button class="btn-icon" onclick="leaveMeetingRoom()" title="Ayrıl">📞</button>
        </div>
      </div>
      
      <div class="meeting-grid" id="meetingGrid">
        ${room.participants.map(p => renderParticipantVideo(p)).join('')}
      </div>
      
      ${renderScreenShareSlot()}
      
      <div class="meeting-chat" id="meetingChat">
        <div class="chat-messages" id="meetingChatMessages"></div>
        <div class="chat-input-row">
          <input type="text" class="chat-input" id="meetingChatInput" placeholder="Mesaj yaz..." 
                 onkeypress="if(event.key==='Enter') sendMeetingMessage()">
          <button class="btn-primary" onclick="sendMeetingMessage()">➤</button>
        </div>
      </div>
      
      <div class="meeting-controls">
        <button class="control-btn ${room.participants.find(p => p.id === meetingsState.currentUser.id)?.isMuted ? 'active' : ''}" onclick="toggleMute()" title="Mikrofon">
          ${room.participants.find(p => p.id === meetingsState.currentUser.id)?.isMuted ? '🎤🔇' : '🎤'}
        </button>
        <button class="control-btn ${room.participants.find(p => p.id === meetingsState.currentUser.id)?.isVideoOn ? 'active' : ''}" onclick="toggleVideo()" title="Kamera">
          ${room.participants.find(p => p.id === meetingsState.currentUser.id)?.isVideoOn ? '📹' : '📹❌'}
        </button>
        <button class="control-btn" onclick="toggleScreenShare()" title="Ekran Paylaşımı">
          🖥️
        </button>
        <button class="control-btn" onclick="toggleHand()" title="El Kaldır">
          ✋
        </button>
        <button class="control-btn" onclick="toggleChat()" title="Sohbet">
          💬
        </button>
        <button class="control-btn end" onclick="leaveMeetingRoom()" title="Ayrıl">
          📞
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Expose functions
  window.toggleRecording = () => {
    if (meetingsState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  window.toggleMute = toggleMute;
  window.toggleVideo = toggleVideo;
  window.toggleScreenShare = () => {
    const me = meetingsState.activeRoom?.participants.find(p => p.id === meetingsState.currentUser.id);
    if (me?.isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };
  window.toggleHand = toggleHand;
  window.toggleChat = () => {
    const chat = document.getElementById('meetingChat');
    chat?.classList.toggle('open');
  };
  window.toggleMeetingInfo = () => {
    toast(`Oda ID: ${room.id}`, 'info');
  };
  window.sendMeetingMessage = () => {
    const input = document.getElementById('meetingChatInput');
    if (!input?.value.trim()) return;
    
    const container = document.getElementById('meetingChatMessages');
    container.innerHTML += `
      <div class="meeting-message">
        <span class="msg-sender">Ben:</span>
        <span class="msg-text">${escHtml(input.value)}</span>
      </div>
    `;
    container.scrollTop = container.scrollHeight;
    input.value = '';
    
    // Simulate reply
    setTimeout(() => {
      const replies = ['Anladım', 'Tamam', '👍', 'Güzel', 'Teşekkürler'];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      const randomUser = room.participants.find(p => p.id !== meetingsState.currentUser.id);
      if (randomUser) {
        container.innerHTML += `
          <div class="meeting-message other">
            <span class="msg-sender">${randomUser.name}:</span>
            <span class="msg-text">${randomReply}</span>
          </div>
        `;
        container.scrollTop = container.scrollHeight;
      }
    }, 2000);
  };
  
  // Start timer updates
  startMeetingTimer();
}

function renderParticipantVideo(participant) {
  return `
    <div class="participant-tile ${participant.isScreenSharing ? 'screen-sharing' : ''}" data-participant="${participant.id}">
      <div class="participant-video">
        ${participant.isVideoOn ? `
          <div class="video-placeholder">
            <span>${participant.avatar}</span>
          </div>
        ` : `
          <div class="video-off">
            <span class="participant-avatar-large">${participant.avatar}</span>
          </div>
        `}
      </div>
      <div class="participant-bar">
        <span class="participant-name">${escHtml(participant.name)} ${participant.isHost ? '(Host)' : ''}</span>
        <div class="participant-indicators">
          ${participant.isMuted ? '<span>🎤🔇</span>' : ''}
          ${participant.hasHandRaised ? '<span>✋</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

function renderScreenShareSlot() {
  const screenSharer = meetingsState.activeRoom?.participants.find(p => p.isScreenSharing);
  if (!screenSharer) return '';
  
  return `
    <div class="screen-share-container">
      <div class="screen-share-header">
        <span>🖥️ ${escHtml(screenSharer.name)} ekran paylaşıyor</span>
      </div>
      <div class="screen-share-content">
        <div class="screen-placeholder">
          <span>Ekran Paylaşımı</span>
          <p>${escHtml(screenSharer.name)}'in ekranı burada görünüyor</p>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function simulateParticipants(room) {
  // Simulate other users joining
  const fakeUsers = [
    { name: 'Ahmet', avatar: '👨‍💻' },
    { name: 'Ayşe', avatar: '👩‍💼' },
    { name: 'Mehmet', avatar: '👨‍🔧' }
  ];
  
  fakeUsers.forEach((user, index) => {
    setTimeout(() => {
      if (Math.random() > 0.5) {
        room.participants.push({
          id: `user_${index + 2}`,
          name: user.name,
          avatar: user.avatar,
          isHost: false,
          isMuted: true,
          isVideoOn: false,
          isScreenSharing: false,
          joinedAt: Date.now()
        });
        
        updateMeetingGrid();
        toast(`${user.name} katıldı`, 'info');
      }
    }, 3000 + index * 2000);
  });
}

function updateMeetingGrid() {
  const grid = document.getElementById('meetingGrid');
  if (grid && meetingsState.activeRoom) {
    grid.innerHTML = meetingsState.activeRoom.participants.map(p => renderParticipantVideo(p)).join('');
  }
}

function updateParticipantUI(participant) {
  const tile = document.querySelector(`[data-participant="${participant.id}"]`);
  if (tile) {
    tile.className = `participant-tile ${participant.isScreenSharing ? 'screen-sharing' : ''}`;
    tile.innerHTML = renderParticipantVideo(participant).replace(/<[^>]+>/, '').trim(); // Extract inner HTML
  }
}

function updateRecordingUI() {
  const btn = document.querySelector('.btn-icon.recording');
  if (btn) {
    btn.classList.toggle('recording', meetingsState.isRecording);
  }
}

function startMeetingTimer() {
  const timer = document.querySelector('.meeting-timer');
  if (!timer) return;
  
  let seconds = 0;
  setInterval(() => {
    seconds++;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    timer.textContent = `${mins}:${secs}`;
  }, 1000);
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.openCreateMeetingModal = () => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'createMeetingModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <div class="modal-title">🏢 Yeni Toplantı Odası</div>
        <button class="modal-close" onclick="closeModal('createMeetingModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Oda Adı</label>
          <input type="text" class="form-input" id="meetingName" placeholder="Örn: Sprint Retrospective">
        </div>
        <div class="form-group">
          <label class="form-label">Oda Tipi</label>
          <select class="form-select" id="meetingType">
            <option value="instant">⚡ Anında</option>
            <option value="scheduled">📅 Planlanmış</option>
            <option value="permanent">🔒 Kalıcı</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Maksimum Katılımcı</label>
          <input type="number" class="form-input" id="meetingMax" value="50" min="2" max="100">
        </div>
        <div class="form-check">
          <input type="checkbox" id="meetingRecording">
          <label for="meetingRecording">Kayıt yapılabilir</label>
        </div>
        <div class="form-check">
          <input type="checkbox" id="meetingWaiting">
          <label for="meetingWaiting">Bekleme odası</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('createMeetingModal')">İptal</button>
        <button class="btn btn-primary" onclick="createNewMeeting()">➕ Oluştur</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('meetingName').focus();
  
  window.createNewMeeting = () => {
    const name = document.getElementById('meetingName').value.trim();
    if (!name) {
      toast('Oda adı gerekli', 'error');
      return;
    }
    
    createMeetingRoom({
      name,
      type: document.getElementById('meetingType').value,
      maxParticipants: parseInt(document.getElementById('meetingMax').value),
      settings: {
        recording: document.getElementById('meetingRecording').checked,
        waitingRoom: document.getElementById('meetingWaiting').checked
      }
    });
    
    closeModal('createMeetingModal');
    document.getElementById('createMeetingModal')?.remove();
    renderMeetingsList();
  };
};

window.joinMeetingRoom = joinMeetingRoom;
window.deleteMeetingRoom = deleteMeetingRoom;
window.leaveMeetingRoom = leaveMeetingRoom;

window.playRecording = (id) => {
  toast('🎙️ Kayıt oynatılıyor...', 'info');
};

window.downloadRecording = (id) => {
  const recordings = getStorage('devvault_recordings', []);
  const rec = recordings.find(r => r.id === id);
  if (rec) {
    toast(`⬇️ ${rec.roomName} indiriliyor...`, 'success');
  }
};

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadMeetings() {
  const saved = getStorage(MEETINGS_STORAGE_KEY, '{}');
  if (saved.rooms) {
    meetingsState.rooms = saved.rooms;
  }
}

function saveMeetings() {
  setStorage(MEETINGS_STORAGE_KEY, {
    rooms: meetingsState.rooms
  });
}

// Export
export function getActiveMeeting() {
  return meetingsState.activeRoom;
}

export function isInMeeting() {
  return !!meetingsState.activeRoom;
}
