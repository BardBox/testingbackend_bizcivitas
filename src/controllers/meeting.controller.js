import mongoose from "mongoose"; // Add this import
import { Meeting } from "../models/meeting.model.js";
import { Community } from "../models/community.model.js";
import { Invitation } from "../models/invitation.model.js";
import path from "path";
import fs from "fs";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { sendInvitationMeetingEmail, sendPaymentConfirmationEmail }  from"../services/sendInvitationMeetingEmail.js";
;
import Razorpay from "razorpay";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create a new meeting
 const createMeeting = asyncHandler(async (req, res) => {
  const { visitor, date, place, time, title, speaker, community, agenda, visitorFee } = req.body;
  const image = req.files?.img?.[0];

  if (!visitor || !date || !place || !time || !title || !speaker || !community || !agenda) {
    throw new ApiErrors(400, "All fields (visitor, title, speaker, community, date, place, time, agenda) are required");
  }

  if (!image) {
    throw new ApiErrors(400, "Meeting image is required");
  }

  const inviter = await User.findById(req.user._id);
  if (!inviter) throw new ApiErrors(404, "Inviter not found");

  const existingCommunity = await Community.findById(community).populate("users coreMembers", "fname lname email mobile");
  if (!existingCommunity) {
    throw new ApiErrors(404, "Community not found");
  }

  const meetingImage = `meeting/${path.basename(image.path)}`;

  try {
    const newMeeting = new Meeting({
      visitor,
      title,
      speaker,
      community,
      date,
      place,
      time,
      img: meetingImage,
      agenda,
      visitorFee: visitorFee || 0,
      invited: [],
      attendees: [],
    });

    await newMeeting.save();

    const communityUsers = [...new Set([...(existingCommunity.users || []), ...(existingCommunity.coreMembers || [])])];

    const invitations = await Promise.all(
      communityUsers.map(async (user) => {
        const visitorName = `${user.fname || ''} ${user.lname || ''}`.trim() || user.email;
        if (!user.email) {
          console.warn(`Skipping user with no email: ${user._id}`);
          return null;
        }
        const invitation = new Invitation({
          meeting: newMeeting._id,
          email: user.email,
          visitorName,
          businessCategory: "",
          businessSubcategory: "",
          mobile: user.mobile || "",
          inviter: inviter._id,
          amount: 0,
          status: "confirmed",
        });
        await invitation.save();
        try {
          await sendInvitationMeetingEmail(
            visitorName,
            user.email,
            inviter,
            newMeeting,
            null,
            null,
            { businessCategory: "", businessSubcategory: "", mobile: user.mobile || "" }
          );
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
        }
        return invitation._id;
      })
    );

    newMeeting.invited = invitations.filter((id) => id !== null);
    await newMeeting.save();

    return res.status(201).json(new ApiResponses(201, newMeeting, "Meeting created successfully"));
  } catch (error) {
    if (image && image.path) {
      const imagePath = path.join("public", "meeting", path.basename(image.path)); // Adjust baseImageDir if needed
      console.log("Deleting uploaded image due to error:", imagePath);
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Failed to delete uploaded meeting image:", err);
      });
    }
    throw error;
  }
});

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
    throw new ApiErrors(400, "Missing required fields");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiErrors(400, "Invalid email format");
  }

  if (mobile && !/^[0-9]{10}$/.test(mobile)) {
    throw new ApiErrors(400, "Mobile must be 10 digits");
  }

  const [meeting, existingInvitation] = await Promise.all([
    Meeting.findById(meetingId),
    Invitation.findOne({
      meeting: meetingId,
      $or: [{ email }, mobile ? { mobile } : {}],
    }),
  ]);

  if (!meeting) throw new ApiErrors(404, "Meeting not found");
  if (existingInvitation) throw new ApiErrors(400, "Duplicate invitation");

  const invitation = await createInvitation({
    meeting,
    email,
    visitorName,
    businessCategory,
    businessSubcategory,
    mobile,
    inviter,
  });

  return res.status(200).json(
    new ApiResponses(200, invitation, "Invitation processed successfully")
  );
});

