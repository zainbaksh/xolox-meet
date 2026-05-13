const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Track rooms: roomId -> Set of socket IDs
const rooms = {};

// Endpoint to check room size before joining (used by lobby for soft-cap warning).
// Mesh WebRTC degrades fast past 4 peers (bandwidth scales as O(N^2)).
const ROOM_SOFT_CAP = 4;
app.get('/api/room-size/:roomId', (req, res) => {
  const size = rooms[req.params.roomId]?.size || 0;
  res.json({ size, softCap: ROOM_SOFT_CAP, isAtCap: size >= ROOM_SOFT_CAP });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, userName }) => {
    socket.data.userName = userName;
    socket.data.roomId = roomId;

    if (!rooms[roomId]) rooms[roomId] = new Set();

    // Send list of existing peers to the new joiner
    const existingPeers = [...rooms[roomId]].map(id => ({
      peerId: id,
      userName: io.sockets.sockets.get(id)?.data.userName || 'Guest'
    }));
    socket.emit('existing-peers', existingPeers);

    // Tell existing peers about the new joiner
    rooms[roomId].forEach(peerId => {
      io.to(peerId).emit('peer-joined', {
        peerId: socket.id,
        userName
      });
    });

    rooms[roomId].add(socket.id);
    socket.join(roomId);

    console.log(`${userName} joined room ${roomId} (${rooms[roomId].size} users)`);
  });

  // WebRTC signaling relay — the only media-related events now.
  // Actual audio/video flows peer-to-peer via RTCPeerConnection, not through us.
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Chat relay
  socket.on('chat-message', ({ roomId, name, text }) => {
    socket.to(roomId).emit('chat-message', { name, text });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const { roomId, userName } = socket.data;
    if (roomId && rooms[roomId]) {
      rooms[roomId].delete(socket.id);
      if (rooms[roomId].size === 0) delete rooms[roomId];
      else {
        io.to(roomId).emit('peer-left', { peerId: socket.id, userName });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Xolox Meet running at http://localhost:${PORT}\n`);
});