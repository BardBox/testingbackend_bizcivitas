import ApiResponses from "../utils/ApiResponses.js";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import { WallFeed } from "../models/wallFeed.model.js";
import { Poll } from "../models/poll.model.js";
import { Announcement } from "../models/announcement.model.js";
import { Article } from "../models/article.model.js";
import { Event } from "../models/Event.model.js";
import { OnlineEvent } from "../models/onlineEvent.model.js";
import { TripEvent } from "../models/tripEvent.model.js";
import { User } from "../models/user.model.js";
import { Community } from "../models/community.model.js";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");
const baseVideoDir = path.join(process.cwd(), "public", "assets", "videos");

// Helper function to build response data
const buildResponseData = (wallFeed, userId) => {
  // Ensure comments is always an array
  const comments = wallFeed.comments || [];

  const processedComments = comments.map((comment) => {
    // Convert to plain object if it's a Mongoose document
    const commentObj = comment.toObject ? comment.toObject() : comment;

    return {
      ...commentObj,
      likeCount: commentObj.likes ? commentObj.likes.length : 0,
      isLiked: (commentObj.likes || []).some(
        (like) =>
          like.userId &&
          (typeof like.userId === "object"
            ? like.userId._id.toString() === userId.toString()
            : like.userId.toString() === userId.toString())
      ),
    };
  });

  const responseData = {
    _id: wallFeed._id,
    userId: wallFeed.userId,
    type: wallFeed.type,
    visibility: wallFeed.visibility,
    createdAt: wallFeed.createdAt,
    updatedAt: wallFeed.updatedAt,
    comments: processedComments,
    commentCount: processedComments.length,
    likes: wallFeed.likes,
    likeCount: wallFeed.likes ? wallFeed.likes.length : 0,
    communityId: wallFeed.communityId,
    image: wallFeed.image,
    video: wallFeed.video,
    icon: wallFeed.icon,
    badge: wallFeed.badge,
    title: wallFeed.title,
    description: wallFeed.description,
    isLiked: (wallFeed.likes || []).some(
      (like) =>
        like.userId &&
        (typeof like.userId === "object"
          ? like.userId._id.toString() === userId.toString()
          : like.userId.toString() === userId.toString())
    ),
  };

  if (wallFeed.type === "poll" || wallFeed.type === "pulsePolls") {
    responseData.poll = wallFeed.poll;
  } else if (wallFeed.type === "announcement") {
    responseData.announcement = wallFeed.announcement;
  } else if (wallFeed.type === "article") {
    responseData.article = wallFeed.article;
  } else if (["trip", "upcomingEvent"].includes(wallFeed.type)) {
    responseData.eventRef = wallFeed.eventRef;
    responseData.eventModel = wallFeed.eventModel;
  }

  return responseData;
};

// GET All WallFeeds
const modelMap = {

  Event,
};

const getWallFeed = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const formatDate = (date) => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formatTimeAgo = (date) => {
      const now = new Date();
      const inputDate = new Date(date);
      const diffMs = now - inputDate;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return "Just now";
      if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
      if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
      if (diffDay === 1) return "Yesterday";
      if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;

      return formatDate(date);
    };

    const user = await User.findById(userId).select("connections");
    if (!user) {
      throw new ApiErrors(404, "User not found");
    }

    const communities = await Community.find({
      $or: [{ users: userId }, { coreMembers: userId }],
    }).select("_id");
    const communityIds = communities
      ? communities.map((community) => community._id)
      : [];

    const wallFeeds = await WallFeed.find({
      $or: [
        { visibility: "public" },
        {
          visibility: "connections",
          userId: { $in: [...(user.connections || []), userId] },
        },
        {
          visibility: "community",
          communityId: { $in: communityIds },
        },
      ],
    })
      .populate([
        { path: "poll" },
        { path: "announcement" },
        { path: "article" },
        { path: "userId", select: "fname lname avatar username" },
        { path: "comments.userId", select: "fname lname avatar username" },
        { path: "comments.mentions", select: "fname lname avatar username" },
        { path: "likes.userId", select: "fname lname avatar username" },
        { path: "communityId", select: "name" },
      ])
      .sort({ createdAt: -1 })
      .lean();

    const eventIdsByModel = wallFeeds.reduce(
      (acc, feed) => ({
        ...acc,
        [feed.eventModel || "None"]: [
          ...(acc[feed.eventModel || "None"] || []),
          feed.eventRef || null,
        ].filter(Boolean),
      }),
      { TripEvent: [], OnlineEvent: [], OneDayEvent: [], None: [] }
    );

    const eventsByModel = await Promise.all(
      Object.entries(modelMap).map(async ([modelName, Model]) => ({
        [modelName]: await Model.find({
          _id: { $in: eventIdsByModel[modelName] },
        }).lean(),
      }))
    ).then((results) => Object.assign({}, ...results));

    const eventMap = Object.values(eventsByModel)
      .flat()
      .reduce((acc, event) => ({ ...acc, [event._id.toString()]: event }), {});

    const populatedWallFeeds = wallFeeds.map((feed) => ({
      ...buildResponseData(
        {
          ...feed,
          poll: feed.poll,
          announcement: feed.announcement,
          article: feed.article,
          userId: feed.userId,
          comments: feed.comments,
          likes: feed.likes,
          communityId: feed.communityId,
        },
        userId
      ),
      eventRef: feed.eventRef
        ? eventMap[feed.eventRef.toString()] || null
        : null,
      timeAgo: formatTimeAgo(feed.createdAt),
    }));

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          { wallFeeds: populatedWallFeeds },
          "WallFeeds retrieved successfully"
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Failed to retrieve WallFeeds", error.message);
  }
});

