import Razorpay from "razorpay";
import ApiErrors from "../utils/ApiErrors.js";

const payNow = async (option) => {
  let order;
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_ID_KEY,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
  });
  // const razorpay = new Razorpay({
  //   key_id: "rzp_live_8yP4GuUj3gYmyy",
  //   key_secret: "oqmyqcRZJf5OxCx6DOLXR2G8",
  // });

  //   const option = req.body;
  order = await razorpay.orders.create(option);

  if (!order) {
    throw new ApiErrors(
      500,
      "Something went wrong in creating razorpay order!"
    );
  }

  return order;
};

export default payNow;