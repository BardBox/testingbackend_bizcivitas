import { MembershipBenefit } from "../models/membershipbenefits.js";
import { User } from "../models/user.model.js";
import asyncHandler from "express-async-handler";

// Admin: Create a new membership benefit
export const createMembershipBenefit = asyncHandler(async (req, res) => {
  const { membershipType, content } = req.body;
  const adminId = req.user._id;

  if (!membershipType || !content || !Array.isArray(content) || content.length === 0) {
    return res.status(400).json({ message: "Membership type and non-empty content array are required" });
  }

  const benefit = await MembershipBenefit.create({
    membershipType,
    content,
    createdBy: adminId,
  });

  res.status(201).json({
    success: true,
    data: benefit,
    message: "Membership benefit created successfully",
  });
});

// Admin: Update a membership benefit
export const updateMembershipBenefit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { membershipType, content } = req.body;
  const adminId = req.user._id;

  const benefit = await MembershipBenefit.findById(id);
  if (!benefit) {
    return res.status(404).json({ message: "Membership benefit not found" });
  }

  if (membershipType) benefit.membershipType = membershipType;
  if (content && Array.isArray(content) && content.length > 0) benefit.content = content;
  benefit.updatedBy = adminId;

  await benefit.save();

  res.status(200).json({
    success: true,
    data: benefit,
    message: "Membership benefit updated successfully",
  });
});

// Admin: Delete a membership benefit
export const deleteMembershipBenefit = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const benefit = await MembershipBenefit.findByIdAndDelete(id);
  if (!benefit) {
    return res.status(404).json({ message: "Membership benefit not found" });
  }

  res.status(200).json({
    success: true,
    message: "Membership benefit deleted successfully",
  });
});

// Admin: Get all membership benefits
export const getAllMembershipBenefits = asyncHandler(async (req, res) => {
  const benefits = await MembershipBenefit.find().populate("createdBy updatedBy", "fname email");

  res.status(200).json({
    success: true,
    data: benefits,
  });
});

// User: Get benefits by membership type
export const getUserMembershipBenefits = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select("membershipType");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const benefits = await MembershipBenefit.find({
    membershipType: user.membershipType,
    isActive: true,
  });

  res.status(200).json({
    success: true,
    data: benefits,
  });
});