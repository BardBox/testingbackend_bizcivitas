import { User } from "../models/user.model.js";
import { Community } from "../models/community.model.js";
import { Post } from "../models/post.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { createUpload } from "../middlewares/multer.middleware.js";

// Multer configuration using createUpload
const upload = createUpload("post");

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json(new ApiResponses(400, null, `Multer error: ${err.message}`));
  }
  if (err.message.includes("Invalid category")) {
    return res.status(400).json(new ApiResponses(400, null, err.message));
  }
  next(err);
};

// Helper function to format time ago
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

  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };
  return formatDate(date);
};

// Helper function to build response data
const buildResponseData = (post, userId) => {
  const baseImageUrl = "https://backend.bizcivitas.com/api/v1/image";

  const processedComments = (post.comments || []).map((comment) => {
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
      mediaUrl: commentObj.mediaUrl
        ? `${baseImageUrl}/post/${path.basename(commentObj.mediaUrl)}`
        : null,
    };
  });

  const responseData = {
    _id: post._id,
    user: {
      _id: post.userId._id,
      name: `${post.userId.fname} ${post.userId.lname}`,
      avatar: post.userId.avatar,
      username: post.userId.username,
      role: post.userId.role,
      classification: post.userId.profile?.professionalDetails?.classification || null,
      companyName: post.userId.profile?.professionalDetails?.companyName || null,
      myBusiness: post.userId.profile?.professionalDetails?.myBusiness || null,
      industry: post.userId.profile?.professionalDetails?.industry || null,
      city: post.userId.profile?.addresses?.address?.city || null,
      country: post.userId.profile?.addresses?.address?.country || null,
      state: post.userId.profile?.addresses?.address?.state || null,
    },
    type: post.type,
    visibility: post.visibility,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    mentions: (post.mentions || []).map((mention) => ({
      _id: mention._id,
      name: `${mention.fname} ${mention.lname}`,
      avatar: mention.avatar,
      username: mention.username,
      role: mention.role,
    })),
    comments: processedComments,
    likeCount: post.likes ? post.likes.length : 0,
    likes: (post.likes || []).map((like) => ({
      userId: {
        _id: like.userId._id,
        name: `${like.userId.fname} ${like.userId.lname}`,
        fname: like.userId.fname,
        lname: like.userId.lname,
        avatar: like.userId.avatar,
        username: like.userId.username,
        role: like.userId.role,
      },
    })),
    commentCount: processedComments.length,
    communityId: post.communityId,
    badge: post.badge || "Biz Hub",
    isLiked: (post.likes || []).some(
      (like) =>
        like.userId &&
        (typeof like.userId === "object"
          ? like.userId._id.toString() === userId.toString()
          : like.userId.toString() === userId.toString())
    ),
    timeAgo: formatTimeAgo(post.createdAt),
  };

  if (post.type !== "poll") {
    responseData.title = post.title;
    responseData.description = post.description;
    responseData.mediaUrl = post.mediaUrl
      ? `${baseImageUrl}/post/${path.basename(post.mediaUrl)}`
      : null;
  } else if (post.type === "poll") {
    responseData.poll = post.poll;
    responseData.description = post.description;
  }

  return responseData;
};


