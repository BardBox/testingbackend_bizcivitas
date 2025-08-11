// src/middlewares/razorpayWebhook.js
import crypto from "crypto";
import ApiErrors from "../utils/ApiErrors.js";

export const verifyRazorpayWebhook = (req, res, next) => {
  const sigHeader = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!sigHeader || !secret) {
    return res.status(400).json({ success: false, message: "Missing Razorpay signature or secret" });
  }

  // Ensure body is a string
  const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(bodyString)
    .digest("hex");

  if (expectedSignature !== sigHeader) {
    return res.status(400).json({ success: false, message: "Invalid Razorpay signature" });
  }

  next();
};