/* ═══════════════════════════════════════════════════════════════
   Chat Module - Real-time Messaging & Communication
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull, formatTime, todayStr } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Chat State
// ═══════════════════════════════════════════════════════════════

const CHAT_STORAGE_KEY = 'devvault_chat';

let chatState = {
  conversations: [],
  activeConversation: null,
  currentUser: { id: 'user_1', name: 'Ben', avatar: '👤', status: 'online' },
  users: [
    { id: 'user_1', name: 'Ben', avatar: '👤', status: 'online', role: 'admin' },
    { id: 'user_2', name: 'Ahmet', avatar: '👨‍💻', status: 'online', role: 'developer' },
    { id: 'user_3', name: 'Ayşe', avatar: '👩‍💼', status: 'away', role: 'designer' },
    { id: 'user_4', name: 'Mehmet', avatar: '👨‍🔧', status: 'offline', role: 'developer' }
  ],
  unreadCount: 0,
  isOpen: false
};

// ═══════════════════════════════════════════════════════════════
// Initialize Chat
// ═══════════════════════════════════════════════════════════════

export function initChat() {
  loadChat();
  
  // Create default conversations if none
  if (!chatState.conversations.length) {
    createDefaultConversations();
  }
  
  // Setup presence simulation
  startPresenceSimulation();
  
  // Render chat widget
  renderChatWidget();
  
  console.log('[Chat] Module initialized');
}

function createDefaultConversations() {
  // Team conversation
  const teamConv = createConversation({
    type: 'group',
    name: 'Ekip Sohbeti',
    participants: ['user_1', 'user_2', 'user_3', 'user_4'],
    avatar: '👥'
  });
  
  // Add welcome message
  sendMessage(teamConv.id, {
    senderId: 'system',
    text: '👋 DevVault Pro Sohbetine hoş geldiniz! Buradan ekip üyelerinizle iletişim kurabilirsiniz.',
    type: 'system'
  });
  
  // Direct message with Ahmet
  const ahmetConv = createConversation({
    type: 'direct',
    name: 'Ahmet',
    participants: ['user_1', 'user_2'],
    avatar: '👨‍💻'
  });
  
  sendMessage(ahmetConv.id, {
    senderId: 'user_2',
    text: 'Merhaba! Proje dosyalarını gönderdim, inceler misin?',
    type: 'text'
  });
}

// ═══════════════════════════════════════════════════════════════
// Conversation Management
// ═══════════════════════════════════════════════════════════════

export function createConversation(data) {
  const conversation = {
    id: genId(),
    type: data.type || 'direct', // 'direct' | 'group'
    name: data.name,
    participants: data.participants || [],
    avatar: data.avatar || '💬',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    unread: 0
  };
  
  chatState.conversations.push(conversation);
  saveChat();
  
  return conversation;
}

export function deleteConversation(convId) {
  chatState.conversations = chatState.conversations.filter(c => c.id !== convId);
  
  if (chatState.activeConversation?.id === convId) {
    chatState.activeConversation = null;
  }
  
  saveChat();
  renderChatWidget();
}

export function setActiveConversation(convId) {
  const conversation = chatState.conversations.find(c => c.id === convId);
  if (conversation) {
    chatState.activeConversation = conversation;
    conversation.unread = 0;
    saveChat();
    renderChatWidget();
  }
}

// ═══════════════════════════════════════════════════════════════
// Message Functions
// ═══════════════════════════════════════════════════════════════

export function sendMessage(convId, messageData) {
  const conversation = chatState.conversations.find(c => c.id === convId);
  if (!conversation) return null;
  
  const message = {
    id: genId(),
    senderId: messageData.senderId || chatState.currentUser.id,
    text: messageData.text,
    type: messageData.type || 'text', // 'text' | 'image' | 'file' | 'voice' | 'system'
    attachments: messageData.attachments || [],
    timestamp: Date.now(),
    edited: false,
    reactions: []
  };
  
  conversation.messages.push(message);
  conversation.updatedAt = Date.now();
  
  // Update unread for other participants
  conversation.participants.forEach(userId => {
    if (userId !== chatState.currentUser.id) {
      conversation.unread++;
    }
  });
  
  saveChat();
  renderChatMessages();
  
  // Simulate reply for demo
  if (messageData.senderId === chatState.currentUser.id && conversation.type === 'direct') {
    setTimeout(() => simulateReply(convId), 2000 + Math.random() * 3000);
  }
  
  return message;
}

export function sendTextMessage(text) {
  if (!chatState.activeConversation || !text.trim()) return;
  
  sendMessage(chatState.activeConversation.id, { text: text.trim() });
  
  // Clear input
  const input = document.getElementById('chatInput');
  if (input) input.value = '';
}

export function sendImageMessage(imageData) {
  if (!chatState.activeConversation) return;
  
  sendMessage(chatState.activeConversation.id, {
    type: 'image',
    text: '📷 Görsel',
    attachments: [{ type: 'image', data: imageData }]
  });
  
  toast('📷 Görsel gönderildi', 'success');
}

export function sendFileMessage(file) {
  if (!chatState.activeConversation) return;
  
  sendMessage(chatState.activeConversation.id, {
    type: 'file',
    text: `📎 ${file.name}`,
    attachments: [{ type: 'file', name: file.name, size: file.size }]
  });
  
  toast(`📎 ${file.name} gönderildi`, 'success');
}

export function sendVoiceMessage(audioBlob) {
  if (!chatState.activeConversation) return;
  
  const reader = new FileReader();
  reader.onloadend = () => {
    sendMessage(chatState.activeConversation.id, {
      type: 'voice',
      text: '🎙️ Ses mesajı',
      attachments: [{ type: 'voice', data: reader.result, duration: 10 }]
    });
  };
  reader.readAsDataURL(audioBlob);
}

function simulateReply(convId) {
  const replies = [
    'Anladım, teşekkürler!',
    'Tamam, bakıyorum şimdi.',
    'Güzel fikir! 🎉',
    'Bunu daha sonra konuşalım mı?',
    'Dosyaları aldım, inceliyorum.',
    '👍 Harika!',
    'Sorun neydi? Yardımcı olabilir miyim?'
  ];
  
  const randomReply = replies[Math.floor(Math.random() * replies.length)];
  
  sendMessage(convId, {
    senderId: chatState.activeConversation.participants.find(p => p !== chatState.currentUser.id) || 'user_2',
    text: randomReply,
    type: 'text'
  });
  
  // Show notification if chat closed
  if (!chatState.isOpen) {
    toast(`💬 Yeni mesaj: ${randomReply.slice(0, 30)}...`, 'info');
    chatState.unreadCount++;
    updateChatBadge();
  }
}

// ═══════════════════════════════════════════════════════════════
// Voice Recording
// ═══════════════════════════════════════════════════════════════

let mediaRecorder = null;
let audioChunks = [];

export async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      sendVoiceMessage(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    
    // Show recording UI
    showRecordingUI();
    
    toast('🎙️ Ses kaydı başladı...', 'info');
  } catch (err) {
    toast('Mikrofon erişimi reddedildi', 'error');
    console.error('Voice recording error:', err);
  }
}

export function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    hideRecordingUI();
    toast('🎙️ Ses mesajı gönderildi', 'success');
  }
}

function showRecordingUI() {
  const btn = document.getElementById('voiceRecordBtn');
  if (btn) {
    btn.innerHTML = '⏹️ Kaydı Durdur';
    btn.classList.add('recording');
    btn.onclick = stopVoiceRecording;
  }
}

function hideRecordingUI() {
  const btn = document.getElementById('voiceRecordBtn');
  if (btn) {
    btn.innerHTML = '🎙️ Ses';
    btn.classList.remove('recording');
    btn.onclick = startVoiceRecording;
  }
}

// ═══════════════════════════════════════════════════════════════
// UI Rendering
// ═══════════════════════════════════════════════════════════════

export function renderChatWidget() {
  let widget = document.getElementById('chatWidget');
  
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'chatWidget';
    widget.className = 'chat-widget';
    document.body.appendChild(widget);
  }
  
  widget.innerHTML = `
    ${chatState.isOpen ? renderChatOpen() : renderChatClosed()}
  `;
}

function renderChatClosed() {
  const totalUnread = chatState.conversations.reduce((sum, c) => sum + c.unread, 0);
  
  return `
    <button class="chat-toggle-btn" onclick="toggleChat()">
      💬 ${totalUnread > 0 ? `<span class="chat-badge">${totalUnread}</span>` : ''}
    </button>
  `;
}

function renderChatOpen() {
  return `
    <div class="chat-container">
      <div class="chat-header">
        <div class="chat-title">
          <span>💬</span>
          <span>Sohbet</span>
        </div>
        <div class="chat-actions">
          <button class="btn-icon" onclick="openNewConversationModal()">➕</button>
          <button class="btn-icon" onclick="toggleChat()">✕</button>
        </div>
      </div>
      
      <div class="chat-body">
        <div class="chat-sidebar">
          <div class="chat-search">
            <input type="text" class="form-input" placeholder="Ara..." onkeyup="searchConversations(this.value)">
          </div>
          <div class="conversations-list">
            ${chatState.conversations.map(conv => renderConversationItem(conv)).join('')}
          </div>
        </div>
        
        <div class="chat-main">
          ${chatState.activeConversation ? renderActiveConversation() : renderNoConversation()}
        </div>
      </div>
    </div>
  `;
}

function renderConversationItem(conv) {
  const lastMessage = conv.messages[conv.messages.length - 1];
  const isActive = chatState.activeConversation?.id === conv.id;
  
  return `
    <div class="conversation-item ${isActive ? 'active' : ''} ${conv.unread > 0 ? 'unread' : ''}" 
         onclick="setActiveConversation('${conv.id}')">
      <div class="conv-avatar">${conv.avatar}</div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(conv.name)}</div>
        <div class="conv-preview">${lastMessage ? escHtml(lastMessage.text.slice(0, 30)) : 'Henüz mesaj yok'}...</div>
      </div>
      <div class="conv-meta">
        ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ''}
        <span class="conv-time">${lastMessage ? formatTime(lastMessage.timestamp) : ''}</span>
      </div>
    </div>
  `;
}

function renderActiveConversation() {
  const conv = chatState.activeConversation;
  
  return `
    <div class="conversation-header">
      <div class="conv-header-info">
        <span class="conv-avatar-large">${conv.avatar}</span>
        <div>
          <div class="conv-name-large">${escHtml(conv.name)}</div>
          <div class="conv-status">${conv.type === 'group' ? `${conv.participants.length} katılımcı` : 'Çevrimiçi'}</div>
        </div>
      </div>
      <div class="conv-header-actions">
        <button class="btn-icon" title="Sesli ara" onclick="startVoiceCall()">📞</button>
        <button class="btn-icon" title="Görüntülü ara" onclick="startVideoCall()">📹</button>
        <button class="btn-icon" title="Ekran paylaş" onclick="startScreenShare()">🖥️</button>
      </div>
    </div>
    
    <div class="messages-container" id="messagesContainer">
      ${conv.messages.map(msg => renderMessage(msg)).join('')}
    </div>
    
    <div class="chat-input-area">
      <div class="chat-input-actions">
        <button class="btn-icon" onclick="openFilePicker()" title="Dosya gönder">📎</button>
        <button class="btn-icon" onclick="openImagePicker()" title="Görsel gönder">📷</button>
        <button class="btn-icon" id="voiceRecordBtn" onclick="startVoiceRecording()" title="Ses mesajı">🎙️</button>
      </div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" id="chatInput" placeholder="Mesaj yaz..." 
               onkeypress="if(event.key==='Enter') sendTextMessage(this.value)">
        <button class="btn-primary" onclick="sendTextMessage(document.getElementById('chatInput').value)">➤</button>
      </div>
    </div>
  `;
}

function renderMessage(msg) {
  const isMe = msg.senderId === chatState.currentUser.id;
  const isSystem = msg.type === 'system';
  const sender = chatState.users.find(u => u.id === msg.senderId);
  
  if (isSystem) {
    return `
      <div class="message-system">
        <span>${msg.text}</span>
      </div>
    `;
  }
  
  return `
    <div class="message ${isMe ? 'me' : 'other'}">
      ${!isMe ? `<div class="message-avatar">${sender?.avatar || '👤'}</div>` : ''}
      <div class="message-content">
        ${!isMe ? `<div class="message-sender">${escHtml(sender?.name || 'Bilinmeyen')}</div>` : ''}
        <div class="message-bubble ${msg.type}">
          ${msg.type === 'image' ? `<img src="${msg.attachments[0]?.data}" class="message-image">` : ''}
          ${msg.type === 'file' ? `<div class="message-file">📎 ${escHtml(msg.attachments[0]?.name)}</div>` : ''}
          ${msg.type === 'voice' ? renderVoicePlayer(msg.attachments[0]) : ''}
          ${msg.type === 'text' ? escHtml(msg.text) : ''}
        </div>
        <div class="message-time">${formatTime(msg.timestamp)} ${isMe ? '✓' : ''}</div>
      </div>
    </div>
  `;
}

function renderVoicePlayer(attachment) {
  return `
    <div class="voice-player">
      <button class="voice-play-btn" onclick="this.nextElementSibling.play()">▶️</button>
      <audio src="${attachment?.data}"></audio>
      <div class="voice-waveform">
        ${Array(20).fill(0).map(() => `<span style="height: ${Math.random() * 20 + 5}px"></span>`).join('')}
      </div>
      <span class="voice-duration">${attachment?.duration || 0}s</span>
    </div>
  `;
}

function renderNoConversation() {
  return `
    <div class="no-conversation">
      <div class="no-conv-icon">💬</div>
      <p>Sohbet seçmek için sol panelden bir konuşma seçin</p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Presence & Online Status
// ═══════════════════════════════════════════════════════════════

function startPresenceSimulation() {
  // Simulate user status changes
  setInterval(() => {
    const randomUser = chatState.users[Math.floor(Math.random() * chatState.users.length)];
    if (randomUser.id !== chatState.currentUser.id) {
      const statuses = ['online', 'away', 'offline'];
      randomUser.status = statuses[Math.floor(Math.random() * statuses.length)];
      
      if (Math.random() > 0.7) {
        renderChatWidget();
      }
    }
  }, 30000); // Every 30 seconds
}

export function getOnlineUsers() {
  return chatState.users.filter(u => u.status === 'online');
}

export function getUserStatus(userId) {
  const user = chatState.users.find(u => u.id === userId);
  return user?.status || 'offline';
}

// ═══════════════════════════════════════════════════════════════
// File & Image Pickers
// ═══════════════════════════════════════════════════════════════

export function openFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) sendFileMessage(file);
  };
  input.click();
}

export function openImagePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => sendImageMessage(e.target.result);
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════════
// Calls & Meetings (Simulated)
// ═══════════════════════════════════════════════════════════════

export function startVoiceCall() {
  toast('📞 Sesli arama başlatılıyor...', 'info');
  openCallModal('voice');
}

export function startVideoCall() {
  toast('📹 Görüntülü arama başlatılıyor...', 'info');
  openCallModal('video');
}

export function startScreenShare() {
  toast('🖥️ Ekran paylaşımı başlatılıyor...', 'info');
  // In real app, this would use getDisplayMedia
}

function openCallModal(type) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open call-overlay';
  modal.id = 'callModal';
  
  const isVideo = type === 'video';
  
  modal.innerHTML = `
    <div class="call-container ${type}">
      <div class="call-participants">
        <div class="participant main">
          <div class="participant-avatar">${isVideo ? '📹' : '📞'}</div>
          <div class="participant-name">${chatState.activeConversation?.name}</div>
          <div class="call-timer" id="callTimer">00:00</div>
        </div>
        ${isVideo ? `
          <div class="participant self">
            <div class="participant-avatar">👤</div>
            <div class="participant-name">Ben (Sen)</div>
          </div>
        ` : ''}
      </div>
      
      <div class="call-controls">
        <button class="call-btn" onclick="toggleMute()">🎤</button>
        ${isVideo ? `<button class="call-btn" onclick="toggleVideo()">📹</button>` : ''}
        <button class="call-btn" onclick="toggleScreen()">🖥️</button>
        <button class="call-btn end" onclick="endCall()">📞</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  startCallTimer();
  
  // Expose functions
  window.toggleMute = () => toast('🎤 Mikrofon ' + (Math.random() > 0.5 ? 'kapalı' : 'açık'), 'info');
  window.toggleVideo = () => toast('📹 Kamera ' + (Math.random() > 0.5 ? 'kapalı' : 'açık'), 'info');
  window.toggleScreen = () => toast('🖥️ Ekran paylaşımı aktif', 'info');
  window.endCall = () => {
    closeModal('callModal');
    document.getElementById('callModal')?.remove();
    toast('📞 Arama sonlandırıldı', 'info');
  };
}

let callTimerInterval = null;

function startCallTimer() {
  let seconds = 0;
  callTimerInterval = setInterval(() => {
    seconds++;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    const timer = document.getElementById('callTimer');
    if (timer) timer.textContent = `${mins}:${secs}`;
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.toggleChat = () => {
  chatState.isOpen = !chatState.isOpen;
  renderChatWidget();
};

window.setActiveConversation = setActiveConversation;
window.sendTextMessage = sendTextMessage;
window.startVoiceRecording = startVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.openFilePicker = openFilePicker;
window.openImagePicker = openImagePicker;
window.startVoiceCall = startVoiceCall;
window.startVideoCall = startVideoCall;
window.startScreenShare = startScreenShare;

window.searchConversations = (query) => {
  // Filter conversations
  const items = document.querySelectorAll('.conversation-item');
  items.forEach(item => {
    const name = item.querySelector('.conv-name')?.textContent?.toLowerCase() || '';
    item.style.display = name.includes(query.toLowerCase()) ? 'flex' : 'none';
  });
};

window.openNewConversationModal = () => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'newConvModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 400px;">
      <div class="modal-header">
        <div class="modal-title">➕ Yeni Sohbet</div>
        <button class="modal-close" onclick="closeModal('newConvModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Kullanıcı Seç</label>
          <select class="form-select" id="newConvUser">
            ${chatState.users.filter(u => u.id !== chatState.currentUser.id).map(u => `
              <option value="${u.id}">${u.avatar} ${u.name}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('newConvModal')">İptal</button>
        <button class="btn btn-primary" onclick="createNewConversation()">➕ Oluştur</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  window.createNewConversation = () => {
    const userId = document.getElementById('newConvUser').value;
    const user = chatState.users.find(u => u.id === userId);
    
    const conv = createConversation({
      type: 'direct',
      name: user.name,
      participants: [chatState.currentUser.id, userId],
      avatar: user.avatar
    });
    
    setActiveConversation(conv.id);
    closeModal('newConvModal');
    document.getElementById('newConvModal')?.remove();
    toast(`💬 ${user.name} ile sohbet başlatıldı`, 'success');
  };
};

function updateChatBadge() {
  const totalUnread = chatState.conversations.reduce((sum, c) => sum + c.unread, 0);
  const badge = document.querySelector('.chat-badge');
  if (badge) {
    badge.textContent = totalUnread;
    badge.style.display = totalUnread > 0 ? 'block' : 'none';
  }
}

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadChat() {
  const saved = getStorage(CHAT_STORAGE_KEY, '{}');
  if (saved.conversations) {
    chatState.conversations = saved.conversations;
    chatState.users = saved.users || chatState.users;
  }
}

function saveChat() {
  setStorage(CHAT_STORAGE_KEY, {
    conversations: chatState.conversations,
    users: chatState.users
  });
}

// Global Window Export for index.html inline scripts
window.toggleChat = () => {
  chatState.isOpen = !chatState.isOpen;
  renderChatWidget();
};
window.setActiveConversation = setActiveConversation;
window.sendTextMessage = sendTextMessage;
window.startVoiceRecording = startVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.openFilePicker = openFilePicker;
window.openImagePicker = openImagePicker;
window.startVoiceCall = startVoiceCall;
window.startVideoCall = startVideoCall;
window.startScreenShare = startScreenShare;
window.searchConversations = (query) => {
  const items = document.querySelectorAll('.conversation-item');
  items.forEach(item => {
    const name = item.querySelector('.conv-name')?.textContent?.toLowerCase() || '';
    item.style.display = name.includes(query.toLowerCase()) ? 'flex' : 'none';
  });
};

// Export
export function getChatState() {
  return { ...chatState };
}

export function getUnreadCount() {
  return chatState.conversations.reduce((sum, c) => sum + c.unread, 0);
}
