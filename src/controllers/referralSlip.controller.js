import { ReferralSlip } from "../models/referralSlip.model.js";
import { User } from "../models/user.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import { Community } from "../models/community.model.js";

// Create a new Referral Slip
const createReferralSlip = asyncHandler(async (req, res) => {
  const { to, referral, telephone, email, address, comments } = req.body;
  const from = req.user._id;
  const requiredFields = [to, from, referral, telephone, email, address];
  const isFieldMissing = requiredFields.some((field) => !field);

  if (isFieldMissing) {
    throw new ApiErrors(400, "Please fill in all required fields");
  }

  const user = await User.findById(to);
  if (!user) {
    throw new ApiErrors(400, "The user referenced in 'to' does not exist");
  }

  if (to === from.toString()) {
    throw new ApiErrors(400, "The 'to' user cannot be the same as the 'from' user");
  }

  try {
    const newReferralSlip = new ReferralSlip({
      from,
      to,
      referral,
      telephone,
      email,
      address,
      comments: comments || "",
    });

    await newReferralSlip.save();
    return res
      .status(201)
      .json(new ApiResponses(201, newReferralSlip, "Referral Slip created successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to create Referral Slip");
  }
});

// Get All Referral Slips
const getAllReferralSlips = asyncHandler(async (req, res) => {
  try {
    const referralSlips = await ReferralSlip.find().populate("to from");
    return res
      .status(200)
      .json(new ApiResponses(200, referralSlips, "Referral Slips retrieved successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve Referral Slips");
  }
});

// Get Last 15 Days Slip Counts
const getLast15DaysSlipCounts = asyncHandler(async (req, res) => {
  try {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Start from midnight today

    const dailyCounts = [];

    for (let i = 14; i >= 0; i--) {
      const startOfDay = new Date(currentDate);
      startOfDay.setDate(currentDate.getDate() - i);

      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      const referralsCount = await ReferralSlip.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
        from: req.user._id,
      });

      const givenCount = await ReferralSlip.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
        to: req.user._id,
      });

      const label = startOfDay.toISOString().split("T")[0];

      dailyCounts.push({
        day: label,
        referrals: referralsCount,
        given: givenCount,
      });
    }

    const totalReferralsCount = await ReferralSlip.countDocuments({
      from: req.user._id,
    });

    const totalGivenCount = await ReferralSlip.countDocuments({
      to: req.user._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            dailyCounts,
            totalReferralsCount,
            totalGivenCount,
          },
          "Last 15 days slip counts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve last 15 days slip counts");
  }
});

// Get Last 3 Months Fortnight Counts (6 fortnights, 15 days each)
const getLast3MonthsFortnightCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
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

      const referralsCount = await ReferralSlip.countDocuments({
        createdAt: { $gte: fortnightStart, $lte: fortnightEnd },
        from: userId,
      });

      const givenCount = await ReferralSlip.countDocuments({
        createdAt: { $gte: fortnightStart, $lte: fortnightEnd },
        to: userId,
      });

      const label = `Fortnight ${TOTAL_FORTNIGHTS - i}: ${fortnightStart.toISOString().split("T")[0]} to ${fortnightEnd.toISOString().split("T")[0]}`;

      fortnightCounts.push({
        period: label,
        referrals: referralsCount,
        given: givenCount,
      });
    }

    const totalReferralsCount = await ReferralSlip.countDocuments({
      createdAt: { $gte: startDate, $lte: currentDate },
      from: userId,
    });

    const totalGivenCount = await ReferralSlip.countDocuments({
      createdAt: { $gte: startDate, $lte: currentDate },
      to: userId,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            fortnightCounts,
            totalReferralsCount,
            totalGivenCount,
          },
          "Last 3 months fortnight counts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve last 3 months fortnight counts");
  }
});

