/* ═══════════════════════════════════════════════════════════════
   Voice Module - Voice AI Recording & Analysis
═══════════════════════════════════════════════════════════════ */

import { state, setVoiceMode, setOutputType, addVoiceHistory, updateItem, addTask } from './state.js';
import { saveVoiceHistory, saveItems, saveTasks, saveGroqKey } from './storage.js';
import { APP_CONFIG } from './config.js';
import { genId, escHtml, fmtSecs, countWords, todayStr, extractTitle, copyToClipboard } from './utils.js';
import { transcribeAudio, analyzeTranscript, validateApiKey } from './api.js';
import { toast, openModal, closeModal, switchMainTab } from './ui.js';
import { renderCards } from './vault.js';

// ═══════════════════════════════════════════════════════════════
// Initialize Voice View
// ═══════════════════════════════════════════════════════════════

export function initVoiceView() {
  // Load API key
  const keyInput = document.getElementById('groqKeyInput');
  if (keyInput && state.groqApiKey) {
    keyInput.value = state.groqApiKey;
    setKeyStatus('ok');
  } else {
    setKeyStatus('idle');
  }
  
  // Populate target select for update mode
  populateTargetSelect();
  
  // Render history
  renderVoiceHistory();
  
  // Set default mode
  setVoiceMode('new');
  updateModeUI();
}

// ═══════════════════════════════════════════════════════════════
// API Key Management
// ═══════════════════════════════════════════════════════════════

export function saveGroqApiKey() {
  const input = document.getElementById('groqKeyInput');
  const key = input?.value.trim() || '';
  
  const validation = validateApiKey(key);
  
  if (!validation.valid) {
    toast(validation.message, 'error');
    setKeyStatus('bad');
    return false;
  }
  
  state.groqApiKey = key;
  saveGroqKey(key);
  setKeyStatus('ok');
  toast('Groq API anahtarı kaydedildi ✓', 'success');
  return true;
}

