import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { Otp } from "../models/otp.model.js";
import { sendOtpEmail } from "../services/forgotPasswordEmail.js";
import crypto from "crypto";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";

// Send OTP Email (Forgot Password)
const sendOtpForPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || email.trim() === "") {
    throw new ApiErrors(400, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiErrors(404, "User not found with this email");
  }

  const existingOtpEntry = await Otp.findOne({
    userId: user._id,
    isUsed: false,
  });
  if (existingOtpEntry) {
    if (new Date() < existingOtpEntry.expiration) {
      throw new ApiErrors(
        400,
        "Your OTP has been sent to your email. Please check your inbox (and spam folder) to retrieve it."
      );
    }
  }

  // Generate OTP
  const otp = Math.floor(1000 + Math.random() * 9000);
  const expiration = new Date(Date.now() + 10 * 60 * 1000);
  // Save OTP to database
  const otpEntry = new Otp({
    userId: user._id,
    otp,
    expiration,
    isUsed: false,
  });

  try {
    await otpEntry.save();
    await sendOtpEmail(user.fname, user.email, otp);
    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {},
          "OTP sent successfully. Please check your email."
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Failed to send OTP");
  }
});

// Verify OTP
const verifyOtp = asyncHandler(async (req, res) => {
  const { otp, email } = req.body;

  if (!otp || otp.trim() === "" || !email || email.trim() === "") {
    throw new ApiErrors(400, "OTP and email are required");
  }

  // Find the user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiErrors(404, "User not found with this email");
  }

  // Find the OTP entry for the user
  const otpEntry = await Otp.findOne({
    userId: user._id,
    otp,
    isUsed: false,
  });

  if (!otpEntry) {
    throw new ApiErrors(400, "Invalid or expired OTP");
  }

  // Check if the OTP has expired
  if (new Date() > otpEntry.expiration) {
    throw new ApiErrors(400, "OTP has expired");
  }

  // Mark OTP as used
  otpEntry.isUsed = true;
  await otpEntry.save();

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        "OTP verified successfully. You can now reset your password."
      )
    );
});

// Set New Password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;

  if (!newPassword || newPassword.trim() === "") {
    throw new ApiErrors(400, "New password is required");
  }

  // Find the user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiErrors(404, "User not found with this email");
  }

  // Hash the new password before saving
  user.password = newPassword;
  await user.save();

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        "Password reset successfully. You can now log in with the new password."
      )
    );
});

export { sendOtpForPasswordReset, verifyOtp, resetPassword };