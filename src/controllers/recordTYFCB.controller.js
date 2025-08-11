import { RecordTYFCB } from "../models/recordTYFCB.model.js";
import { User } from "../models/user.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Create a new RecordTYFCB
const createRecordTYFCB = asyncHandler(async (req, res) => {
  const { to, comments, amount } = req.body;
  const from = req.user._id;

  const requiredFields = [to, from];
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
    const newRecordTYFCB = new RecordTYFCB({
      from,
      to,
      comments: comments || "",
      amount,
    });

    await newRecordTYFCB.save();
    return res
      .status(201)
      .json(new ApiResponses(201, newRecordTYFCB, "RecordTYFCB created successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to create RecordTYFCB");
  }
});

// Get All RecordTYFCBs where 'to' exists
const getAllRecordTYFCBs = asyncHandler(async (req, res) => {
  try {
    const recordTYFCBs = await RecordTYFCB.find({ to: { $exists: true } }).populate("to from");
    return res
      .status(200)
      .json(new ApiResponses(200, recordTYFCBs, "RecordTYFCBs retrieved successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve RecordTYFCBs");
  }
});

// Get Monthly RecordTYFCB Counts for 'to' user
const getMonthlyRecordTYFCBCounts = asyncHandler(async (req, res) => {
  try {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlySums = await Promise.all(
      months.map(async (month, index) => {
        const startDate = new Date(new Date().getFullYear(), index, 1);
        const endDate = new Date(new Date().getFullYear(), index + 1, 0);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const totalReceived = await RecordTYFCB.aggregate([
          { $match: { createdAt: { $gte: startDate, $lt: endDate }, to: req.user._id } },
          { $group: { _id: null, totalReceived: { $sum: "$amount" } } },
        ]);

        const totalGiven = await RecordTYFCB.aggregate([
          { $match: { createdAt: { $gte: startDate, $lt: endDate }, from: req.user._id } },
          { $group: { _id: null, totalGiven: { $sum: "$amount" } } },
        ]);

        return {
          month,
          totalReceived: totalReceived.length > 0 ? totalReceived[0].totalReceived : 0,
          totalGiven: totalGiven.length > 0 ? totalGiven[0].totalGiven : 0,
        };
      })
    );

    const totalReceivedAllTime = await RecordTYFCB.aggregate([
      { $match: { to: req.user._id } },
      { $group: { _id: null, totalReceived: { $sum: "$amount" } } },
    ]);

    const totalGivenAllTime = await RecordTYFCB.aggregate([
      { $match: { from: req.user._id } },
      { $group: { _id: null, totalGiven: { $sum: "$amount" } } },
    ]);

    const totalReceivedAllTimeAmount = totalReceivedAllTime.length > 0 ? totalReceivedAllTime[0].totalReceived : 0;
    const totalGivenAllTimeAmount = totalGivenAllTime.length > 0 ? totalGivenAllTime[0].totalGiven : 0;

    return res.status(200).json(
      new ApiResponses(
        200,
        { monthlySums, totalReceivedAllTime: totalReceivedAllTimeAmount, totalGivenAllTime: totalGivenAllTimeAmount },
        "Monthly totalTYFCB amounts retrieved successfully"
      )
    );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve monthly TYFCB total amounts");
  }
});

// Get Last 15 Days RecordTYFCB Counts
const getLast15DaysRecordTYFCBCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const currentDate = new Date();
    currentDate.setUTCHours(23, 59, 59, 999);

    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 14); // 15 days = today + last 14 days
    startDate.setUTCHours(0, 0, 0, 0);

    const dailySums = [];

    for (let i = 0; i < 15; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(startDate.getDate() + i);
      dayStart.setUTCHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const totalReceived = await RecordTYFCB.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lte: dayEnd }, to: userId } },
        { $group: { _id: null, totalReceived: { $sum: "$amount" } } }
      ]);

      const totalGiven = await RecordTYFCB.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lte: dayEnd }, from: userId } },
        { $group: { _id: null, totalGiven: { $sum: "$amount" } } }
      ]);

      dailySums.push({
        date: dayStart.toISOString().split("T")[0],
        totalReceived: totalReceived[0]?.totalReceived || 0,
        totalGiven: totalGiven[0]?.totalGiven || 0,
      });
    }

    const totalReceived = await RecordTYFCB.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: currentDate }, to: userId } },
      { $group: { _id: null, totalReceived: { $sum: "$amount" } } }
    ]);

    const totalGiven = await RecordTYFCB.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: currentDate }, from: userId } },
      { $group: { _id: null, totalGiven: { $sum: "$amount" } } }
    ]);

    return res.status(200).json(new ApiResponses(200, {
      dailySums,
      totalReceived: totalReceived[0]?.totalReceived || 0,
      totalGiven: totalGiven[0]?.totalGiven || 0,
    }, "Last 15 days TYFCB amounts retrieved successfully"));
  } catch (err) {
    console.error(err);
    throw new ApiErrors(500, "Failed to retrieve 15-day TYFCB summary");
  }
});


