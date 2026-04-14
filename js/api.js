/* ═══════════════════════════════════════════════════════════════
   API Module - Groq API Integration
═══════════════════════════════════════════════════════════════ */

import { APP_CONFIG, AI_SYSTEM_PROMPTS } from './config.js';
import { extractTitle, countWords } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// Groq API Configuration
// ═══════════════════════════════════════════════════════════════

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

function getHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

// ═══════════════════════════════════════════════════════════════
// Whisper Transcription
// ═══════════════════════════════════════════════════════════════

export async function transcribeAudio(audioBlob, apiKey, onProgress = null) {
  if (!apiKey) throw new Error('API anahtarı gerekli');
  
  const formData = new FormData();
  
  // Determine file extension
  const ext = audioBlob.type.includes('ogg') ? 'ogg' : 
              audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
  
  const audioFile = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });
  
  formData.append('file', audioFile);
  formData.append('model', APP_CONFIG.WHISPER_MODEL);
  formData.append('language', 'tr');
  formData.append('response_format', 'json');
  
  // Simulate progress
  let progressInterval;
  if (onProgress) {
    let progress = 0;
    progressInterval = setInterval(() => {
      progress = Math.min(progress + 5, 90);
      onProgress(progress);
    }, 300);
  }
  
  try {
    const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    
    clearInterval(progressInterval);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      throw new Error(error.error?.message || 'Whisper API hatası');
    }
    
    const data = await response.json();
    
    if (onProgress) onProgress(100);
    
    return {
      text: data.text || '',
      language: data.language || 'tr',
      duration: data.duration || 0
    };
    
  } catch (err) {
    clearInterval(progressInterval);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Chat Completions (LLM)
// ═══════════════════════════════════════════════════════════════

export async function analyzeTranscript(transcript, options = {}) {
  const { 
    apiKey, 
    mode = 'new', 
    outputType = 'project', 
    existingContent = '',
    onStep = null 
  } = options;
  
  if (!apiKey) throw new Error('API anahtarı gerekli');
  if (!transcript?.trim()) throw new Error('Transkript boş');
  
  // Determine system prompt
  let promptKey = mode === 'update' 
    ? (outputType === 'instruction' ? 'instruction_update' : 'project_update')
    : outputType === 'instruction' ? 'instruction_new'
    : outputType === 'tasks' ? 'tasks'
    : outputType === 'report' ? 'report'
    : 'project_new';
  
  const systemPrompt = AI_SYSTEM_PROMPTS[promptKey];
  
  // Build user message
  const userMessage = mode === 'update' && existingContent
    ? `MEVCUT DOKÜMAN:\n${existingContent}\n\n---\nYENİ BİLGİLER (ses transkripti):\n${transcript}`
    : `Ses transkripti:\n${transcript}`;
  
  // Report steps
  const steps = ['API bağlantısı kuruluyor', 'Transkript analiz ediliyor', 'Doküman oluşturuluyor', 'Formatlanıyor'];
  let currentStep = 0;
  
  const stepInterval = setInterval(() => {
    if (currentStep < steps.length - 1 && onStep) {
      currentStep++;
      onStep(currentStep, steps[currentStep]);
    }
  }, 700);
  
  try {
    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model: APP_CONFIG.GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 4096,
        temperature: 0.65,
        stream: false
      })
    });
    
    clearInterval(stepInterval);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      throw new Error(error.error?.message || 'Groq API hatası');
    }
    
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';
    
    return {
      result,
      title: extractTitle(result) || generateTitle(mode, outputType),
      tokens: data.usage?.total_tokens || 0,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      wordCount: countWords(result)
    };
    
  } catch (err) {
    clearInterval(stepInterval);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Streaming Analysis (for real-time display)
// ═══════════════════════════════════════════════════════════════

export async function* streamAnalysis(transcript, options = {}) {
  const { 
    apiKey, 
    mode = 'new', 
    outputType = 'project', 
    existingContent = ''
  } = options;
  
  if (!apiKey) throw new Error('API anahtarı gerekli');
  
  let promptKey = mode === 'update' 
    ? (outputType === 'instruction' ? 'instruction_update' : 'project_update')
    : outputType === 'instruction' ? 'instruction_new'
    : outputType === 'tasks' ? 'tasks'
    : outputType === 'report' ? 'report'
    : 'project_new';
  
  const systemPrompt = AI_SYSTEM_PROMPTS[promptKey];
  const userMessage = mode === 'update' && existingContent
    ? `MEVCUT DOKÜMAN:\n${existingContent}\n\n---\nYENİ BİLGİLER:\n${transcript}`
    : `Ses transkripti:\n${transcript}`;
  
  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: APP_CONFIG.GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 4096,
      temperature: 0.65,
      stream: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`API Hatası: ${response.status}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function generateTitle(mode, outputType) {
  const date = new Date().toLocaleDateString('tr-TR');
  const typeLabels = {
    project: 'Proje',
    instruction: 'AI Talimatı',
    tasks: 'Görev Listesi',
    report: 'Rapor'
  };
  
  if (mode === 'update') {
    return `Güncellendi: ${typeLabels[outputType]} - ${date}`;
  }
  return `Yeni ${typeLabels[outputType]} - ${date}`;
}

// ═══════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════

export function validateApiKey(key) {
  if (!key || !key.startsWith('gsk_')) {
    return { valid: false, message: 'Geçerli bir Groq API anahtarı gir (gsk_ ile başlar)' };
  }
  if (key.length < 20) {
    return { valid: false, message: 'API anahtarı çok kısa' };
  }
  return { valid: true, message: 'API anahtarı geçerli görünüyor' };
}