// Create a post
const createPost = asyncHandler(async (req, res) => {
  console.log("Request body:", req.body);
  console.log("Request files:", req.files);
  const { type, title, description, question, pollOptions, visibility, communityId, mediaUrl } = req.body;
  const userId = req.user._id;

  const trimmedType = type.trim();

  const validPostTypes = [
    "general-chatter",
    "referral-exchange",
    "business-deep-dive",
    "travel-talks",
    "biz-learnings",
    "collab-corner",
    "poll",
  ];
  if (!trimmedType || !validPostTypes.includes(trimmedType)) {
    throw new ApiErrors(400, "Invalid post type. Must be one of: general-chatter, referral-exchange, business-deep-dive, travel-talks, biz-learnings, collab-corner, poll");
  }

  let parsedVisibility = visibility;
  if (typeof visibility === 'string' && visibility.startsWith('["') && visibility.endsWith('"]')) {
    parsedVisibility = JSON.parse(visibility)[0];
  } else if (Array.isArray(visibility) && visibility.length > 0) {
    parsedVisibility = visibility[0];
  }

  const validVisibility = ["connections", "public", "community"];
  if (parsedVisibility && !validVisibility.includes(parsedVisibility)) {
    throw new ApiErrors(400, "Invalid visibility type");
  }

  if (parsedVisibility === "community" && communityId) {
    const community = await Community.findById(communityId);
    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }
  }

  const postData = {
    userId: userId,
    type: trimmedType,
    visibility: parsedVisibility || "public", // Respect schema default
    badge: "Biz Hub",
  };

  if (parsedVisibility === "community" && communityId) {
    postData.communityId = communityId;
  }

  let mentions = [];
  if (description) {
    const mentionRegex = /@(\w+)/g;
    const mentionedUsernames = [];
    let match;
    while ((match = mentionRegex.exec(description)) !== null) {
      mentionedUsernames.push(match[1]);
    }

    const user = await User.findById(userId).select("connections");
    if (!user) {
      throw new ApiErrors(404, "User not found");
    }

    const mentionedUsers = await User.find({
      username: { $in: mentionedUsernames },
      _id: { $in: user.connections },
    }).select("_id");

    mentions = mentionedUsers.map((user) => user._id);

    if (mentionedUsers.length !== mentionedUsernames.length) {
      throw new ApiErrors(400, "Some mentioned users are not in your connections or do not exist");
    }
  }

  if (trimmedType !== "poll") {
    if (!title || title.trim() === "" || !description || description.trim() === "") {
      throw new ApiErrors(400, "Title and description are required for non-poll posts");
    }
    postData.title = title;
    postData.description = description;
    postData.mentions = mentions;

    if (req.files?.media?.[0]?.path) {
      const mediaLocalPath = req.files.media[0].path;
      postData.mediaUrl = `post/${path.basename(mediaLocalPath)}`;
    } else if (mediaUrl) {
      postData.mediaUrl = mediaUrl;
    }
  } else if (trimmedType === "poll") {
    if (!question || !pollOptions) {
      throw new ApiErrors(400, "Question and poll options are required for polls");
    }
    try {
      postData.poll = {
        question: question,
        options: JSON.parse(pollOptions).map((opt) => ({ text: opt, votes: 0 })),
        totalVotes: 0,
        voters: [],
      };
      if (description && description.trim() !== "") {
        postData.description = description;
        postData.mentions = mentions;
      }
    } catch (error) {
      throw new ApiErrors(400, "Invalid poll options format");
    }
  }

  const post = await Post.create(postData);
  if (!post) {
    throw new ApiErrors(500, "Failed to create post");
  }

  const populatedPost = await Post.findById(post._id)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(201)
    .json(
      new ApiResponses(
        201,
        buildResponseData(populatedPost, userId),
        "Post created successfully"
      )
    );
});

// Get posts
const getPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select("connections");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");

  const communityIds = communities.map((community) => community._id);

  let query = {
    $or: [
      { visibility: "public" },
      {
        $and: [
          { visibility: "connections" },
          { userId: { $in: user.connections.concat(userId) } },
        ],
      },
      {
        $and: [{ visibility: "community" }, { communityId: { $in: communityIds } }],
      },
    ],
  };

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const posts = await Post.find(query)
    .populate({
      path: "userId",
      select: "fname lname avatar username role profile",
      populate: {
        path: "profile",
        select:
          "professionalDetails.classification professionalDetails.companyName professionalDetails.myBusiness professionalDetails.industry addresses.address.city addresses.address.country addresses.address.state",
      },
    })
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPosts = await Post.countDocuments(query);

  const formattedPosts = posts.map((post) => buildResponseData(post, userId));

  return res.status(200).json(
    new ApiResponses(200, {
      posts: formattedPosts,
      page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
    }, "Posts fetched successfully")
  );
});




