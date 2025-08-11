import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  inviter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  visitorName: {
    type: String,
    required: true,
  },
  businessCategory: {
    type: String,
    default: "", // Optional with default empty string
  },
  businessSubcategory: {
    type: String,
    default: "",
  },
  mobile: {
    type: String,
    default: "",
  },
  amount: {
    type: Number,
    default: 0,
  },
  paymentLink: {
    type: String,
  },
  paymentId: {
    type: String,
  },
    paymentLinkId: { type: String },     // <- NEW: Razorpay plink_xxx for webhook

  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Invitation = mongoose.model("Invitation", invitationSchema);