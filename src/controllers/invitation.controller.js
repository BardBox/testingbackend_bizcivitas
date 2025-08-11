import { Invitation } from "../models/invitation.model.js";
import { Meeting } from "../models/meeting.model.js";
import { razorpay } from "../utils/razorpay.js";
import { sendInvitationMeetingEmail, sendPaymentConfirmationEmail }  from"../services/sendInvitationMeetingEmail.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import crypto from "crypto";

export const inviteToMeeting = asyncHandler(async (req, res) => {
  const {
    meetingId,
    email,
    visitorName,
    businessCategory,
    businessSubcategory = "",
    mobile = "",
  } = req.body;

  const inviter = await User.findById(req.user._id);
  if (!inviter) throw new ApiErrors(404, "Inviter not found");

  if (!meetingId || !email || !visitorName || !businessCategory) {
    throw new ApiErrors(
      400,
      "meetingId, email, visitorName, and businessCategory are required"
    );
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new ApiErrors(404, "Meeting not found");

  const dup = await Invitation.findOne({
    meeting: meetingId,
    $or: [{ email }, mobile ? { mobile } : {}],
  });
  if (dup) throw new ApiErrors(400, "Duplicate invite for this meeting");

  const invitation = new Invitation({
    meeting: meetingId,
    email,
    visitorName,
    businessCategory,
    businessSubcategory,
    mobile,
    inviter: inviter._id,
    amount: meeting.visitorFee || 0,
    status: "pending",
  });

  if (meeting.visitorFee > 0) {
    const pl = await razorpay.paymentLink.create({
      amount: meeting.visitorFee * 100,
      currency: "INR",
      description: `Visitor fee for ${meeting.title}`,
      customer: { name: visitorName, email, contact: mobile || undefined },
      notify: { email: false, sms: false },
    });

    invitation.paymentLinkId = pl.id;
    invitation.paymentLink = pl.short_url;
    await invitation.save();

    await sendInvitationMeetingEmail(
      visitorName,
      email,
      inviter,
      meeting,
      pl.short_url,
      null,
      { businessCategory, businessSubcategory, mobile }
    );

    console.log(`💳 Payment link ${pl.short_url} generated for invite ${invitation._id}`);
  } else {
    invitation.status = "confirmed";
    await invitation.save();

    await Meeting.findByIdAndUpdate(meetingId, {
      $addToSet: { invited: invitation._id },
    });

    await sendInvitationMeetingEmail(
      visitorName,
      email,
      inviter,
      meeting,
      null,
      null,
      { businessCategory, businessSubcategory, mobile }
    );

    console.log(`✅ Invitation ${invitation._id} auto-confirmed (no fee)`);
  }

  const responseInvitation = invitation.toObject();
  responseInvitation.businessCategory = businessCategory;
  responseInvitation.businessSubcategory = businessSubcategory;
  responseInvitation.mobile = mobile;

  return res
    .status(200)
    .json(new ApiResponses(200, responseInvitation, "Invitation sent successfully"));
});

export const handlePaymentWebhook = asyncHandler(async (req, res) => {
  let paymentId = undefined;
  let paymentLinkId = undefined;
  let status = undefined;

  // Handle new format
  if (req.body.event === "payment_link.paid") {
    paymentId = req.body.payload.payment.entity.id;
    paymentLinkId = req.body.payload.payment_link.entity.id;
    status = req.body.payload.payment_link.entity.status;
  } else {
    // Fallback for old format
    paymentId = req.body.payment_id;
    paymentLinkId = req.body.payment_link_id;
    status = req.body.status;
  }

  console.log("🧾 Webhook parsed:", { paymentId, paymentLinkId, status });

  const sigHeader = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!sigHeader || !secret) {
    throw new ApiErrors(400, "Missing Razorpay signature or secret");
  }

  const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac("sha256", secret).update(bodyString).digest("hex");

  if (expectedSignature !== sigHeader) {
    throw new ApiErrors(400, "Invalid Razorpay signature");
  }

  let invitation = await Invitation.findOne({ paymentLinkId }).populate("inviter meeting");

  if (!invitation && paymentLinkId?.startsWith("http")) {
    const slug = paymentLinkId.split("/").pop();
    invitation = await Invitation.findOne({ paymentLink: { $regex: slug + "$" } }).populate("inviter meeting");
  }

  if (!invitation) {
    throw new ApiErrors(404, `Invitation not found for ${paymentLinkId}`);
  }

  if (status === "paid") {
    invitation.status = "confirmed";
    invitation.paymentId = paymentId || `test_${Date.now()}`;
    await invitation.save();

    await Meeting.findByIdAndUpdate(invitation.meeting._id, {
      $addToSet: { invited: invitation._id },
    });

    await sendPaymentConfirmationEmail(
      invitation.visitorName,
      invitation.email,
      invitation.meeting
    );

    console.log(`✅ Payment SUCCESS — invitation confirmed: ${invitation._id}`);
  }

  return res.status(200).json(new ApiResponses(200, {}, "Webhook processed"));
});

export const simulatePaymentWebhook = asyncHandler(async (req, res) => {
  const { paymentLinkId } = req.body;

  if (process.env.NODE_ENV !== "development") {
    throw new ApiErrors(403, "Simulated webhook only allowed in development");
  }

  const invitation = await Invitation.findOne({ paymentLinkId }).populate("inviter meeting");
  if (!invitation) throw new ApiErrors(404, "Invitation not found");

  if (invitation.status === "confirmed") {
    return res.status(200).json(new ApiResponses(200, {}, "Already confirmed"));
  }

  invitation.status = "confirmed";
  invitation.paymentId = `test_${Date.now()}`;
  await invitation.save();

  await Meeting.findByIdAndUpdate(invitation.meeting._id, {
    $addToSet: { invited: invitation._id },
  });

  await sendPaymentConfirmationEmail(
    invitation.visitorName,
    invitation.email,
    invitation.meeting
  );

  console.log(`✅ Simulated payment success – invitation confirmed: ${invitation._id}`);

  return res.status(200).json(new ApiResponses(200, {}, "Simulated webhook processed"));
});