async function createInvitation(params) {
  const {
    meeting,
    email,
    visitorName,
    businessCategory,
    businessSubcategory,
    mobile,
    inviter,
  } = params;

  const invitationData = {
    meeting: meeting._id,
    email,
    visitorName,
    businessCategory,
    businessSubcategory,
    mobile,
    inviter: inviter._id,
    amount: meeting.visitorFee || 0,
    status: "pending",
  };

  const invitation = new Invitation(invitationData);

  if (meeting.visitorFee > 0) {
    // Paid invitation flow
    const paymentLink = await razorpay.paymentLink.create({
      amount: meeting.visitorFee * 100,
      currency: "INR",
      description: `Visitor fee for ${meeting.title}`,
      customer: { name: visitorName, email, contact: mobile || undefined },
      notify: { email: false, sms: false },
      notes: {
        inviteId: invitation._id.toString(),
      },
    });

    invitation.paymentLinkId = paymentLink.id;
    invitation.paymentLink = paymentLink.short_url;
  } else {
    // Free invitation - auto confirm
    invitation.status = "confirmed";
    await Meeting.findByIdAndUpdate(meeting._id, {
      $addToSet: { invited: invitation._id },
    });
  }

  await invitation.save();

  // Send email
  await sendInvitationMeetingEmail(
    visitorName,
    email,
    inviter,
    meeting,
    invitation.paymentLink,
    null,
    { businessCategory, businessSubcategory, mobile }
  );

  return invitation.toObject();
}


// Confirm invitation after payment


// Get a meeting by ID
 const getMeetingById = asyncHandler(async (req, res) => {
  const meetingId = req.params.id;

  const meeting = await Meeting.findById(meetingId)
    .populate("community")
    .populate({
      path: "invited",
      select: "visitorName email businessCategory businessSubcategory mobile status amount",
      match: { status: "confirmed" }, // Filter for confirmed invitations only
    })
    .populate("attendees", "fname lname email mobile");

  if (!meeting) throw new ApiErrors(404, "Meeting not found");

  const meetingInvitations = meeting.invited || [];
  const invitedVisitors = meetingInvitations.map((invitation) => ({
    visitorName: invitation.visitorName || "",
    email: invitation.email,
    businessCategory: invitation.businessCategory || "",
    businessSubcategory: invitation.businessSubcategory || "",
    mobile: invitation.mobile || "",
    source: "invited",
    fname: invitation.visitorName?.split(" ")[0] || "",
    lname: invitation.visitorName?.split(" ").slice(1).join(" ") || "",
    meetingId: meetingId,
  }));

  const communityUsers = meetingInvitations
    .filter((invitation) => invitation.amount === 0)
    .map((invitation) => ({
      visitorName: invitation.visitorName || "",
      email: invitation.email,
      businessCategory: "",
      businessSubcategory: "",
      mobile: invitation.mobile || "",
      source: "community",
      fname: invitation.visitorName?.split(" ")[0] || "",
      lname: invitation.visitorName?.split(" ").slice(1).join(" ") || "",
      meetingId: meetingId,
    }));

  const registeredUsers = meeting.attendees.map((user) => ({
    visitorName: `${user.fname || ""} ${user.lname || ""}`.trim() || user.email,
    email: user.email,
    mobile: user.mobile || "",
    businessCategory: "",
    businessSubcategory: "",
    source: "registered",
    fname: user.fname || "",
    lname: user.lname || "",
    meetingId: meetingId,
  }));

  const allVisitors = [...communityUsers, ...registeredUsers, ...invitedVisitors];

  const meetingResponse = meeting.toObject();
  meetingResponse.allVisitors = allVisitors;
  meetingResponse.invitedVisitors = invitedVisitors;

  return res.status(200).json(new ApiResponses(200, meetingResponse, "Meeting fetched successfully"));
});

