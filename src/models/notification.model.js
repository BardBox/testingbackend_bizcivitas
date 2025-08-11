import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageTitle: {
      type: String,
      required: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    isUnread: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      enum: ["connection", "message", "event", "other","meetup","chat","meeting"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model("Notification", notificationSchema);