// CREATE trip or upcomingEvent WallFeed
const createEventWallFeed = asyncHandler(async (req, res) => {
  const { type, eventRef, eventModel, visibility, communityId, badge } =
    req.body;
  const userId = req.user._id;

  if (!["trip", "upcomingEvent"].includes(type)) {
    throw new ApiErrors(400, "Type must be 'trip' or 'upcomingEvent'");
  }

  if (!eventRef || !eventModel) {
    throw new ApiErrors(
      400,
      "eventRef and eventModel are required for this type"
    );
  }

  if (
    visibility &&
    !["public", "connections", "community"].includes(visibility)
  ) {
    throw new ApiErrors(400, "Invalid visibility value");
  }

  if (visibility === "community" && !communityId) {
    throw new ApiErrors(
      400,
      "communityId is required for community visibility"
    );
  }

  if (
    visibility === "community" &&
    !mongoose.Types.ObjectId.isValid(communityId)
  ) {
    throw new ApiErrors(400, "Invalid communityId format");
  }

  let validEvent;
  if (eventModel === "OneDayEvent") {
    validEvent = await OneDayEvent.findById(eventRef);
  } else if (eventModel === "OnlineEvent") {
    validEvent = await OnlineEvent.findById(eventRef);
  } else if (eventModel === "TripEvent") {
    validEvent = await TripEvent.findById(eventRef);
  } else {
    throw new ApiErrors(400, "Invalid eventModel provided");
  }

  if (!validEvent) {
    throw new ApiErrors(
      404,
      `No event found with ID ${eventRef} in ${eventModel}`
    );
  }

  const newWallFeed = new WallFeed({
    type,
    eventRef: validEvent._id,
    eventModel,
    userId,
    visibility: visibility || "public",
    communityId: visibility === "community" ? communityId : undefined,
    badge: badge || undefined,
  });

  await newWallFeed.save();

  const populatedWallFeed = await WallFeed.findById(newWallFeed._id)
    .populate("userId", "fname lname avatar username")
    .populate("comments.userId", "fname lname avatar username")
    .populate("comments.mentions", "fname lname avatar username")
    .populate("likes.userId", "fname lname avatar username")
    .populate("communityId", "name");

  return res
    .status(201)
    .json(
      new ApiResponses(
        201,
        buildResponseData(populatedWallFeed, userId),
        "Event WallFeed created successfully"
      )
    );
});

// UPDATE trip or upcomingEvent WallFeed
const updateEventWallFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, eventRef, eventModel, visibility, communityId, badge } =
    req.body;
  const userId = req.user._id;

  const wallFeed = await WallFeed.findById(id);
  if (!wallFeed) {
    throw new ApiErrors(404, "WallFeed not found");
  }

  if (!["trip", "upcomingEvent"].includes(type)) {
    throw new ApiErrors(400, "Type must be 'trip' or 'upcomingEvent'");
  }

  if (!eventRef || !eventModel) {
    throw new ApiErrors(
      400,
      "eventRef and eventModel are required for this type"
    );
  }

  if (
    visibility &&
    !["public", "connections", "community"].includes(visibility)
  ) {
    throw new ApiErrors(400, "Invalid visibility value");
  }

  if (visibility === "community" && !communityId) {
    throw new ApiErrors(
      400,
      "communityId is required for community visibility"
    );
  }

  if (
    visibility === "community" &&
    !mongoose.Types.ObjectId.isValid(communityId)
  ) {
    throw new ApiErrors(400, "Invalid communityId format");
  }

  let validEvent;
  if (eventModel === "OneDayEvent") {
    validEvent = await OneDayEvent.findById(eventRef);
  } else if (eventModel === "OnlineEvent") {
    validEvent = await OnlineEvent.findById(eventRef);
  } else if (eventModel === "TripEvent") {
    validEvent = await TripEvent.findById(eventRef);
  } else {
    throw new ApiErrors(400, "Invalid eventModel provided");
  }

  if (!validEvent) {
    throw new ApiErrors(
      404,
      `No event found with ID ${eventRef} in ${eventModel}`
    );
  }

  wallFeed.type = type;
  wallFeed.eventRef = validEvent._id;
  wallFeed.eventModel = eventModel;
  wallFeed.userId = userId;
  wallFeed.visibility = visibility || wallFeed.visibility;
  wallFeed.communityId = visibility === "community" ? communityId : undefined;
  wallFeed.badge = badge || wallFeed.badge;

  await wallFeed.save();

  const populatedWallFeed = await WallFeed.findById(id)
    .populate("userId", "fname lname avatar username")
    .populate("comments.userId", "fname lname avatar username")
    .populate("comments.mentions", "fname lname avatar username")
    .populate("likes.userId", "fname lname avatar username")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedWallFeed, userId),
        "Event WallFeed updated successfully"
      )
    );
});

