import mongoose, { Schema } from "mongoose";

const userSuggestionHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    currentSuggestion: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    suggestionStartDate: {
      type: Date,
      default: null
    },
    suggestedUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    connectedUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
userSuggestionHistorySchema.index({ userId: 1, suggestionStartDate: -1 });

export const UserSuggestionHistory = mongoose.model("UserSuggestionHistory", userSuggestionHistorySchema);