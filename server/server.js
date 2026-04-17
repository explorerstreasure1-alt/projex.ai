const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

// API Keys endpoint - returns keys from Vercel environment variables
app.get('/api/keys', (req, res) => {
  res.json({
    groqApiKey: process.env.GROQ_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    sabmanovaId: process.env.SABMANOVA_ID || '',
    hfToken: process.env.HF_TOKEN || '',
    cloudflareApiKey: process.env.CLOUDFLARE_API_KEY || ''
  });
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
