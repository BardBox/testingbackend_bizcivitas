// src/utils/razorpay.js
import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ||  "rzp_test_qWgOmzxjIZYO46",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "MNhzgDZpjpU1jRFfhJbCWVks" ,
});