// Get all meetings
const getMeetings = asyncHandler(async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate("community")
      .populate({
        path: "invited",
        select: "visitorName email businessCategory businessSubcategory mobile status amount",
      })
      .populate("attendees", "fname lname email mobile")
      .sort({ date: 1 });

    if (!meetings || meetings.length === 0) {
      console.log("No meetings found");
      return res.status(200).json(new ApiResponses(200, [], "No meetings found"));
    }

    const meetingsWithVisitors = await Promise.all(
      meetings.map(async (meeting) => {
        // Log the invited array for each meeting
       

        const meetingInvitations = meeting.invited.filter((invitation) => {
          const isConfirmed = invitation.status === "confirmed";
          if (!isConfirmed) {
            console.log(`Invitation ${invitation._id} excluded: status is ${invitation.status}`);
          }
          return isConfirmed;
        });

        const invitedVisitors = meetingInvitations
          .filter((invitation) => {
            const hasAmount = invitation.amount > 0;
            if (!hasAmount) {
              console.log(`Invitation ${invitation._id} excluded from invitedVisitors: amount is ${invitation.amount}`);
            }
            return hasAmount;
          })
          .map((invitation) => {
            return {
              visitorName: invitation.visitorName || "",
              email: invitation.email,
              businessName: invitation.businessCategory || "",
              businessCategory: invitation.businessCategory || "",
              businessSubcategory: invitation.businessSubcategory || "",
              mobile: invitation.mobile || "",
              source: "invited",
            };
          });

        const communityUsers = meetingInvitations
          .filter((invitation) => invitation.amount === 0)
          .map((invitation) => ({
            visitorName: invitation.visitorName || "",
            email: invitation.email,
            businessName: "",
            businessCategory: "",
            businessSubcategory: "",
            mobile: invitation.mobile || "",
            source: "community",
          }));

        const registeredUsers = meeting.attendees.map((user) => ({
          visitorName: `${user.fname} ${user.lname}`.trim() || user.email,
          email: user.email,
          businessName: "",
          businessCategory: "",
          businessSubcategory: "",
          mobile: user.mobile || "",
          source: "registered",
        }));

        const allVisitors = [...communityUsers, ...registeredUsers, ...invitedVisitors];

      

        const meetingResponse = meeting.toObject();
        meetingResponse.allVisitors = allVisitors;
        meetingResponse.invitedVisitors = invitedVisitors;

        return meetingResponse;
      })
    );

    return res.status(200).json(new ApiResponses(200, meetingsWithVisitors, "Meetings fetched successfully"));
  } catch (error) {
    console.error("Error fetching meetings:", error);
    throw new ApiErrors(500, "Failed to fetch meetings");
  }
});

// Update a meeting
const updateMeeting = asyncHandler(async (req, res) => {
  const meetingId = req.params.id;
  const { visitor, title, speaker, community, date, place, time, agenda, visitorFee } = req.body;
  const image = req.files?.img?.[0];

  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new ApiErrors(404, "Meeting not found");
    }
    if (community && community !== String(meeting.community)) {
      const existingCommunity = await Community.findById(community);
      if (!existingCommunity) {
        throw new ApiErrors(404, "Community not found");
      }
      meeting.community = community;
    }

    meeting.visitor = visitor || meeting.visitor;
    meeting.title = title || meeting.title;
    meeting.speaker = speaker || meeting.speaker;
    meeting.date = date || meeting.date;
    meeting.place = place || meeting.place;
    meeting.time = time || meeting.time;
    meeting.agenda = agenda || meeting.agenda;
    meeting.visitorFee = visitorFee !== undefined ? visitorFee : meeting.visitorFee;

    if (image) {
      const oldImagePath = path.join(baseImageDir, meeting.img);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
      const updatedImage = `meeting/${path.basename(image.path)}`;
      meeting.img = updatedImage;
    }

    await meeting.save();

    return res.status(200).json(new ApiResponses(200, meeting, "Meeting updated successfully"));
  } catch (error) {
    if (image && image.path) {
      const uploadedImagePath = path.join(baseImageDir, "meeting", path.basename(image.path));
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
        console.log("Uploaded image deleted due to error");
      }
    }
    console.log(error);
    throw error;
  }
});

// Delete a meeting
const deleteMeeting = asyncHandler(async (req, res) => {
  const meetingId = req.params.id;

  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new ApiErrors(404, "Meeting not found");
    }

    const imagePath = path.join(baseImageDir, meeting.img);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Meeting.findByIdAndDelete(meetingId);

    return res.status(200).json(new ApiResponses(200, {}, "Meeting deleted successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to delete meeting");
  }
});

// Get All-Time Invitation Count (non-community only)
const getAllTimeInvitationCount = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiErrors(401, "Unauthorized");

  const totalPaidInvitations = await Invitation.countDocuments({
    inviter: userId,
    amount: { $gt: 0 },
    status: "confirmed"
  });

  return res.status(200).json(
    new ApiResponses(200, { totalPaidInvitations }, "All-time paid invitation count retrieved")
  );
});


