# Projex AI - Video Konferans Sistemi Deployment Rehberi

## 📹 WebRTC Video Konferans Sistemi

Bu sistem gerçek zamanlı video/audio konferans özellikleri ile Zoom benzeri bir deneyim sunar.

## 🏗️ Mimari

### Frontend
- **Teknoloji**: HTML, CSS, JavaScript (Vanilla)
- **WebRTC**: Gerçek zamanlı video/audio akışı
- **Socket.io Client**: Signaling sunucusu ile iletişim

### Backend (Signaling Server)
- **Teknoloji**: Node.js + Express + Socket.io
- **Port**: 3001 (veya environment variable)
- **Fonksiyon**: WebRTC peer-to-peer bağlantıları için signaling

## 🚀 Deployment Adımları

### 1. Backend Deployment (Vercel)

Backend sunucusunu Vercel'e deploy edin:

```bash
cd server
npm install
vercel deploy
```

**Backend URL'ini kaydedin** (örn: `https://projex-signaling.vercel.app`)

### 2. Frontend Deployment

Frontend'i deploy edin:

```bash
# Ana dizinde
vercel deploy
```

### 3. Frontend Konfigürasyonu

`index.html` dosyasında signaling server URL'ini güncelleyin:

```javascript
// Bu satırı bulun:
socket = io('http://localhost:3001');

// Backend URL'iniz ile değiştirin:
socket = io('https://projex-signaling.vercel.app');
```

## 🔧 Local Development

### Backend Başlatma

```bash
cd server
npm install
npm start
```

Backend `http://localhost:3001` adresinde çalışacak.

### Frontend Başlatma

```bash
# Ana dizinde
# index.html dosyasını bir HTTP sunucusu ile açın
# Örnek: Live Server (VS Code extension) veya
python -m http.server 8000
```

Frontend `http://localhost:8000` adresinde çalışacak.

## 🎥 Kullanım

### Toplantı Oluşturma

1. **Toplantı** sekmesine gidin
2. **"+ Yeni Oda"** butonuna tıklayın
3. Toplantı adı girin
4. Kamera ve mikrofon izni verin

### Toplantıya Katılma

1. **"Odaya Katıl"** butonuna tıklayın
2. Oda ID'sini girin (oda oluşturan kişiden alın)
3. Kamera ve mikrofon izni verin

### Özellikler

- 🎤 **Mikrofon Kontrolü**: Aç/kapa
- 📷 **Kamera Kontrolü**: Aç/kapa  
- 🖥️ **Ekran Paylaşımı**: Ekranınızı paylaşın
- 💬 **Toplantı Sohbeti**: Anlık mesajlaşma
- 📊 **Toplantı Notları**: Not alın ve kaydedin

## 🔒 Güvenlik Notları

### HTTPS Gereksinimi

WebRTC, HTTPS gerektirir. Production deployment için:
- Vercel otomatik HTTPS sağlar
- Local development için HTTP çalışır

### STUN/TURN Sunucuları

Şu anda ücretsiz Google STUN sunucuları kullanılıyor. Production için:
- Kendi TURN sunucunuzu kurun
- Commercial TURN servisleri kullanın (örn: Twilio, Xirsys)

## 🌐 CORS Konfigürasyonu

Backend CORS ayarları `server.js` dosyasında:

```javascript
app.use(cors({
  origin: '*', // Production için frontend URL'inizi kullanın
  methods: ['GET', 'POST']
}));
```

## 📊 Monitoring

### Backend Logs

Vercel dashboard'da backend logs'unu kontrol edin:
- User connections
- Room joins/leaves
- WebRTC signaling events

### Frontend Console

Tarayıcı console'da WebRTC events'ini kontrol edin:
- `Connected to signaling server`
- `User connected`
- `ICE candidate exchange`

## 🐛 Troubleshooting

### Kamera/Mikrofon Çalışmıyor
- Tarayıcı izinlerini kontrol edin
- HTTPS kullanın (production)
- Diğer uygulamaların kamera/mikrofon kullanmadığından emin olun

### Bağlantı Kurulamıyor
- Backend çalışıyor mu kontrol edin
- Firewall ayarlarını kontrol edin
- WebSocket bağlantısı için port açık mı

### Video Görüntülenmiyor
- WebRTC peer connection başarılı mı kontrol edin
- ICE candidates değişimi tamamlandı mı
- Video element'leri doğru ID ile oluşturulmuş mu

## 🚀 Production İpuçları

1. **TURN Sunucusu**: NAT traversal için commercial TURN kullanın
2. **Load Balancing**: Çoklu kullanıcı için backend'i scale edin
3. **Recording**: Toplantı kaydı için media server ekleyin
4. **Authentication**: Kullanıcı kimlik doğrulama sistemi ekleyin
5. **Rate Limiting**: DDoS koruması ekleyin

## 📝 Lisans

Bu sistem open-source ve eğitim amaçlıdır. Production kullanım için güvenlik önlemlerini artırın.