function setKeyStatus(status) {
  const dot = document.getElementById('keyStatusDot');
  if (dot) {
    dot.className = `key-status-dot ${status}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Mode Management
// ═══════════════════════════════════════════════════════════════

export function setMode(mode) {
  setVoiceMode(mode);
  updateModeUI();
  
  if (mode === 'update') {
    populateTargetSelect();
  }
}

function updateModeUI() {
  const newCard = document.getElementById('modeNewCard');
  const updateCard = document.getElementById('modeUpdateCard');
  const targetCard = document.getElementById('voiceTargetCard');
  
  if (newCard) {
    newCard.className = `voice-mode-card ${state.voiceMode === 'new' ? 'active-new' : ''}`;
  }
  if (updateCard) {
    updateCard.className = `voice-mode-card ${state.voiceMode === 'update' ? 'active-update' : ''}`;
  }
  if (targetCard) {
    targetCard.classList.toggle('visible', state.voiceMode === 'update');
  }
}

export function setOutput(outputType) {
  setOutputType(outputType);
  
  ['project', 'instruction', 'tasks', 'report'].forEach(type => {
    const btn = document.getElementById(`otype-${type}`);
    if (btn) {
      btn.classList.toggle('selected', type === outputType);
    }
  });
}

function populateTargetSelect() {
  const select = document.getElementById('voiceTargetSelect');
  if (!select) return;
  
  const projects = state.items.filter(i => i.type === 'project' || i.type === 'instruction');
  
  select.innerHTML = `
    <option value="">— Kayıt seçin —</option>
    ${projects.map(p => {
      const icon = p.type === 'project' ? '📁' : '🤖';
      return `<option value="${p.id}">${icon} ${escHtml(p.title)}</option>`;
    }).join('')}
  `;
}

// ═══════════════════════════════════════════════════════════════
// Recording Functions
// ═══════════════════════════════════════════════════════════════

export async function toggleRecording() {
  if (state.isRecording) {
    await finishRecording();
  } else {
    await startRecording();
  }
}

export async function startRecording() {
  // Validate API key
  if (!state.groqApiKey) {
    toast('Önce Groq API anahtarı ekle!', 'error');
    return;
  }
  
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    
    // Reset state
    state.isRecording = true;
    state.isPaused = false;
    state.recordSeconds = 0;
    state.audioChunks = [];
    state.finalTranscript = '';
    state.interimTranscript = '';
    
    // Setup MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus' 
        : 'audio/webm';
    
    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        state.audioChunks.push(e.data);
      }
    };
    
    state.mediaRecorder.start(500);
    
    // Start live transcription
    startLiveTranscription();
    
    // Setup waveform
    setupWaveform(stream);
    
    // Start timer
    state.recordTimer = setInterval(() => {
      if (!state.isPaused) {
        state.recordSeconds++;
        updateTimerDisplay();
        
        if (state.recordSeconds >= APP_CONFIG.MAX_REC_SECONDS) {
          finishRecording();
          toast('Maksimum kayıt süresi doldu', 'info');
        }
      }
    }, 1000);
    
    // Update UI
    updateRecordingUI(true);
    toast('Kayıt başladı 🎙️', 'success');
    
  } catch (err) {
    toast('Mikrofon hatası: ' + err.message, 'error');
    console.error('Recording error:', err);
  }
}

export function pauseRecording() {
  if (!state.isRecording) return;
  
  state.isPaused = !state.isPaused;
  
  if (state.isPaused) {
    if (state.mediaRecorder?.state === 'recording') {
      state.mediaRecorder.pause();
    }
    if (state.recognition) {
      try { state.recognition.stop(); } catch {}
    }
    
    document.getElementById('pauseBtn').textContent = '▶ Devam Et';
    document.getElementById('statusDot').className = 'status-dot';
    document.getElementById('statusText').textContent = 'Duraklatıldı';
    toast('Kayıt duraklatıldı', 'info');
    
  } else {
    if (state.mediaRecorder?.state === 'paused') {
      state.mediaRecorder.resume();
    }
    startLiveTranscription();
    
    document.getElementById('pauseBtn').textContent = '⏸ Duraklat';
    document.getElementById('statusDot').className = 'status-dot recording';
    document.getElementById('statusText').textContent = 'Kayıt yapılıyor…';
    toast('Kayıt devam ediyor', 'info');
  }
}

export async function finishRecording() {
  if (!state.isRecording) return;
  
  state.isRecording = false;
  clearInterval(state.recordTimer);
  
  // Stop recognition
  if (state.recognition) {
    try { state.recognition.stop(); } catch {}
    state.recognition = null;
  }
  
  // Stop MediaRecorder
  await new Promise(resolve => {
    if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
      resolve();
      return;
    }
    state.mediaRecorder.onstop = resolve;
    state.mediaRecorder.stop();
    state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
  });
  
  // Stop waveform
  stopWaveform();
  
  // Update UI for processing
  updateRecordingUI(false);
  updateProcessingUI(true);
  
  // Run Whisper transcription
  try {
    const audioBlob = new Blob(state.audioChunks, { type: state.mediaRecorder?.mimeType || 'audio/webm' });
    
    updateWhisperStatus(true, 0, '🎧 Groq Whisper ses dosyasını işliyor…');
    
    const result = await transcribeAudio(
      audioBlob, 
      state.groqApiKey,
      (progress) => updateWhisperStatus(true, progress)
    );
    
    if (result.text?.trim()) {
      state.finalTranscript = result.text;
      updateTranscriptDisplay(escHtml(result.text));
      toast('🎧 Whisper transkripti hazır!', 'success');
    } else {
      updateTranscriptDisplay('<span style="color:var(--amber)">⚠️ Konuşma tespit edilemedi. Transkript alanına manuel yazabilirsin.</span>');
    }
    
    updateWhisperStatus(true, 100, '✅ Transkript hazır — Groq Whisper');
    setTimeout(() => updateWhisperStatus(false), 2000);
    
  } catch (err) {
    console.error('Transcription error:', err);
    updateWhisperStatus(true, 0, `⚠️ ${err.message}`);
    
    // Fall back to live transcript
    if (state.finalTranscript.trim()) {
      toast('Whisper hatası, canlı transkript kullanılıyor', 'info');
    } else {
      toast('Whisper hatası: ' + err.message, 'error');
    }
    
    setTimeout(() => updateWhisperStatus(false), 4000);
  }
  
  // Reset UI
  updateProcessingUI(false);
  updateTimerDisplay(true);
  
  document.getElementById('micBtn').textContent = '🎙️';
  document.getElementById('statusDot').className = 'status-dot done';
  document.getElementById('statusText').textContent = `✓ Kayıt tamamlandı (${fmtSecs(state.recordSeconds)})`;
}

export function cancelRecording() {
  if (!state.isRecording) return;
  
  state.isRecording = false;
  state.isPaused = false;
  clearInterval(state.recordTimer);
  
  if (state.recognition) {
    try { state.recognition.stop(); } catch {}
    state.recognition = null;
  }
  
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
    state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  
  stopWaveform();
  resetRecordingUI();
  clearTranscript();
  
  state.finalTranscript = '';
  state.interimTranscript = '';
  
  toast('Kayıt iptal edildi', 'info');
}

// ═══════════════════════════════════════════════════════════════
// Live Transcription
// ═══════════════════════════════════════════════════════════════

function startLiveTranscription() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;
  
  state.recognition = new SpeechRec();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'tr-TR';
  
  state.recognition.onresult = (e) => {
    state.interimTranscript = '';
    
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        state.finalTranscript += e.results[i][0].transcript + ' ';
      } else {
        state.interimTranscript += e.results[i][0].transcript;
      }
    }
    
    updateLiveTranscript();
  };
  
  state.recognition.onerror = () => {
    if (state.isRecording && !state.isPaused) {
      setTimeout(() => {
        try { state.recognition.start(); } catch {}
      }, 500);
    }
  };
  
  state.recognition.onend = () => {
    if (state.isRecording && !state.isPaused) {
      setTimeout(() => {
        try { state.recognition.start(); } catch {}
      }, 200);
    }
  };
  
  try { state.recognition.start(); } catch {}
}

function updateLiveTranscript() {
  const text = (state.finalTranscript + ' ' + state.interimTranscript).trim();
  const words = countWords(text);
  
  document.getElementById('transcriptWordCount').textContent = `${words} kelime`;
  
  const html = (state.finalTranscript ? `<span>${escHtml(state.finalTranscript)}</span>` : '') +
               (state.interimTranscript ? `<span class="interim">${escHtml(state.interimTranscript)}</span>` : '');
  
  updateTranscriptDisplay(html || '<span class="interim">🎙 Dinleniyor…</span>');
}

// ═══════════════════════════════════════════════════════════════
// Waveform Visualization
// ═══════════════════════════════════════════════════════════════

function setupWaveform(stream) {
  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 512;
    
    state.audioContext.createMediaStreamSource(stream).connect(state.analyser);
    
    drawWaveform();
  } catch (err) {
    console.error('Waveform setup error:', err);
  }
}

function drawWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas || !state.analyser) return;
  
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  const W = parent?.offsetWidth || 600;
  const H = parent?.offsetHeight || 80;
  
  canvas.width = W;
  canvas.height = H;
  
  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function animate() {
    if (!state.isRecording) return;
    
    state.animFrameId = requestAnimationFrame(animate);
    state.analyser.getByteFrequencyData(dataArray);
    
    ctx.clearRect(0, 0, W, H);
    
    const barWidth = (W / bufferLength) * 2.5;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * H * 0.85;
      const alpha = 0.35 + (dataArray[i] / 255) * 0.65;
      const g = Math.floor(59 + (dataArray[i] / 255) * 50);
      
      ctx.fillStyle = `rgba(255, ${g}, 92, ${alpha})`;
      
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, H - barHeight, Math.max(barWidth - 1, 1), barHeight, 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, H - barHeight, Math.max(barWidth - 1, 1), barHeight);
      }
      
      x += barWidth + 1;
    }
  }
  
  animate();
}

function stopWaveform() {
  if (state.animFrameId) {
    cancelAnimationFrame(state.animFrameId);
    state.animFrameId = null;
  }
  
  const canvas = document.getElementById('waveformCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  if (state.audioContext) {
    try { state.audioContext.close(); } catch {}
    state.audioContext = null;
    state.analyser = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Analysis Functions
// ═══════════════════════════════════════════════════════════════

export async function runAnalysis() {
  const transcript = getTranscriptText();
  
  if (!transcript || transcript.length < 10) {
    toast('Önce ses kaydı yap veya transkript gir!', 'error');
    return;
  }
  
  if (!state.groqApiKey) {
    toast('Groq API anahtarı eksik!', 'error');
    return;
  }
  
  // Get existing content for update mode
  let existingContent = '';
  let targetItem = null;
  
  if (state.voiceMode === 'update') {
    const targetId = document.getElementById('voiceTargetSelect')?.value;
    if (targetId) {
      targetItem = state.items.find(i => i.id === targetId);
      existingContent = targetItem?.content || '';
    }
    
    if (!existingContent) {
      toast('Güncellenecek kayıt seçilmedi', 'error');
      return;
    }
  }
  
  // Show processing UI
  const resultArea = document.getElementById('aiResultArea');
  showProcessingUI(resultArea);
  
  document.getElementById('saveSection')?.classList.remove('visible');
  document.getElementById('aiStatsRow').style.display = 'none';
  document.getElementById('analyzeBtn').disabled = true;
  
  const t0 = Date.now();
  
  try {
    const result = await analyzeTranscript(transcript, {
      apiKey: state.groqApiKey,
      mode: state.voiceMode,
      outputType: state.outputType,
      existingContent,
      onStep: (step, message) => updateStep(step, message)
    });
    
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    
    state.currentAiResult = result.result;
    
    // Complete all steps
    completeAllSteps();
    
    // Stream the result
    streamResultText(resultArea, result.result);
    
    // Update stats
    updateAIStats(elapsed, result.tokens, result.wordCount);
    
    // Show save section
    document.getElementById('saveSection')?.classList.add('visible');
    document.getElementById('saveResultTitle').value = result.title;
    
    // Save to history
    saveToHistory(result, elapsed, transcript, targetItem);
    
    toast('✅ Analiz tamamlandı!', 'success');
    
  } catch (err) {
    console.error('Analysis error:', err);
    resultArea.innerHTML = `
      <div style="padding:16px;color:var(--red);font-size:0.83rem">
        ❌ Groq API hatası:\n\n${escHtml(err.message)}\n\n
        • API anahtarını kontrol et\n        • İnternet bağlantını kontrol et\n        • Transkriptin çok uzun olmadığından emin ol
      </div>
    `;
    toast('API hatası: ' + err.message, 'error');
    
  } finally {
    document.getElementById('analyzeBtn').disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// Save Functions
// ═══════════════════════════════════════════════════════════════

export function saveResultToVault() {
  const title = document.getElementById('saveResultTitle')?.value.trim() || 
                `AI Üretimi — ${new Date().toLocaleDateString('tr-TR')}`;
  
  if (!state.currentAiResult) {
    toast('Önce analiz yap!', 'error');
    return;
  }
  
  // Update mode
  if (state.voiceMode === 'update') {
    const targetId = document.getElementById('voiceTargetSelect')?.value;
    if (targetId) {
      const idx = state.items.findIndex(i => i.id === targetId);
      if (idx > -1) {
        updateItem(targetId, {
          content: state.currentAiResult,
          aiGenerated: true
        });
        saveItems(state.items);
        toast('✅ Kayıt güncellendi!', 'success');
        document.getElementById('saveSection')?.classList.remove('visible');
        renderCards();
        return;
      }
    }
    toast('Hedef kayıt bulunamadı', 'error');
    return;
  }
  
  // New mode - create item
  const typeMap = {
    project: 'project',
    instruction: 'instruction',
    tasks: 'project',
    report: 'project'
  };
  
  const newItem = {
    id: genId(),
    type: typeMap[state.outputType] || 'project',
    title,
    content: state.currentAiResult,
    language: '',
    tags: ['ai-generated', state.outputType],
    favorite: false,
    aiGenerated: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0
  };
  
  state.items.unshift(newItem);
  saveItems(state.items);
  
  toast('💾 Vault\'a kaydedildi!', 'success');
  document.getElementById('saveSection')?.classList.remove('visible');
  renderCards();
}

export function generateTasksFromResult() {
  if (!state.currentAiResult) {
    toast('Önce analiz yap!', 'error');
    return;
  }
  
  const lines = state.currentAiResult.split('\n').filter(l => l.trim());
  let added = 0;
  
  lines.forEach(line => {
    const clean = line.replace(/^[-*#✅📌•\d.)\s🔴🟠🟡🟢⚪]+/, '').trim();
    if (clean.length < 8 || clean.length > 200 || added >= 20) return;
    
    const priority = /kritik|critical/i.test(line) ? 'critical'
      : /yüksek|high/i.test(line) ? 'high'
      : /düşük|low/i.test(line) ? 'low' : 'medium';
    
    state.tasks.unshift({
      id: genId(),
      title: clean,
      description: '',
      date: todayStr(),
      time: '',
      estimate: '',
      projectId: '',
      priority,
      status: 'todo',
      completed: false,
      tags: ['ai-generated'],
      subtasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    added++;
  });
  
  if (added > 0) {
    saveTasks(state.tasks);
    toast(`📋 ${added} görev oluşturuldu!`, 'success');
    switchMainTab('tasks');
  } else {
    toast('Görev yapısı bulunamadı', 'info');
  }
}

// ═══════════════════════════════════════════════════════════════
// History Functions
// ═══════════════════════════════════════════════════════════════

function saveToHistory(result, elapsed, transcript, targetItem) {
  const historyEntry = {
    id: genId(),
    mode: state.voiceMode,
    outputType: state.outputType,
    title: result.title,
    transcript: transcript.slice(0, 300),
    fullResult: result.result,
    targetId: state.voiceMode === 'update' ? document.getElementById('voiceTargetSelect')?.value : null,
    targetTitle: targetItem?.title || null,
    duration: state.recordSeconds,
    tokens: result.tokens,
    elapsed,
    createdAt: Date.now()
  };
  
  addVoiceHistory(historyEntry);
  saveVoiceHistory(state.voiceHistory);
  renderVoiceHistory();
}

function renderVoiceHistory() {
  const container = document.getElementById('voiceHistoryList');
  const countEl = document.getElementById('vhCount');
  
  if (!container) return;
  
  countEl.textContent = `${state.voiceHistory.length} kayıt`;
  
  if (!state.voiceHistory.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;font-size:0.78rem;color:var(--text-muted)">Henüz ses kaydı yok</div>';
    return;
  }
  
  const typeLabels = {
    project: 'Proje Dokümanı',
    instruction: 'AI Talimatı',
    tasks: 'Görev Listesi',
    report: 'Rapor'
  };
  
  container.innerHTML = state.voiceHistory.slice(0, 12).map(h => `
    <div class="vh-item" onclick="window.loadVoiceHistory('${h.id}')">
      <div class="vh-icon ${h.mode === 'new' ? 'vh-new' : 'vh-update'}">${h.mode === 'new' ? '🆕' : '🔄'}</div>
      <div class="vh-body">
        <div class="vh-title">${escHtml(h.title)}</div>
        <div class="vh-meta">
          ${new Date(h.createdAt).toLocaleDateString('tr-TR')} · 
          ${typeLabels[h.outputType] || h.outputType}
          ${h.duration ? ' · ' + fmtSecs(h.duration) : ''}
          ${h.tokens ? ' · ' + h.tokens + ' token' : ''}
        </div>
        <div class="vh-preview">${escHtml((h.transcript || '').slice(0, 120))}</div>
      </div>
      <div class="vh-badges">
        <span class="vh-badge ${h.mode === 'new' ? 'vh-badge-new' : 'vh-badge-update'}">
          ${h.mode === 'new' ? 'YENİ' : 'GÜNCELLE'}
        </span>
        ${h.targetTitle ? `<span style="font-size:0.62rem;color:var(--text-muted)">→ ${escHtml(h.targetTitle.slice(0, 16))}</span>` : ''}
      </div>
    </div>
  `).join('');
}

export function loadHistoryEntry(id) {
  const entry = state.voiceHistory.find(h => h.id === id);
  if (!entry) return;
  
  state.currentAiResult = entry.fullResult || '';
  
  const resultArea = document.getElementById('aiResultArea');
  if (resultArea) {
    resultArea.innerHTML = escHtml(state.currentAiResult).replace(/\n/g, '<br>');
  }
  
  document.getElementById('saveSection')?.classList.add('visible');
  document.getElementById('saveResultTitle').value = entry.title;
  
  if (entry.transcript) {
    state.finalTranscript = entry.transcript;
    updateTranscriptDisplay(escHtml(entry.transcript));
    updateTranscriptMeta();
  }
  
  toast('Geçmiş kayıt yüklendi 📚', 'info');
}

export function clearHistory() {
  state.voiceHistory = [];
  saveVoiceHistory([]);
  renderVoiceHistory();
  toast('Geçmiş temizlendi', 'info');
}

// ═══════════════════════════════════════════════════════════════
// UI Update Functions
// ═══════════════════════════════════════════════════════════════

function updateRecordingUI(recording) {
  document.getElementById('micOuter')?.classList.toggle('recording', recording);
  document.getElementById('micBtn')?.classList.toggle('recording', recording);
  document.getElementById('micBtn').textContent = recording ? '⏹' : '🎙️';
  document.getElementById('micTimer')?.classList.toggle('active', recording);
  document.getElementById('micControls').style.display = recording ? 'flex' : 'none';
  document.getElementById('waveformIdleText').style.display = recording ? 'none' : '';
  document.getElementById('statusDot').className = recording ? 'status-dot recording' : 'status-dot';
  document.getElementById('statusText').textContent = recording ? 'Kayıt yapılıyor…' : 'Başlatmak için tıkla';
}

function updateProcessingUI(processing) {
  document.getElementById('micBtn')?.classList.toggle('processing', processing);
  document.getElementById('statusDot').className = processing ? 'status-dot processing' : 'status-dot done';
  document.getElementById('statusText').textContent = processing ? 'Whisper ile transkript alınıyor…' : 'Kayıt tamamlandı';
}

function resetRecordingUI() {
  document.getElementById('micOuter')?.classList.remove('recording');
  document.getElementById('micBtn')?.classList.remove('recording', 'processing');
  document.getElementById('micBtn').textContent = '🎙️';
  document.getElementById('micTimer').textContent = '00:00';
  document.getElementById('micTimer')?.classList.remove('active');
  document.getElementById('micControls').style.display = 'none';
  document.getElementById('statusDot').className = 'status-dot';
  document.getElementById('statusText').textContent = 'Başlatmak için tıkla';
  document.getElementById('waveformIdleText').style.display = '';
}

function updateTimerDisplay(final = false) {
  document.getElementById('micTimer').textContent = final 
    ? '00:00' 
    : fmtSecs(state.recordSeconds);
}

function updateWhisperStatus(visible, progress = 0, text = null) {
  const status = document.getElementById('whisperStatus');
  const fill = document.getElementById('whisperFill');
  const textEl = document.getElementById('whisperText');
  
  if (status) status.classList.toggle('visible', visible);
  if (fill) fill.style.width = `${progress}%`;
  if (text && textEl) textEl.textContent = text;
}

function updateTranscriptDisplay(html) {
  const area = document.getElementById('transcriptArea');
  if (area) {
    area.innerHTML = html;
    area.scrollTop = area.scrollHeight;
  }
}

function updateTranscriptMeta() {
  const text = getTranscriptText();
  const words = countWords(text);
  document.getElementById('transcriptWordCount').textContent = `${words} kelime`;
  document.getElementById('transcriptCharCount').textContent = `${text.length} karakter`;
}

function getTranscriptText() {
  if (state.transcriptEditMode) {
    return document.getElementById('transcriptTextarea')?.value || '';
  }
  return state.finalTranscript;
}

function showProcessingUI(container) {
  container.innerHTML = `
    <div class="ai-processing">
      <div class="ai-spinner-ring"></div>
      <div style="font-size:0.82rem;color:var(--text-dim)">Groq AI analiz ediyor…</div>
      <div class="ai-steps">
        <div class="ai-step active" id="step1"><div class="ai-step-dot"></div><span>API bağlantısı kuruluyor</span></div>
        <div class="ai-step" id="step2"><div class="ai-step-dot"></div><span>Transkript analiz ediliyor</span></div>
        <div class="ai-step" id="step3"><div class="ai-step-dot"></div><span>Doküman oluşturuluyor</span></div>
        <div class="ai-step" id="step4"><div class="ai-step-dot"></div><span>Formatlanıyor</span></div>
      </div>
    </div>
  `;
}

function updateStep(step, message) {
  const stepEl = document.getElementById(`step${step}`);
  const prevEl = document.getElementById(`step${step - 1}`);
  
  if (prevEl) prevEl.className = 'ai-step done';
  if (stepEl) {
    stepEl.className = 'ai-step active';
    stepEl.querySelector('span').textContent = message;
  }
}

function completeAllSteps() {
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`step${i}`);
    if (stepEl) stepEl.className = 'ai-step done';
  }
}

function updateAIStats(elapsed, tokens, words) {
  document.getElementById('aiStatsRow').style.display = 'flex';
  document.getElementById('aiTime').textContent = `${elapsed}s`;
  document.getElementById('aiTokens').textContent = tokens || '—';
  document.getElementById('aiWords').textContent = words || '—';
}

function streamResultText(container, text) {
  container.innerHTML = '';
  let i = 0;
  const chunkSize = text.length > 3000 ? 6 : 3;
  const speed = text.length > 3000 ? 8 : 15;
  
  function next() {
    if (i < text.length) {
      const chunk = text.slice(0, i + chunkSize);
      container.innerHTML = escHtml(chunk).replace(/\n/g, '<br>') + '<span class="ai-cursor"></span>';
      i += chunkSize;
      container.scrollTop = container.scrollHeight;
      setTimeout(next, speed);
    } else {
      container.innerHTML = escHtml(text).replace(/\n/g, '<br>');
    }
  }
  
  next();
}

export function clearTranscript() {
  state.finalTranscript = '';
  state.interimTranscript = '';
  updateTranscriptDisplay('<span class="transcript-placeholder">Kayıt başlattığında canlı transkript burada görünür. Kayıt bitince Groq Whisper ile doğruluğu artırılır.</span>');
  document.getElementById('transcriptWordCount').textContent = '0 kelime';
  document.getElementById('transcriptCharCount').textContent = '0 karakter';
}

export function toggleEditMode() {
  state.transcriptEditMode = !state.transcriptEditMode;
  const area = document.getElementById('transcriptArea');
  const textarea = document.getElementById('transcriptTextarea');
  const btn = document.getElementById('transcriptEditBtn');
  
  if (state.transcriptEditMode) {
    textarea.value = getTranscriptText();
    area.style.display = 'none';
    textarea.style.display = 'block';
    btn.textContent = '✅ Bitti';
    textarea.focus();
  } else {
    state.finalTranscript = textarea.value;
    area.style.display = 'block';
    textarea.style.display = 'none';
    btn.textContent = '✏️ Düzenle';
    updateTranscriptDisplay(escHtml(textarea.value));
    updateTranscriptMeta();
  }
}

export async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      state.finalTranscript = text;
      updateTranscriptDisplay(escHtml(text));
      updateTranscriptMeta();
      toast('Transkript panodan yapıştırıldı', 'success');
    }
  } catch {
    toggleEditMode();
    toast('Düzenleme moduna geçildi, manuel yapıştırabilirsin', 'info');
  }
}

export function copyResult() {
  if (!state.currentAiResult) return;
  copyToClipboard(state.currentAiResult);
  toast('📋 Kopyalandı!', 'success');
}

export function editResult() {
  if (!state.currentAiResult) return;
  const container = document.getElementById('aiResultArea');
  const textarea = document.createElement('textarea');
  
  textarea.style.cssText = 'width:100%;min-height:300px;background:var(--bg);border:none;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.84rem;line-height:1.75;resize:vertical;outline:none;padding:0;';
  textarea.value = state.currentAiResult;
  textarea.oninput = () => { state.currentAiResult = textarea.value; };
  
  container.innerHTML = '';
  container.appendChild(textarea);
  textarea.focus();
  
  toast('Düzenleme modu açık — değişiklikler otomatik kaydedilir', 'info');
}

// ═══════════════════════════════════════════════════════════════
// Global Access
// ═══════════════════════════════════════════════════════════════

window.saveGroqKey = saveGroqApiKey;
window.setVoiceMode = setMode;
window.setOutputType = setOutput;
window.toggleRecording = toggleRecording;
window.pauseResume = pauseRecording;
window.finishRecording = finishRecording;
window.cancelRecording = cancelRecording;
window.runGroqAnalysis = runAnalysis;
window.saveAiResultToVault = saveResultToVault;
window.generateTasksFromResult = generateTasksFromResult;
window.toggleTranscriptEdit = toggleEditMode;
window.clearTranscript = clearTranscript;
window.pasteAndSetTranscript = pasteFromClipboard;
window.copyAiResult = copyResult;
window.editAiResultInline = editResult;
window.clearVoiceHistory = clearHistory;
window.loadVoiceHistory = loadHistoryEntry;
