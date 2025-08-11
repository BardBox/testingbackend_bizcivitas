import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    membershipType: {
      type: String,
      enum: [
        "Core Membership",
        "Flagship Membership",
        "Industria Membership",
        "Digital Membership",
      ],
      required: true,
    },
    feeType: {
      type: String,
      enum: [
        "annual",
        "registration",
        "community_launching",
        "meeting",
        "event",
      ],
      required: true,
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cash", "check","manual"],
      default: "razorpay",
    },
    cashId: {
      type: String,
      required: false, // Optional field for cash payments
    },
    checkId: {
      type: String,
      required: false, // Optional field for check payments
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model("Payment", paymentSchema);
