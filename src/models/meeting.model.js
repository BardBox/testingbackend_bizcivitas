import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema({
  visitor: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  speaker: {
    type: String,
    required: true,
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Community",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  place: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  img: {
    type: String,
    required: true,
  },
  agenda: {
    type: String,
    required: true,
  },
  visitorFee: {
    type: Number,
    default: 0,
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  invited: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Invitation",
  }],
}, {
  timestamps: true,

});

export const Meeting = mongoose.model("Meeting", meetingSchema);