import ApiErrors from "../utils/ApiErrors.js";

let io;

export const setSocketInstance = (socketServer) => {
  io = socketServer;
};

export const getSocketInstance = () => {
  if (!io) throw new ApiErrors(500, 'Socket.io not initialized!');
  return io;
};