// Like a post
const likePost = asyncHandler(async (req, res) => {
  const { postId } = req.body;
  const userId = req.user._id;

  if (!postId) {
    throw new ApiErrors(400, "Post ID is required");
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, "Post not found");
  }

  const user = await User.findById(userId).select("connections");
  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");

  const communityIds = communities.map((community) => community._id);

  const isAuthorized =
    post.visibility === "public" ||
    (post.visibility === "connections" &&
      (user.connections.includes(post.userId.toString()) || post.userId.toString() === userId.toString())) ||
    (post.visibility === "community" &&
      communityIds.some((id) => post.communityId && id.equals(post.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to like this post");
  }

  const userLikeIndex = post.likes.findIndex(
    (like) => like.userId.toString() === userId.toString()
  );

  let isLiked = false;

  if (userLikeIndex !== -1) {
    await Post.updateOne(
      { _id: postId },
      { $pull: { likes: { userId: userId } } }
    );
    isLiked = false;
  } else {
    await Post.updateOne(
      { _id: postId },
      { $push: { likes: { userId: userId } } }
    );
    isLiked = true;
  }

  const populatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedPost, userId),
        isLiked ? "Post liked successfully" : "Post unliked successfully"
      )
    );
});

// Vote in a poll
const votePoll = asyncHandler(async (req, res) => {
  const { postId, optionIndex } = req.body;
  const userId = req.user._id;

  if (!postId || optionIndex === undefined) {
    throw new ApiErrors(400, "Post ID and option index are required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiErrors(400, "Invalid Post ID format");
  }

  const post = await Post.findById(postId);
  if (!post || post.type !== "poll") {
    throw new ApiErrors(404, "Poll not found");
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
    post.visibility === "public" ||
    (post.visibility === "connections" &&
      (user.connections.includes(post.userId.toString()) || post.userId.toString() === userId.toString())) ||
    (post.visibility === "community" &&
      communityIds.some((id) => post.communityId && id.equals(post.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to vote in this poll");
  }

  const existingVoteIndex = post.poll.voters.findIndex((voter) => voter.userId.toString() === userId.toString());
  if (existingVoteIndex >= 0) {
    throw new ApiErrors(400, "You have already voted in this poll");
  }

  if (!post.poll.options[optionIndex]) {
    throw new ApiErrors(400, "Invalid poll option");
  }

  post.poll.voters.push({ userId: userId, optionIndex });
  post.poll.options[optionIndex].votes += 1;
  post.poll.totalVotes = post.poll.voters.length;
  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(updatedPost, userId),
        "Voted successfully"
      )
    );
});

// Remove a vote from a poll
const removeVote = asyncHandler(async (req, res) => {
  const { postId } = req.body;
  const userId = req.user._id;

  if (!postId) {
    throw new ApiErrors(400, "Post ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiErrors(400, "Invalid Post ID format");
  }

  const post = await Post.findById(postId);
  if (!post || post.type !== "poll") {
    throw new ApiErrors(404, "Poll not found");
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
    post.visibility === "public" ||
    (post.visibility === "connections" &&
      (user.connections.includes(post.userId.toString()) || post.userId.toString() === userId.toString())) ||
    (post.visibility === "community" &&
      communityIds.some((id) => post.communityId && id.equals(post.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to remove vote from this poll");
  }

  const existingVoteIndex = post.poll.voters.findIndex((voter) => voter.userId.toString() === userId.toString());
  if (existingVoteIndex === -1) {
    throw new ApiErrors(400, "You have not voted in this poll");
  }

  const previousOptionIndex = post.poll.voters[existingVoteIndex].optionIndex;
  post.poll.options[previousOptionIndex].votes -= 1;
  post.poll.voters.splice(existingVoteIndex, 1);
  post.poll.totalVotes = post.poll.voters.length;
  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(updatedPost, userId),
        "Vote removed successfully"
      )
    );
});

// Edit a post
const editPost = asyncHandler(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user._id;
  const { title, description, question, pollOptions, visibility, communityId } = req.body;

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, "Post not found");
  }

  if (post.userId.toString() !== userId.toString()) {
    throw new ApiErrors(403, "You are not authorized to edit this post");
  }

  const trimmedType = post.type.trim();
  const validPostTypes = [
    "general-chatter",
    "referral-exchange",
    "business-deep-dive",
    "travel-talks",
    "biz-learnings",
    "collab-corner",
    "poll",
  ];
  if (!validPostTypes.includes(trimmedType)) {
    throw new ApiErrors(400, "Invalid post type");
  }

  let parsedVisibility = visibility;
  if (typeof visibility === 'string' && visibility.startsWith('["') && visibility.endsWith('"]')) {
    parsedVisibility = JSON.parse(visibility)[0];
  } else if (Array.isArray(visibility) && visibility.length > 0) {
    parsedVisibility = visibility[0];
  }

  const validVisibility = ["connections", "public", "community"];
  if (parsedVisibility && !validVisibility.includes(parsedVisibility)) {
    throw new ApiErrors(400, "Invalid visibility type");
  }

  if (parsedVisibility === "community" && communityId) {
    const community = await Community.findById(communityId);
    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }
  }

  const updateData = {};

  if (parsedVisibility) {
    updateData.visibility = parsedVisibility;
    if (parsedVisibility === "community" && communityId) {
      updateData.communityId = communityId;
    } else if (parsedVisibility !== "community") {
      updateData.communityId = null;
    }
  }

  updateData.badge = "Biz Hub";

  let mentions = [];
  if (description) {
    const mentionRegex = /@(\w+)/g;
    const mentionedUsernames = [];
    let match;
    while ((match = mentionRegex.exec(description)) !== null) {
      mentionedUsernames.push(match[1]);
    }

    const user = await User.findById(userId).select("connections");
    if (!user) {
      throw new ApiErrors(404, "User not found");
    }

    const mentionedUsers = await User.find({
      username: { $in: mentionedUsernames },
      _id: { $in: user.connections },
    }).select("_id");

    mentions = mentionedUsers.map((user) => user._id);

    if (mentionedUsers.length !== mentionedUsernames.length) {
      throw new ApiErrors(400, "Some mentioned users are not in your connections or do not exist");
    }
    updateData.mentions = mentions;
  }

  if (trimmedType !== "poll") {
    if (title && title.trim() === "") {
      throw new ApiErrors(400, "Title cannot be empty");
    }
    if (description && description.trim() === "") {
      throw new ApiErrors(400, "Description cannot be empty");
    }

    if (title) updateData.title = title;
    if (description !== undefined) {
      updateData.description = description.trim() !== "" ? description : null;
    }

    if (req.files?.media?.[0]?.path) {
      if (post.mediaUrl) {
        const oldMediaPath = path.join(process.cwd(), "public", "assets", "images", post.mediaUrl);
        if (fs.existsSync(oldMediaPath)) {
          fs.unlinkSync(oldMediaPath);
        }
      }
      const mediaLocalPath = req.files.media[0].path;
      updateData.mediaUrl = `post/${path.basename(mediaLocalPath)}`;
    } else if (req.body.removeMedia === "true") {
      if (post.mediaUrl) {
        const oldMediaPath = path.join(process.cwd(), "public", "assets", "images", post.mediaUrl);
        if (fs.existsSync(oldMediaPath)) {
          fs.unlinkSync(oldMediaPath);
        }
      }
      updateData.mediaUrl = null;
    }
  } else if (trimmedType === "poll") {
    if (question && question.trim() === "") {
      throw new ApiErrors(400, "Question cannot be empty");
    }
    if (pollOptions) {
      try {
        const parsedOptions = JSON.parse(pollOptions);
        if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
          throw new ApiErrors(400, "Poll options must be an array with at least two options");
        }
        updateData.poll = {
          question: question || post.poll.question,
          options: parsedOptions.map((opt) => ({ text: opt, votes: 0 })),
          totalVotes: 0,
          voters: [],
        };
      } catch (error) {
        throw new ApiErrors(400, "Invalid poll options format");
      }
    } else if (question) {
      updateData.poll = {
        ...post.poll,
        question,
      };
    }
    if (description !== undefined) {
      updateData.description = description.trim() !== "" ? description : null;
    }
  }

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  if (!updatedPost) {
    throw new ApiErrors(500, "Failed to update post");
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(updatedPost, userId),
        "Post updated successfully"
      )
    );
});

