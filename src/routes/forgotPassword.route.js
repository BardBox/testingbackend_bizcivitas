import { Router } from "express";
import {
  sendOtpForPasswordReset,
  verifyOtp,
  resetPassword,
} from "../controllers/forgotPassword.controller.js";

const router = Router();

// Route to send OTP for password reset
router.route("/send-otp").post(sendOtpForPasswordReset);

// Route to verify OTP
router.route("/verify-otp").post(verifyOtp);

// Route to set new password
router.route("/reset-password").post(resetPassword);

export default router;