import ApiResponses from "../utils/ApiResponses.js";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import { Community } from "../models/community.model.js";
import { User } from "../models/user.model.js";
import { roles } from "../constants.js";
import path from "path";
import fs from "fs";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");

const createCommunity = asyncHandler(async (req, res) => {
  const { communityName, coreMemberIds, regionName } = req.body;
  const image = req.files?.image?.[0];

  const requiredFields = [communityName, coreMemberIds, regionName];
  const isFieldMissing = requiredFields.some(
    (field) => !field || (Array.isArray(field) && field.length === 0)
  );

  if (isFieldMissing) {
    throw new ApiErrors(400, "Please fill in all the required fields");
  }

  if (!image) {
    throw new ApiErrors(400, "Community image file is required");
  }

  const communityImage = `community/${path.basename(image.path)}`;

  try {
    const coreMembers = await User.find({
      _id: { $in: coreMemberIds },
      role: roles[1],
    });
    const validCoreMemberIds = coreMembers.map((member) =>
      member._id.toString()
    );
    const invalidCoreMemberIds = coreMemberIds.filter(
      (id) => !validCoreMemberIds.includes(id)
    );

    if (invalidCoreMemberIds.length > 0) {
      throw new ApiErrors(
        400,
        `Invalid core member IDs: ${invalidCoreMemberIds.join(", ")}`
      );
    }

    const community = new Community({
      communityName,
      image: communityImage,
      coreMembers: validCoreMemberIds,
      region: regionName,
    });

    await community.save();
    return res
      .status(201)
      .json(new ApiResponses(201, community, "Community added successfully"));
  } catch (error) {
    if (image && image.path) {
      const imagePath = path.join(
        baseImageDir,
        "community",
        path.basename(image.path)
      );
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Failed to delete image:", err);
        }
      });
    }
    console.log(error);
    throw error;
  }
});

const updateCommunity = asyncHandler(async (req, res) => {
  const { communityName, coreMemberIds, regionName } = req.body;
  const communityId = req.params.id;
  const image = req.files?.image?.[0];

  try {
    const community = await Community.findById(communityId);
    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }

    if (coreMemberIds) {
      const coreMembers = await User.find({
        _id: { $in: coreMemberIds },
        role: roles[1],
      });
      const validCoreMemberIds = coreMembers.map((member) =>
        member._id.toString()
      );
      const invalidCoreMemberIds = coreMemberIds.filter(
        (id) => !validCoreMemberIds.includes(id)
      );

      if (invalidCoreMemberIds.length > 0) {
        throw new ApiErrors(
          400,
          `Invalid core member IDs: ${invalidCoreMemberIds.join(", ")}`
        );
      }

      community.coreMembers = validCoreMemberIds;
    }

    community.communityName = communityName || community.communityName;
    community.region = regionName || community.region;

    if (image) {
      const oldImagePath = path.join(baseImageDir, community.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
      const updatedImage = `community/${path.basename(image.path)}`;
      community.image = updatedImage;
    }

    await community.save();
    return res
      .status(200)
      .json(new ApiResponses(200, community, "Community updated successfully"));
  } catch (error) {
    if (image && image.path) {
      const uploadedImagePath = path.join(
        baseImageDir,
        "community",
        path.basename(image.path)
      );
     
      if (fs.existsSync(uploadedImagePath)) {
        fs.unlinkSync(uploadedImagePath);
        console.log("Uploaded image deleted due to error");
      }
    }
    console.log(error);
    throw error;
  }
});

