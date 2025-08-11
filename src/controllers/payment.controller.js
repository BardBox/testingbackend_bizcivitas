import Razorpay from "razorpay";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";

const payNow = asyncHandler(async (req, res, next) => {
  let order;
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_erb8Nx1MrTJEfO",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "S1vvU9HozFKmwMQftItIF20B",
  });

  const option = req.body;
  order = await razorpay.orders.create(option);

  if (!order) {
    return next(new ApiErrors(500, "There is something wrong with order creation!"));
  }

  return res.status(200).json(order);
});

export { payNow };