import mongoose from "mongoose";

const { Schema } = mongoose;

const meetupSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    attendees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User", // Assuming you have a User model
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
      date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const Meetup = mongoose.model("Meetup", meetupSchema);
