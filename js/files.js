/* ═══════════════════════════════════════════════════════════════
   Files Module - Asset & Document Management
═══════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { getStorage, setStorage } from './storage.js';
import { genId, escHtml, formatDateFull, formatFileSize } from './utils.js';
import { toast } from './ui.js';
import { logActivity } from './team.js';

// ═══════════════════════════════════════════════════════════════
// File State
// ═══════════════════════════════════════════════════════════════

const FILES_STORAGE_KEY = 'devvault_files';

let filesState = {
  files: [],
  folders: [
    { id: 'root', name: 'Ana Dizin', parentId: null },
    { id: 'docs', name: 'Dokümanlar', parentId: 'root' },
    { id: 'images', name: 'Görseller', parentId: 'root' },
    { id: 'code', name: 'Kod Dosyaları', parentId: 'root' },
    { id: 'assets', name: 'Assets', parentId: 'root' }
  ],
  currentFolder: 'root',
  viewMode: 'grid', // 'grid' | 'list'
  selectedFiles: [],
  searchQuery: ''
};

// ═══════════════════════════════════════════════════════════════
// Initialize Files
// ═══════════════════════════════════════════════════════════════

export function initFiles() {
  loadFiles();
  
  // Create sample files if empty
  if (!filesState.files.length) {
    createSampleFiles();
  }
}

function createSampleFiles() {
  const sampleFiles = [
    {
      id: genId(),
      name: 'Proje-Spec.pdf',
      type: 'application/pdf',
      size: 2457600,
      folderId: 'docs',
      tags: ['spec', 'pdf'],
      createdAt: Date.now() - 86400000 * 3,
      url: null,
      content: null
    },
    {
      id: genId(),
      name: 'api-endpoints.js',
      type: 'text/javascript',
      size: 4500,
      folderId: 'code',
      tags: ['api', 'js'],
      createdAt: Date.now() - 86400000,
      url: null,
      content: '// API Endpoints\nconst API_BASE = \'/api/v1\';\n\nexport const endpoints = {\n  users: `${API_BASE}/users`,\n  projects: `${API_BASE}/projects`,\n  tasks: `${API_BASE}/tasks`\n};'
    },
    {
      id: genId(),
      name: 'logo-dark.png',
      type: 'image/png',
      size: 15600,
      folderId: 'images',
      tags: ['logo', 'brand'],
      createdAt: Date.now() - 86400000 * 5,
      url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="80">⚡</text></svg>',
      content: null
    }
  ];
  
  filesState.files = sampleFiles;
  saveFiles();
}

// ═══════════════════════════════════════════════════════════════
// File Operations
// ═══════════════════════════════════════════════════════════════

export function uploadFile(file, folderId = 'root', content = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const fileData = {
        id: genId(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        folderId: folderId,
        tags: [],
        createdAt: Date.now(),
        url: e.target.result,
        content: content || null
      };
      
      filesState.files.push(fileData);
      saveFiles();
      
      logActivity(`Dosya yüklendi: ${file.name}`);
      toast(`"${file.name}" yüklendi`, 'success');
      
      resolve(fileData);
      renderFiles();
    };
    
    reader.onerror = () => {
      toast('Dosya yüklenirken hata oluştu', 'error');
      reject(new Error('File read error'));
    };
    
    reader.readAsDataURL(file);
  });
}

export function createTextFile(name, content, folderId = 'root') {
  const fileData = {
    id: genId(),
    name: name.endsWith('.txt') ? name : `${name}.txt`,
    type: 'text/plain',
    size: new Blob([content]).size,
    folderId: folderId,
    tags: ['text'],
    createdAt: Date.now(),
    url: `data:text/plain;base64,${btoa(content)}`,
    content: content
  };
  
  filesState.files.push(fileData);
  saveFiles();
  
  toast(`"${fileData.name}" oluşturuldu`, 'success');
  renderFiles();
  return fileData;
}

export function createFolder(name, parentId = 'root') {
  const folder = {
    id: genId(),
    name: name,
    parentId: parentId
  };
  
  filesState.folders.push(folder);
  saveFiles();
  
  toast(`Klasör oluşturuldu: ${name}`, 'success');
  renderFiles();
  return folder;
}

export function deleteFile(fileId) {
  const file = filesState.files.find(f => f.id === fileId);
  if (!file) return;
  
  if (!confirm(`"${file.name}" silmek istediğinize emin misiniz?`)) return;
  
  filesState.files = filesState.files.filter(f => f.id !== fileId);
  saveFiles();
  
  logActivity(`Dosya silindi: ${file.name}`);
  toast('Dosya silindi', 'info');
  renderFiles();
}

export function deleteFolder(folderId) {
  const folder = filesState.folders.find(f => f.id === folderId);
  if (!folder) return;
  
  // Check if folder has files
  const hasFiles = filesState.files.some(f => f.folderId === folderId);
  if (hasFiles) {
    toast('Önce klasördeki dosyaları silin', 'error');
    return;
  }
  
  filesState.folders = filesState.folders.filter(f => f.id !== folderId);
  saveFiles();
  
  toast('Klasör silindi', 'info');
  renderFiles();
}

export function moveFile(fileId, targetFolderId) {
  const file = filesState.files.find(f => f.id === fileId);
  if (file) {
    file.folderId = targetFolderId;
    saveFiles();
    renderFiles();
    toast('Dosya taşındı', 'success');
  }
}

export function renameFile(fileId, newName) {
  const file = filesState.files.find(f => f.id === fileId);
  if (file) {
    file.name = newName;
    saveFiles();
    renderFiles();
    toast('Dosya yeniden adlandırıldı', 'success');
  }
}

export function downloadFile(fileId) {
  const file = filesState.files.find(f => f.id === fileId);
  if (!file) return;
  
  const a = document.createElement('a');
  a.href = file.url || `data:${file.type};base64,${file.content}`;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  toast(`"${file.name}" indiriliyor...`, 'info');
}

export function shareFile(fileId) {
  const file = filesState.files.find(f => f.id === fileId);
  if (!file) return;
  
  // Generate share link (in real app, this would be a real URL)
  const shareId = genId();
  file.shareId = shareId;
  saveFiles();
  
  // Copy to clipboard
  const shareUrl = `${window.location.origin}/share/${shareId}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    toast('Paylaşım linki kopyalandı!', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════
// Search & Filter
// ═══════════════════════════════════════════════════════════════

export function searchFiles(query) {
  filesState.searchQuery = query.toLowerCase();
  renderFiles();
}

export function filterByType(type) {
  renderFiles(type);
}

// ═══════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════

export function renderFiles(filterType = null) {
  const container = document.getElementById('filesGrid');
  if (!container) return;
  
  const currentFolder = filesState.currentFolder;
  
  // Get folders in current directory
  const folders = filesState.folders.filter(f => f.parentId === currentFolder);
  
  // Get files in current directory
  let files = filesState.files.filter(f => f.folderId === currentFolder);
  
  // Apply search
  if (filesState.searchQuery) {
    files = files.filter(f => 
      f.name.toLowerCase().includes(filesState.searchQuery) ||
      f.tags.some(t => t.toLowerCase().includes(filesState.searchQuery))
    );
  }
  
  // Apply type filter
  if (filterType) {
    files = files.filter(f => f.type.startsWith(filterType));
  }
  
  // Breadcrumb
  const breadcrumb = renderBreadcrumb();
  
  container.innerHTML = `
    <div class="files-header">
      ${breadcrumb}
      <div class="files-actions">
        <button class="btn btn-secondary" onclick="setFileView('grid')">⊞ Grid</button>
        <button class="btn btn-secondary" onclick="setFileView('list')">☰ Liste</button>
        <button class="btn btn-primary" onclick="openUploadModal()">⬆️ Yükle</button>
        <button class="btn btn-secondary" onclick="openNewFolderModal()">📁 Yeni Klasör</button>
      </div>
    </div>
    
    <div class="files-container ${filesState.viewMode}">
      ${folders.map(folder => `
        <div class="file-item folder" onclick="openFolder('${folder.id}')">
          <div class="file-icon">📁</div>
          <div class="file-info">
            <div class="file-name">${escHtml(folder.name)}</div>
            <div class="file-meta">${getFolderItemCount(folder.id)} öğe</div>
          </div>
        </div>
      `).join('')}
      
      ${files.map(file => renderFileItem(file)).join('')}
      
      ${!folders.length && !files.length ? `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📁</div>
          <h3 class="empty-title">Boş Klasör</h3>
          <p class="empty-desc">Dosya yüklemek veya yeni klasör oluşturmak için yukarıdaki butonları kullanın.</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderFileItem(file) {
  const icon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');
  
  return `
    <div class="file-item" onclick="viewFile('${file.id}')">
      <div class="file-icon" style="${isImage && file.url ? `background: url('${file.url}') center/cover;` : ''}">
        ${!isImage || !file.url ? icon : ''}
      </div>
      <div class="file-info">
        <div class="file-name">${escHtml(file.name)}</div>
        <div class="file-meta">
          <span>${formatFileSize(file.size)}</span>
          <span>•</span>
          <span>${formatDateFull(file.createdAt)}</span>
        </div>
      </div>
      <div class="file-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="downloadFile('${file.id}')" title="İndir">⬇️</button>
        <button class="btn-icon" onclick="shareFile('${file.id}')" title="Paylaş">🔗</button>
        <button class="btn-icon" onclick="deleteFile('${file.id}')" title="Sil">🗑️</button>
      </div>
    </div>
  `;
}

function renderBreadcrumb() {
  const paths = [];
  let current = filesState.folders.find(f => f.id === filesState.currentFolder);
  
  while (current) {
    paths.unshift(current);
    current = filesState.folders.find(f => f.id === current.parentId);
  }
  
  return `
    <div class="breadcrumb">
      ${paths.map((folder, index) => `
        <span class="breadcrumb-item ${index === paths.length - 1 ? 'active' : ''}" 
              onclick="${index < paths.length - 1 ? `openFolder('${folder.id}')` : ''}">
          ${index === 0 ? '🏠' : escHtml(folder.name)}
        </span>
        ${index < paths.length - 1 ? '<span class="breadcrumb-separator">/</span>' : ''}
      `).join('')}
    </div>
  `;
}

function getFolderItemCount(folderId) {
  const files = filesState.files.filter(f => f.folderId === folderId).length;
  const folders = filesState.folders.filter(f => f.parentId === folderId).length;
  return files + folders;
}

function getFileIcon(type) {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('javascript') || type.includes('typescript')) return '📜';
  if (type.includes('json')) return '📋';
  if (type.includes('html')) return '🌐';
  if (type.includes('css')) return '🎨';
  if (type.startsWith('text/')) return '📝';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
  return '📎';
}

// ═══════════════════════════════════════════════════════════════
// File Preview
// ═══════════════════════════════════════════════════════════════

export function viewFile(fileId) {
  const file = filesState.files.find(f => f.id === fileId);
  if (!file) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'filePreviewModal';
  
  let preview = '';
  
  if (file.type.startsWith('image/') && file.url) {
    preview = `<img src="${file.url}" style="max-width: 100%; max-height: 60vh; border-radius: var(--radius-lg);">`;
  } else if (file.type.startsWith('text/') || file.type.includes('javascript') || file.type.includes('json')) {
    const content = file.content || atob(file.url?.split(',')[1] || '');
    preview = `
      <pre style="background: var(--bg-deep); padding: var(--space-lg); border-radius: var(--radius-md); overflow: auto; max-height: 60vh; font-family: var(--font-mono); font-size: 0.875rem;"><code>${escHtml(content)}</code></pre>
    `;
  } else {
    preview = `
      <div class="empty-state">
        <div class="empty-icon" style="font-size: 4rem;">${getFileIcon(file.type)}</div>
        <p>Bu dosya türü önizleme desteklemiyor</p>
        <button class="btn btn-primary" onclick="downloadFile('${file.id}')">⬇️ İndir</button>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div class="modal" style="max-width: 800px;">
      <div class="modal-header">
        <div class="modal-title">${escHtml(file.name)}</div>
        <button class="modal-close" onclick="closeModal('filePreviewModal')">✕</button>
      </div>
      <div class="modal-body" style="padding: var(--space-lg);">
        ${preview}
      </div>
      <div class="modal-footer">
        <span style="color: var(--text-muted); font-size: 0.875rem;">${formatFileSize(file.size)} • ${formatDateFull(file.createdAt)}</span>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" onclick="downloadFile('${file.id}')">⬇️ İndir</button>
          <button class="btn btn-secondary" onclick="shareFile('${file.id}')">🔗 Paylaş</button>
          <button class="btn btn-danger" onclick="deleteFile('${file.id}'); closeModal('filePreviewModal');">🗑️ Sil</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Apply syntax highlighting if needed
  if (file.type.includes('javascript') || file.type.includes('json')) {
    setTimeout(() => {
      const code = modal.querySelector('code');
      if (code && window.hljs) {
        hljs.highlightElement(code);
      }
    }, 100);
  }
}

// ═══════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════

export function openUploadModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'uploadModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <div class="modal-title">⬆️ Dosya Yükle</div>
        <button class="modal-close" onclick="closeModal('uploadModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="upload-area" id="uploadArea" style="border: 2px dashed var(--border-medium); border-radius: var(--radius-lg); padding: var(--space-2xl); text-align: center; cursor: pointer; transition: all var(--transition-fast);">
          <div style="font-size: 3rem; margin-bottom: var(--space-md);">📁</div>
          <p style="margin-bottom: var(--space-sm);">Dosyaları sürükleyin veya tıklayın</p>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Maksimum 10MB</p>
          <input type="file" id="fileInput" multiple style="display: none;">
        </div>
        
        <div id="uploadPreview" style="margin-top: var(--space-md);"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('uploadModal')">İptal</button>
        <button class="btn btn-primary" id="uploadBtn" onclick="handleFileUpload()" disabled>⬆️ Yükle</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  
  uploadArea.onclick = () => fileInput.click();
  
  uploadArea.ondragover = (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--accent-purple)';
    uploadArea.style.background = 'rgba(139, 92, 246, 0.1)';
  };
  
  uploadArea.ondragleave = () => {
    uploadArea.style.borderColor = 'var(--border-medium)';
    uploadArea.style.background = 'transparent';
  };
  
  uploadArea.ondrop = (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--border-medium)';
    uploadArea.style.background = 'transparent';
    handleFiles(e.dataTransfer.files);
  };
  
  fileInput.onchange = (e) => {
    handleFiles(e.target.files);
  };
}

function handleFiles(files) {
  const preview = document.getElementById('uploadPreview');
  const uploadBtn = document.getElementById('uploadBtn');
  
  preview.innerHTML = Array.from(files).map(file => `
    <div class="file-preview-item" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm); background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: var(--space-sm);">
      <span style="font-size: 1.5rem;">${getFileIcon(file.type)}</span>
      <div style="flex: 1;">
        <div style="font-weight: 500;">${escHtml(file.name)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${formatFileSize(file.size)}</div>
      </div>
    </div>
  `).join('');
  
  uploadBtn.disabled = false;
  
  // Store files for upload
  window.pendingFiles = files;
}

export function openNewFolderModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'newFolderModal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 380px;">
      <div class="modal-header">
        <div class="modal-title">📁 Yeni Klasör</div>
        <button class="modal-close" onclick="closeModal('newFolderModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Klasör Adı</label>
          <input type="text" class="form-input" id="folderName" placeholder="Yeni Klasör">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('newFolderModal')">İptal</button>
        <button class="btn btn-primary" onclick="createNewFolder()">➕ Oluştur</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('folderName').focus();
}

// ═══════════════════════════════════════════════════════════════
// Global Functions
// ═══════════════════════════════════════════════════════════════

window.openUploadModal = openUploadModal;
window.openNewFolderModal = openNewFolderModal;
window.openFolder = (folderId) => {
  filesState.currentFolder = folderId;
  renderFiles();
};
window.setFileView = (mode) => {
  filesState.viewMode = mode;
  renderFiles();
};
window.viewFile = viewFile;
window.downloadFile = downloadFile;
window.shareFile = shareFile;
window.deleteFile = deleteFile;

window.handleFileUpload = async () => {
  if (!window.pendingFiles) return;
  
  for (const file of window.pendingFiles) {
    await uploadFile(file, filesState.currentFolder);
  }
  
  window.pendingFiles = null;
  closeModal('uploadModal');
  document.getElementById('uploadModal').remove();
};

window.createNewFolder = () => {
  const name = document.getElementById('folderName').value.trim();
  if (!name) {
    toast('Klasör adı gerekli', 'error');
    return;
  }
  
  createFolder(name, filesState.currentFolder);
  closeModal('newFolderModal');
  document.getElementById('newFolderModal').remove();
};

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════

function loadFiles() {
  const saved = getStorage(FILES_STORAGE_KEY, '{}');
  if (saved.files) {
    filesState.files = saved.files;
    filesState.folders = saved.folders || filesState.folders;
    filesState.currentFolder = saved.currentFolder || 'root';
  }
}

function saveFiles() {
  setStorage(FILES_STORAGE_KEY, {
    files: filesState.files,
    folders: filesState.folders,
    currentFolder: filesState.currentFolder
  });
}

// Export state access
export function getFilesState() {
  return { ...filesState };
}

export function getFilesInFolder(folderId) {
  return filesState.files.filter(f => f.folderId === folderId);
}
