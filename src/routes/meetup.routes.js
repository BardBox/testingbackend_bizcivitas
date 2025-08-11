import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  addMeetup,
  getLast15DaysMeetupCount,
  getLast3MonthsFortnightMeetupCounts,
  getLast6MonthsMeetupCounts,
  getMeetupsByDateDetailed,
  getAllTimeMeetupCount,
} from "../controllers/meetup.controller.js";

const router = Router();

// Create Meetup
router.route("/add").post(verifyJWT, addMeetup);

// Get Last 15 Days Meetup Count
router.get("/meeting-count", verifyJWT, getLast15DaysMeetupCount);

// Get Last 3 Months Fortnight Meetup Counts
router.get("/3-month-counts", verifyJWT, getLast3MonthsFortnightMeetupCounts);

// Get Last 6 Months Meetup Counts
router.get("/6-month-counts", verifyJWT, getLast6MonthsMeetupCounts);

// Get Meetups by Date Range (Detailed)
router.route("/detailed-by-date").post(verifyJWT, getMeetupsByDateDetailed);

// Get All-Time Meetup Count
router.get("/all-time-count", verifyJWT, getAllTimeMeetupCount);

export default router;