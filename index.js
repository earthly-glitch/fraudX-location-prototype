// Main server file
const cors = require('cors');
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make io accessible to routes
app.set('io', io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/starksLocProto")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('join-device', (deviceId) => {
    socket.join(`device:${deviceId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Routes
app.use('/api/location', require('./routes/location'));
app.use('/api/simulator', require('./routes/simulator'));
app.use('/', require('./routes/dashboard'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    ok: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
});

// Import simulator to attach event listeners
const simulator = require('./services/pingSimulator');

simulator.on('simulation-started', (data) => {
  io.emit('simulation-started', data);
});

simulator.on('ping-sent', (data) => {
  io.emit('ping-sent', data);
});

simulator.on('simulation-stopped', (data) => {
  io.emit('simulation-stopped', data);
});

simulator.on('route-completed', (data) => {
  io.emit('route-completed', data);
});

simulator.on('ping-error', (data) => {
  io.emit('ping-error', data);
  console.error('Simulator error:', data);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 FraudX Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🎮 Simulator: http://localhost:${PORT}/simulator`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  const stopped = simulator.stopAll();
  console.log(`⏹️  Stopped ${stopped} simulations`);
  
  io.close(() => {
    console.log('🔌 Socket.IO closed');
  });
  
  await mongoose.connection.close();
  console.log('📦 MongoDB connection closed');
  
  server.close(() => {
    console.log('🚀 Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down...');
  process.emit('SIGINT');
});