// Delete a comment
const deleteComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user._id;

  if (!postId || !commentId) {
    throw new ApiErrors(400, "Post ID and Comment ID are required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiErrors(400, "Post ID or Comment ID format");
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, "Post not found");
  }

  const comment = post.comments.id(commentId);
  if (!comment) {
    throw new ApiErrors(404, "Comment not found");
  }

  if (post.userId.toString() !== userId.toString() && comment.userId.toString() !== userId.toString()) {
    throw new ApiErrors(403, "You are not authorized to delete this comment");
  }

  post.comments.pull(commentId);
  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role comments")
    .populate("comments.mentions", "fname lname avatar username role comments")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(updatedPost, userId),
        "Comment deleted successfully"
      )
    );
});

// Add a comment
const addComment = asyncHandler(async (req, res) => {
  const postId = req.params.id;
  const { content, mentions } = req.body;
  const userId = req.user._id;
  const file = req.files?.media?.[0];

  if (!postId) {
    throw new ApiErrors(400, "Post ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiErrors(400, "Invalid Post ID format");
  }

  console.log("Received postId:", postId);

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, `Post not found with ID: ${postId}`);
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
    post.visibility === "public" ||
    (post.visibility === "connections" &&
      (user.connections.includes(post.userId.toString()) || post.userId.toString() === userId.toString())) ||
    (post.visibility === "community" &&
      communityIds.some((id) => post.communityId && id.equals(post.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to comment on this post");
  }

  let validatedMentions = [];
  if (mentions) {
    let mentionIds;
    try {
      mentionIds = Array.isArray(mentions) ? mentions : JSON.parse(mentions);
    } catch (error) {
      throw new ApiErrors(400, "Mentions must be a valid array of user IDs");
    }

    if (!Array.isArray(mentionIds) || mentionIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
      throw new ApiErrors(400, "Mentions must be an array of valid user IDs");
    }

    const acceptedConnections = user.connections
      .filter(connection => connection.isAccepted)
      .map(connection => connection._id);

    const mentionedUsers = await User.find({
      _id: { $in: mentionIds },
      _id: { $in: acceptedConnections },
    }).select("_id");

    validatedMentions = mentionedUsers.map((user) => user._id);

    if (mentionedUsers.length !== mentionIds.length) {
      throw new ApiErrors(400, "Some mentioned users are not in your connections or do not exist");
    }
  }

  let mediaUrl = null;
  if (file) {
    mediaUrl = `post/${path.basename(file.path)}`;
  }

  if (!content?.trim() && !file && validatedMentions.length === 0) {
    throw new ApiErrors(400, "Comment cannot be blank. Provide content, image/GIF, or mentions.");
  }

  const comment = {
    userId,
    content: content?.trim() || null,
    mediaUrl,
    mentions: validatedMentions,
    createdAt: Date.now(),
  };

  post.comments.push(comment);
  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(updatedPost, userId),
        "Comment added successfully"
      )
    );
});

