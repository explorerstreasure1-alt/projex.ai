/* ═══════════════════════════════════════════════════════════════
   Config - Constants & Configuration
═══════════════════════════════════════════════════════════════ */

// Storage Keys
export const STORAGE_KEYS = {
  ITEMS: 'devvault_items',
  TASKS: 'devvault_tasks',
  VOICE_HISTORY: 'devvault_voice_history',
  GROQ_KEY: 'devvault_groq_key',
  COPIES: 'devvault_copies'
};

// App Configuration
export const APP_CONFIG = {
  MAX_REC_SECONDS: 30 * 60, // 30 minutes
  MAX_HISTORY_ITEMS: 50,
  DEFAULT_LANG: 'tr-TR',
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  WHISPER_MODEL: 'whisper-large-v3'
};

// Language Options for Code Snippets
export const LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'HTML', 'CSS', 
  'React', 'Vue', 'PHP', 'Java', 'C#', 'Go', 'Rust', 
  'SQL', 'Bash', 'JSON', 'YAML', 'Markdown'
];

// Priority Order (for sorting)
export const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4
};

// Kanban Columns
export const KANBAN_COLS = [
  { id: 'todo', label: 'Bekliyor', color: 'var(--text-muted)', dot: '#888' },
  { id: 'inprogress', label: 'Devam Ediyor', color: 'var(--blue)', dot: '#38bdf8' },
  { id: 'review', label: 'İnceleme', color: 'var(--purple)', dot: '#c084fc' },
  { id: 'done', label: 'Tamamlandı', color: 'var(--green)', dot: '#10d48a' }
];

// Day Names (Turkish)
export const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çrş', 'Per', 'Cum', 'Cmt'];

// AI System Prompts
export const AI_SYSTEM_PROMPTS = {
  project_new: `Sen kıdemli bir proje dokümanı yazarısın. Kullanıcının konuşmasından profesyonel bir proje dokümanı oluştur.

Şu yapıyı kullan:
## 📋 Proje Özeti
## 🎯 Hedefler & Başarı Kriterleri
## 🛠️ Tech Stack & Mimari Kararlar
## 📐 Sistem Mimarisi (bileşenler, akışlar)
## ✅ Yapılacaklar (öncelik sırasına göre, her biri öncelik etiketi ile)
## 📅 Tahmini Zaman Çizelgesi
## ⚠️ Riskler & Bağımlılıklar
## 💡 Ek Öneriler

Kullanıcının söylemediği ama projeye değer katacak teknik öneriler de ekle. Türkçe yaz, profesyonel ve detaylı ol.`,

  project_update: `Mevcut proje dokümanını yeni bilgilerle GENİŞLET.
KURALLAR:
- Mevcut bölümleri SİLME, yeni bilgilerle GÜNCELLE
- Çelişen bilgileri düzelt, eski bilgilerin üstüne yaz
- Yeni bölümler ekle gerekirse
- Mevcut görevlerin durumunu güncelle
- [GÜNCELLEME: tarih] etiketi ekle değişen yerlere
Güncellenmiş tam dokümanı döndür.`,

  instruction_new: `Kullanıcının anlattıklarından güçlü bir AI sistem talimatı oluştur.
Format:
## ROL & UZMANLIK
## TEMEL KURALLAR
## ÇIKTI FORMAT GEREKSİNİMLERİ
## KAÇINILACAKLAR
## ÖRNEK DAVRANIŞLAR

Net, uygulanabilir, eksiksiz yaz.`,

  instruction_update: `Mevcut AI talimatını koru, yeni gereksinimlerle genişlet. Çelişen kuralları güncelle, yeni kurallar ekle. Tam talimatı döndür.`,

  tasks: `Kullanıcının anlattıklarından detaylı bir görev listesi oluştur.
Her görev için:
- Başlık (eylem fiili ile başlat: "Yaz", "Kur", "Test et"...)
- [KRİTİK/YÜKSEK/ORTA/DÜŞÜK] öncelik
- Tahmini süre
- Kısa açıklama
- Bağlı bileşen/alan

Mantıklı sırayla yaz. Bağımlılıkları belirt. Kullanıcının atladığı ama gerekli olan görevleri de ekle.`,

  report: `Kullanıcının anlattıklarından kapsamlı bir durum/ilerleme raporu oluştur.

## 📊 Yönetici Özeti
## ✅ Tamamlanan İşler
## 🔄 Devam Eden Çalışmalar
## ⏳ Bekleyen / Bloke Olan İşler
## 📈 Metrikler & KPI'lar (varsa)
## 🚨 Riskler & Sorunlar
## 📅 Önümüzdeki Adımlar
## 💬 Notlar & Kararlar

Profesyonel, nesnel, tarih damgalı bir rapor formatında yaz.`
};

// Output Type Labels
export const OUTPUT_LABELS = {
  project: 'Proje Dokümanı',
  instruction: 'AI Talimatı',
  tasks: 'Görev Listesi',
  report: 'Rapor'
};
