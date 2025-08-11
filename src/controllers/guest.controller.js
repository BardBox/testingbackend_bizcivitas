import mongoose from 'mongoose';
import ApiErrors from '../utils/ApiErrors.js';
import ApiResponses from '../utils/ApiResponses.js';
import asyncHandler from '../utils/asyncHandler.js';
import { Guest } from '../models/guest.model.js';
import { User } from '../models/user.model.js';
import { Event } from '../models/Event.model.js';

import { sendRegistrationNotifications } from '../services/sendRegistrationNotifications.js';
import sendEmail from '../services/sendEmail.js';
import generateQR from '../services/generateQR.js';
import QRCode from 'qrcode';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import fs from 'fs';
import path from 'path';
import sendWhatsAppMessage from '../services/sendWhatsappMessage.js';
import crypto from 'crypto';
import razorpay from '../config/razorpay.config.js';

const registerGuest = asyncHandler(async (req, res) => {
  try {
    const {
      eventId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    console.log('📥 Guest registration input:', { eventId });

    const userId = req.user?._id;
    const { email, mobile, fname, lname } = req.user || {};

    if (!eventId) {
      throw new ApiErrors(400, 'eventId is required');
    }
    if (!userId) {
      throw new ApiErrors(401, 'User not authenticated');
    }
    if (!email && !mobile) {
      throw new ApiErrors(400, 'User email or mobile is required');
    }

    let normalizedMobile = mobile?.toString() || '';
    if (normalizedMobile.startsWith('+91')) {
      normalizedMobile = normalizedMobile.slice(3);
    } else if (normalizedMobile.startsWith('91') && normalizedMobile.length > 10) {
      normalizedMobile = normalizedMobile.slice(2);
    }

    if (!mongoose.isValidObjectId(eventId)) throw new ApiErrors(400, 'Invalid eventId format');
    const event = await Event.findById(eventId);
    const eventType = 'Event';
    const eventNameField = 'name';

    if (!event) {
      throw new ApiErrors(404, `${eventType} not found`);
    }

    const existingGuest = await Guest.findOne({
      eventId,
      userId,
      paymentStatus: { $in: ['completed', 'free'] },
    });

    if (existingGuest) {
      const paidMessage = event.isPaid ? ` and payment of ₹${event.amount} was successful` : '';
      return res.status(200).json(
        new ApiResponses(
          200,
          existingGuest,
          `You have already registered for this ${eventType.toLowerCase()}${paidMessage}.`
        )
      );
    }

    await Guest.deleteMany({
      eventId,
      $or: [
        ...(email ? [{ email }] : []),
        ...(normalizedMobile ? [{ mobile: normalizedMobile }] : []),
      ],
      paymentStatus: { $in: ['pending', 'failed'] },
    });

    if (event.isPaid) {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        const order = await razorpay.orders.create({
          amount: event.amount * 100,
          currency: 'INR',
          receipt: `TXN-${Date.now()}`,
          payment_capture: 1,
          notes: {
            eventId: eventId.toString(),
            userId: userId.toString(),
            email: email || '',
            fname,
            lname,
            mobile: normalizedMobile,
          },
        });

        return res.status(200).json(
          new ApiResponses(200, {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            eventName: event[eventNameField],
            email: email || '',
            mobile: normalizedMobile,
          }, 'Payment order created')
        );
      }

      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        throw new ApiErrors(400, 'Invalid payment signature');
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const [guest] = await Guest.create([{
          eventId,
          userId,
          email: email || '',
          mobile: normalizedMobile,
          fname,
          lname,
          paymentStatus: 'completed',
          paymentInfo: {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
          },
          amountPaid: event.amount,
        }], { session });

        await Event.updateOne({ _id: eventId }, { $addToSet: { participants: userId } }, { session });

        await sendRegistrationNotifications(guest, event, true);
console.log("📣 Calling sendRegistrationNotifications for guest", guest.email);

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(
          new ApiResponses(200, guest, `Guest registered successfully for ${eventType}`)
        );
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [guest] = await Guest.create([{
        eventId,
        userId,
        email: email || '',
        mobile: normalizedMobile,
        fname,
        lname,
        paymentStatus: 'free',
        amountPaid: 0,
      }], { session });

      await Event.updateOne({ _id: eventId }, { $addToSet: { participants: userId } }, { session });

      await sendRegistrationNotifications(guest, event, false, { skipWhatsapp: true });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json(
        new ApiResponses(200, guest, `Guest registered (free ${eventType.toLowerCase()})`)
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error('❌ registerGuest Error:', error);
    throw new ApiErrors(error.statusCode || 500, error.message || 'Internal Server Error');
  }
});




const deregisterGuest = asyncHandler(async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user?._id;
    const { email, mobile: rawMobile } = req.user || {};

    if (!eventId) {
      throw new ApiErrors(400, 'eventId is required');
    }
    if (!userId) {
      throw new ApiErrors(401, 'User not authenticated');
    }
    if (!email && !rawMobile) {
      throw new ApiErrors(400, 'User email or mobile is required');
    }

    let mobile = rawMobile?.toString() || '';
    if (mobile.startsWith('+91')) {
      mobile = mobile.slice(3);
    } else if (mobile.startsWith('91') && mobile.length > 10) {
      mobile = mobile.slice(2);
    }

    if (!mongoose.isValidObjectId(eventId)) {
      throw new ApiErrors(400, 'Invalid eventId format');
    }

    const event = await Event.findById(eventId);
    const eventType = 'Event';

    if (!event) {
      throw new ApiErrors(404, `${eventType} not found`);
    }

    const guest = await Guest.findOne({
      eventId,
      userId,
      $or: [
        ...(email ? [{ email }] : []),
        ...(mobile ? [{ mobile }] : []),
      ],
    });

    if (!guest) {
      return res.status(404).json(
        new ApiResponses(404, null, `You are not registered for this ${eventType.toLowerCase()}.`)
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Guest.findByIdAndDelete(guest._id, { session });

      await Event.updateOne(
        { _id: eventId },
        { $pull: { participants: userId } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json(
        new ApiResponses(
          200,
          { guestId: guest._id },
          `You have been successfully deregistered from the ${eventType.toLowerCase()}.`
        )
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error(`❌ Deregistration transaction error in ${eventType}:`, err);
      throw new ApiErrors(
        err.statusCode || 500,
        err.message || `Failed to deregister from ${eventType.toLowerCase()}`
      );
    }
  } catch (error) {
    console.error('❌ deregisterGuest Error:', error);
    throw new ApiErrors(error.statusCode || 500, error.message || 'Internal Server Error');
  }
});

const getEventParticipants = asyncHandler(async (req, res) => {
  const { eventId, tripEventId } = req.query;

  console.log('Received event IDs:', { eventId, tripEventId });

  if (!eventId && !tripEventId) {
    throw new ApiErrors(400, 'Either eventId or tripEventId is required');
  }
  if (eventId && tripEventId) {
    throw new ApiErrors(400, 'Cannot provide both eventId and tripEventId');
  }
  if (eventId && !mongoose.isValidObjectId(eventId)) {
    throw new ApiErrors(400, 'Invalid OneDayEvent ID format');
  }
  if (tripEventId && !mongoose.isValidObjectId(tripEventId)) {
    throw new ApiErrors(400, 'Invalid TripEvent ID format');
  }

  const guests = await Guest.find({
    $or: [{ eventId }, { tripEventId }],
  }).lean();

  const participants = guests.map((g) => ({
    fname: g.fname,
    lname: g.lname || '',
    name: `${g.fname} ${g.lname || ''}`.trim(),
    email: g.email,
    mobile: g.mobile || 'Not provided',
    paymentStatus: g.paymentStatus,
    amountPaid: g.amountPaid || 0,
    tableNo: g.tableNo || null,
    attendance: g.attendance || false,
  }));

  return res.status(200).json(
    new ApiResponses(200, participants, 'Participants retrieved successfully')
  );
});

// Other functions unchanged
const getAllGuests = asyncHandler(async (req, res) => {
  const guests = await Guest.find();
  if (!guests.length) throw new ApiErrors(404, 'No guests are registered yet');
  return res.status(200).json(new ApiResponses(200, guests, 'Fetched all guests successfully'));
});

const getOneGuest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiErrors(400, 'Guest ID is required');
  const guest = await Guest.findById(id);
  if (!guest) throw new ApiErrors(404, 'Guest does not exist');
  return res.status(200).json(new ApiResponses(200, guest, 'Guest details fetched successfully'));
});

const setEntered = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiErrors(400, 'Guest ID is required');
  const guest = await Guest.findById(id);
  if (!guest) throw new ApiErrors(404, 'Guest does not exist');
  if (guest.attendance) throw new ApiErrors(400, 'Guest attendance already marked');
  guest.attendance = true;
  await guest.save();
  return res.status(200).json(new ApiResponses(200, guest, 'Attendance marked successfully'));
});

