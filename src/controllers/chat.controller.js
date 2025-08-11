import asyncHandler from "../utils/asyncHandler.js";
import { Chat } from "../models/chat.model.js";
import { User } from "../models/user.model.js";
import Message from "../models/message.model.js";

// @description     Create or fetch One to One Chat
// @route           POST /api/chat/
// @access          Protected
export const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name pic email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

// @description     Fetch all chats for a user
// @route           GET /api/chat/
// @access          Protected
export const fetchChats = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    const results = await Chat.find({
      users: { $elemMatch: { $eq: userId } },
    })
      .populate("users", "fname lname avatar")
      .populate("groupAdmin", "fname lname avatar")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    const populatedResults = await User.populate(results, {
      path: "latestMessage.sender",
      select: "name pic email",
    });

    // Add unseen message count per chat
    const chatsWithUnseen = await Promise.all(
      populatedResults.map(async (chat) => {
        const unseenCount = await Message.countDocuments({
          chat: chat._id,
          sender: { $ne: userId },
          readBy: false,
        });

        return {
          ...chat.toObject(),
          unseenMsg: unseenCount,
        };
      })
    );

    res.status(200).send({ chats: chatsWithUnseen });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @description     Delete a Chat and its Messages
// @route           DELETE /api/chat/:chatId
// @access          Protected
export const deleteChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user._id;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  try {
    // Find the chat and verify the user is a participant
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.users.includes(userId)) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this chat" });
    }

    // Delete all messages associated with the chat
    await Message.deleteMany({ chat: chatId });

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({
      message: "Chat and all associated messages deleted successfully",
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});