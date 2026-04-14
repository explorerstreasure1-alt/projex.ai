/* ═══════════════════════════════════════════════════════════════
   Kanban Module - Kanban Board
═══════════════════════════════════════════════════════════════ */

import { state, updateTask } from './state.js';
import { saveTasks } from './storage.js';
import { escHtml, PRIORITY_ORDER } from './utils.js';
import { KANBAN_COLS } from './config.js';
import { toast, openModal } from './ui.js';
import { openAddTaskModal, openEditTaskModal, confirmDeleteTask } from './tasks.js';

// ═══════════════════════════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════════════════════════

export function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  
  const allTasks = state.tasks.filter(t => !t.completed);
  
  board.innerHTML = KANBAN_COLS.map(col => {
    const colTasks = allTasks.filter(t => t.status === col.id);
    
    return `
      <div class="kanban-col" data-status="${col.id}">
        <div class="kanban-col-header">
          <div class="kanban-col-dot" style="background:${col.dot}"></div>
          <span class="kanban-col-title" style="color:${col.color}">${col.label}</span>
          <span class="kanban-col-count">${colTasks.length}</span>
        </div>
        <div class="kanban-col-body">
          ${colTasks.length ? colTasks.map(t => renderKanbanCard(t)).join('') : ''}
          <div class="add-kanban-card" onclick="window.openAddTaskForStatus('${col.id}')">
            ＋ Yeni görev
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Initialize drag and drop
  initDragAndDrop();
}

function renderKanbanCard(task) {
  const priorityColors = {
    critical: '#ff2d55',
    high: '#ff4f6a',
    medium: '#f59e0b',
    low: '#10d48a',
    none: '#888'
  };
  
  const project = state.items.find(i => i.id === task.projectId);
  
  return `
    <div class="kanban-card" draggable="true" data-task-id="${task.id}" 
         onclick="window.openTaskDetail('${task.id}')">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:6px;height:6px;border-radius:50%;background:${priorityColors[task.priority] || '#888'}"></span>
        <span style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase">${task.priority}</span>
      </div>
      <div class="kanban-card-title">${escHtml(task.title)}</div>
      <div class="kanban-card-meta">
        ${task.time ? `<span style="font-size:0.65rem;color:var(--text-dim)">🕐 ${task.time}</span>` : ''}
        ${project ? `<span style="font-size:0.65rem;color:var(--accent)">📁 ${escHtml(project.title.slice(0, 15))}</span>` : ''}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Drag & Drop
// ═══════════════════════════════════════════════════════════════

function initDragAndDrop() {
  const cards = document.querySelectorAll('.kanban-card');
  const columns = document.querySelectorAll('.kanban-col-body');
  
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });
  
  columns.forEach(col => {
    col.addEventListener('dragover', handleDragOver);
    col.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
  e.target.style.opacity = '0.5';
}

function handleDragEnd(e) {
  e.target.style.opacity = '1';
}

function handleDragOver(e) {
  e.preventDefault();
  const column = e.currentTarget.closest('.kanban-col');
  if (column) {
    column.style.border = '2px dashed var(--accent)';
  }
}

function handleDrop(e) {
  e.preventDefault();
  
  const taskId = e.dataTransfer.getData('text/plain');
  const column = e.currentTarget.closest('.kanban-col');
  
  if (column) {
    column.style.border = '';
    const newStatus = column.dataset.status;
    
    if (taskId && newStatus) {
      moveTaskToStatus(taskId, newStatus);
    }
  }
}

function moveTaskToStatus(taskId, newStatus) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status === newStatus) return;
  
  const oldStatus = task.status;
  
  updateTask(taskId, {
    status: newStatus,
    completed: newStatus === 'done'
  });
  
  saveTasks(state.tasks);
  renderKanban();
  
  const statusLabels = {
    todo: 'Bekliyor',
    inprogress: 'Devam Ediyor',
    review: 'İnceleme',
    done: 'Tamamlandı'
  };
  
  toast(`Görev "${statusLabels[newStatus]}" kolonuna taşındı`, 'success');
}