const getLast15DaysInvitedPeopleCount = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiErrors(401, "Unauthorized: User not found");
  }

  const today = new Date();
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(today.getDate() - 14);

  try {
    // Aggregated count per day for unique emails
    const result = await Invitation.aggregate([
      {
        $match: {
          inviter: userId,
          status: "confirmed",
          createdAt: {
            $gte: new Date(fifteenDaysAgo.setHours(0, 0, 0, 0)),
            $lte: new Date(today.setHours(23, 59, 59, 999)),
          },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            email: "$email",
          },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Build daily structure with 0s where no data exists
    const dayWiseData = [];
    for (let i = 0; i < 15; i++) {
      const date = new Date();
      date.setDate(today.getDate() - (14 - i));
      const formatted = date.toISOString().split("T")[0];
      const matched = result.find((r) => r._id === formatted);
      dayWiseData.push({ date: formatted, count: matched ? matched.count : 0 });
    }

    const last15DaysCount = dayWiseData.reduce((sum, item) => sum + item.count, 0);

    const allTimeCount = await Invitation.aggregate([
      {
        $match: {
          inviter: userId,
          status: "confirmed",
        },
      },
      {
        $group: {
          _id: "$email",
        },
      },
      {
        $count: "totalInvitedPeople",
      },
    ]);

    const allTimePaidInvitationCount = allTimeCount[0]?.totalInvitedPeople || 0;

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          dayWiseData,
          last15DaysPaidInvitationCount: last15DaysCount, // Keeping variable name as is
          allTimePaidInvitationCount,
        },
        "Paid invitation count retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching paid invitation stats:", error);
    throw new ApiErrors(500, "Failed to fetch paid invitation stats");
  }
});


const getLast3MonthsFortnightInvitedPeopleCount = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiErrors(401, "Unauthorized");

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  // Generate fortnight intervals
  const intervals = [];
  let current = new Date(threeMonthsAgo);
  while (current < now) {
    const end = new Date(current);
    end.setDate(end.getDate() + 14);
    intervals.push({ start: new Date(current), end });
    current = end;
  }

  const results = [];

  // Get count for each interval
  for (const interval of intervals) {
    const count = await Invitation.aggregate([
      {
        $match: {
          inviter: userId,
          status: "confirmed",
          createdAt: { $gte: interval.start, $lt: interval.end },
        },
      },
      {
        $group: {
          _id: "$email",
        },
      },
      {
        $count: "count",
      },
    ]);

    results.push({
      period: `${interval.start.toISOString().split("T")[0]} to ${interval.end.toISOString().split("T")[0]}`,
      count: count[0]?.count || 0,
    });
  }

  // Get total count across entire 3-month period
  const totalCount = await Invitation.aggregate([
    {
      $match: {
        inviter: userId,
        status: "confirmed",
        createdAt: { $gte: threeMonthsAgo, $lte: now },
      },
    },
    {
      $group: {
        _id: "$email",
      },
    },
    {
      $count: "totalPaidInvitations",
    },
  ]);

  const totalPaidInvitations = totalCount[0]?.totalPaidInvitations || 0;

  return res.status(200).json(
    new ApiResponses(200, {
      results,
      totalPaidInvitations,
    }, "Last 3 months fortnight paid invitation count retrieved")
  );
});
const getLast6MonthsInvitedPeopleCount = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiErrors(401, "Unauthorized");

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const totalPaidInvitations = await Invitation.aggregate([
    {
      $match: {
        inviter: userId,
        status: "confirmed",
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: "$email",
      },
    },
    {
      $count: "totalPaidInvitations",
    },
  ]);

  const totalCount = totalPaidInvitations[0]?.totalPaidInvitations || 0;

  return res.status(200).json(
    new ApiResponses(
      200,
      { totalPaidInvitations: totalCount },
      "Last 6 months paid invitation count retrieved"
    )
  );
});

// Get All-Time Invited People Count (non-community only)
const getAllTimeInvitedPeopleCount = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiErrors(401, "Unauthorized: User not found");
    }

    const invitedPeopleStats = await Invitation.aggregate([
      {
        $match: {
          inviter: userId,
          status: "confirmed",
        },
      },
      {
        $group: {
          _id: {
            meeting: "$meeting",
            email: "$email",
          },
        },
      },
      {
        $group: {
          _id: "$_id.meeting",
          invitees: { $addToSet: "$_id.email" },
        },
      },
      {
        $lookup: {
          from: "meetings",
          localField: "_id",
          foreignField: "_id",
          as: "meetingDetails",
        },
      },
      {
        $unwind: {
          path: "$meetingDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          meetingId: "$_id",
          meetingTitle: "$meetingDetails.title",
          meetingDate: "$meetingDetails.date",
          inviteeCount: { $size: "$invitees" },
          invitees: 1,
        },
      },
      {
        $sort: { meetingId: 1 },
      },
    ]);

    const uniqueInvitees = await Invitation.aggregate([
      {
        $match: {
          inviter: userId,
          status: "confirmed",
        },
      },
      {
        $group: {
          _id: "$email",
        },
      },
      {
        $count: "totalInvitedPeople",
      },
    ]);

    const totalInvitedPeopleCount = uniqueInvitees[0]?.totalInvitedPeople || 0;

    return res.status(200).json(
      new ApiResponses(200, { invitedPeopleStats, totalInvitedPeopleCount }, "All-time invited people count retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching all-time invited people count:", error);
    throw new ApiErrors(500, "Failed to retrieve all-time invited people count");
  }
});

const getMeetingsByCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.params;

  // Validate communityId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(communityId)) {
    throw new ApiErrors(400, "Invalid community ID");
  }

  // Check if the community exists
  const community = await Community.findById(communityId);
  if (!community) {
    throw new ApiErrors(404, "Community not found");
  }

  // Fetch meetings for the specific community
  const meetings = await Meeting.find({ community: communityId })
    .populate("community")
    .populate({
      path: "invited",
      select: "visitorName email businessCategory businessSubcategory mobile status amount",
      match: { status: "confirmed" }, // Filter for confirmed invitations only
    })
    .populate("attendees", "fname lname email mobile")
    .sort({ date: 1 });

  if (!meetings || meetings.length === 0) {
    return res.status(200).json(new ApiResponses(200, [], "No meetings found for this community"));
  }

  // Process meetings with visitors
  const meetingsWithVisitors = await Promise.all(
    meetings.map(async (meeting) => {
      const meetingInvitations = meeting.invited || [];
      const invitedVisitors = meetingInvitations.map((invitation) => ({
        visitorName: invitation.visitorName || "",
        email: invitation.email,
        businessCategory: invitation.businessCategory || "",
        businessSubcategory: invitation.businessSubcategory || "",
        mobile: invitation.mobile || "",
        source: "invited",
        fname: invitation.visitorName?.split(" ")[0] || "",
        lname: invitation.visitorName?.split(" ").slice(1).join(" ") || "",
        meetingId: meeting._id,
      }));

      const communityUsers = meetingInvitations
        .filter((invitation) => invitation.amount === 0)
        .map((invitation) => ({
          visitorName: invitation.visitorName || "",
          email: invitation.email,
          businessCategory: "",
          businessSubcategory: "",
          mobile: invitation.mobile || "",
          source: "community",
          fname: invitation.visitorName?.split(" ")[0] || "",
          lname: invitation.visitorName?.split(" ").slice(1).join(" ") || "",
          meetingId: meeting._id,
        }));

      const registeredUsers = meeting.attendees.map((user) => ({
        visitorName: `${user.fname || ""} ${user.lname || ""}`.trim() || user.email,
        email: user.email,
        mobile: user.mobile || "",
        businessCategory: "",
        businessSubcategory: "",
        source: "registered",
        fname: user.fname || "",
        lname: user.lname || "",
        meetingId: meeting._id,
      }));

      const allVisitors = [...communityUsers, ...registeredUsers, ...invitedVisitors];

      const meetingResponse = meeting.toObject();
      meetingResponse.allVisitors = allVisitors;
      meetingResponse.invitedVisitors = invitedVisitors;

      return meetingResponse;
    })
  );

  return res.status(200).json(new ApiResponses(200, meetingsWithVisitors, "Meetings fetched successfully for this community"));
});

const getInvitedUsersByDateDetailed = asyncHandler(async (req, res) => {
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
    // Fetch all confirmed invitations where the user is the inviter
    const invitations = await Invitation.aggregate([
      {
        $match: {
          inviter: userId,
          createdAt: { $gte: start, $lte: end },
          status: "confirmed",
        },
      },
      {
        $group: {
          _id: "$email",
          invitation: { $first: "$$ROOT" }, // Keep the first invitation for each email
        },
      },
      {
        $lookup: {
          from: "meetings",
          localField: "invitation.meeting",
          foreignField: "_id",
          as: "meeting",
        },
      },
      {
        $unwind: {
          path: "$meeting",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    // Format invited users data
    const formattedInvitedUsers = invitations.map(({ invitation, meeting }) => ({
      visitorName: invitation.visitorName || "",
      email: invitation.email,
      businessCategory: invitation.businessCategory || "",
      businessSubcategory: invitation.businessSubcategory || "",
      mobile: invitation.mobile || "",
      amount: invitation.amount || 0,
      status: invitation.status || "",
      createdAt: invitation.createdAt,
      meetingTitle: meeting?.title || "N/A",
      meetingDate: meeting?.date || null,
    }));

    const totalInvitedCount = invitations.length;

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          invitedUsers: formattedInvitedUsers,
          totalInvitedCount,
        },
        "Detailed invited users data retrieved successfully"
      )
    );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to retrieve detailed invited users data");
  }
});

export {
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
 getInvitedUsersByDateDetailed,

};