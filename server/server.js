const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: { error: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per windowMs
  message: { error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 email requests per hour
  message: { error: 'Çok fazla e-posta isteği. Lütfen 1 saat sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Account lockout storage
const failedLoginAttempts = new Map();
const lockedAccounts = new Map();

// Security constants
const JWT_SECRET = process.env.JWT_SECRET || 'projex_jwt_secret_2024';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_SALT_ROUNDS = 12; // Increased from 10 for better security
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

// Resend API
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@projex.ai';

// Audit log storage (in production, use a database or file system)
const auditLogs = [];

// Logging function
function logAuditEvent(event, details, ip) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    ip
  };
  auditLogs.push(logEntry);

  // Keep only last 1000 logs
  if (auditLogs.length > 1000) {
    auditLogs.shift();
  }

  console.log(`[AUDIT] ${event}: ${details} from ${ip}`);
}

// Password strength validation
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Şifre en az ${minLength} karakter olmalı`);
  }
  if (!hasUpperCase) {
    errors.push('Şifre en az bir büyük harf içermeli');
  }
  if (!hasLowerCase) {
    errors.push('Şifre en az bir küçük harf içermeli');
  }
  if (!hasNumbers) {
    errors.push('Şifre en az bir rakam içermeli');
  }
  if (!hasSpecialChar) {
    errors.push('Şifre en az bir özel karakter içermeli');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
}

function calculatePasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'fair';
  if (score <= 4) return 'good';
  if (score <= 5) return 'strong';
  return 'very strong';
}

// Input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}

function validateEmail(email) {
  return validator.isEmail(email) && validator.isLength(email, { min: 5, max: 255 });
}

function checkAccountLockout(email) {
  const lockout = lockedAccounts.get(email);
  if (lockout && lockout.expiresAt > Date.now()) {
    const remainingTime = Math.ceil((lockout.expiresAt - Date.now()) / 60000);
    return { locked: true, remainingTime };
  }
  if (lockout) {
    lockedAccounts.delete(email);
  }
  return { locked: false };
}

function recordFailedLogin(email) {
  const attempts = (failedLoginAttempts.get(email) || 0) + 1;
  failedLoginAttempts.set(email, attempts);

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION;
    lockedAccounts.set(email, { expiresAt: lockoutUntil });
    failedLoginAttempts.delete(email);
    logAuditEvent('ACCOUNT_LOCKED', `Account locked for email: ${email}`, 'N/A');
  }
}

function resetFailedLogin(email) {
  failedLoginAttempts.delete(email);
}

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
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Input validation
    if (!fullName || !email || !password) {
      logAuditEvent('REGISTER_FAILED', 'Missing required fields', clientIp);
      return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }

    // Sanitize inputs
    const sanitizedFullName = sanitizeInput(fullName);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    // Validate email format
    if (!validateEmail(sanitizedEmail)) {
      logAuditEvent('REGISTER_FAILED', 'Invalid email format', clientIp);
      return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
    }

    // Validate full name length
    if (!validator.isLength(sanitizedFullName, { min: 2, max: 100 })) {
      logAuditEvent('REGISTER_FAILED', 'Invalid name length', clientIp);
      return res.status(400).json({ error: 'İsim 2-100 karakter arasında olmalı' });
    }

    // Simple password validation - minimum 6 characters
    if (password.length < 6) {
      logAuditEvent('REGISTER_FAILED', 'Password too short', clientIp);
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    // Check if user already exists
    const existingUser = users.get(sanitizedEmail);
    if (existingUser) {
      logAuditEvent('REGISTER_FAILED', `Email already registered: ${sanitizedEmail}`, clientIp);
      return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
    }

    // Hash password with increased salt rounds
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = Date.now() + VERIFICATION_TOKEN_EXPIRY;

    const user = {
      id: userId,
      email: sanitizedEmail,
      fullName: sanitizedFullName,
      password: hashedPassword,
      verified: false,
      verificationToken,
      verificationExpiresAt,
      createdAt: Date.now(),
      lastLogin: null
    };

    users.set(sanitizedEmail, user);
    verificationTokens.set(verificationToken, { email: sanitizedEmail, expiresAt: verificationExpiresAt });

    // Send verification email
    const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
    const emailHtml = `
      <h2>Hoş Geldiniz!</h2>
      <p>PROJEX AI hesabınızı doğrulamak için aşağıdaki linke tıklayın:</p>
      <a href="${verificationLink}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Hesabı Doğrula</a>
      <p>Bu link 24 saat geçerlidir.</p>
    `;
    await sendEmail(sanitizedEmail, 'PROJEX AI - Hesap Doğrulama', emailHtml);

    // Generate JWT token
    const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logAuditEvent('REGISTER_SUCCESS', `User registered: ${sanitizedEmail}`, clientIp);

    res.json({
      message: 'Kayıt başarılı. Lütfen e-postanızı doğrulayın.',
      user: { id: userId, email: user.email, fullName: sanitizedFullName, verified: false },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    logAuditEvent('REGISTER_ERROR', error.message, req.ip);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
});

// Auth: Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Input validation
    if (!email || !password) {
      logAuditEvent('LOGIN_FAILED', 'Missing email or password', clientIp);
      return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
    }

    // Sanitize and validate email
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    if (!validateEmail(sanitizedEmail)) {
      logAuditEvent('LOGIN_FAILED', 'Invalid email format', clientIp);
      return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
    }

    // Check account lockout
    const lockoutStatus = checkAccountLockout(sanitizedEmail);
    if (lockoutStatus.locked) {
      logAuditEvent('LOGIN_BLOCKED', `Account locked: ${sanitizedEmail}`, clientIp);
      return res.status(429).json({
        error: `Hesabınız geçici olarak kilitlendi. Lütfen ${lockoutStatus.remainingTime} dakika sonra tekrar deneyin.`
      });
    }

    const user = users.get(sanitizedEmail);
    if (!user) {
      recordFailedLogin(sanitizedEmail);
      logAuditEvent('LOGIN_FAILED', `User not found: ${sanitizedEmail}`, clientIp);
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordFailedLogin(sanitizedEmail);
      const attempts = failedLoginAttempts.get(sanitizedEmail) || 0;
      logAuditEvent('LOGIN_FAILED', `Invalid password for: ${sanitizedEmail}, attempts: ${attempts}`, clientIp);
      return res.status(401).json({
        error: 'Geçersiz e-posta veya şifre',
        remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts
      });
    }

    // Reset failed login attempts on successful login
    resetFailedLogin(sanitizedEmail);

    // Update last login
    user.lastLogin = Date.now();
    users.set(sanitizedEmail, user);

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logAuditEvent('LOGIN_SUCCESS', `User logged in: ${sanitizedEmail}`, clientIp);

    res.json({
      message: 'Giriş başarılı',
      user: { id: user.id, email: user.email, fullName: user.fullName, verified: user.verified },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    logAuditEvent('LOGIN_ERROR', error.message, req.ip);
    res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
  }
});

// Auth: Forgot Password
app.post('/api/auth/forgot-password', emailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Input validation
    if (!email) {
      logAuditEvent('FORGOT_PASSWORD_FAILED', 'Missing email', clientIp);
      return res.status(400).json({ error: 'E-posta adresi gerekli' });
    }

    // Sanitize and validate email
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    if (!validateEmail(sanitizedEmail)) {
      logAuditEvent('FORGOT_PASSWORD_FAILED', 'Invalid email format', clientIp);
      return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
    }

    const user = users.get(sanitizedEmail);
    if (!user) {
      // Don't reveal if email exists or not for security
      logAuditEvent('FORGOT_PASSWORD_ATTEMPT', `Email not found: ${sanitizedEmail}`, clientIp);
      return res.json({ message: 'Şifre sıfırlama linki e-posta adresine gönderildi' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + RESET_TOKEN_EXPIRY;

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

    logAuditEvent('FORGOT_PASSWORD_SUCCESS', `Password reset link sent to: ${sanitizedEmail}`, clientIp);

    res.json({ message: 'Şifre sıfırlama linki e-posta adresine gönderildi' });
  } catch (error) {
    console.error('Forgot password error:', error);
    logAuditEvent('FORGOT_PASSWORD_ERROR', error.message, req.ip);
    res.status(500).json({ error: 'Şifre sıfırlama isteği sırasında hata oluştu' });
  }
});

// Auth: Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Input validation
    if (!token || !newPassword) {
      logAuditEvent('RESET_PASSWORD_FAILED', 'Missing token or password', clientIp);
      return res.status(400).json({ error: 'Token ve yeni şifre gerekli' });
    }

    // Simple password validation - minimum 6 characters
    if (newPassword.length < 6) {
      logAuditEvent('RESET_PASSWORD_FAILED', 'Password too short', clientIp);
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    const resetData = resetTokens.get(token);
    if (!resetData) {
      logAuditEvent('RESET_PASSWORD_FAILED', 'Invalid token', clientIp);
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token' });
    }

    if (Date.now() > resetData.expiresAt) {
      resetTokens.delete(token);
      logAuditEvent('RESET_PASSWORD_FAILED', 'Expired token', clientIp);
      return res.status(400).json({ error: 'Token süresi dolmuş' });
    }

    const user = users.get(resetData.email);
    if (!user) {
      logAuditEvent('RESET_PASSWORD_FAILED', 'User not found', clientIp);
      return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Hash new password with increased salt rounds
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.password = hashedPassword;
    users.set(resetData.email, user);

    // Delete used token
    resetTokens.delete(token);

    logAuditEvent('RESET_PASSWORD_SUCCESS', `Password reset for: ${resetData.email}`, clientIp);

    res.json({ message: 'Şifre başarıyla sıfırlandı' });
  } catch (error) {
    console.error('Reset password error:', error);
    logAuditEvent('RESET_PASSWORD_ERROR', error.message, req.ip);
    res.status(500).json({ error: 'Şifre sıfırlama sırasında hata oluştu' });
  }
});

// Auth: Verify Email
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!token) {
      logAuditEvent('VERIFY_EMAIL_FAILED', 'Missing token', clientIp);
      return res.status(400).json({ error: 'Token gerekli' });
    }

    const tokenData = verificationTokens.get(token);
    if (!tokenData) {
      logAuditEvent('VERIFY_EMAIL_FAILED', 'Invalid token', clientIp);
      return res.status(400).json({ error: 'Geçersiz token' });
    }

    // Check token expiration
    if (Date.now() > tokenData.expiresAt) {
      verificationTokens.delete(token);
      logAuditEvent('VERIFY_EMAIL_FAILED', 'Expired token', clientIp);
      return res.status(400).json({ error: 'Token süresi dolmuş' });
    }

    const user = users.get(tokenData.email);
    if (!user) {
      logAuditEvent('VERIFY_EMAIL_FAILED', 'User not found', clientIp);
      return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
    }

    user.verified = true;
    user.verificationToken = null;
    user.verificationExpiresAt = null;
    users.set(tokenData.email, user);

    verificationTokens.delete(token);

    logAuditEvent('VERIFY_EMAIL_SUCCESS', `Email verified for: ${tokenData.email}`, clientIp);

    res.json({ message: 'E-posta başarıyla doğrulandı' });
  } catch (error) {
    console.error('Verify email error:', error);
    logAuditEvent('VERIFY_EMAIL_ERROR', error.message, req.ip);
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