// Get Last 3 Months Fortnight TYFCB Counts (6 fortnights, 15 days each)
const getLast3MonthsFortnightTYFCBCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const currentDate = new Date();
    currentDate.setUTCHours(23, 59, 59, 999);

    const FORTNIGHT_DAYS = 15;
    const TOTAL_FORTNIGHTS = 6;
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - FORTNIGHT_DAYS * TOTAL_FORTNIGHTS);
    startDate.setUTCHours(0, 0, 0, 0);

    const fortnightSums = [];

    for (let i = 0; i < TOTAL_FORTNIGHTS; i++) {
      const periodStart = new Date(startDate);
      periodStart.setDate(periodStart.getDate() + i * FORTNIGHT_DAYS);
      periodStart.setUTCHours(0, 0, 0, 0);

      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + FORTNIGHT_DAYS - 1);
      periodEnd.setUTCHours(23, 59, 59, 999);

      const totalReceived = await RecordTYFCB.aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd }, to: userId } },
        { $group: { _id: null, totalReceived: { $sum: "$amount" } } },
      ]);

      const totalGiven = await RecordTYFCB.aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd }, from: userId } },
        { $group: { _id: null, totalGiven: { $sum: "$amount" } } },
      ]);

      fortnightSums.push({
        period: `Fortnight ${i + 1}: ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
        totalReceived: totalReceived[0]?.totalReceived || 0,
        totalGiven: totalGiven[0]?.totalGiven || 0,
      });
    }

    const totalReceived = await RecordTYFCB.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: currentDate }, to: userId } },
      { $group: { _id: null, totalReceived: { $sum: "$amount" } } },
    ]);

    const totalGiven = await RecordTYFCB.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: currentDate }, from: userId } },
      { $group: { _id: null, totalGiven: { $sum: "$amount" } } },
    ]);

    return res.status(200).json(new ApiResponses(200, {
      fortnightSums,
      totalReceived: totalReceived[0]?.totalReceived || 0,
      totalGiven: totalGiven[0]?.totalGiven || 0,
    }, "Last 3 months fortnight TYFCB amounts retrieved successfully"));
  } catch (err) {
    console.error(err);
    throw new ApiErrors(500, "Failed to retrieve last 3 months TYFCB amounts");
  }
});


// Get Last 6 Months TYFCB Counts (from 23rd to 23rd of each month)
const getLast6MonthsTYFCBCounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const currentDate = new Date();
    currentDate.setUTCHours(23, 59, 59, 999);

    const monthSums = [];
    const startDate = new Date(currentDate);
    startDate.setMonth(startDate.getMonth() - 5);
    startDate.setDate(1);
    startDate.setUTCHours(0, 0, 0, 0);

    for (let i = 0; i < 6; i++) {
      const periodStart = new Date(startDate);
      periodStart.setMonth(startDate.getMonth() + i);
      periodStart.setUTCHours(0, 0, 0, 0);

      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodStart.getMonth() + 1);
      periodEnd.setDate(0); // Last day of month
      periodEnd.setUTCHours(23, 59, 59, 999);

      const totalReceived = await RecordTYFCB.aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd }, to: userId } },
        { $group: { _id: null, totalReceived: { $sum: "$amount" } } }
      ]);

      const totalGiven = await RecordTYFCB.aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd }, from: userId } },
        { $group: { _id: null, totalGiven: { $sum: "$amount" } } }
      ]);

      monthSums.push({
        month: periodStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
        totalReceived: totalReceived[0]?.totalReceived || 0,
        totalGiven: totalGiven[0]?.totalGiven || 0,
      });
    }

    const totalReceived = await RecordTYFCB.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: currentDate }, to: userId } },
      { $group: { _id: null, totalReceived: { $sum: "$amount" } } }
    ]);

    const totalGiven = await RecordTYFCB.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: currentDate }, from: userId } },
      { $group: { _id: null, totalGiven: { $sum: "$amount" } } }
    ]);

    return res.status(200).json(new ApiResponses(200, {
      monthSums,
      totalReceived: totalReceived[0]?.totalReceived || 0,
      totalGiven: totalGiven[0]?.totalGiven || 0,
    }, "Last 6 months TYFCB amounts retrieved successfully"));
  } catch (err) {
    console.error(err);
    throw new ApiErrors(500, "Failed to retrieve 6-month TYFCB summary");
  }
});


// Get TYFCB Records by Date Range (Detailed)
const getTYFCBByDateDetailed = asyncHandler(async (req, res) => {
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
    const tyfcbGiven = await RecordTYFCB.find({
      from: userId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate({ path: "to", select: "fname lname" })
      .lean();

    const tyfcbReceived = await RecordTYFCB.find({
      to: userId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate({ path: "from", select: "fname lname" })
      .lean();

    const formattedGiven = tyfcbGiven.map((record) => ({
      toUser: record.to ? `${record.to.fname} ${record.to.lname}`.trim() : "Unknown",
      amount: record.amount,
      comments: record.comments || "",
      createdAt: record.createdAt,
    }));

    const formattedReceived = tyfcbReceived.map((record) => ({
      fromUser: record.from ? `${record.from.fname} ${record.from.lname}`.trim() : "Unknown",
      amount: record.amount,
      comments: record.comments || "",
      createdAt: record.createdAt,
    }));

    const totalGivenAmountResult = await RecordTYFCB.aggregate([
      { $match: { from: userId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalGivenAmount: { $sum: "$amount" } } },
    ]);

    const totalReceivedAmountResult = await RecordTYFCB.aggregate([
      { $match: { to: userId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalReceivedAmount: { $sum: "$amount" } } },
    ]);

    const totalGivenAmount = totalGivenAmountResult.length > 0 ? totalGivenAmountResult[0].totalGivenAmount : 0;
    const totalReceivedAmount = totalReceivedAmountResult.length > 0 ? totalReceivedAmountResult[0].totalReceivedAmount : 0;

    return res.status(200).json(
      new ApiResponses(
        200,
        { tyfcbGiven: formattedGiven, tyfcbReceived: formattedReceived, totalGivenAmount, totalReceivedAmount },
        "Detailed TYFCB data retrieved successfully"
      )
    );
  } catch (error) {
    console.log("Error in getTYFCBByDateDetailed:", error);
    throw new ApiErrors(500, "Failed to retrieve detailed TYFCB data");
  }
});

// Get Till Date TYFCB Amounts
const getTillDateTYFCBAmounts = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Calculate total TYFCB amounts given by the user (from)
    const totalGiven = await RecordTYFCB.aggregate([
      { $match: { from: userId } },
      { $group: { _id: null, totalGivenAmount: { $sum: "$amount" } } },
    ]);

    // Calculate total TYFCB amounts received by the user (to)
    const totalReceived = await RecordTYFCB.aggregate([
      { $match: { to: userId } },
      { $group: { _id: null, totalReceivedAmount: { $sum: "$amount" } } },
    ]);

    const totalGivenAmount = totalGiven.length > 0 ? totalGiven[0].totalGivenAmount : 0;
    const totalReceivedAmount = totalReceived.length > 0 ? totalReceived[0].totalReceivedAmount : 0;

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {
            totalGivenAmount,
            totalReceivedAmount,
          },
          "Till date TYFCB amounts retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve till date TYFCB amounts");
  }
});

// Export the functions
export {
  createRecordTYFCB,
  getAllRecordTYFCBs,
  getMonthlyRecordTYFCBCounts,
  getLast15DaysRecordTYFCBCounts,
  getLast3MonthsFortnightTYFCBCounts,
  getLast6MonthsTYFCBCounts,
  getTYFCBByDateDetailed,
  getTillDateTYFCBAmounts, // Add the new function to exports
};