// CREATE Poll WallFeed
const createPollWallFeed = asyncHandler(async (req, res) => {
  const { type, question, options, visibility, communityId, badge } = req.body;
  const userId = req.user._id;

  try {
    if (!["poll", "pulsePolls"].includes(type)) {
      throw new ApiErrors(400, "Type must be 'poll' or 'pulsePolls'");
    }

    if (
      !question ||
      !options ||
      !Array.isArray(options) ||
      options.length === 0
    ) {
      throw new ApiErrors(400, "Poll question and options are required");
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    const newPoll = new Poll({
      question,
      options: options.map((option) => ({ text: option })),
    });

    await newPoll.save();

    let imagePath;
    if (req.files?.image) {
      imagePath = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    const newWallFeed = new WallFeed({
      type,
      poll: newPoll._id,
      image: imagePath,
      userId,
      visibility: visibility || "public",
      communityId: visibility === "community" ? communityId : undefined,
      badge: badge || undefined,
    });

    await newWallFeed.save();

    const populatedWallFeed = await WallFeed.findById(newWallFeed._id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("poll");

    return res
      .status(201)
      .json(
        new ApiResponses(
          201,
          buildResponseData(populatedWallFeed, userId),
          "Poll WallFeed created successfully"
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    throw new ApiErrors(500, "Failed to create Poll WallFeed", error.message);
  }
});

// UPDATE Poll WallFeed
const updatePollWallFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, question, options, visibility, communityId, badge } = req.body;
  const userId = req.user._id;

  const wallFeed = await WallFeed.findById(id).populate("poll");

  try {
    if (!wallFeed) {
      throw new ApiErrors(404, "WallFeed not found");
    }

    if (!["poll", "pulsePolls"].includes(type)) {
      throw new ApiErrors(400, "Type must be 'poll' or 'pulsePolls'");
    }

    if (
      !question ||
      !options ||
      !Array.isArray(options) ||
      options.length === 0
    ) {
      throw new ApiErrors(400, "Poll question and options are required");
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    const pollDoc = wallFeed.poll;
    pollDoc.question = question;
    pollDoc.options = options.map((option) => ({
      text: option,
      votes: 0,
    }));
    pollDoc.totalVotes = 0;
    pollDoc.voters = [];

    await pollDoc.save();

    if (req.files?.image) {
      if (wallFeed.image) {
        const oldImagePath = path.join(baseImageDir, wallFeed.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      wallFeed.image = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    wallFeed.userId = userId;
    wallFeed.visibility = visibility || wallFeed.visibility;
    wallFeed.communityId = visibility === "community" ? communityId : undefined;
    wallFeed.badge = badge || wallFeed.badge;

    await wallFeed.save();

    const populatedWallFeed = await WallFeed.findById(id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("poll");

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          buildResponseData(populatedWallFeed, userId),
          "Poll WallFeed updated successfully"
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    throw new ApiErrors(500, "Failed to update Poll WallFeed", error.message);
  }
});

// Vote on Poll
const voteOnPoll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { optionIndex } = req.body;
  const userId = req.user._id;

  if (!userId) {
    throw new ApiErrors(401, "User authentication required to vote");
  }

  const wallFeed = await WallFeed.findById(id).populate("poll");
  if (!wallFeed || !["poll", "pulsePolls"].includes(wallFeed.type)) {
    throw new ApiErrors(404, "Poll not found");
  }

  const user = await User.findById(userId).select("connections");
  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");
  const communityIds = communities
    ? communities.map((community) => community._id)
    : [];

  const isAuthorized =
    wallFeed.visibility === "public" ||
    (wallFeed.visibility === "connections" &&
      (user.connections.includes(wallFeed.userId.toString()) ||
        wallFeed.userId.toString() === userId.toString())) ||
    (wallFeed.visibility === "community" &&
      communityIds.some(
        (id) => wallFeed.communityId && id.equals(wallFeed.communityId)
      ));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to vote on this WallFeed");
  }

  const poll = wallFeed.poll;

  const hasVoted = poll.voters.some(
    (voter) => voter.userId.toString() === userId.toString()
  );

  if (hasVoted) {
    throw new ApiErrors(403, "You have already voted on this poll");
  }

  if (
    typeof optionIndex !== "number" ||
    optionIndex < 0 ||
    optionIndex >= poll.options.length
  ) {
    throw new ApiErrors(400, "Invalid poll option index");
  }

  try {
    poll.options[optionIndex].votes += 1;
    poll.totalVotes += 1;
    poll.voters.push({
      userId,
      optionIndex,
    });

    await poll.save();
    await wallFeed.save();

    const populatedWallFeed = await WallFeed.findById(id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("poll");

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          buildResponseData(populatedWallFeed, userId),
          "Vote recorded successfully"
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Failed to record vote", error.message);
  }
});

// Remove Vote from Poll
const removeVoteFromPoll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!userId) {
    throw new ApiErrors(401, "User authentication required to remove vote");
  }

  const wallFeed = await WallFeed.findById(id).populate("poll");
  if (!wallFeed || !["poll", "pulsePolls"].includes(wallFeed.type)) {
    throw new ApiErrors(404, "Poll not found");
  }

  const user = await User.findById(userId).select("connections");
  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");
  const communityIds = communities
    ? communities.map((community) => community._id)
    : [];

  const isAuthorized =
    wallFeed.visibility === "public" ||
    (wallFeed.visibility === "connections" &&
      (user.connections.includes(wallFeed.userId.toString()) ||
        wallFeed.userId.toString() === userId.toString())) ||
    (wallFeed.visibility === "community" &&
      communityIds.some(
        (id) => wallFeed.communityId && id.equals(wallFeed.communityId)
      ));

  if (!isAuthorized) {
    throw new ApiErrors(
      403,
      "Not authorized to remove vote from this WallFeed"
    );
  }

  const poll = wallFeed.poll;

  const voterIndex = poll.voters.findIndex(
    (voter) => voter.userId.toString() === userId.toString()
  );

  if (voterIndex === -1) {
    throw new ApiErrors(400, "You have not voted on this poll");
  }

  const votedOptionIndex = poll.voters[voterIndex].optionIndex;

  try {
    if (
      poll.options[votedOptionIndex] &&
      poll.options[votedOptionIndex].votes > 0
    ) {
      poll.options[votedOptionIndex].votes -= 1;
      poll.totalVotes = Math.max(0, poll.totalVotes - 1);
    }

    poll.voters.splice(voterIndex, 1);

    await poll.save();
    await wallFeed.save();

    const populatedWallFeed = await WallFeed.findById(id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("poll");

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          buildResponseData(populatedWallFeed, userId),
          "Vote removed successfully"
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Failed to remove vote", error.message);
  }
});

// CREATE Article WallFeed
const createArticleWallFeed = asyncHandler(async (req, res) => {
  const { type, title, contents, visibility, communityId, badge } = req.body;
  const userId = req.user._id;

  try {
    if (type !== "article") {
      throw new ApiErrors(400, "Type must be 'article'");
    }

    if (!title || !contents || !Array.isArray(contents)) {
      throw new ApiErrors(
        400,
        "Title and valid contents are required for article"
      );
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    const newArticle = new Article({ title, contents });
    await newArticle.save();

    let imagePath;
    if (req.files?.image) {
      imagePath = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    const newWallFeed = new WallFeed({
      type,
      article: newArticle._id,
      image: imagePath,
      userId,
      visibility: visibility || "public",
      communityId: visibility === "community" ? communityId : undefined,
      badge: badge || undefined,
    });

    await newWallFeed.save();

    const populatedWallFeed = await WallFeed.findById(newWallFeed._id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("article");

    return res
      .status(201)
      .json(
        new ApiResponses(
          201,
          buildResponseData(populatedWallFeed, userId),
          "Article WallFeed created successfully"
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    throw new ApiErrors(
      500,
      "Failed to create Article WallFeed",
      error.message
    );
  }
});

// UPDATE Article WallFeed
const updateArticleWallFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, title, contents, visibility, communityId, badge } = req.body;
  const userId = req.user._id;

  const wallFeed = await WallFeed.findById(id).populate("article");

  try {
    if (!wallFeed) {
      throw new ApiErrors(404, "WallFeed not found");
    }

    if (type !== "article") {
      throw new ApiErrors(400, "Type must be 'article'");
    }

    if (!title || !contents || !Array.isArray(contents)) {
      throw new ApiErrors(
        400,
        "Title and valid contents are required for article"
      );
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    const articleDoc = wallFeed.article;
    articleDoc.title = title;
    articleDoc.contents = contents;
    await articleDoc.save();

    if (req.files?.image) {
      if (wallFeed.image) {
        const oldImagePath = path.join(baseImageDir, wallFeed.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      wallFeed.image = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    wallFeed.userId = userId;
    wallFeed.visibility = visibility || wallFeed.visibility;
    wallFeed.communityId = visibility === "community" ? communityId : undefined;
    wallFeed.badge = badge || wallFeed.badge;

    await wallFeed.save();

    const populatedWallFeed = await WallFeed.findById(id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("article");

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          buildResponseData(populatedWallFeed, userId),
          "Article WallFeed updated successfully"
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    throw new ApiErrors(
      500,
      "Failed to update Article WallFeed",
      error.message
    );
  }
});

// CREATE Announcement WallFeed
const createAnnouncementWallFeed = asyncHandler(async (req, res) => {
  const { type, title, description, visibility, communityId, badge } = req.body;
  const userId = req.user._id;

  try {
    if (type !== "announcement") {
      throw new ApiErrors(400, "Type must be 'announcement'");
    }

    if (
      !title ||
      !description ||
      !Array.isArray(description) ||
      description.length === 0
    ) {
      throw new ApiErrors(400, "Title and description are required");
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    const newAnnouncement = new Announcement({
      title,
      description,
    });

    await newAnnouncement.save();

    let imagePath;
    if (req.files?.image) {
      imagePath = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    const newWallFeed = new WallFeed({
      type,
      announcement: newAnnouncement._id,
      image: imagePath,
      userId,
      visibility: visibility || "public",
      communityId: visibility === "community" ? communityId : undefined,
      badge: badge || undefined,
    });

    await newWallFeed.save();

    const populatedWallFeed = await WallFeed.findById(newWallFeed._id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("announcement");

    return res
      .status(201)
      .json(
        new ApiResponses(
          201,
          buildResponseData(populatedWallFeed, userId),
          "Announcement WallFeed created successfully"
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    throw new ApiErrors(
      500,
      "Failed to create Announcement WallFeed",
      error.message
    );
  }
});

// UPDATE Announcement WallFeed
const updateAnnouncementWallFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, title, description, visibility, communityId, badge } = req.body;
  const userId = req.user._id;

  const wallFeed = await WallFeed.findById(id).populate("announcement");

  try {
    if (!wallFeed) {
      throw new ApiErrors(404, "WallFeed not found");
    }

    if (type !== "announcement") {
      throw new ApiErrors(400, "Type must be 'announcement'");
    }

    if (
      !title ||
      !description ||
      !Array.isArray(description) ||
      description.length === 0
    ) {
      throw new ApiErrors(400, "Title and description are required");
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    const announcementDoc = wallFeed.announcement;
    announcementDoc.title = title;
    announcementDoc.description = description;

    await announcementDoc.save();

    if (req.files?.image) {
      if (wallFeed.image) {
        const oldImagePath = path.join(baseImageDir, wallFeed.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      wallFeed.image = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    wallFeed.userId = userId;
    wallFeed.visibility = visibility || wallFeed.visibility;
    wallFeed.communityId = visibility === "community" ? communityId : undefined;
    wallFeed.badge = badge || wallFeed.badge;

    await wallFeed.save();

    const populatedWallFeed = await WallFeed.findById(id)
      .populate("userId", "fname lname avatar username role")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("announcement");
 
    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          buildResponseData(populatedWallFeed, userId),
          "Announcement WallFeed updated successfully"
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    throw new ApiErrors(
      500,
      "Failed to update Announcement WallFeed",
      error.message
    );
  }
});

// CREATE Generic WallFeed (for new types)
const createGenericWallFeed = asyncHandler(async (req, res) => {
  const {
    type,
    title,
    description: descriptionRaw,
    visibility,
    communityId,
    badge,
    question,
    options: optionsRaw,
  } = req.body;
  const userId = req.user._id;

  try {
    const validTypes = [
      "travelStories",
      "lightPulse",
      "spotlightStories",
      "pulsePolls",
      "businessBoosters",
      "foundersDesk",
    ];

    if (!validTypes.includes(type)) {
      throw new ApiErrors(400, `Type must be one of: ${validTypes.join(", ")}`);
    }

    // Parse description if it's a string
    let description;
    try {
      description =
        typeof descriptionRaw === "string"
          ? JSON.parse(descriptionRaw)
          : descriptionRaw;
    } catch (error) {
      throw new ApiErrors(
        400,
        "Description must be a valid JSON array of strings"
      );
    }

    if (
      !title ||
      !description ||
      !Array.isArray(description) ||
      description.length === 0
    ) {
      throw new ApiErrors(400, "Title and description are required");
    }

    // Validate that description contains only strings
    if (!description.every((item) => typeof item === "string")) {
      throw new ApiErrors(400, "Description must be an array of strings");
    }

    // Parse options for pulsePolls if provided
    let options;
    if (type === "pulsePolls") {
      try {
        options =
          typeof optionsRaw === "string" ? JSON.parse(optionsRaw) : optionsRaw;
      } catch (error) {
        throw new ApiErrors(
          400,
          "Options must be a valid JSON array of strings"
        );
      }

      if (
        !question ||
        !options ||
        !Array.isArray(options) ||
        options.length === 0
      ) {
        throw new ApiErrors(
          400,
          "Poll question and options are required for pulsePolls"
        );
      }

      // Validate that options contains only strings
      if (!options.every((item) => typeof item === "string")) {
        throw new ApiErrors(400, "Options must be an array of strings");
      }
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    let poll;
    if (type === "pulsePolls") {
      poll = new Poll({
        question,
        options: options.map((option) => ({ text: option })),
      });
      await poll.save();
    }

    let imagePath;
    let videoPath;
    if (req.files?.image) {
      imagePath = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }
    if (req.files?.video) {
      videoPath = `videos/${path.basename(req.files.video[0].path)}`;
    }

    const newWallFeed = new WallFeed({
      type,
      title,
      description,
      poll: type === "pulsePolls" ? poll._id : undefined,
      image: imagePath,
      video: videoPath,
      userId,
      visibility: visibility || "public",
      communityId: visibility === "community" ? communityId : undefined,
      badge: badge || undefined,
    });

    await newWallFeed.save();

    const populatedWallFeed = await WallFeed.findById(newWallFeed._id)
      .populate("userId", "fname lname avatar username")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("poll");

    return res
      .status(201)
      .json(
        new ApiResponses(
          201,
          buildResponseData(populatedWallFeed, userId),
          `${type} WallFeed created successfully`
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    if (req.files?.video) {
      const uploadedVideoPath = path.join(
        baseVideoDir,
        `videos/${path.basename(req.files.video[0].path)}`
      );
      if (fs.existsSync(uploadedVideoPath)) {
        fs.unlinkSync(uploadedVideoPath);
      }
    }
    throw new ApiErrors(
      500,
      `Failed to create ${type} WallFeed`,
      error.message
    );
  }
});

// UPDATE Generic WallFeed (for new types)
const updateGenericWallFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    type,
    title,
    description: descriptionRaw,
    visibility,
    communityId,
    badge,
    question,
    options: optionsRaw,
  } = req.body;
  const userId = req.user._id;

  const wallFeed = await WallFeed.findById(id).populate("poll");

  try {
    if (!wallFeed) {
      throw new ApiErrors(404, "WallFeed not found");
    }

    const validTypes = [
      "travelStories",
      "lightPulse",
      "spotlightStories",
      "pulsePolls",
      "businessBoosters",
      "foundersDesk",
    ];

    if (!validTypes.includes(type)) {
      throw new ApiErrors(400, `Type must be one of: ${validTypes.join(", ")}`);
    }

    // Parse description if it's a string
    let description;
    try {
      description =
        typeof descriptionRaw === "string"
          ? JSON.parse(descriptionRaw)
          : descriptionRaw;
    } catch (error) {
      throw new ApiErrors(
        400,
        "Description must be a valid JSON array of strings"
      );
    }

    if (
      !title ||
      !description ||
      !Array.isArray(description) ||
      description.length === 0
    ) {
      throw new ApiErrors(400, "Title and description are required");
    }

    // Validate that description contains only strings
    if (!description.every((item) => typeof item === "string")) {
      throw new ApiErrors(400, "Description must be an array of strings");
    }

    // Parse options for pulsePolls if provided
    let options;
    if (type === "pulsePolls") {
      try {
        options =
          typeof optionsRaw === "string" ? JSON.parse(optionsRaw) : optionsRaw;
      } catch (error) {
        throw new ApiErrors(
          400,
          "Options must be a valid JSON array of strings"
        );
      }

      if (
        !question ||
        !options ||
        !Array.isArray(options) ||
        options.length === 0
      ) {
        throw new ApiErrors(
          400,
          "Poll question and options are required for pulsePolls"
        );
      }

      // Validate that options contains only strings
      if (!options.every((item) => typeof item === "string")) {
        throw new ApiErrors(400, "Options must be an array of strings");
      }

      // Update the associated poll
      if (wallFeed.poll) {
        const pollDoc = wallFeed.poll;
        pollDoc.question = question;
        pollDoc.options = options.map((option) => ({
          text: option,
          votes: 0,
        }));
        pollDoc.totalVotes = 0;
        pollDoc.voters = [];
        await pollDoc.save();
      } else {
        const newPoll = new Poll({
          question,
          options: options.map((option) => ({ text: option })),
        });
        await newPoll.save();
        wallFeed.poll = newPoll._id;
      }
    }

    if (
      visibility &&
      !["public", "connections", "community"].includes(visibility)
    ) {
      throw new ApiErrors(400, "Invalid visibility value");
    }

    if (visibility === "community" && !communityId) {
      throw new ApiErrors(
        400,
        "communityId is required for community visibility"
      );
    }

    if (
      visibility === "community" &&
      !mongoose.Types.ObjectId.isValid(communityId)
    ) {
      throw new ApiErrors(400, "Invalid communityId format");
    }

    // Update image if a new one is uploaded
    if (req.files?.image) {
      if (wallFeed.image) {
        const oldImagePath = path.join(baseImageDir, wallFeed.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      wallFeed.image = `wallFeed/${path.basename(req.files.image[0].path)}`;
    }

    // Update video if a new one is uploaded
    if (req.files?.video) {
      if (wallFeed.video) {
        const oldVideoPath = path.join(baseVideoDir, wallFeed.video);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldVideoPath);
        }
      }
      wallFeed.video = `videos/${path.basename(req.files.video[0].path)}`;
    }

    // Update the wall feed
    wallFeed.type = type;
    wallFeed.title = title;
    wallFeed.description = description;
    wallFeed.userId = userId;
    wallFeed.visibility = visibility || wallFeed.visibility;
    wallFeed.communityId = visibility === "community" ? communityId : undefined;
    wallFeed.badge = badge || wallFeed.badge;

    await wallFeed.save();

    const populatedWallFeed = await WallFeed.findById(id)
      .populate("userId", "fname lname avatar username")
      .populate("comments.userId", "fname lname avatar username")
      .populate("comments.mentions", "fname lname avatar username")
      .populate("likes.userId", "fname lname avatar username")
      .populate("communityId", "name")
      .populate("poll");

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          buildResponseData(populatedWallFeed, userId),
          `${type} WallFeed updated successfully`
        )
      );
  } catch (error) {
    if (req.files?.image) {
      const uploadedImagePath = path.join(
        baseImageDir,
        `wallFeed/${path.basename(req.files.image[0].path)}`
      );
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
      }
    }
    if (req.files?.video) {
      const uploadedVideoPath = path.join(
        baseVideoDir,
        `videos/${path.basename(req.files.video[0].path)}`
      );
      if (fs.existsSync(uploadedVideoPath)) {
        fs.unlinkSync(uploadedVideoPath);
      }
    }
    throw new ApiErrors(
      500,
      `Failed to update ${type} WallFeed`,
      error.message
    );
  }
});

// DELETE WallFeed
const deleteWallFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const wallFeed = await WallFeed.findById(id).populate([
    "poll",
    "announcement",
    "article",
  ]);

  if (!wallFeed) {
    throw new ApiErrors(404, "WallFeed not found");
  }

  try {
    if (["poll", "pulsePolls"].includes(wallFeed.type) && wallFeed.poll) {
      await Poll.findByIdAndDelete(wallFeed.poll._id);
    }

    if (wallFeed.type === "announcement" && wallFeed.announcement) {
      await Announcement.findByIdAndDelete(wallFeed.announcement._id);
    }

    if (wallFeed.type === "article" && wallFeed.article) {
      await Article.findByIdAndDelete(wallFeed.article._id);
    }

    if (wallFeed.image) {
      const imagePath = path.join(baseImageDir, wallFeed.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    if (wallFeed.video) {
      const videoPath = path.join(baseVideoDir, wallFeed.video);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }

    await WallFeed.findByIdAndDelete(wallFeed._id);

    return res
      .status(200)
      .json(new ApiResponses(200, null, "WallFeed deleted successfully"));
  } catch (error) {
    throw new ApiErrors(500, "Failed to delete WallFeed", error.message);
  }
});

// GET WallFeed by ID
const getWallFeedById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const formatDate = (date) => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formatTimeAgo = (date) => {
      const now = new Date();
      const inputDate = new Date(date);
      const diffMs = now - inputDate;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return "Just now";
      if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
      if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
      if (diffDay === 1) return "Yesterday";
      if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;

      return formatDate(date);
    };

    const wallFeed = await WallFeed.findById(id)
      .populate([
        { path: "poll" },
        { path: "announcement" },
        { path: "article" },
        { path: "userId", select: "fname lname avatar username" },
        { path: "comments.userId", select: "fname lname avatar username" },
        { path: "comments.mentions", select: "fname lname avatar username" },
        { path: "likes.userId", select: "fname lname avatar username" },
        { path: "communityId", select: "name" },
      ])
      .lean();

    if (!wallFeed) {
      throw new ApiErrors(404, "WallFeed not found");
    }

    const user = await User.findById(userId).select("connections");
    if (!user) {
      throw new ApiErrors(404, "User not found");
    }

    const communities = await Community.find({
      $or: [{ users: userId }, { coreMembers: userId }],
    }).select("_id");
    const communityIds = communities
      ? communities.map((community) => community._id)
      : [];

    const isAuthorized =
      wallFeed.visibility === "public" ||
      (wallFeed.visibility === "connections" &&
        ((user.connections || []).includes(wallFeed.userId.toString()) ||
          wallFeed.userId.toString() === userId.toString())) ||
      (wallFeed.visibility === "community" &&
        communityIds.some(
          (id) => wallFeed.communityId && id.equals(wallFeed.communityId)
        ));

    if (!isAuthorized) {
      throw new ApiErrors(403, "Not authorized to view this WallFeed");
    }

    const event = wallFeed.eventRef
      ? await modelMap[wallFeed.eventModel]?.findById(wallFeed.eventRef).lean()
      : null;

    const populatedWallFeed = {
      ...buildResponseData(
        {
          ...wallFeed,
          poll: wallFeed.poll,
          announcement: wallFeed.announcement,
          article: wallFeed.article,
          userId: wallFeed.userId,
          comments: wallFeed.comments,
          likes: wallFeed.likes,
          communityId: wallFeed.communityId,
        },
        userId
      ),
      eventRef: event || null,
      timeAgo: formatTimeAgo(wallFeed.createdAt),
    };

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          { wallFeed: populatedWallFeed },
          "WallFeed retrieved successfully"
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Failed to retrieve WallFeed", error.message);
  }
});

// Add a comment to a WallFeed
const addCommentToWallFeed = asyncHandler(async (req, res) => {
  const wallFeedId = req.params.id;
  const { content, mentions } = req.body;
  const userId = req.user._id;
  const file = req.file;

  if (!wallFeedId) {
    throw new ApiErrors(400, "WallFeed ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(wallFeedId)) {
    throw new ApiErrors(400, "Invalid WallFeed ID format");
  }

  const wallFeed = await WallFeed.findById(wallFeedId);
  if (!wallFeed) {
    throw new ApiErrors(404, `WallFeed not found with ID: ${wallFeedId}`);
  }

  const user = await User.findById(userId).select("connections");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");
  const communityIds = communities
    ? communities.map((community) => community._id)
    : [];

  const isAuthorized =
    wallFeed.visibility === "public" ||
    (wallFeed.visibility === "connections" &&
      ((user.connections || []).includes(wallFeed.userId.toString()) ||
        wallFeed.userId.toString() === userId.toString())) ||
    (wallFeed.visibility === "community" &&
      communityIds.some(
        (id) => wallFeed.communityId && id.equals(wallFeed.communityId)
      ));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to comment on this WallFeed");
  }

  let validatedMentions = [];
  if (mentions) {
    let mentionIds;
    try {
      mentionIds = Array.isArray(mentions) ? mentions : JSON.parse(mentions);
    } catch (error) {
      throw new ApiErrors(400, "Mentions must be a valid array of user IDs");
    }

    if (
      !Array.isArray(mentionIds) ||
      mentionIds.some((id) => !mongoose.Types.ObjectId.isValid(id))
    ) {
      throw new ApiErrors(400, "Mentions must be an array of valid user IDs");
    }

    const acceptedConnections = (user.connections || [])
      .filter((connection) => connection.isAccepted)
      .map((connection) => connection._id);

    const mentionedUsers = await User.find({
      _id: { $in: mentionIds },
      _id: { $in: acceptedConnections },
    }).select("_id");

    validatedMentions = mentionedUsers.map((user) => user._id);

    if (mentionedUsers.length !== mentionIds.length) {
      throw new ApiErrors(
        400,
        "Some mentioned users are not in your connections or do not exist"
      );
    }
  }

  let mediaUrl = null;
  if (file) {
    mediaUrl = path.join("public", "assets", "images", file.filename);
  }

  if (!content?.trim() && !file && validatedMentions.length === 0) {
    throw new ApiErrors(
      400,
      "Comment cannot be blank. Provide content, image/GIF, or mentions."
    );
  }

  const comment = {
    userId,
    content: content?.trim() || null,
    mediaUrl,
    mentions: validatedMentions,
    createdAt: Date.now(),
  };

  wallFeed.comments.push(comment);
  await wallFeed.save();

  const populatedWallFeed = await WallFeed.findById(wallFeedId)
    .populate("userId", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username")
    .populate("comments.mentions", "fname lname avatar username")
    .populate("likes.userId", "fname lname avatar username")
    .populate("communityId", "name")
    .populate("poll")
    .populate("announcement")
    .populate("article");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedWallFeed, userId),
        "Comment added successfully"
      )
    );
});

const editCommentOnWallFeed = asyncHandler(async (req, res) => {
  const { wallFeedId, commentId } = req.params;
  const { content, mentions } = req.body;
  const userId = req.user._id;
  const file = req.file;

  if (!mongoose.Types.ObjectId.isValid(wallFeedId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiErrors(400, "Invalid WallFeed ID or Comment ID format");
  }

  const wallFeed = await WallFeed.findById(wallFeedId);
  if (!wallFeed) {
    throw new ApiErrors(404, `WallFeed not found with ID: ${wallFeedId}`);
  }

  const comment = wallFeed.comments.id(commentId);
  if (!comment) {
    throw new ApiErrors(404, "Comment not found");
  }

  if (comment.userId.toString() !== userId.toString()) {
    throw new ApiErrors(403, "You are not authorized to edit this comment");
  }

  const user = await User.findById(userId).select("connections");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");
  const communityIds = communities.map((community) => community._id);

  const isAuthorized =
    wallFeed.visibility === "public" ||
    (wallFeed.visibility === "connections" &&
      ((user.connections || []).includes(wallFeed.userId.toString()) ||
        wallFeed.userId.toString() === userId.toString())) ||
    (wallFeed.visibility === "community" &&
      communityIds.some((id) => wallFeed.communityId && id.equals(wallFeed.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to edit a comment on this WallFeed");
  }

  let validatedMentions = [];
  if (mentions) {
    let mentionIds;
    try {
      mentionIds = Array.isArray(mentions) ? mentions : JSON.parse(mentions);
    } catch (error) {
      throw new ApiErrors(400, "Mentions must be a valid array of user IDs");
    }

    if (!Array.isArray(mentionIds) || mentionIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new ApiErrors(400, "Mentions must be an array of valid user IDs");
    }

    const acceptedConnections = (user.connections || [])
      .filter((connection) => connection.isAccepted)
      .map((connection) => connection._id);

    const mentionedUsers = await User.find({
      _id: { $in: mentionIds, $in: acceptedConnections },
    }).select("_id");

    validatedMentions = mentionedUsers.map((user) => user._id);

    if (mentionedUsers.length !== mentionIds.length) {
      throw new ApiErrors(400, "Some mentioned users are not in your connections or do not exist");
    }
  }

  let mediaUrl = comment.mediaUrl;
  if (file) {
    mediaUrl = path.join("public", "assets", "images", file.filename);
  }

  if (!content?.trim() && !file && validatedMentions.length === 0) {
    throw new ApiErrors(400, "Comment cannot be blank. Provide content, image/GIF, or mentions.");
  }

  comment.content = content?.trim() || null;
  comment.mentions = validatedMentions;
  comment.mediaUrl = mediaUrl;
  comment.edited = true;
  comment.editedAt = new Date();

  await wallFeed.save();

  const populatedWallFeed = await WallFeed.findById(wallFeedId)
    .populate("userId", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username")
    .populate("comments.mentions", "fname lname avatar username")
    .populate("likes.userId", "fname lname avatar username")
    .populate("communityId", "name")
    .populate("poll")
    .populate("announcement")
    .populate("article");

  return res.status(200).json(
    new ApiResponses(200, buildResponseData(populatedWallFeed, userId), "Comment updated successfully")
  );
});

// Like or unlike a WallFeed
const likeWallFeed = asyncHandler(async (req, res) => {
  const { wallFeedId } = req.body;
  const userId = req.user._id;

  if (!wallFeedId) {
    throw new ApiErrors(400, "WallFeed ID is required");
  }

  const wallFeed = await WallFeed.findById(wallFeedId);
  if (!wallFeed) {
    throw new ApiErrors(404, "WallFeed not found");
  }

  const user = await User.findById(userId).select("connections");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");
  const communityIds = communities
    ? communities.map((community) => community._id)
    : [];

  const isAuthorized =
    wallFeed.visibility === "public" ||
    (wallFeed.visibility === "connections" &&
      ((user.connections || []).includes(wallFeed.userId.toString()) ||
        wallFeed.userId.toString() === userId.toString())) ||
    (wallFeed.visibility === "community" &&
      communityIds.some(
        (id) => wallFeed.communityId && id.equals(wallFeed.communityId)
      ));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to like this WallFeed");
  }

  const userLikeIndex = (wallFeed.likes || []).findIndex(
    (like) => like.userId.toString() === userId.toString()
  );

  let isLiked = false;

  if (userLikeIndex !== -1) {
    await WallFeed.updateOne(
      { _id: wallFeedId },
      { $pull: { likes: { userId: userId } } }
    );
    isLiked = false;
  } else {
    await WallFeed.updateOne(
      { _id: wallFeedId },
      { $push: { likes: { userId: userId } } }
    );
    isLiked = true;
  }

  const populatedWallFeed = await WallFeed.findById(wallFeedId)
    .populate("userId", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username")
    .populate("comments.mentions", "fname lname avatar username")
    .populate("likes.userId", "fname lname avatar username")
    .populate("communityId", "name")
    .populate("poll")
    .populate("announcement")
    .populate("article");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedWallFeed, userId),
        isLiked
          ? "WallFeed liked successfully"
          : "WallFeed unliked successfully"
      )
    );
});

// Delete a comment from a WallFeed
const deleteCommentFromWallFeed = asyncHandler(async (req, res) => {
  const { wallFeedId, commentId } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  if (!wallFeedId || !commentId) {
    throw new ApiErrors(400, "WallFeed ID and Comment ID are required");
  }

  if (
    !mongoose.Types.ObjectId.isValid(wallFeedId) ||
    !mongoose.Types.ObjectId.isValid(commentId)
  ) {
    throw new ApiErrors(400, "Invalid WallFeed ID or Comment ID format");
  }

  const wallFeed = await WallFeed.findById(wallFeedId);
  if (!wallFeed) {
    throw new ApiErrors(404, `WallFeed not found with ID: ${wallFeedId}`);
  }

  const comment = wallFeed.comments.id(commentId);
  if (!comment) {
    throw new ApiErrors(404, `Comment not found with ID: ${commentId}`);
  }

  const user = await User.findById(userId).select("connections");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");
  const communityIds = communities
    ? communities.map((community) => community._id)
    : [];

  const isAuthorizedToView =
    wallFeed.visibility === "public" ||
    (wallFeed.visibility === "connections" &&
      ((user.connections || []).includes(wallFeed.userId.toString()) ||
        wallFeed.userId.toString() === userId.toString())) ||
    (wallFeed.visibility === "community" &&
      communityIds.some(
        (id) => wallFeed.communityId && id.equals(wallFeed.communityId)
      ));

  if (!isAuthorizedToView) {
    throw new ApiErrors(403, "Not authorized to access this WallFeed");
  }

  const isCommentCreator = comment.userId.toString() === userId.toString();
  const isAdmin = userRole === "admin";

  if (!isCommentCreator && !isAdmin) {
    throw new ApiErrors(403, "Not authorized to delete this comment");
  }

  if (comment.mediaUrl) {
    const mediaPath = path.join(process.cwd(), comment.mediaUrl);
    if (fs.existsSync(mediaPath)) {
      fs.unlinkSync(mediaPath);
    }
  }

  wallFeed.comments = wallFeed.comments.filter(
    (c) => c._id.toString() !== commentId
  );

  await wallFeed.save();

  const populatedWallFeed = await WallFeed.findById(wallFeedId)
    .populate("userId", "fname lname avatar username")
    .populate("comments.userId", "fname lname avatar username")
    .populate("comments.mentions", "fname lname avatar username")
    .populate("likes.userId", "fname lname avatar username")
    .populate("communityId", "name")
    .populate("poll")
    .populate("announcement")
    .populate("article");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedWallFeed, userId),
        "Comment deleted successfully"
      )
    );
});


// Add this to wallFeed.controller.js

// Like or unlike a comment
const likeComment = asyncHandler(async (req, res) => {
  const { wallFeedId, commentId } = req.params;
  const userId = req.user._id;

  if (!wallFeedId || !commentId) {
    throw new ApiErrors(400, "WallFeed ID and Comment ID are required");
  }

  if (
    !mongoose.Types.ObjectId.isValid(wallFeedId) ||
    !mongoose.Types.ObjectId.isValid(commentId)
  ) {
    throw new ApiErrors(400, "Invalid WallFeed ID or Comment ID format");
  }

  const wallFeed = await WallFeed.findById(wallFeedId);
  if (!wallFeed) {
    throw new ApiErrors(404, "WallFeed not found");
  }

  const comment = wallFeed.comments.id(commentId);
  if (!comment) {
    throw new ApiErrors(404, "Comment not found");
  }

  // Check if user already liked the comment
  const userLikeIndex = comment.likes.findIndex(
    (like) =>
      like.userId &&
      (typeof like.userId === "object"
        ? like.userId._id.toString() === userId.toString()
        : like.userId.toString() === userId.toString())
  );

  let isLiked = false;

  if (userLikeIndex !== -1) {
    // Unlike the comment
    comment.likes.splice(userLikeIndex, 1);
    isLiked = false;
  } else {
    // Like the comment
    comment.likes.push({ userId });
    isLiked = true;
  }

  await wallFeed.save();

  // Repopulate the wallFeed after update
  const populatedWallFeed = await WallFeed.findById(wallFeedId).populate([
    { path: "userId", select: "fname lname avatar username" },
    { path: "comments.userId", select: "fname lname avatar username" },
    { path: "comments.mentions", select: "fname lname avatar username" },
    { path: "comments.likes.userId", select: "fname lname avatar username" },
    { path: "likes.userId", select: "fname lname avatar username" },
    { path: "communityId", select: "name" },
    { path: "poll" },
    { path: "announcement" },
    { path: "article" },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedWallFeed, userId),
        isLiked ? "Comment liked successfully" : "Comment unliked successfully"
      )
    );
});

// Export all functions
export {
  createEventWallFeed,
  updateEventWallFeed,
  createPollWallFeed,
  updatePollWallFeed,
  voteOnPoll,
  removeVoteFromPoll,
  createArticleWallFeed,
  updateArticleWallFeed,
  createAnnouncementWallFeed,
  updateAnnouncementWallFeed,
  createGenericWallFeed,
  updateGenericWallFeed,
  deleteWallFeed,
  getWallFeed,
  getWallFeedById,
  addCommentToWallFeed,
  likeWallFeed,
  deleteCommentFromWallFeed,
  likeComment,
   editCommentOnWallFeed,
};
