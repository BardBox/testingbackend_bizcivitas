import mongoose from "mongoose";

const { Schema } = mongoose;

const announcementSchema = new Schema(
  {
    title: String,
    description: [String],
  },
  { timestamps: true }
);

export const Announcement = mongoose.model("Announcement", announcementSchema);