const editComment = asyncHandler(async (req, res) => {
  const { postId, commentId, content, mentions } = req.body;
  const userId = req.user._id;
  const file = req.files?.media?.[0];

  // Step 1: Validate input
  if (!postId || !commentId) {
    throw new ApiErrors(400, "Post ID and Comment ID are required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiErrors(400, "Invalid Post ID or Comment ID format");
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, `Post not found with ID: ${postId}`);
  }

  const comment = post.comments.id(commentId);
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
    post.visibility === "public" ||
    (post.visibility === "connections" &&
      (user.connections.includes(post.userId.toString()) || post.userId.toString() === userId.toString())) ||
    (post.visibility === "community" &&
      communityIds.some((id) => post.communityId && id.equals(post.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to edit a comment on this post");
  }

  // Validate and filter mentions
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

    const acceptedConnections = user.connections
      .filter((connection) => connection.isAccepted)
      .map((connection) => connection._id);

    const mentionedUsers = await User.find({
      _id: { $in: mentionIds },
      _id: { $in: acceptedConnections },
    }).select("_id");

    validatedMentions = mentionedUsers.map((user) => user._id);

    if (mentionedUsers.length !== mentionIds.length) {
      throw new ApiErrors(400, "Some mentioned users are not in your connections or do not exist");
    }
  }

  let mediaUrl = comment.mediaUrl;
  if (file) {
    mediaUrl = `post/${path.basename(file.path)}`;
  }

  if (!content?.trim() && !file && validatedMentions.length === 0) {
    throw new ApiErrors(400, "Comment cannot be blank. Provide content, image/GIF, or mentions.");
  }

  // Update the comment
  comment.content = content?.trim() || null;
  comment.mentions = validatedMentions;
  comment.mediaUrl = mediaUrl || null;
  comment.edited = true;
  comment.editedAt = new Date();

  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res.status(200).json(
    new ApiResponses(200, buildResponseData(updatedPost, userId), "Comment updated successfully")
  );
});



// Delete a post
const deletePost = asyncHandler(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user._id;

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, "Post not found");
  }

  if (post.userId.toString() !== userId.toString()) {
    throw new ApiErrors(403, "You are not authorized to delete this post");
  }

  if (post.mediaUrl) {
    const mediaPath = path.join(process.cwd(), "public", "assets", "images", post.mediaUrl);
    if (fs.existsSync(mediaPath)) {
      fs.unlinkSync(mediaPath);
    }
  }

  if (post.comments) {
    post.comments.forEach((comment) => {
      if (comment.mediaUrl) {
        const mediaPath = path.join(process.cwd(), "public", "assets", "images", comment.mediaUrl);
        if (fs.existsSync(mediaPath)) {
          fs.unlinkSync(mediaPath);
        }
      }
    });
  }

  await Post.findByIdAndDelete(postId);

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "Post deleted successfully"));
});    