const addTableNo = asyncHandler(async (req, res) => {
  const { guestId, tableNo } = req.body;
  if (!guestId || !tableNo) throw new ApiErrors(400, 'GuestId and TableNo are required');
  const updatedGuest = await Guest.findByIdAndUpdate(guestId, { $set: { tableNo } }, { new: true });
  if (!updatedGuest) throw new ApiErrors(404, 'Guest does not exist');
  return res
    .status(200)
    .json(new ApiResponses(200, updatedGuest, "Guest's TableNo updated successfully"));
});

const deleteOneGuest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiErrors(400, 'Guest ID is required');
  const guest = await Guest.findById(id);
  if (!guest) throw new ApiErrors(404, 'Guest does not exist');

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // Remove from event participants
    if (guest.eventId) {
      await OneDayEvent.updateOne(
        { _id: guest.eventId },
        { $pull: { participants: id } },
        { session }
      );
    } else if (guest.tripEventId) {
      await TripEvent.updateOne(
        { _id: guest.tripEventId },
        { $pull: { participants: id } },
        { session }
      );
    }

    await Guest.findByIdAndDelete(id, { session });

    await session.commitTransaction();
    return res.status(200).json(new ApiResponses(200, guest, 'Guest deleted successfully'));
  } catch (error) {
    if (session && session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Delete guest error:', error.message, error.stack);
    throw new ApiErrors(error.statusCode || 500, error.message || 'Failed to delete guest');
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

export {
  registerGuest,
  deregisterGuest,
  getAllGuests,
  setEntered,
  getOneGuest,
  addTableNo,
  deleteOneGuest,
  getEventParticipants,
};
