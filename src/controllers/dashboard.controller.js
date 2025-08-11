import ApiResponses from "../utils/ApiResponses.js";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import { Community } from "../models/community.model.js";
import { User } from "../models/user.model.js";
import { Event } from "../models/Event.model.js";
import { OnlineEvent } from "../models/onlineEvent.model.js";
import { TripEvent } from "../models/tripEvent.model.js";
import { Payment } from "../models/payment.model.js";
import { ReferralSlip } from "../models/referralSlip.model.js";
import { RecordTYFCB } from "../models/recordTYFCB.model.js";
import { roles } from "../constants.js";
import mongoose from "mongoose";

const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: roles[0] });

    const totalCommunities = await Community.countDocuments();

    const totalCoreMembers = await User.countDocuments({ role: roles[1] });

    const totalOneDayEvents = await OneDayEvent.countDocuments();
    const totalOnlineEvents = await OnlineEvent.countDocuments();
    const totalTripEvents = await TripEvent.countDocuments();

    const totalEvents = totalOneDayEvents + totalOnlineEvents + totalTripEvents;

    const dashboardStats = {
      totalUsers,
      totalCommunities,
      totalCoreMembers,
      totalEvents,
    };

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          dashboardStats,
          "Dashboard stats fetched successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to fetch dashboard stats");
  }
});

const getUpcomingEvents = asyncHandler(async (req, res) => {
  try {
    const currentDate = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(currentDate.getDate() + 7);

    // Get all events first (up to a sensible limit to avoid performance issues)
    const oneDayEvents = await OneDayEvent.find().limit(100);
    const onlineEvents = await OnlineEvent.find().limit(100);
    const tripEvents = await TripEvent.find().limit(100);

    // Helper to parse various string date formats
    const parseDate = (dateString) => {
      const parsed = new Date(dateString);
      if (!isNaN(parsed)) return parsed;

      // Try dd/mm/yyyy fallback
      const [day, month, year] = dateString.split("/");
      return new Date(`${year}-${month}-${day}`);
    };

    const formatDate = (dateObj) => {
      const options = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      };
      return dateObj.toLocaleString("en-GB", options).replace(",", "");
    };

    const allEvents = [
      ...oneDayEvents.map((event) => {
        const eventDate = parseDate(event.date);
        return { ...event.toObject(), rawDate: eventDate };
      }),
      ...onlineEvents.map((event) => {
        const eventDate = parseDate(event.eventDate);
        return { ...event.toObject(), rawDate: eventDate };
      }),
      ...tripEvents.map((event) => {
        const eventDate = parseDate(event.startDate);
        return { ...event.toObject(), rawDate: eventDate };
      }),
    ];

    const upcomingEvents = allEvents
      .filter((event) => {
        const date = event.rawDate;
        return date >= currentDate && date <= sevenDaysLater;
      })
      .sort((a, b) => a.rawDate - b.rawDate)
      .slice(0, 5)
      .map((event) => ({
        ...event,
        date: formatDate(event.rawDate),
        rawDate: undefined, // Remove raw date from final response
      }));

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          upcomingEvents,
          "Upcoming events within the next 7 days fetched successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to fetch upcoming events");
  }
});

const getLastRegisteredUsers = asyncHandler(async (req, res) => {
  try {
    const lastTenUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("fname lname email membershipStatus createdAt");

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          lastTenUsers,
          "Last 10 registered users fetched successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to fetch last 10 registered users");
  }
});

const getLastCoreMembers = asyncHandler(async (req, res) => {
  try {
    const lastFiveCoreMembers = await User.find({ role: roles[1] })
      .sort({ createdAt: -1 })
      .limit(7)
      .select("fname lname email mobile role createdAt");
    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          lastFiveCoreMembers,
          "Last 5 core members fetched successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to fetch last 5 core members");
  }
});

const getPaymentTotals = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new ApiErrors(400, "Start date and end date are required");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const paymentTotals = await Payment.aggregate([
      {
        $match: {
          status: "success",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $let: {
              vars: {
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: 1,
                  },
                },
              },
              in: {
                $concat: [
                  { $dateToString: { format: "%b", date: "$$date" } }, // 'Jan', 'Feb', etc.
                  "-",
                  {
                    $substr: [{ $toString: "$_id.year" }, 2, 2], // take last 2 digits of year
                  },
                ],
              },
            },
          },
          totalAmount: 1,
        },
      },
    ]);

    // Generate all months between startDate and endDate
    const monthsBetween = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const monthLabel = `${current.toLocaleString("default", {
        month: "short",
      })}-${String(current.getFullYear()).slice(2)}`;
      monthsBetween.push(monthLabel);
      current.setMonth(current.getMonth() + 1);
    }

    const monthlyTotals = monthsBetween.map((month) => {
      const found = paymentTotals.find((t) => t.month === month);
      return found || { month, totalAmount: 0 };
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          monthlyTotals,
          `Payment totals from ${startDate} to ${endDate} fetched successfully`
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to fetch payment totals");
  }
});

