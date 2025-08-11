import { Meetup } from "../models/meetup.model.js";
import { User } from "../models/user.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Create Meetup
const addMeetup = asyncHandler(async (req, res) => {
  const { title, attendees , date , time} = req.body;
  const createdBy = req.user?._id;

if (!title || !createdBy || !date || !time) {
  throw new ApiErrors(400, "Title, date, time and createdBy are required");
}


  const parsedAttendees = Array.isArray(attendees)
    ? attendees
    : attendees
    ? JSON.parse(attendees)
    : [];

  try {
    const creator = await User.findById(createdBy);
    if (!creator) {
      throw new ApiErrors(404, "Creator user not found");
    }

    const validAttendees = await User.find({ _id: { $in: parsedAttendees } });
    if (validAttendees.length !== parsedAttendees.length) {
      throw new ApiErrors(400, "One or more attendees are invalid users");
    }

    const meetup = new Meetup({
  title,
  attendees: parsedAttendees,
  createdBy,
  date,
  time,
});


    await meetup.save();

    return res
      .status(201)
      .json(new ApiResponses(201, meetup, "Meetup created successfully"));
  } catch (error) {
    console.log("Error while creating meetup:", error);
    throw new ApiErrors(500, "Failed to create meetup");
  }
});

// Get Last 15 Days Meetup Count
const getLast15DaysMeetupCount = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiErrors(401, "Unauthorized: User not found");
  }

  const today = new Date();
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(today.getDate() - 14);

  try {
    const result = await Meetup.aggregate([
      {
        $match: {
          createdBy: userId,
          createdAt: {
            $gte: new Date(fifteenDaysAgo.setHours(0, 0, 0, 0)),
            $lte: new Date(today.setHours(23, 59, 59, 999)),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const dayWiseData = [];
    for (let i = 0; i < 15; i++) {
      const date = new Date();
      date.setDate(today.getDate() - (14 - i));
      const formatted = date.toISOString().split("T")[0];
      const matched = result.find((r) => r._id === formatted);
      dayWiseData.push({ date: formatted, count: matched ? matched.count : 0 });
    }

    const allTimeCount = await Meetup.countDocuments({ createdBy: userId });

    const last15DaysMeetupCount = dayWiseData.reduce((sum, item) => sum + item.count, 0);

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          { dayWiseData, last15DaysMeetupCount, allTimeCount },
          "User's meetup count (last 15 days)"
        )
      );
  } catch (error) {
    console.error("Error fetching user's meetup stats:", error);
    throw new ApiErrors(500, "Failed to fetch meetup counts");
  }
});

// Get Last 3 Months Fortnight Meetup Counts (6 fortnights, 15 days each)
const getLast3MonthsFortnightMeetupCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiErrors(401, "Unauthorized: User not found");
    }

    const currentDate = new Date();
    
    // Adjust for IST (UTC+5:30) to UTC
    currentDate.setHours(currentDate.getHours() - 5);
    currentDate.setMinutes(currentDate.getMinutes() - 30);
    currentDate.setHours(23, 59, 59, 999); // End of today in UTC

    const fortnightCounts = [];
    const FORTNIGHT_DAYS = 15;
    const TOTAL_FORTNIGHTS = 6;

    // Calculate the start date (90 days ago from today)
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - FORTNIGHT_DAYS * TOTAL_FORTNIGHTS);
    startDate.setHours(0, 0, 0, 0); // Start of the day in UTC

    // Loop through each fortnight
    for (let i = TOTAL_FORTNIGHTS - 1; i >= 0; i--) {
      const fortnightEnd = new Date(currentDate);
      fortnightEnd.setDate(currentDate.getDate() - i * FORTNIGHT_DAYS);
      fortnightEnd.setHours(23, 59, 59, 999); // End of the fortnight

      const fortnightStart = new Date(fortnightEnd);
      fortnightStart.setDate(fortnightEnd.getDate() - FORTNIGHT_DAYS + 1);
      fortnightStart.setHours(0, 0, 0, 0); // Start of the fortnight

      const meetupCount = await Meetup.countDocuments({
        createdAt: { $gte: fortnightStart, $lte: fortnightEnd },
        createdBy: userId,
      });

      // Format the period (e.g., "Fortnight 1: 2025-02-23 to 2025-03-09")
      const label = `Fortnight ${TOTAL_FORTNIGHTS - i}: ${fortnightStart.toISOString().split("T")[0]} to ${fortnightEnd.toISOString().split("T")[0]}`;

      fortnightCounts.push({
        period: label,
        count: meetupCount,
      });
    }

    // Get total count for the entire 3-month period
    const totalMeetupCount = await Meetup.countDocuments({
      createdAt: { $gte: startDate, $lte: currentDate },
      createdBy: userId,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            fortnightCounts,
            totalMeetupCount,
          },
          "Last 3 months fortnight meetup counts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve last 3 months fortnight meetup counts");
  }
});

