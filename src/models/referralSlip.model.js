import mongoose, { Schema } from "mongoose";

const referralSlipSchema = new Schema(
  {
    from: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referral: {
      type: String,
      required: true,
      trim: true,
    },
    telephone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    comments: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export const ReferralSlip = mongoose.model("ReferralSlip", referralSlipSchema);