const getUserStatistics = asyncHandler(async (req, res) => {
  try {
    const { startDate: start, endDate: end } = req.query;

    if (!start || !end) {
      throw new ApiErrors(400, "Start date and end date are required");
    }

    const selectedStartDate = new Date(start);
    const selectedEndDate = new Date(end);

    if (selectedStartDate > selectedEndDate) {
      throw new ApiErrors(400, "Start date cannot be after end date");
    }

    const getShortMonthName = (monthIndex) => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return months[monthIndex];
    };

    const getMonthRange = (start, end) => {
      const result = [];
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);

      while (current <= last) {
        result.push({
          year: current.getFullYear(),
          month: current.getMonth(),
          label: getShortMonthName(current.getMonth()),
        });
        current.setMonth(current.getMonth() + 1);
      }

      return result;
    };

    const monthRange = getMonthRange(selectedStartDate, selectedEndDate);

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: selectedStartDate,
            $lte: selectedEndDate,
          },
          role: roles[0], // Adjust as needed
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }, // 1-based (1 = Jan)
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    const monthlyUserGrowth = monthRange.map(({ year, month, label }) => {
      const found = userGrowth.find(
        (g) => g._id.year === year && g._id.month === month + 1 // Mongo returns 1-based months
      );
      return {
        month: `${label} ${year}`,
        users: found ? found.count : 0,
      };
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          { userGrowth: monthlyUserGrowth },
          `User growth statistics from ${selectedStartDate.toDateString()} to ${selectedEndDate.toDateString()} fetched successfully`
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiErrors(500, "Failed to fetch user growth statistics");
  }
});

const getUpcomingEventsForUser = asyncHandler(async (req, res) => {
  try {
    const currentDate = new Date();

    const parseDate = (dateString) => {
      const isoDate = new Date(dateString.replace(/ GMT.*$/, "")).toISOString();
      return new Date(isoDate);
    };

    const oneDayEvents = await OneDayEvent.find({
      participants: req.user._id,
      $expr: {
        $gte: [{ $toDate: { $substr: ["$date", 0, 28] } }, currentDate],
      },
    }).sort({ date: 1 });

    const onlineEvents = await OnlineEvent.find({
      participants: req.user._id,
      $expr: {
        $gte: [{ $toDate: { $substr: ["$eventDate", 0, 28] } }, currentDate],
      },
    }).sort({ eventDate: 1 });

    const tripEvents = await TripEvent.find({
      participants: req.user._id,
      $expr: {
        $gte: [{ $toDate: { $substr: ["$startDate", 0, 28] } }, currentDate],
      },
    }).sort({ startDate: 1 });

    const upcomingEvents = [
      ...oneDayEvents.map((event) => ({
        ...event.toObject(),
        date: parseDate(event.date),
      })),
      ...onlineEvents.map((event) => ({
        ...event.toObject(),
        date: parseDate(event.eventDate),
      })),
      ...tripEvents.map((event) => ({
        ...event.toObject(),
        date: parseDate(event.startDate),
      })),
    ];

    upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          upcomingEvents,
          "Upcoming events fetched successfully"
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Failed to fetch upcoming events");
  }
});

const getReferralAndTYFCBStats = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id ? req.params.id : req.user?._id;

    if (!userId) {
      throw new ApiErrors(400, "User ID is required");
    }

    // Count received referrals (where user is 'to')
    const receivedReferrals = await ReferralSlip.countDocuments({ to: userId });
    // Fetch actual documents for received referrals
    const receivedReferralDocs = await ReferralSlip.find({ to: userId }).lean();

    // Count given referrals (where user is 'from')
    const givenReferrals = await ReferralSlip.countDocuments({ from: userId });
    // Fetch actual documents for given referrals
    const givenReferralDocs = await ReferralSlip.find({ from: userId }).lean();

    // Count received TYFCB (where user is 'to')
    const receivedTYFCB = await RecordTYFCB.countDocuments({ to: userId });

    // Count given TYFCB (where user is 'from')
    const givenTYFCB = await RecordTYFCB.countDocuments({ from: userId });

    // Log counts for debugging
    console.log("Received Referral Count:", receivedReferrals);
    console.log("Given Referral Count:", givenReferrals);
    console.log("Received Referral Docs:", receivedReferralDocs.length);
    console.log("Given Referral Docs:", givenReferralDocs.length);

    const stats = {
      receivedReferrals,
      givenReferrals,
      receivedTYFCB,
      givenTYFCB,
    };

    return res.status(200).json({
      statusCode: 200,
      data: stats,
      message: "Referral and TYFCB statistics fetched successfully",
      success: true,
    });
  } catch (error) {
    console.log("Error:", error);
    throw new ApiErrors(
      error.statusCode || 500,
      error.message || "Failed to fetch referral and TYFCB statistics"
    );
  }
});

export {
  getDashboardStats,
  getUpcomingEvents,
  getLastRegisteredUsers,
  getLastCoreMembers,
  getPaymentTotals,
  getUserStatistics,
  getUpcomingEventsForUser,
  getReferralAndTYFCBStats,
};
