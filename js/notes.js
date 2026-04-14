/* ═══════════════════════════════════════════════════════════════
   Notes Module - Rich Text Wiki & Documentation
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// Notes State
// ═══════════════════════════════════════════════════════════════

const NOTES_STORAGE_KEY = 'devvault_notes';

let notesState = {
  folders: [
    { id: 'root', name: 'Tüm Notlar', parentId: null },
    { id: 'projects', name: '📁 Projeler', parentId: 'root' },
    { id: 'meetings', name: '📅 Toplantılar', parentId: 'root' },
    { id: 'docs', name: '📄 Dokümanlar', parentId: 'root' },
    { id: 'knowledge', name: '📚 Bilgi Bankası', parentId: 'root' },
    { id: 'personal', name: '🔒 Kişisel', parentId: 'root' }
  ],
  notes: [],
  currentFolder: 'root',
  currentNote: null,
  searchQuery: ''
};

// ═══════════════════════════════════════════════════════════════
// Initialize Notes
// ═══════════════════════════════════════════════════════════════

export function initNotes() {
  loadNotes();
  
  // Create sample notes if empty
  if (!notesState.notes.length) {
    createSampleNotes();
  }
  
  console.log('[Notes] Module initialized');
}

function createSampleNotes() {
  const samples = [
    {
      id: genId(),
      title: 'Proje README',
      content: '<h1>DevVault Pro</h1><p>Proje yönetim ve işbirliği platformu.</p><h2>Özellikler</h2><ul><li>Görev Yönetimi</li><li>Proje Takibi</li><li>Ekip Sohbeti</li><li>Toplantı Odaları</li></ul>',
      folderId: 'projects',
      tags: ['proje', 'doküman'],
      type: 'document',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000
    },
    {
      id: genId(),
      title: 'API Dokümantasyonu',
      content: '<h1>API Endpoints</h1><pre><code>GET /api/v1/projects\nPOST /api/v1/tasks\nPUT /api/v1/tasks/:id</code></pre>',
      folderId: 'docs',
      tags: ['api', 'kod'],
      type: 'code',
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 172800000
    },
    {
      id: genId(),
      title: 'Sprint Planning Notları',
      content: '<h1>Sprint 15 Planning</h1><p><strong>Tarih:</strong> 15 Nisan 2026</p><h2>Katılımcılar</h2><ul><li>Ahmet</li><li>Ayşe</li><li>Mehmet</li></ul><h2>Gündem</h2><ol><li>Önceki sprint değerlendirmesi</li><li>Yeni görevler</li><li>Tahminler</li></ol>',
      folderId: 'meetings',
      tags: ['sprint', 'toplantı'],
      type: 'document',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now()
    }
  ];
  
  notesState.notes = samples;
  saveNotes();
}

// ═══════════════════════════════════════════════════════════════
// Note CRUD
// ═══════════════════════════════════════════════════════════════

export function createNote(data) {
  const note = {
    id: genId(),
    title: data.title || 'Yeni Not',
    content: data.content || '',
    folderId: data.folderId || notesState.currentFolder,
    tags: data.tags || [],
    type: data.type || 'document', // 'document' | 'code' | 'markdown'
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  notesState.notes.push(note);
  saveNotes();
  
  toast(`📝 "${note.title}" oluşturuldu`, 'success');
  logActivity(`Not oluşturuldu: ${note.title}`);
  
  renderNotesList();
  return note;
}

export function updateNote(noteId, updates) {
  const note = notesState.notes.find(n => n.id === noteId);
  if (!note) return null;
  
  Object.assign(note, updates, { updatedAt: Date.now() });
  saveNotes();
  
  return note;
}

export function deleteNote(noteId) {
  const note = notesState.notes.find(n => n.id === noteId);
  if (!note) return;
  
  if (!confirm(`"${note.title}" silmek istediğinize emin misiniz?`)) return;
  
  notesState.notes = notesState.notes.filter(n => n.id !== noteId);
  saveNotes();
  
  if (notesState.currentNote?.id === noteId) {
    notesState.currentNote = null;
  }
  
  toast('📝 Not silindi', 'info');
  renderNotesList();
}

export function duplicateNote(noteId) {
  const original = notesState.notes.find(n => n.id === noteId);
  if (!original) return;
  
  const copy = {
    ...original,
    id: genId(),
    title: `${original.title} (Kopya)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  notesState.notes.push(copy);
  saveNotes();
  
  toast('📝 Not kopyalandı', 'success');
  renderNotesList();
}

// ═══════════════════════════════════════════════════════════════
// Rich Text Editor
// ═══════════════════════════════════════════════════════════════

export function openNoteEditor(noteId = null) {
  const note = noteId ? notesState.notes.find(n => n.id === noteId) : null;
  notesState.currentNote = note;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'noteEditorModal';
  modal.style.cssText = '--max-width: 900px;';
  
  modal.innerHTML = `
    <div class="modal note-editor-modal" style="max-width: 900px; height: 80vh;">
      <div class="modal-header">
        <div class="note-editor-header">
          <input type="text" class="note-title-input" id="noteTitle" 
                 value="${note ? escHtml(note.title) : ''}" 
                 placeholder="Not başlığı...">
        </div>
        <div class="note-actions">
          <button class="btn-icon" onclick="exportNote()" title="Dışa aktar">📥</button>
          <button class="btn-icon" onclick="duplicateNote('${note?.id}')" title="Kopyala">📋</button>
          <button class="btn-icon" onclick="closeNoteEditor()" title="Kapat">✕</button>
        </div>
      </div>
      
      <div class="note-toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="formatText('bold')" title="Kalın"><b>B</b></button>
          <button class="toolbar-btn" onclick="formatText('italic')" title="İtalik"><i>I</i></button>
          <button class="toolbar-btn" onclick="formatText('underline')" title="Altı çizili"><u>U</u></button>
        </div>
        <div class="toolbar-separator"></div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="formatText('h1')" title="Başlık 1">H1</button>
          <button class="toolbar-btn" onclick="formatText('h2')" title="Başlık 2">H2</button>
          <button class="toolbar-btn" onclick="formatText('h3')" title="Başlık 3">H3</button>
        </div>
        <div class="toolbar-separator"></div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="formatText('ul')" title="Liste">•</button>
          <button class="toolbar-btn" onclick="formatText('ol')" title="Sıralı liste">1.</button>
          <button class="toolbar-btn" onclick="formatText('checklist')" title="Görev listesi">☑</button>
        </div>
        <div class="toolbar-separator"></div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="insertCode()" title="Kod bloğu">&lt;/&gt;</button>
          <button class="toolbar-btn" onclick="insertLink()" title="Link">🔗</button>
          <button class="toolbar-btn" onclick="insertTable()" title="Tablo">⊞</button>
        </div>
        <div class="toolbar-separator"></div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="insertInstruction()" title="Talimat ekle">📋</button>
          <button class="toolbar-btn" onclick="insertProjectDoc()" title="Proje dokümanı">📁</button>
        </div>
      </div>
      
      <div class="modal-body" style="flex: 1; overflow: hidden; padding: 0;">
        <div class="note-editor-container">
          <div class="note-editor" id="noteEditor" contenteditable="true" 
               placeholder="Notunuzu yazmaya başlayın...">
            ${note ? note.content : ''}
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <div class="note-meta">
          <span id="saveStatus">Kaydedildi</span>
          ${note ? `<span>• Son güncelleme: ${formatDateFull(note.updatedAt)}</span>` : ''}
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-ghost" onclick="closeNoteEditor()">İptal</button>
          <button class="btn btn-primary" onclick="saveCurrentNote()">💾 Kaydet</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus editor
  setTimeout(() => {
    document.getElementById('noteEditor')?.focus();
  }, 100);
  
  // Auto-save on input
  const editor = document.getElementById('noteEditor');
  let saveTimeout;
  
  editor?.addEventListener('input', () => {
    document.getElementById('saveStatus').textContent = 'Kaydediliyor...';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      document.getElementById('saveStatus').textContent = 'Kaydedildi';
    }, 1000);
  });
  
  // Expose functions
  window.formatText = (command) => {
    document.execCommand(command, false, null);
    editor?.focus();
  };
  
  window.insertCode = () => {
    const code = prompt('Kod bloğu dilini girin (javascript, python, css, vb.):') || 'javascript';
    const codeContent = prompt('Kodunuzu yapıştırın:');
    if (codeContent) {
      const pre = document.createElement('pre');
      pre.innerHTML = `<code class="language-${code}">${escHtml(codeContent)}</code>`;
      editor?.appendChild(pre);
    }
  };
  
  window.insertLink = () => {
    const url = prompt('Link URL:');
    const text = prompt('Link metni:');
    if (url && text) {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${text}</a>`);
    }
  };
  
  window.insertTable = () => {
    const rows = parseInt(prompt('Satır sayısı:')) || 3;
    const cols = parseInt(prompt('Sütun sayısı:')) || 3;
    
    let table = '<table class="note-table"><tbody>';
    for (let i = 0; i < rows; i++) {
      table += '<tr>';
      for (let j = 0; j < cols; j++) {
        table += `<td>Hücre ${i + 1}-${j + 1}</td>`;
      }
      table += '</tr>';
    }
    table += '</tbody></table>';
    
    document.execCommand('insertHTML', false, table);
  };
  
  window.insertInstruction = () => {
    const template = `
      <div class="instruction-block">
        <h3>📋 Talimatlar</h3>
        <ol>
          <li>Adım 1...</li>
          <li>Adım 2...</li>
          <li>Adım 3...</li>
        </ol>
        <p><strong>Not:</strong> Önemli notlar buraya...</p>
      </div>
    `;
    document.execCommand('insertHTML', false, template);
  };
  
  window.insertProjectDoc = () => {
    const template = `
      <div class="project-doc-block">
        <h1>Proje Adı</h1>
        <div class="project-meta">
          <p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
          <p><strong>Sahibi:</strong> </p>
          <p><strong>Durum:</strong> Planlama</p>
        </div>
        <h2>Özet</h2>
        <p>Proje özeti buraya...</p>
        <h2>Hedefler</h2>
        <ul>
          <li>Hedef 1</li>
          <li>Hedef 2</li>
        </ul>
        <h2>Kapsam</h2>
        <p>Proje kapsamı buraya...</p>
      </div>
    `;
    document.execCommand('insertHTML', false, template);
  };
  
  window.saveCurrentNote = () => {
    const title = document.getElementById('noteTitle').value.trim() || 'İsimsiz Not';
    const content = document.getElementById('noteEditor').innerHTML;
    
    if (notesState.currentNote) {
      updateNote(notesState.currentNote.id, { title, content });
      toast('📝 Not güncellendi', 'success');
    } else {
      createNote({ title, content });
    }
    
    closeNoteEditor();
  };
  
  window.closeNoteEditor = () => {
    closeModal('noteEditorModal');
    document.getElementById('noteEditorModal')?.remove();
    notesState.currentNote = null;
  };
  
  window.exportNote = () => {
    const title = document.getElementById('noteTitle').value || 'not';
    const content = document.getElementById('noteEditor').innerHTML;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>${title}</title></head>
      <body>${content}</body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast('📥 Not indirildi', 'success');
  };
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderNotesList() {
  const container = document.getElementById('notesList');
  if (!container) return;
  
  const currentFolder = notesState.currentFolder;
  const folders = notesState.folders.filter(f => f.parentId === currentFolder);
  let notes = notesState.notes.filter(n => n.folderId === currentFolder);
  
  // Apply search
  if (notesState.searchQuery) {
    notes = notes.filter(n => 
      n.title.toLowerCase().includes(notesState.searchQuery) ||
      n.content.toLowerCase().includes(notesState.searchQuery) ||
      n.tags.some(t => t.toLowerCase().includes(notesState.searchQuery))
    );
  }
  
  // Sort by updated
  notes.sort((a, b) => b.updatedAt - a.updatedAt);
  
  container.innerHTML = `
    <div class="notes-header">
      ${renderNotesBreadcrumb()}
      <div class="notes-actions">
        <button class="btn btn-primary" onclick="openNoteEditor()">➕ Yeni Not</button>
      </div>
    </div>
    
    <div class="notes-search">
      <input type="text" class="form-input" placeholder="Notlarda ara..." 
             value="${notesState.searchQuery}" onkeyup="searchNotes(this.value)">
    </div>
    
    <div class="notes-grid">
      ${folders.map(folder => `
        <div class="note-folder-card" onclick="openFolder('${folder.id}')">
          <div class="folder-icon">📁</div>
          <div class="folder-name">${escHtml(folder.name)}</div>
          <div class="folder-count">${getFolderItemCount(folder.id)} öğe</div>
        </div>
      `).join('')}
      
      ${notes.map(note => `
        <div class="note-card" onclick="openNoteEditor('${note.id}')">
          <div class="note-icon">${getNoteIcon(note.type)}</div>
          <h4 class="note-title">${escHtml(note.title)}</h4>
          <p class="note-preview">${getNotePreview(note.content)}</p>
          <div class="note-tags">
            ${note.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
          </div>
          <div class="note-footer">
            <span class="note-date">${formatDateFull(note.updatedAt)}</span>
            <button class="btn-icon" onclick="event.stopPropagation(); deleteNote('${note.id}')">🗑️</button>
          </div>
        </div>
      `).join('')}
      
      ${!folders.length && !notes.length ? `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📝</div>
          <h3>Burada not yok</h3>
          <p>Yeni bir not oluşturmak için + Yeni Not butonuna tıklayın</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderNotesBreadcrumb() {
  const paths = [];
  let current = notesState.folders.find(f => f.id === notesState.currentFolder);
  
  while (current) {
    paths.unshift(current);
    current = notesState.folders.find(f => f.id === current.parentId);
  }
  
  return `
    <div class="breadcrumb">
      ${paths.map((folder, index) => `
        <span class="breadcrumb-item ${index === paths.length - 1 ? 'active' : ''}" 
              onclick="${index < paths.length - 1 ? `openFolder('${folder.id}')` : ''}">
          ${folder.id === 'root' ? '🏠' : escHtml(folder.name)}
        </span>
        ${index < paths.length - 1 ? '<span class="breadcrumb-separator">/</span>' : ''}
      `).join('')}
    </div>
  `;
}

function getNoteIcon(type) {
  const icons = {
    document: '📝',
    code: '💻',
    markdown: '📄'
  };
  return icons[type] || '📝';
}

function getNotePreview(content) {
  const text = content.replace(/<[^>]+>/g, '').slice(0, 100);
  return text || 'Boş not...';
}

function getFolderItemCount(folderId) {
  const notes = notesState.notes.filter(n => n.folderId === folderId).length;
  const folders = notesState.folders.filter(f => f.parentId === folderId).length;
  return notes + folders;
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.openNoteEditor = openNoteEditor;
window.deleteNote = deleteNote;
window.duplicateNote = duplicateNote;

window.openFolder = (folderId) => {
  notesState.currentFolder = folderId;
  renderNotesList();
};

window.searchNotes = (query) => {
  notesState.searchQuery = query.toLowerCase();
  renderNotesList();
};

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadNotes() {
  const saved = getStorage(NOTES_STORAGE_KEY, '{}');
  if (saved.notes) {
    notesState.notes = saved.notes;
    notesState.folders = saved.folders || notesState.folders;
    notesState.currentFolder = saved.currentFolder || 'root';
  }
}

function saveNotes() {
  setStorage(NOTES_STORAGE_KEY, {
    notes: notesState.notes,
    folders: notesState.folders,
    currentFolder: notesState.currentFolder
  });
}

// Export
export function getAllNotes() {
  return [...notesState.notes];
}

export function searchNotesByTag(tag) {
  return notesState.notes.filter(n => n.tags.includes(tag));
}