const deleteCommunity = asyncHandler(async (req, res) => {
  const communityId = req.params.id;

  try {
    const community = await Community.findById(communityId);
    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }

    const imagePath = path.join(baseImageDir, community.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Community.findByIdAndDelete(communityId);
    return res
      .status(200)
      .json(new ApiResponses(200, {}, "Community deleted successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to delete community");
  }
});

const getUserIdsByCommunityId = asyncHandler(async (req, res) => {
  const communityId = req.params.id;

  try {
    if (!communityId) {
      throw new ApiErrors(400, "Community ID is required");
    }

    const community = await Community.findById(communityId).populate({
      path: "users",
      select: "fname lname _id email mobile referBy createdAt avatar region role",
      populate: [
        {
          path: "referBy",
          select: "fname lname",
        },
        {
          path: "profile",
          select: "professionalDetails.companyName professionalDetails.classification professionalDetails.myBusiness professionalDetails.industry addresses.address.city addresses.address.state addresses.address.country",
        },
      ],
    });

    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }

    const userDetails = community.users.map((user) => ({
      id: user._id,
      fname: user.fname,
      lname: user.lname,
      role : user.role,
      avatar: user.avatar,
      classification: user.profile?.professionalDetails?.classification || "N/A",
      companyName: user.profile?.professionalDetails?.companyName || "N/A",
      industry: user.profile?.professionalDetails?.industry || "N/A", // New field
      Business: user.profile?.professionalDetails?.myBusiness|| "N/A", // New field
      city: user.profile?.addresses?.address?.city || "N/A", // New field
      state: user.profile?.addresses?.address?.state || "N/A", // New field
      pincode: user.profile?.addresses?.address?.pincode|| "N/A", // New field
      country: user.profile?.addresses?.address?.country || "N/A", // New field
      profile: user.profile && user.profile._id ? user.profile._id.toString() : null,
      region: user.region,
      email: user.email,
      contactNo: user.mobile,
      referredBy: user.referBy
        ? `${user.referBy.fname} ${user.referBy.lname}`
        : null,
      joiningDate: user.createdAt,
    }));

    return res
      .status(200)
      .json(
        new ApiResponses(200, userDetails, "User details fetched successfully")
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to fetch user details by community");
  }
});

const searchUsersInCommunity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { keyword } = req.query;

  try {
    if (!id) {
      throw new ApiErrors(400, "Community ID is required");
    }

    const community = await Community.findById(id).populate({
      path: "users",
      select: "fname lname _id email mobile referBy createdAt avatar region",
      populate: [
        {
          path: "referBy",
          select: "fname lname",
        },
        {
          path: "profile",
          select: "professionalDetails.companyName professionalDetails.classification professionalDetails.industry addresses.address.city addresses.address.state",
        },
      ],
    });

    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }

    let users = community.users.map((user) => ({
      id: user._id,
      fname: user.fname,
      lname: user.lname,
      avatar: user.avatar,
      classification: user.profile?.professionalDetails?.classification || "N/A",
      companyName: user.profile?.professionalDetails?.companyName || "N/A",
      industry: user.profile?.professionalDetails?.industry || "N/A",
      city: user.profile?.addresses?.address?.city || "N/A",
      state: user.profile?.addresses?.address?.state || "N/A",
      region: user.region || "N/A",
      email: user.email,
      contactNo: user.mobile,
      referredBy: user.referBy
        ? `${user.referBy.fname} ${user.referBy.lname}`
        : null,
      joiningDate: user.createdAt,
    }));

    if (keyword) {
      const searchTerm = keyword.toLowerCase();
      users = users.filter((user) => {
        // Search across all string fields
        const matchesStringFields = Object.entries(user).some(([key, value]) => {
          if (key === "joiningDate") return false; // Handle joiningDate separately
          return (
            value &&
            typeof value === "string" &&
            value.toLowerCase().includes(searchTerm)
          );
        });

        // Search in joiningDate (if it exists)
        const matchesJoiningDate =
          user.joiningDate &&
          new Date(user.joiningDate).toISOString().toLowerCase().includes(searchTerm);

        return matchesStringFields || matchesJoiningDate;
      });
    }

    if (users.length === 0) {
      return res
        .status(200)
        .json(new ApiResponses(200, [], "No matching users found"));
    }

    return res
      .status(200)
      .json(new ApiResponses(200, users, "Users fetched successfully"));
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to search users in community");
  }
});

const getAllCommunities = asyncHandler(async (req, res) => {
  try {
    const communities = await Community.find()
      .populate({
        path: "users",
        select: "fname lname _id",
      })
      .populate({
        path: "coreMembers",
        select: "fname lname _id",
      });

    if (!communities || communities.length === 0) {
      return res
        .status(200)
        .json(new ApiResponses(200, communities, "No communities found"));
    }

    const data = communities.map((community) => ({
      ...community.toObject(),
      coreMembers: community.coreMembers.map((member) => ({
        id: member._id,
        name: `${member.fname} ${member.lname}`,
      })),
      users: community.users.map((user) => ({
        id: user._id,
        name: `${user.fname} ${user.lname}`,
      })),
    }));

    return res
      .status(200)
      .json(new ApiResponses(200, data, "Communities fetched successfully"));
  } catch (error) {
    console.log("Error:", error);
    throw new ApiErrors(500, "Failed to fetch communities");
  }
});

const removeUserFromCommunity = asyncHandler(async (req, res) => {
  const { communityId, userId } = req.body;

  try {
    if (!communityId || !userId) {
      throw new ApiErrors(400, "Both communityId and userId are required");
    }

    const community = await Community.findById(communityId);
    if (!community) {
      throw new ApiErrors(404, "Community not found");
    }

    const userIndex = community.users.indexOf(userId);
    if (userIndex === -1) {
      throw new ApiErrors(400, "User not found in this community");
    }

    community.users.splice(userIndex, 1);
    await community.save();

    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          community,
          "User removed from community successfully"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiErrors(500, "Failed to remove user from community");
  }
});

export {
  createCommunity,
  updateCommunity,
  deleteCommunity,
  getUserIdsByCommunityId,
  searchUsersInCommunity,
  getAllCommunities,
  removeUserFromCommunity,
};