// Get Last 6 Months Meetup Counts (from 23rd to 23rd of each month)
const getLast6MonthsMeetupCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiErrors(401, "Unauthorized: User not found");
    }

    const currentDate = new Date();
    
    // Adjust for IST (UTC+5:30) to UTC
    currentDate.setHours(currentDate.getHours() - 5);
    currentDate.setMinutes(currentDate.getMinutes() - 30);
    currentDate.setHours(23, 59, 59, 999); // End of today in UTC

    const monthCounts = [];
    const TOTAL_MONTHS = 6;

    // Start from today (May 23, 2025) and go back 6 months
    const endDate = new Date(currentDate); // May 23, 2025
    const startDate = new Date(endDate);
    startDate.setMonth(endDate.getMonth() - TOTAL_MONTHS); // Go back 6 months to Nov 23, 2024
    startDate.setHours(0, 0, 0, 0); // Start of the day

    // Loop through each month (23rd to 23rd)
    for (let i = TOTAL_MONTHS - 1; i >= 0; i--) {
      const monthEnd = new Date(endDate);
      monthEnd.setMonth(endDate.getMonth() - i);
      monthEnd.setDate(23);
      monthEnd.setHours(23, 59, 59, 999); // End of the 23rd

      const monthStart = new Date(monthEnd);
      monthStart.setMonth(monthEnd.getMonth() - 1);
      monthStart.setDate(23);
      monthStart.setHours(0, 0, 0, 0); // Start of the 23rd of the previous month

      if (monthStart.getDate() !== 23) {
        monthStart.setDate(23);
      }

      const meetupCount = await Meetup.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        createdBy: userId,
      });

      // Format the period (e.g., "Month 1: 2024-11-23 to 2024-12-23")
      const label = `Month ${TOTAL_MONTHS - i}: ${monthStart.toISOString().split("T")[0]} to ${monthEnd.toISOString().split("T")[0]}`;

      monthCounts.push({
        period: label,
        count: meetupCount,
      });
    }

    // Get total count for the entire 6-month period
    const totalMeetupCount = await Meetup.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      createdBy: userId,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            monthCounts,
            totalMeetupCount,
          },
          "Last 6 months meetup counts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve last 6 months meetup counts");
  }
});

// Get Meetups by Date Range (Detailed)
const getMeetupsByDateDetailed = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user?._id;

  if (!startDate || !endDate) {
    throw new ApiErrors(400, "Please provide both startDate and endDate");
  }

  if (!userId) {
    throw new ApiErrors(401, "Unauthorized: User not found");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Adjust for IST (UTC+5:30) to UTC
  start.setHours(start.getHours() - 5);
  start.setMinutes(start.getMinutes() - 30);
  end.setHours(end.getHours() - 5);
  end.setMinutes(end.getMinutes() - 30);

  start.setHours(0, 0, 0, 0); // Start of the day in UTC
  end.setHours(23, 59, 59, 999); // End of the day in UTC

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiErrors(400, "Invalid date format");
  }

  if (start > end) {
    throw new ApiErrors(400, "startDate cannot be after endDate");
  }

  try {
    const meetups = await Meetup.find({
      createdBy: userId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate({
        path: "attendees",
        select: "fname lname",
      })
      .lean();

const formattedMeetups = meetups.map((meetup) => ({
  title: meetup.title,
  attendees: meetup.attendees.map((attendee) =>
    `${attendee.fname} ${attendee.lname}`.trim()
  ),
  createdAt: meetup.createdAt,
  date: meetup.date,
  time: meetup.time,
}));

    const totalMeetupCount = await Meetup.countDocuments({
      createdBy: userId,
      createdAt: { $gte: start, $lte: end },
    });

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          meetups: formattedMeetups,
          totalMeetupCount,
        },
        "Detailed meetup data retrieved successfully"
      )
    );
  } catch (error) {
    console.log("Error in getMeetupsByDateDetailed:", error);
    throw new ApiErrors(500, "Failed to retrieve detailed meetup data");
  }
});

// Get All-Time Meetup Count
const getAllTimeMeetupCount = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiErrors(401, "Unauthorized: User not found");
    }

    const totalMeetupCount = await Meetup.countDocuments({
      createdBy: userId,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          { totalMeetupCount },
          "All-time meetup count retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching all-time meetup count:", error);
    throw new ApiErrors(500, "Failed to retrieve all-time meetup count");
  }
});

export {
  addMeetup,
  getLast15DaysMeetupCount,
  getLast3MonthsFortnightMeetupCounts,
  getLast6MonthsMeetupCounts,
  getMeetupsByDateDetailed,
  getAllTimeMeetupCount,
};