import asyncHandler from "../utils/asyncHandler.js";
import Message from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { Chat } from "../models/chat.model.js";

// @description     Get all Messages
// @route           GET /api/Message/:chatId
// @access          Protected
export const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "fname lname avatar")
      .populate("chat");

    const getFormattedDate = (dateStr) => {
      const messageDate = new Date(dateStr);
      const now = new Date();

      const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);

      if (isSameDay(messageDate, now)) {
        return "Today";
      } else if (isSameDay(messageDate, yesterday)) {
        return "Yesterday";
      }

      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);

      if (messageDate > oneWeekAgo) {
        return days[messageDate.getDay()];
      }

      // ✅ Return date as dd/mm/yyyy
      const day = String(messageDate.getDate()).padStart(2, "0");
      const month = String(messageDate.getMonth() + 1).padStart(2, "0");
      const year = messageDate.getFullYear();

      return `${day}/${month}/${year}`;
    };

    const enhancedMessages = messages.map((msg) => {
      return {
        ...msg._doc,
        formattedDate: getFormattedDate(msg.createdAt),
      };
    });

    res.json(enhancedMessages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @description     Create New Message
// @route           POST /api/Message/
// @access          Protected
export const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  const newMessage = {
    sender: req.user._id,
    content,
    chat: chatId,
  };

  try {
    let message = await Message.create(newMessage);

    // Populate fields without .execPopulate
    message = await message.populate("sender", "fname lname avatar");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "fname lname avatar",
    });

    // Update the latest message in the chat
    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

export const markMessageAsSeen = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { targetUserId } = req.body;

  if (!userId || !targetUserId) {
    return res
      .status(400)
      .json({ message: "User ID and target UserId are required" });
  }

  const chat = await Chat.findOne({
    users: { $all: [userId, targetUserId] },
  });

  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }

  const unreadMessages = await Message.find({
    chat: chat._id,
    readBy: false,
  }).populate("chat");

  for (const message of unreadMessages) {
    message.readBy = true;
    await message.save();
  }

  res.status(200).json({
    message: "Messages marked as seen",
    updatedCount: unreadMessages.length,
  });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res
      .status(400)
      .json({ message: "messageIds must be a non-empty array" });
  }

  const results = {
    deleted: [],
    skipped: [],
  };

  for (const messageId of messageIds) {
    try {
      const message = await Message.findById(messageId).populate("chat");

      if (!message) {
        results.skipped.push({ messageId, reason: "Message not found" });
        continue;
      }

      if (message.sender.toString() !== userId.toString()) {
        results.skipped.push({
          messageId,
          reason: "Not authorized to delete this message",
        });
        continue;
      }

      // Delete the message
      await Message.findByIdAndDelete(messageId);
      results.deleted.push(messageId);

      // Check if it was the latest message in the chat
      const chat = await Chat.findById(message.chat._id).populate(
        "latestMessage"
      );

      if (
        chat.latestMessage &&
        chat.latestMessage._id.toString() === messageId
      ) {
        const latest = await Message.find({ chat: chat._id })
          .sort({ createdAt: -1 })
          .limit(1);

        chat.latestMessage = latest[0]?._id || null;
        await chat.save();
      }
    } catch (error) {
      results.skipped.push({
        messageId,
        reason: "Unexpected error",
        error: error.message,
      });
    }
  }

  if (results.deleted.length === 0) {
    return res.status(400).json({
      message: "No messages were deleted",
      results,
    });
  }

  return res.status(200).json({
    message: "Messages processed",
    results,
  });
});

export const editMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  if (!content) {
    return res.status(400).json({ message: "Content is required" });
  }

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this message" });
    }

    message.content = content;
    message.isEdited = true;
    message.updatedAt = new Date();

    const updatedMessage = await message.save();

    await updatedMessage.populate("sender", "fname lname avatar");
    await updatedMessage.populate("chat");

    const chat = await Chat.findById(message.chat._id);
    if (
      chat.latestMessage &&
      chat.latestMessage.toString() === id
    ) {
      chat.latestMessage = updatedMessage._id;
      await chat.save();
    }

    res.json(updatedMessage);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
