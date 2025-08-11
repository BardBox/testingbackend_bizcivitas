import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createRecordTYFCB,
  getAllRecordTYFCBs,
  getMonthlyRecordTYFCBCounts,
  getLast15DaysRecordTYFCBCounts,
  getLast3MonthsFortnightTYFCBCounts,
  getLast6MonthsTYFCBCounts,
  getTYFCBByDateDetailed,
  getTillDateTYFCBAmounts, // Add the new controller import
} from "../controllers/recordTYFCB.controller.js";

const router = Router();

// Create a RecordTYFCB
router.route("/create").post(verifyJWT, createRecordTYFCB);

// Get All RecordTYFCBs where 'to' exists
router.route("/").get(verifyJWT, getAllRecordTYFCBs);

// Get Monthly RecordTYFCB Counts for 'to' user
router.route("/monthly-counts").get(verifyJWT, getMonthlyRecordTYFCBCounts);

// Get Last 15 Days RecordTYFCB Counts
router.route("/last-15days-counts").get(verifyJWT, getLast15DaysRecordTYFCBCounts);

// Get Last 3 Months Fortnight TYFCB Counts
router.route("/3-month-counts").get(verifyJWT, getLast3MonthsFortnightTYFCBCounts);

// Get Last 6 Months TYFCB Counts
router.route("/6-month-counts").get(verifyJWT, getLast6MonthsTYFCBCounts);

// Get TYFCB Records by Date Range (Detailed)
router.route("/detailed-by-date").post(verifyJWT, getTYFCBByDateDetailed);

// Get Till Date TYFCB Amounts
router.route("/till-date-amounts").get(verifyJWT, getTillDateTYFCBAmounts);

export default router;