import { Server } from 'socket.io';
import { setSocketInstance } from './services/socketInstance.js';

const configureSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    },
    transports: ['websocket', "polling"],
  });

  // Set the socket instance so it can be used elsewhere
  setSocketInstance(io);

  // Socket event handling
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('setup', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} connected`);
      socket.emit('connected');
    });

    socket.on('join chat', (room) => {
      socket.join(room);
      console.log(`User joined room: ${room}`);
    });

    socket.on('typing', (room) => {
      socket.to(room).emit('typing');
      
    });

    socket.on('stop typing', (room) => {
      socket.to(room).emit('stop typing');
    });

    socket.on('new message', (newMessage) => {
      const chat = newMessage.chat;
      if (!chat.users) return console.log("chat.users not defined");

      chat.users.forEach((user) => {
        if (user._id.toString() !== newMessage.sender._id.toString()) {
          socket.to(user._id.toString()).emit('message received', newMessage);
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export default configureSocket;
