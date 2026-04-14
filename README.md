# DevVault Pro

Geliştirici Bilgi ve Görev Merkezi - Voice AI destekli proje yönetimi uygulaması.

![DevVault Pro](https://img.shields.io/badge/DevVault-Pro-7c6aff?style=for-the-badge)
![Version](https://img.shields.io/badge/version-2.0.0-10d48a?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-f59e0b?style=for-the-badge)

## Özellikler

### 🗄️ Bilgi Kasası (Vault)
- **Projeler**: Proje dokümanları ve planları
- **AI Talimatları**: AI sistem talimatları ve prompt'lar
- **Kod Parçacıkları**: Sık kullanılan kod örnekleri
- Etiket sistemi ve favoriler
- Arama ve filtreleme
- Grid/List görünüm seçenekleri

### 📋 Görev Merkezi
- Günlük görev takibi (7 gün slider)
- Öncelik sistemi (Kritik/Yüksek/Orta/Düşük)
- Alt görevler ve bağlı projeler
- Durum takibi (Bekliyor/Devam/İnceleme/Tamam)

### 🗂️ Kanban Board
- Drag & drop görev yönetimi
- 4 kolon: Bekliyor / Devam Ediyor / İnceleme / Tamamlandı

### 🎙️ Ses AI (Voice Assistant)
- **Groq Whisper**: Ses kaydını metne çevirme
- **Groq LLM (llama-3.3-70b)**: AI analizi ve doküman oluşturma
- Canlı transkript (Web Speech API)
- Ses dalgası görselleştirme
- Çıktı formatları:
  - Proje Dokümanı
  - AI Talimatı
  - Görev Listesi
  - Durum Raporu

### ⭐ Pro Plan Özellikleri

#### 📅 7 Günlük Timeline (Canva Tarzı)
- Haftalık görünüm (Pzt-Paz)
- Saatlik planlama (08:00-20:00)
- Drag & drop görev planlama
- Çakışma kontrolü

#### 👥 Ekip Yönetimi
- Çoklu kullanıcı desteği
- Rol tabanlı yetkilendirme (Owner/Admin/Member/Viewer)
- Online/Offline durum takibi
- Çalışma alanı (Workspace) yönetimi
- Aktivite günlüğü

#### 🔌 Eklenti Sistemi
- 12+ hazır eklenti:
  - GitHub Sync
  - Slack Bildirim
  - Zaman Takibi
  - Sprint Planlayıcı
  - Kod Kütüphanesi
  - AI Asistan+
  - Takvim Senkronizasyonu
  - Gelişmiş Analitik
  - Odak Modu (Pomodoro)
  - API Bağlayıcı
  - Özel Tema
  - Otomatik Yedekleme

#### ⚡ Hızlı Eylemler
- Hızlı görev oluşturma
- Odak modu başlatma
- Toplantı planlama
- Ses notu kaydetme

## Teknolojiler

- **Frontend**: Vanilla JavaScript (ES6+ Modules)
- **Styling**: CSS3 (Modüler CSS)
- **Storage**: LocalStorage
- **AI API**: Groq (Whisper + LLM)
- **Syntax Highlighting**: Highlight.js
- **Deployment**: Vercel

## Kurulum

### Yerel Geliştirme

```bash
# Repoyu klonlayın
git clone https://github.com/yourusername/devvault-pro.git
cd devvault-pro

# Bağımlılıkları yükleyin (opsiyonel)
npm install

# Geliştirme sunucusunu başlatın
npm start
```

### Vercel'e Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/devvault-pro)

1. GitHub reponuzu bağlayın
2. Build settings: Framework preset: **Other**, Build command: **(boş bırakın)**, Output directory: **(boş bırakın)**
3. Deploy

## Kullanım

### Groq API Anahtarı

Ses AI özelliğini kullanmak için Groq API anahtarı gereklidir:

1. [Groq Console](https://console.groq.com)'dan ücretsiz hesap oluşturun
2. API anahtarı oluşturun (`gsk_...` ile başlar)
3. Uygulamada "Ses AI" sekmesine gidin
4. API anahtarınızı girin ve "Kaydet" butonuna tıklayın

**Not**: API anahtarınız tarayıcınızın LocalStorage'ında saklanır ve sadece Groq API'ye gönderilir.

### Klavye Kısayolları

| Kısayol | Aksiyon |
|---------|---------|
| `Ctrl/Cmd + K` | Arama kutusuna odaklan |
| `Ctrl/Cmd + N` | Yeni kayıt ekle |
| `Alt + 1` | Bilgi Kasası sekmesi |
| `Alt + 2` | Görevler sekmesi |
| `Alt + 3` | Kanban sekmesi |
| `Alt + 4` | Ses AI sekmesi |
| `Escape` | Açık modal'ı kapat |

## Proje Yapısı

```
devvault-pro/
├── css/
│   ├── variables.css    # CSS değişkenleri ve tema renkleri
│   ├── base.css         # Reset ve temel stiller
│   ├── layout.css       # Layout (header, sidebar, main)
│   ├── components.css   # UI bileşenleri (butonlar, kartlar, modal)
│   ├── views.css        # View'lar (vault, tasks, kanban, voice)
│   ├── proplan.css      # Pro Plan özellikleri stilleri
│   └── responsive.css   # Responsive stiller
├── js/
│   ├── config.js       # Sabitler ve yapılandırma
│   ├── utils.js        # Yardımcı fonksiyonlar
│   ├── storage.js      # LocalStorage işlemleri
│   ├── state.js        # State yönetimi
│   ├── team.js         # Ekip yönetimi (Pro)
│   ├── plugins.js      # Eklenti sistemi (Pro)
│   ├── protimeline.js  # 7 günlük timeline (Pro)
│   ├── ui.js           # UI yardımcıları (toast, modal)
│   ├── vault.js        # Vault modülü
│   ├── tasks.js        # Tasks modülü
│   ├── kanban.js       # Kanban modülü
│   ├── voice.js        # Voice AI modülü
│   ├── api.js          # Groq API entegrasyonu
│   └── app.js          # Ana uygulama
├── index.html          # Ana HTML dosyası
├── package.json        # NPM yapılandırması
├── vercel.json         # Vercel yapılandırması
├── .gitignore          # Git ignore kuralları
└── README.md           # Bu dosya
```

## Veri Yedekleme

### Dışa Aktarma
1. Header'daki "📤" butonuna tıklayın
2. `devvault-backup-YYYY-MM-DD.json` dosyası indirilecektir

### İçe Aktarma
1. Header'daki "📥" butonuna tıklayın
2. Yedek JSON dosyanızı seçin veya sürükleyin
3. Mevcut veriler birleştirilerek aktarılır

## Güvenlik

- Tüm veriler tarayıcınızın LocalStorage'ında saklanır
- API anahtarları sadece Groq API'ye gönderilir
- Sunucu tarafı işlem yapılmaz (tamamen client-side)
- XSS koruması için HTML escape kullanılır

## Geliştirme

### CSS Modülleri
CSS dosyaları modüler yapıdadır ve sırayla yüklenir:
1. `variables.css` - CSS değişkenleri
2. `base.css` - Temel stiller
3. `layout.css` - Layout stilleri
4. `components.css` - Bileşen stilleri
5. `views.css` - View stilleri
6. `responsive.css` - Responsive stiller

### JavaScript Modülleri
ES6 module sistemi kullanılır:
- `config.js` - Sabitler ve promptlar
- `state.js` - Merkezi state yönetimi
- `storage.js` - LocalStorage CRUD işlemleri
- Her modül kendi domain'ini yönetir

## Lisans

MIT License - [LICENSE](LICENSE) dosyasına bakın.

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## İletişim

Sorularınız ve önerileriniz için [Issues](https://github.com/yourusername/devvault-pro/issues) bölümünü kullanabilirsiniz.

---

**DevVault Pro** - Geliştiriciler için, geliştiriciler tarafından ❤️ ile yapıldı.
