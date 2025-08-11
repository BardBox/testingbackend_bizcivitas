import express from "express";
import { Router } from "express";
import {
  createMeeting,
  getMeetings,
  updateMeeting,
  deleteMeeting,
  getMeetingById,
  getAllTimeInvitationCount,
  getLast15DaysInvitedPeopleCount,
  getLast3MonthsFortnightInvitedPeopleCount,
  getLast6MonthsInvitedPeopleCount,
  getAllTimeInvitedPeopleCount,
  getMeetingsByCommunity, 
  getInvitedUsersByDateDetailed,// New function to be added
} from "../controllers/meeting.controller.js";
import {
  inviteToMeeting,
  handlePaymentWebhook,
  simulatePaymentWebhook,
} from "../controllers/invitation.controller.js";
import { createUpload } from "../middlewares/multer.middleware.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { verifyRazorpayWebhook } from "../middlewares/razorpayWebhook.js";

const router = Router();

// Configure multer to save in "meetings" folder
const upload = createUpload("meeting");

// ✅ Analytics Routes - Should come BEFORE the "/:id" route
router.get("/all-time-invitation-count", verifyJWT, getAllTimeInvitationCount);
router.get("/last-15-days-invited-count", verifyJWT, getLast15DaysInvitedPeopleCount);
router.get("/3-month-fortnight-invited-count", verifyJWT, getLast3MonthsFortnightInvitedPeopleCount);
router.get("/6-month-invited-count", verifyJWT, getLast6MonthsInvitedPeopleCount);
router.get("/all-time-invited-people-count", verifyJWT, getAllTimeInvitedPeopleCount);
router.post("/detailed-by-date", verifyJWT,  getInvitedUsersByDateDetailed);
// Create a new meeting (admin only)
router.post(
  "/",
  verifyJWT,
  authorizeRoles("admin"),
  upload.fields([{ name: "img", maxCount: 1 }]),
  createMeeting
);

// Get all meetings (authenticated users)
router.get("/", verifyJWT, getMeetings);

// New route: Get meetings by community (authenticated users)
router.get("/community/:communityId", verifyJWT, getMeetingsByCommunity);

// Invite a visitor to a meeting (authenticated users)
router.post("/invite", verifyJWT, inviteToMeeting);

// Handle Razorpay payment webhook (public endpoint for Razorpay)
router.post(
  "/payment/webhook",
  express.raw({ type: "application/json" }),
  verifyRazorpayWebhook,
  handlePaymentWebhook
);

// ✨ Simulate webhook endpoint – dev only
if (process.env.NODE_ENV === "development") {
  router.post("/payment/simulate-webhook", verifyJWT, simulatePaymentWebhook);
}

// Update a meeting (admin only)
router.put(
  "/:id",
  verifyJWT,
  authorizeRoles("admin"),
  upload.fields([{ name: "img", maxCount: 1 }]),
  updateMeeting
);

// Delete a meeting (admin only)
router.delete("/:id", verifyJWT, authorizeRoles("admin"), deleteMeeting);

// Get a meeting by ID (authenticated users)
router.get("/:id", verifyJWT, getMeetingById); // 🚫 Keep this LAST

export default router;