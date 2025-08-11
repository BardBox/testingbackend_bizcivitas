import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: [
      "general-chatter",
      "referral-exchange",
      "business-deep-dive",
      "travel-talks",
      "biz-learnings",
      "collab-corner",
      "poll",
    ],
    required: true,
  },
  title: {
    type: String,
    required: function () {
      return this.type !== "poll"; // Title is required for all types except poll
    },
  },
  description: {
    type: String,
    required: function () {
      return this.type !== "poll"; // Description is required for all types except poll
    },
  },
  mediaUrl: {
    type: String,
    required: false,
  },
  badge: {
    type: String,
    default: "Biz Hub",
    required: true, // Ensure all posts have the "Biz Hub" badge
  },
  mentions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  poll: {
    question: {
      type: String,
      required: function () {
        return this.type === "poll"; // Poll question is required only for type "poll"
      },
    },
    options: [
      {
        text: String,
        votes: { type: Number, default: 0 },
      },
    ],
    totalVotes: { type: Number, default: 0 },
    voters: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        optionIndex: Number,
      },
    ],
  },
  visibility: {
    type: String,
    enum: ["public", "connections", "community"],

    default: "public",
  },
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Community",
    required: function () {
      return this.visibility === "community";
    },
  },
  comments: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      content: {
        type: String,
        required: false,
      },
      mediaUrl: {
        type: String,
        required: false,
      },
      mentions: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      likes: [
 
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  likes: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isHidden: {
    type: Boolean,
    default: false,
  },
});

// Virtual getter for timeAgo
postSchema.virtual("timeAgo").get(function () {
  if (!this.createdAt || isNaN(this.createdAt.getTime())) {
    return "Unknown time";
  }

  const now = new Date();
  const inputDate = this.createdAt;
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

  const day = String(inputDate.getDate()).padStart(2, "0");
  const month = String(inputDate.getMonth() + 1).padStart(2, "0");
  const year = inputDate.getFullYear();
  return `${day}/${month}/${year}`;
});

// Virtual getters for likeCount and commentCount
postSchema.virtual("likeCount").get(function () {
  return this.likes ? this.likes.length : 0;
});

postSchema.virtual("commentCount").get(function () {
  return this.comments ? this.comments.length : 0;
});

// Ensure virtuals are included in toJSON and toObject
postSchema.set("toJSON", { virtuals: true });
postSchema.set("toObject", { virtuals: true });

// Add a compound index to ensure a user can only like a post once
postSchema.index({ "_id": 1, "likes.userId": 1 }, { unique: true, sparse: true });

export const Post = mongoose.model("Post", postSchema);