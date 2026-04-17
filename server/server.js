const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store rooms and participants
const rooms = new Map();

// In-memory user storage (in production, use a database)
const users = new Map();
const resetTokens = new Map();
const verificationTokens = new Map();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'projex_jwt_secret_2024';
const JWT_EXPIRES_IN = '7d';

// Resend API
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@projex.ai';

// API Keys endpoint - returns keys from Vercel environment variables
app.get('/api/keys', (req, res) => {
  res.json({
    groqApiKey: process.env.GROQ_API_KEY || '',
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    sabmanovaId: process.env.SABMANOVA_ID || '',
    hfToken: process.env.HF_TOKEN || '',
    cloudflareApiKey: process.env.CLOUDFLARE_API_KEY || ''
  });
});

// Send email using Resend API
async function sendEmail(to, subject, html) {
  try {
    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping email');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: to,
        subject: subject,
        html: html
      })
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    // Check if user already exists
    const existingUser = users.get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = {
      id: userId,
      email: email.toLowerCase(),
      fullName,
      password: hashedPassword,
      verified: false,
      verificationToken,
      createdAt: Date.now(),
      lastLogin: null
    };

    users.set(email, user);
    verificationTokens.set(verificationToken, email);

    // Send verification email
    const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
    const emailHtml = `
      <h2>Hoş Geldiniz!</h2>
      <p>PROJEX AI hesabınızı doğrulamak için aşağıdaki linke tıklayın:</p>
      <a href="${verificationLink}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Hesabı Doğrula</a>
      <p>Bu link 24 saat geçerlidir.</p>
    `;
    await sendEmail(email, 'PROJEX AI - Hesap Doğrulama', emailHtml);

    // Generate JWT token
    const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Kayıt başarılı. Lütfen e-postanızı doğrulayın.',
      user: { id: userId, email: user.email, fullName, verified: false },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
    }

    const user = users.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }

    // Update last login
    user.lastLogin = Date.now();
    users.set(email, user);

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Giriş başarılı',
      user: { id: user.id, email: user.email, fullName: user.fullName, verified: user.verified },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
  }
});

// Auth: Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-posta adresi gerekli' });
    }

    const user = users.get(email.toLowerCase());
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'Şifre sıfırlama linki e-posta adresine gönderildi' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour

    resetTokens.set(resetToken, { email: user.email, expiresAt });

    // Send password reset email
    const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
    const emailHtml = `
      <h2>Şifre Sıfırlama</h2>
      <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
      <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Şifreyi Sıfırla</a>
      <p>Bu link 1 saat geçerlidir.</p>
    `;
    await sendEmail(user.email, 'PROJEX AI - Şifre Sıfırlama', emailHtml);

    res.json({ message: 'Şifre sıfırlama linki e-posta adresine gönderildi' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Şifre sıfırlama isteği sırasında hata oluştu' });
  }
});

// Auth: Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token ve yeni şifre gerekli' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    const resetData = resetTokens.get(token);
    if (!resetData) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token' });
    }

    if (Date.now() > resetData.expiresAt) {
      resetTokens.delete(token);
      return res.status(400).json({ error: 'Token süresi dolmuş' });
    }

    const user = users.get(resetData.email);
    if (!user) {
      return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    users.set(resetData.email, user);

    // Delete used token
    resetTokens.delete(token);

    res.json({ message: 'Şifre başarıyla sıfırlandı' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Şifre sıfırlama sırasında hata oluştu' });
  }
});

// Auth: Verify Email
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token gerekli' });
    }

    const email = verificationTokens.get(token);
    if (!email) {
      return res.status(400).json({ error: 'Geçersiz token' });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
    }

    user.verified = true;
    user.verificationToken = null;
    users.set(email, user);

    verificationTokens.delete(token);

    res.json({ message: 'E-posta başarıyla doğrulandı' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'E-posta doğrulama sırasında hata oluştu' });
  }
});

// Auth: Get current user
app.get('/api/auth/me', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(decoded.email);

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, verified: user.verified }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Geçersiz token' });
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a meeting room
  socket.on('join-room', (roomId, userId, userName) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    room.set(socket.id, { userId, userName });

    // Notify others in the room
    socket.to(roomId).emit('user-connected', { socketId: socket.id, userId, userName });

    // Send existing participants to the new user
    const participants = Array.from(room.entries()).map(([id, data]) => ({
      socketId: id,
      userId: data.userId,
      userName: data.userName
    }));

    socket.emit('all-users', participants.filter(p => p.socketId !== socket.id));

    console.log(`User ${userName} joined room ${roomId}`);
  });

  // WebRTC signaling
  socket.on('offer', (payload) => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', (payload) => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', payload);
  });

  // Chat messages
  socket.on('meeting-chat', (roomId, message) => {
    socket.to(roomId).emit('meeting-chat', message);
  });

  // Chat AI messages (user-to-user)
  socket.on('chat-ai-message', (data) => {
    io.emit('chat-ai-message', data);
  });

  // Screen sharing
  socket.on('start-screen-share', (roomId) => {
    socket.to(roomId).emit('user-started-sharing', socket.id);
  });

  socket.on('stop-screen-share', (roomId) => {
    socket.to(roomId).emit('user-stopped-sharing', socket.id);
  });

  // Leave room
  socket.on('leave-room', (roomId) => {
    handleLeaveRoom(socket, roomId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove from all rooms
    rooms.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        handleLeaveRoom(socket, roomId);
      }
    });
  });
});

function handleLeaveRoom(socket, roomId) {
  socket.leave(roomId);

  const room = rooms.get(roomId);
  if (room) {
    const userData = room.get(socket.id);
    room.delete(socket.id);

    if (userData) {
      socket.to(roomId).emit('user-disconnected', socket.id);
    }

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
