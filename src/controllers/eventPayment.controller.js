import mongoose from 'mongoose';
import crypto from 'crypto';
import { razorpay } from '../utils/razorpay.js'; // ✅ Shared instance
import { Guest } from '../models/guest.model.js';
import { Event } from '../models/Event.model.js';
import ApiErrors from '../utils/ApiErrors.js';
import ApiResponses from '../utils/ApiResponses.js';
import { sendRegistrationNotifications } from '../services/sendRegistrationNotifications.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createPaymentOrder = async (req) => {
  try {
    const { eventId } = req.body;
    const userId = req.user._id;

    if (!eventId || !userId) {
      throw new ApiErrors(400, 'Missing required fields');
    }
    if (!mongoose.isValidObjectId(eventId)) {
      throw new ApiErrors(400, 'Invalid Event ID format');
    }

    const event = await OneDayEvent.findById(eventId);
    if (!event || !event.isPaid || !event.amount || event.amount <= 0) {
      throw new ApiErrors(400, 'Invalid or free event');
    }

    // Normalize mobile
    let mobile = req.user.mobile?.toString() || '';
    if (mobile.startsWith('+91')) mobile = mobile.slice(3);
    else if (mobile.startsWith('91')) mobile = mobile.slice(2);

    const email = req.user.emailId || '';
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const options = {
      amount: event.amount * 100,
      currency: 'INR',
      receipt: transactionId,
      payment_capture: 1,
      notes: {
        eventId: event._id.toString(),
        userId: userId.toString(),
        email,
        mobile,
        fname: req.user.fname,
        lname: req.user.lname || '',
      },
    };

    const order = await razorpay.orders.create(options);

    return new ApiResponses(
      200,
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID, // For client-side Razorpay.init
        eventName: event.name,
        email,
        mobile,
      },
      'Payment order created successfully'
    );
  } catch (error) {
    console.error('createPaymentOrder error:', error);
    throw new ApiErrors(500, error.message || 'Failed to create payment order');
  }
};

export const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment details' });
  }

  // Generate expected signature
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    console.log('✅ Payment Verified Successfully');

    // Optional: Save payment details to DB here

    return res.status(200).json({ success: true });
  } else {
    console.warn('❌ Signature Mismatch');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
});