// Get a post by ID
const getPostById = asyncHandler(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user._id;

  if (!postId) {
    throw new ApiErrors(400, "Post ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiErrors(400, "Invalid Post ID format");
  }

  const user = await User.findById(userId).select("connections");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const communities = await Community.find({
    $or: [{ users: userId }, { coreMembers: userId }],
  }).select("_id");

  const communityIds = communities.map((community) => community._id);

  const post = await Post.findById(postId)
    .populate({
      path: "userId",
      select: "fname lname avatar username role profile",
      populate: {
        path: "profile",
        select:
          "professionalDetails.classification professionalDetails.companyName professionalDetails.myBusiness professionalDetails.industry addresses.address.city addresses.address.country addresses.address.state",
      },
    })
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  if (!post) {
    throw new ApiErrors(404, "Post not found");
  }

  const isAuthorized =
    post.visibility === "public" ||
    (post.visibility === "connections" &&
      (user.connections.includes(post.userId._id.toString()) || post.userId._id.toString() === userId.toString())) ||
    (post.visibility === "community" &&
      communityIds.some((id) => post.communityId && id.equals(post.communityId)));

  if (!isAuthorized) {
    throw new ApiErrors(403, "Not authorized to view this post");
  }

  return res.status(200).json(
    new ApiResponses(
      200,
      buildResponseData(post, userId),
      "Post fetched successfully"
    )
  );
});


// Add this to post.controller.js

// Like or unlike a comment
const likeComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user._id;

  if (!postId || !commentId) {
    throw new ApiErrors(400, "Post ID and Comment ID are required");
  }

  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiErrors(400, "Invalid Post ID or Comment ID format");
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiErrors(404, "Post not found");
  }

  const comment = post.comments.id(commentId);
  if (!comment) {
    throw new ApiErrors(404, "Comment not found");
  }

  // Check if user already liked the comment
  const userLikeIndex = comment.likes.findIndex(
    like => like.userId && 
           (typeof like.userId === 'object' ? 
            like.userId._id.toString() === userId.toString() : 
            like.userId.toString() === userId.toString())
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

  await post.save();

  // Repopulate the post after update
  const populatedPost = await Post.findById(postId)
    .populate("userId", "fname lname avatar username role")
    .populate("mentions", "fname lname avatar username role")
    .populate("comments.userId", "fname lname avatar username role")
    .populate("comments.mentions", "fname lname avatar username role")
    .populate("comments.likes.userId", "fname lname avatar username role") // Populate comment likes
    .populate("likes.userId", "fname lname avatar username role")
    .populate("communityId", "name");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        buildResponseData(populatedPost, userId),
        isLiked ? "Comment liked successfully" : "Comment unliked successfully"
      )
    );
});

export {
  upload,
  handleMulterError,
  createPost,
  getPosts,
  addComment,
  likePost,
  votePoll,
  removeVote,
  editPost,
  deleteComment,
  deletePost,
  getPostById,
  likeComment,
  editComment,
};