import mongoose, { Schema } from "mongoose";

const onlineEventSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true },
    eventDate: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    onlineLink: { type: String, required: true },
    description: { type: String, required: true },
    eventImg: { type: String, required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    community: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    region: { type: String, required: true },
    postEventImg: [{ type: String }],
    eventOverview: { type: String, required: true }, 
    subtitle: { type: String, required: true }, 
    whyAttend: [{ type: String }],
  },
  { timestamps: true }
);

export const OnlineEvent = mongoose.model("OnlineEvent", onlineEventSchema);