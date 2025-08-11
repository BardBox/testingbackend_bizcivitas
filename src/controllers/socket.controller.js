const io = getSocketInstance();

io.on("connection", (socket) => {
    console.log("Connected to socket.io");
    socket.on("setup", (userData) => {
      // socket.handshake.auth = {      };
      // socket.join(userData._id);
      // socket.emit("connected");
      // lastSeen(userData._id, true);
      console.log(userData)
    });
  
    socket.on("join chat", (room) => {
      socket.join(room);
      console.log("User Joined Room: " + room);
    });
    socket.on("new message", (newMessageRecieved) => {
      var chat = newMessageRecieved.chat;
  
      if (!chat.users) return console.log("chat.users not defined");
  
      chat.users.forEach((user) => {
        if (user._id == newMessageRecieved.sender._id) return;
  
        socket.in(user._id).emit("message recieved", newMessageRecieved);
      });
    });
  
    socket.on("disconnect", (reason) => {
      console.log("Disconnected");
      lastSeen(socket.handshake.auth.userData?._id || "123", false);
    });
  
    socket.off("setup", (user) => {
      console.log("USER DISCONNECTED");
      socket.leave(user._id);
    });
  });
  