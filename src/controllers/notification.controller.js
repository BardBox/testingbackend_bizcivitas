import firebaseAdmin from "../config/firebaseAdmin.js";
import { Notification } from "../models/notification.model.js";
import { TripEvent } from "../models/tripEvent.model.js";
import { Event } from "../models/Event.model.js";
import { OnlineEvent } from "../models/onlineEvent.model.js";
import { Connection } from "../models/connection.model.js";
import { User } from "../models/user.model.js";
import { Meetup } from "../models/meetup.model.js";
import { Meeting } from "../models/meeting.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

const getUnread = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notifications = await Notification.find({
    userId,
    isUnread: true,
  }).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { notifications, count: notifications.length },
        "Unread notifications fetched successfully"
      )
    );
});

const markRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notificationId = req.params.id;

  // If a specific notification ID is provided, update just that one
  if (notificationId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isUnread: false },
      { new: true }
    );

    if (!notification) {
      throw new ApiErrors(404, "Notification not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          { notification },
          "Notification marked as read successfully"
        )
      );
  }

  // If no specific ID, mark all as read
  const result = await Notification.updateMany(
    { userId, isUnread: true },
    { $set: { isUnread: false } }
  );

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { modifiedCount: result.modifiedCount },
        "All notifications marked as read successfully"
      )
    );
});

const sendToUser = asyncHandler(async (req, res) => {
  const { userId, messageTitle, messageBody, type } = req.body;

  // Validate request body fields
  if (!userId || !messageTitle || !messageBody || !type) {
    throw new ApiErrors(400, "All fields are required");
  }

  // Find user by userId
  const user = await User.findById(userId);
  if (!user || !user.fcmTokens.length) {
    throw new ApiErrors(404, "User not found or no FCM tokens");
  }

  // Create a notification record in the database
  const notification = await Notification.create({
    userId,
    messageTitle,
    messageBody,
    type,
    isUnread: true,
  });

  // Prepare the message object
  const message = {
    notification: {
      title: messageTitle,
      body: messageBody,
    },
  };

  let successCount = 0;
  let failureCount = 0;

  try {
    // Loop through each token and send the message individually
    for (const token of user.fcmTokens) {
      message.token = token; // Set the token for each iteration
      try {
        // Send notification for each token
        const response = await firebaseAdmin.messaging().send(message);
        successCount += response.successCount;
      } catch (error) {
        console.error("Error sending notification to token:", token, error);
        failureCount += 1;
      }
    }

    return res.status(201).json(
      new ApiResponses(
        201,
        {
          notification,
          successCount,
          failureCount,
        },
        "Notifications sent successfully"
      )
    );
  } catch (error) {
    // Handle any other general errors
    throw new ApiErrors(500, "Failed to send notifications", error);
  }
});

const sendToAll = asyncHandler(async (req, res) => {
  const { messageTitle, messageBody, type } = req.body;

  if (!messageTitle || !messageBody || !type) {
    throw new ApiErrors(400, "All fields are required");
  }

  // Fetch all users with FCM tokens
  const users = await User.find({ fcmTokens: { $exists: true, $ne: [] } });

  if (!users.length) {
    throw new ApiErrors(404, "No users with FCM tokens found");
  }

  // Create notifications in the database for each user
  const notificationPromises = users.map((user) =>
    Notification.create({
      userId: user._id,
      messageTitle,
      messageBody,
      type,
      isUnread: true,
    })
  );

  await Promise.all(notificationPromises);

  // Collect all FCM tokens from the users
  const allTokens = users.flatMap((user) => {
    if (
      user.fcmTokens &&
      Array.isArray(user.fcmTokens) &&
      user.fcmTokens.length > 0
    ) {
      return user.fcmTokens.map((tokenObj) => tokenObj.token || tokenObj);
    }
    return [];
  });

  if (!allTokens.length) {
    return res
      .status(400)
      .json(new ApiErrors(400, "No FCM tokens available for notifications"));
  }

  // Create the message structure for FCM
  const message = {
    notification: {
      title: messageTitle,
      body: messageBody,
    },
  };

  try {
    // Send notifications individually to each token using send()
    const notificationResponses = await Promise.all(
      allTokens.map(async (token) => {
        if (!token || token.trim() === "") {
          throw new ApiErrors(400, "Invalid FCM token encountered");
        }

        const singleMessage = { ...message, token };
        try {
          const response = await firebaseAdmin.messaging().send(singleMessage); // Send individual message

          return { token, success: true, response };
        } catch (error) {
          console.error(`Error sending notification to ${token}:`, error);
          return { token, success: false, error };
        }
      })
    );

    // Count successes and failures
    const successCount = notificationResponses.filter(
      (response) => response.success
    ).length;
    const failureCount = notificationResponses.length - successCount;

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          successCount,
          failureCount,
          totalUsers: users.length,
        },
        "Notifications sent to all users"
      )
    );
  } catch (error) {
    console.error("Error in sending notifications:", error);
    throw new ApiErrors(
      500,
      "Failed to send notifications to all users",
      error
    );
  }
});