// Get Last 6 Months Counts (from 23rd to 23rd of each month)
const getLast6MonthsCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
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

      // Adjust for cases where the month might roll over (e.g., if setting to 23rd isn't valid)
      if (monthStart.getDate() !== 23) {
        monthStart.setDate(23);
      }

      const referralsCount = await ReferralSlip.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        from: userId,
      });

      const givenCount = await ReferralSlip.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        to: userId,
      });

      // Format the period (e.g., "Month 1: 2024-11-23 to 2024-12-23")
      const label = `Month ${TOTAL_MONTHS - i}: ${monthStart.toISOString().split("T")[0]} to ${monthEnd.toISOString().split("T")[0]}`;

      monthCounts.push({
        period: label,
        referrals: referralsCount,
        given: givenCount,
      });
    }

    // Get total counts for the entire 6-month period
    const totalReferralsCount = await ReferralSlip.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      from: userId,
    });

    const totalGivenCount = await ReferralSlip.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      to: userId,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            monthCounts,
            totalReferralsCount,
            totalGivenCount,
          },
          "Last 6 months counts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve last 6 months counts");
  }
});

// Get Detailed Referrals by Date Range
const getReferralsByDateDetailed = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user._id;

  if (!startDate || !endDate) {
    throw new ApiErrors(400, "Please provide both startDate and endDate");
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
    const referralsGiven = await ReferralSlip.find({
      from: userId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate({ path: "to", select: "fname lname referBy" })
      .populate({ path: "from", select: "fname lname" })
      .lean();

    const referralsReceived = await ReferralSlip.find({
      to: userId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate({ path: "from", select: "fname lname referBy" })
      .populate({ path: "to", select: "fname lname" })
      .lean();

    const formattedGiven = await Promise.all(
      referralsGiven.map(async (slip) => {
        let communityName = null;
        if (slip.to && slip.to.referBy) {
          const community = await Community.findOne({ coreMembers: slip.to.referBy }).lean();
          if (community) {
            communityName = community.communityName;
          }
        }

        return {
          toUser: slip.to ? `${slip.to.fname} ${slip.to.lname}`.trim() : "Unknown",
          referralName: slip.referral,
          telephone: slip.telephone,
          comments: slip.comments || "",
          communityName,
          createdAt: slip.createdAt,
        };
      })
    );

    const formattedReceived = await Promise.all(
      referralsReceived.map(async (slip) => {
        let communityName = null;
        if (slip.from && slip.from.referBy) {
          const community = await Community.findOne({ coreMembers: slip.from.referBy }).lean();
          if (community) {
            communityName = community.communityName;
          }
        }

        return {
          fromUser: slip.from ? `${slip.from.fname} ${slip.from.lname}`.trim() : "Unknown",
          referralName: slip.referral,
          telephone: slip.telephone,
          comments: slip.comments || "",
          communityName,
          createdAt: slip.createdAt,
        };
      })
    );

    const totalGivenCount = await ReferralSlip.countDocuments({
      from: userId,
      createdAt: { $gte: start, $lte: end },
    });
    const totalReceivedCount = await ReferralSlip.countDocuments({
      to: userId,
      createdAt: { $gte: start, $lte: end },
    });

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          referralsGiven: formattedGiven,
          referralsReceived: formattedReceived,
          totalGivenCount,
          totalReceivedCount,
        },
        "Detailed referrals data retrieved successfully"
      )
    );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve detailed referrals data");
  }
});

// Get Till Date Referral Counts
const getTillDateReferralCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Count total referrals given by the user (from)
    const totalReferralsGiven = await ReferralSlip.countDocuments({
      from: userId,
    });

    // Count total referrals received by the user (to)
    const totalReferralsReceived = await ReferralSlip.countDocuments({
      to: userId,
    });

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            totalReferralsGiven,
            totalReferralsReceived,
          },
          "Till date referral counts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve till date referral counts");
  }
});

// Export the functions
export {
  createReferralSlip,
  getAllReferralSlips,
  getLast15DaysSlipCounts,
  getLast3MonthsFortnightCounts,
  getLast6MonthsCounts,
  getReferralsByDateDetailed,
  getTillDateReferralCounts, // Add the new function to exports
};