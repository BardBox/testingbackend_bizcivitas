import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import { Community } from "../models/community.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import { roles } from "../constants.js";
import crypto from "crypto";
import { sendEmailWithCredentials } from "../services/credentialsEmail.js";

const generateRandomPassword = (length = 12) => {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};

const addCoreMember = asyncHandler(async (req, res) => {
  const { fname, lname, email, mobile, region } = req.body;

  if (!fname || !email || !mobile || !region) {
    throw new ApiErrors(400, "All fields are required");
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiErrors(409, "Email already exists");
  }
  const newPassword = generateRandomPassword();
  const newMember = await User.create({
    fname,
    lname,
    email,
    mobile,
    role: roles[1],
    region,
    password: newPassword,
  });

  const newProfile = await Profile.create({
    contactDetails: {
      mobileNumber: mobile,
      email: email,
    },
    addresses: {},
    myBio: {},
    weeklyPresentation: '',
    professionalDetails: {},
  });

  newMember.profile = newProfile._id;
  await newMember.save();

  if (newMember) {
    await sendEmailWithCredentials(
      newMember.fname,
      newMember.email,
      newPassword
    );
  }

  return res
    .status(201)
    .json(
      new ApiResponses(
        201,
        newMember,
        `Core member added successfully.Credentials sent to ${newMember.email}`
      )
    );
});

const getAllCoreMembers = asyncHandler(async (req, res) => {
  const members = await User.find({ role: roles[1] }).select(
    "fname lname email mobile region state role"
  );

  return res
    .status(200)
    .json(
      new ApiResponses(200, members, "All core members fetched successfully")
    );
});

const searchCoreMembers = asyncHandler(async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res
      .status(200)
      .json(new ApiResponses(200, [], "No search query provided"));
  }

  const isNumericQuery = !isNaN(query);

  const searchCriteria = {
    role: roles[1],
    $or: [
      { fname: { $regex: query, $options: "i" } },
      { lname: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { region: { $regex: query, $options: "i" } },
      { state: { $regex: query, $options: "i" } },
    ],
  };

  if (isNumericQuery) {
    searchCriteria.$or.push({ mobile: query });
  }

  const members = await User.find(searchCriteria)
    .select("fname lname email mobile region state")
    .limit(10);

  return res.status(200).json(new ApiResponses(200, members, "Search results"));
});

const getCorememberStats = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user?.id;

  const user = await User.findById(userId);

  if (!user || !user.role === roles[1]) {
    throw new ApiErrors(404, "core-member not found");
  }

  const totalReferBy = await User.countDocuments({ referBy: userId });
  const totalConnections = user.connections.length;
  const communities = await Community.countDocuments({
    $or: [{ coreMembers: userId }, { users: userId }],
  });

  const userStats = {
    totalReferBy,
    totalConnections,
    communities,
  };

  return res
    .status(200)
    .json(
      new ApiResponses(200, userStats, "core-member stats fetched successfully")
    );
});

const getUsersReferredByCoreMember = asyncHandler(async (req, res) => {
  const coreMemberId = req.params.id || req.user?.id;
  const coreMember = await User.findById(coreMemberId);

  if (!coreMember || coreMember.role !== roles[1]) {
    throw new ApiErrors(404, "Core member not found");
  }

  const getAllReferredUsers = async (referrerId, visited = new Set()) => {
    if (visited.has(referrerId.toString())) return []; // Avoid infinite loops

    visited.add(referrerId.toString()); // Mark ID as visited

    const referredUsers = await User.find({ referBy: referrerId }).select(
      "fname lname email mobile region state referBy createdAt"
    );

    if (!referredUsers.length) return [];

    let allUsers = [...referredUsers];

    for (let user of referredUsers) {
      const nestedUsers = await getAllReferredUsers(user._id, visited);
      allUsers = [...allUsers, ...nestedUsers];
    }

    return allUsers;
  };

  const allReferredUsers = await getAllReferredUsers(coreMemberId);

  if (!allReferredUsers.length) {
    return res
      .status(200)
      .json(new ApiResponses(200, [], "No users referred by this core member"));
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        allReferredUsers,
        "Users referred by core member fetched successfully"
      )
    );
});



const getHighestPayingReferredUser = asyncHandler(async (req, res) => {
  const coreMemberId = req.params.id || req.user?.id;

  const coreMember = await User.findById(coreMemberId);
  if (!coreMember || coreMember.role !== roles[1]) {
    throw new ApiErrors(404, "Core member not found");
  }

  const highestPayingUsers = await User.find({
    referBy: coreMemberId,
    totalPaidAmount: { $gt: 0 },
  })
    .select("fname lname email mobile totalPaidAmount")
    .sort({ totalPaidAmount: -1 });

  if (!highestPayingUsers || highestPayingUsers.length === 0) {
    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {},
          "No paying users referred by this core member"
        )
      );
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        highestPayingUsers,
        "List of referred users by total paid amount fetched successfully"
      )
    );
});

const getAllCommunitiesOfCoreMember = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user?.id;

  const user = await User.findById(userId);

  if (!user || user.role !== roles[1]) {
    throw new ApiErrors(404, "Core member not found or not authorized");
  }

  const communities = await Community.find({ coreMembers: userId }).populate({
    path: "coreMembers",
    select: "fname lname _id",
  });

  if (!communities || communities.length === 0) {
    return res
      .status(200)
      .json(
        new ApiResponses(200, [], "No communities found for this core member")
      );
  }

  const data = communities.map((community) => ({
    ...community.toObject(),
    coreMembers: community.coreMembers.map((member) => ({
      id: member._id,
      name: `${member.fname} ${member.lname}`,
    })),
  }));

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        data,
        "Communities fetched successfully for core member"
      )
    );
});

export {
  addCoreMember,
  getAllCoreMembers,
  searchCoreMembers,
  getCorememberStats,
  getUsersReferredByCoreMember,
  getHighestPayingReferredUser,
  getAllCommunitiesOfCoreMember,
};