const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.user._id;

  if (!fcmToken) {
    throw new ApiErrors(400, "FCM token is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  // Check if the token already exists in the fcmTokens array
  if (!user.fcmTokens.includes(fcmToken)) {
    // If not, add the token to the array
    user.fcmTokens.push(fcmToken);
    await user.save();
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { fcmTokens: user.fcmTokens },
        "FCM token updated successfully"
      )
    );
});

// Helper function to get connection recipients
const getConnectionRecipients = async (userIds, action) => {
  // Get both sender and receiver
  const [senderId, receiverId] = userIds;

  const sender = await User.findById(senderId).select("fcmTokens");
  const receiver = await User.findById(receiverId).select("fcmTokens");

  // If the sender and/or receiver have FCM tokens, return them
  const recipients = [];
  // if (sender?.fcmTokens?.length) {
  //   recipients.push(sender);
  // }
  if (receiver?.fcmTokens?.length) {
    recipients.push(receiver);
  }

  return recipients;
};

// Main notification sending function
const sendNotification = asyncHandler(async (req, res) => {
  const { Id, messageTitle, messageBody, type, action } = req.body;

  if (!Id || !messageTitle || !messageBody || !type) {
    throw new ApiErrors(
      400,
      "Id, messageTitle, messageBody, and type are required"
    );
  }

  const ids = Array.isArray(Id) ? Id : [Id];
  let recipients = [];
  let metadata = {};

 if (type === "event") {
  const events = await Event.find({ _id: { $in: ids } }).populate({
    path: "communities",
    populate: {
      path: "users",
      match: { fcmTokens: { $exists: true, $ne: [] } },
      select: "_id fcmTokens",
    },
  });

  if (!events.length) {
    throw new ApiErrors(404, "No events found with the provided IDs");
  }

  const uniqueUsers = new Map();
  events.forEach((event) => {
    event.communities?.forEach((community) => {
      community.users?.forEach((user) => {
        if (user.fcmTokens?.length > 0) {
          uniqueUsers.set(user._id.toString(), user);
        }
      });
    });
  });

  recipients = Array.from(uniqueUsers.values());
  metadata = { eventIds: ids.map(String) };
}
else if (type === "connection") {
    if (!action) {
      throw new ApiErrors(
        400,
        "Action is required for connection notifications"
      );
    }
    if (ids.length !== 2) {
      throw new ApiErrors(
        400,
        "Exactly two user IDs are required for connection notifications"
      );
    }

    const [senderId, receiverId] = ids;
    recipients = await getConnectionRecipients(ids, action);

    if (action === "accept" || action === "reject") {
      await Connection.findOneAndUpdate(
        { sender: senderId, receiver: receiverId },
        { isAccepted: action === "accept" },
        { new: true }
      );
    }

    metadata = {
      senderId: String(senderId),
      receiverId: String(receiverId),
      connectionStatus: action === "accept" ? "accepted" : action,
    };
  } else if (type === "user") {
    recipients = await User.find({
      _id: { $in: ids },
      fcmTokens: { $exists: true, $ne: [] },
    }).select("_id fcmTokens");

    metadata = { userIds: ids.map(String) };
  } else if (type === "meetup") {
    const meetups = await Meetup.find({ _id: { $in: ids } }).populate({
      path: "attendees",
      match: { fcmTokens: { $exists: true, $ne: [] } },
      select: "_id fcmTokens",
    });

    if (!meetups.length) {
      throw new ApiErrors(404, "No meetups found with the provided IDs");
    }

    const uniqueUsers = new Map();
    meetups.forEach((meetup) => {
      meetup.attendees?.forEach((user) => {
        if (user.fcmTokens?.length > 0) {
          uniqueUsers.set(user._id.toString(), user);
        }
      });
    });

    recipients = Array.from(uniqueUsers.values());
    metadata = { meetupIds: ids.map(String) };
  } else if (type === "meeting") {
    const meetings = await Meeting.find({ _id: { $in: ids } }).populate({
      path: "community",
      populate: {
        path: "users",
        match: { fcmTokens: { $exists: true, $ne: [] } },
        select: "_id fcmTokens",
      },
    });
    console.log("demo", meetings);
    if (!meetings.length) {
      throw new ApiErrors(404, "No meetings found with the provided IDs");
    }

    const uniqueUsers = new Map();
    meetings.forEach((meeting) => {
      meeting.community?.users?.forEach((user) => {
        if (user.fcmTokens?.length > 0) {
          uniqueUsers.set(user._id.toString(), user);
        }
      });
    });

    recipients = Array.from(uniqueUsers.values());
    metadata = { meetingIds: ids.map(String) };
  } else {
    throw new ApiErrors(400, "Invalid notification type");
  }

  // If no recipients found
  if (!recipients.length) {
    return res
      .status(200)
      .json(
        new ApiResponses(200, {}, "No recipients with valid FCM tokens found")
      );
  }

  // Create notifications in database
  const notifications = await Promise.all(
    recipients.map((user) =>
      Notification.create({
        userId: user._id,
        messageTitle,
        messageBody,
        type,
        action,
        isUnread: true,
        metadata,
      })
    )
  );

  // Convert metadata values to strings (IMPORTANT FIX)
  const stringifiedMetadata = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, String(value)])
  );

  // Prepare FCM message
  const message = {
    notification: {
      title: messageTitle,
      body: messageBody,
    },
    data: {
      type: String(type),
      ...stringifiedMetadata, // Ensure all values are strings
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
  };

  // Send notifications
  const allTokens = recipients.flatMap((user) => user.fcmTokens);
  const results = await Promise.all(
    allTokens.map((token) =>
      firebaseAdmin
        .messaging()
        .send({ ...message, token })
        .then(() => ({ success: true }))
        .catch((error) => {
          console.error(`Failed to send to token ${token}:`, error);
          return { success: false, error };
        })
    )
  );
  console.log("token", allTokens);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        notifications,
        successCount,
        failureCount,
        totalRecipients: recipients.length,
        ...metadata,
      },
      "Notifications sent successfully"
    )
  );
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await Notification.updateMany(
    { userId, isUnread: true },
    { $set: { isUnread: false } }
  );

  return res.status(200).json(
    new ApiResponses(
      200,
      { modifiedCount: result.modifiedCount },
      "All notifications marked as read successfully"
    )
  );
});

const getAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [unread, read] = await Promise.all([
    Notification.find({ userId, isUnread: true }).sort({ createdAt: -1 }),
    Notification.find({ userId, isUnread: false }).sort({ createdAt: -1 }),
  ]);

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        unread,
        read,
        unreadCount: unread.length,
        readCount: read.length,
        totalCount: unread.length + read.length,
      },
      "Read and unread notifications fetched successfully"
    )
  );
});


const deleteNotification = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notificationId = req.params.id;

  const deleted = await Notification.findOneAndDelete({
    _id: notificationId,
    userId,
  });

  if (!deleted) {
    throw new ApiErrors(404, "Notification not found or already deleted");
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { notificationId },
        "Notification deleted successfully"
      )
    );
});


const deleteAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await Notification.deleteMany({ userId });

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { deletedCount: result.deletedCount },
        "All notifications deleted successfully"
      )
    );
});




export {
  getUnread,
  sendToUser,
  sendToAll,
  updateFcmToken,
  sendNotification,
  markRead,
  markAllAsRead,
  getAllNotifications,
    deleteNotification,      
  deleteAllNotifications,  
};
