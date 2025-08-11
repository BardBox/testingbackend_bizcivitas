import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reason: {
    type: String,
    enum: ["spam", "inappropriate", "hate speech", "misinformation", "other"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "reviewed", "resolved"],
    default: "pending",
  },
  adminAction: {
    type: String,
    required: false,
  },
});

// Virtual getter for timeAgo
reportSchema.virtual("timeAgo").get(function () {
  // Check if createdAt is undefined or not a valid Date
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

// Ensure virtuals are included in toJSON and toObject
reportSchema.set("toJSON", { virtuals: true });
reportSchema.set("toObject", { virtuals: true });

// Add a compound index to prevent duplicate reports by the same user for the same post
reportSchema.index({ postId: 1, reporterId: 1 }, { unique: true });

export const Report = mongoose.model("Report", reportSchema);