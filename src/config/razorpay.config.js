import Razorpay from 'razorpay';
import '../loadEnv.js'; 

// console.log("loaded razorpay@")

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default razorpay;
