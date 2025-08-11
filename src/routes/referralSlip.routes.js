import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createReferralSlip,
  getAllReferralSlips,
  getLast15DaysSlipCounts,
  getLast3MonthsFortnightCounts,
  getLast6MonthsCounts,
  getReferralsByDateDetailed,
  getTillDateReferralCounts, // Add the new controller import
} from "../controllers/referralSlip.controller.js";

const router = Router();

// Create a Referral Slip
router.route("/create").post(verifyJWT, createReferralSlip);

// Get All Referral Slips
router.route("/").get(verifyJWT, getAllReferralSlips);

// Get Last 15 Days Slip Counts
router.route("/monthly-count").get(verifyJWT, getLast15DaysSlipCounts);

// Get Last 3 Months Fortnight Counts
router.route("/3-month-counts").get(verifyJWT, getLast3MonthsFortnightCounts);

// Get Last 6 Months Counts
router.route("/6-month-counts").get(verifyJWT, getLast6MonthsCounts);

// Get Detailed Referrals by Date Range
router.route("/detailed-by-date").post(verifyJWT, getReferralsByDateDetailed);

// Get Till Date Referral Counts
router.route("/till-date-counts").get(verifyJWT, getTillDateReferralCounts);

export default router;