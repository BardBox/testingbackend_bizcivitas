import mongoose, { Schema } from "mongoose";

// OTP Schema for password reset
const otpSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiration: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, 
  }
);

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export const Otp = mongoose.model("Otp", otpSchema);