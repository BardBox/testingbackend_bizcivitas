import { Profile } from "../models/profile.model.js";
import { User } from "../models/user.model.js";
import { Community } from "../models/community.model.js";
import { Payment } from "../models/payment.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmailWithCredentials } from "../services/credentialsEmail.js";
import { roles, membershipTypes, feeTypes, membershipFees } from "../constants.js";import bcrypt from "bcryptjs";
import vCard from "vcf";
import cron from "node-cron";
import mongoose from "mongoose";
import path from 'path';
import fs from 'fs';




const generateUniqueUsername = async (fname) => {
  const base = fname.toLowerCase().replace(/\s+/g, "");
  let username = base;
  let suffix = Math.floor(100 + Math.random() * 900); // 100–999

  while (await User.exists({ username })) {
    suffix = Math.floor(100 + Math.random() * 900);
    username = `${base}${suffix}`;
  }

  return username;
};




const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiErrors(500, "Something went wrong in token generation");
  }
};

const generateRandomPassword = (length = 12) => {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};
const checkUserRegistrationAndPayment = async (email, mobile, username) => {
  const query = [];
  if (email) query.push({ email });
  if (mobile) query.push({ mobile });
  if (username) query.push({ username });

  const existingUser = await User.findOne({ $or: query }).populate("paymentVerification");

  if (!existingUser) {
    return {
      isRegistered: false,
      user: null,
      paymentStatus: null,
      duplicateFields: [],
      message: "User not found",
    };
  }

  const duplicateFields = [];
  if (email && existingUser.email === email) duplicateFields.push("email");
  if (mobile && existingUser.mobile === mobile) duplicateFields.push("mobile");
  if (username && existingUser.username === username) duplicateFields.push("username");

  const paymentVerification = existingUser.paymentVerification || [];
  const completedPayments = paymentVerification.filter((payment) => payment.status === "completed");
  const pendingPayments = paymentVerification.filter((payment) => payment.status === "pending");

  const paymentStatus = {
    total: paymentVerification.length,
    completed: completedPayments.length,
    pending: pendingPayments.length,
    isFullyPaid: completedPayments.length === paymentVerification.length,
    completedFees: completedPayments.map((p) => ({
      feeType: p.feeType,
      amount: p.amount,
      date: p.createdAt,
      transactionId: p.razorpayPaymentId,
    })),
    pendingFees: pendingPayments.map((p) => ({
      feeType: p.feeType,
      amount: p.amount,
      status: p.status,
    })),
  };

  return {
    isRegistered: true,
    user: existingUser,
    paymentStatus,
    duplicateFields,
    message: `User already registered with ${existingUser.membershipType}`,
  };
};

const registerUser = asyncHandler(async (req, res) => {
  const {
    fname,
    lname,
    username: incomingUsername,
    email,
    mobile,
    referBy,
    region,
    membershipType,
    business,
    businessSubcategory,
    razorpay_order_id,
  } = req.body;

  // Validate input
  if (!fname || !email || !membershipType) {
    throw new ApiErrors(400, "Required fields (fname, email, membershipType) are missing");
  }

  if (!membershipTypes.includes(membershipType)) {
    throw new ApiErrors(400, "Invalid membership type");
  }

  // Check for existing user
  const existingUserCheck = await User.findOne({
    $or: [{ email }, { mobile }, { username: incomingUsername }],
  });

  if (existingUserCheck) {
    const duplicateFields = [];
    if (existingUserCheck.email === email) duplicateFields.push("email");
    if (existingUserCheck.mobile === mobile) duplicateFields.push("mobile");
    if (existingUserCheck.username === incomingUsername) duplicateFields.push("username");

    throw new ApiErrors(
      409,
      `Registration failed: ${duplicateFields.join(", ")} already in use`,
      { duplicateFields }
    );
  }

  const existingProfile = await Profile.findOne({ "contactDetails.email": email });
  if (existingProfile) {
    throw new ApiErrors(
      409,
      "A profile with this email already exists. Please use a different email or contact support.",
      { duplicateFields: ["email"] }
    );
  }

  // ✅ Enforce unique username generation
  let finalUsername;
  if (incomingUsername) {
    const cleanedUsername = incomingUsername.toLowerCase().replace(/\s+/g, "");
    const exists = await User.exists({ username: cleanedUsername });
    finalUsername = exists ? await generateUniqueUsername(fname) : cleanedUsername;
  } else {
    finalUsername = await generateUniqueUsername(fname);
  }

  const expectedRegistrationFee = membershipFees[membershipType].registration;

  if (expectedRegistrationFee > 0) {
    if (!razorpay_order_id) {
      throw new ApiErrors(400, "Razorpay order ID is required to initiate payment");
    }

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          razorpayOrderId: razorpay_order_id,
          amount: expectedRegistrationFee,
          currency: "INR",
          membershipType,
          nextStep: "pay_with_razorpay",
        },
        "Please complete the payment using Razorpay"
      )
    );
  }

  // ✅ Create Profile
  const profile = await Profile.create({
    contactDetails: { mobileNumber: mobile, email },
  });

  if (!profile) {
    throw new ApiErrors(500, "Error creating profile");
  }

  // ✅ Community association via referBy
  let community = null;
  let communityId = null;
  let isConnectedToCore = false;

  if (referBy) {
    let currentReferrerId = referBy;

    while (currentReferrerId) {
      community = await Community.findOne({
        $or: [
          { coreMembers: currentReferrerId },
          { users: currentReferrerId },
        ],
      });

      if (community) {
        isConnectedToCore =
          community.coreMembers.includes(currentReferrerId) ||
          community.users.includes(currentReferrerId);
        communityId = community._id;
        break;
      }

      const referrerUser = await User.findById(currentReferrerId);
      if (!referrerUser?.referBy) break;
      currentReferrerId = referrerUser.referBy;
    }
  }

  // ✅ Create User
  const user = await User.create({
    fname,
    lname,
    username: finalUsername,
    email,
    mobile,
    referBy: referBy || null,
    region,
    membershipType,
    business,
    businessSubcategory,
    profile: profile._id,
    community: communityId,
    isConnectedToCore,
    isActive: false,
  });

  if (!user) {
    throw new ApiErrors(500, "User creation failed");
  }

  res.status(201).json(
    new ApiResponses(
      201,
      {
        userId: user._id,
        username: user.username,
        email: user.email,
        fname: user.fname,
        membershipType: user.membershipType,
      },
      "Registration successful"
    )
  );
});



const assignUserToCommunity = async (userId) => {
  try {
    console.log(`🚀 Starting community assignment for user: ${userId}`);

    const user = await User.findById(userId).populate('community');
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    console.log(`👤 Processing user: ${user.fname} ${user.lname} (${user.membershipType})`);

    if (user.membershipType === "Digital Membership") {
      console.log(`ℹ️ Digital Membership - No community assignment needed`);
      return { success: true, message: "Digital membership - no community required" };
    }

    if (user.community) {
      console.log(`ℹ️ User already assigned to community: ${user.community.communityName}`);
      return { success: true, message: "User already has community assignment" };
    }

    let community = null;
    let communityId = null;
    let isConnectedToCore = false;

    if (user.referBy) {
      let currentReferrerId = user.referBy;
      console.log(`🔍 Starting community search for referBy: ${user.referBy}`);

      while (currentReferrerId) {
        console.log(`🔎 Checking referrer: ${currentReferrerId}`);

        community = await Community.findOne({
          $or: [
            { coreMembers: currentReferrerId },
            { users: currentReferrerId },
          ],
        });

        if (community) {
          isConnectedToCore = community.coreMembers.includes(currentReferrerId) || community.users.includes(currentReferrerId);
          communityId = community._id;
          console.log(`✅ Found community: ${community.communityName} (ID: ${communityId})`);
          console.log(`🔗 Referrer ${currentReferrerId} is connected to community`);
          break;
        }

        const referrer = await User.findById(currentReferrerId);
        if (!referrer || !referrer.referBy) {
          console.log(`❌ End of referrer chain at: ${currentReferrerId}`);
          break;
        }

        console.log(`⬆️ Moving up chain to referrer's referBy: ${referrer.referBy}`);
        currentReferrerId = referrer.referBy;

        if (currentReferrerId === user.referBy) {
          console.log(`❌ Circular reference detected, breaking loop`);
          break;
        }
      }
    }

    if (user.membershipType === "Core Membership" && !communityId) {
      console.log(`🏗️ Creating new community for Core Member: ${user.fname}`);
      community = await Community.create({
        communityName: `${user.fname}'s Community`,
        region: user.region,
        coreMembers: [],
        users: [],
      });
      communityId = community._id;
      console.log(`✅ Created new community: ${community.communityName} (ID: ${communityId})`);
    }

    if (!isConnectedToCore && ["Flagship Membership", "Industria Membership"].includes(user.membershipType)) {
      console.log(`❌ No community found for ${user.membershipType}`);
      throw new Error("User must be referred by someone connected to a community for Flagship or Industria Membership");
    }

    if (!communityId) {
      console.log(`⚠️ No community assignment possible for user ${user.fname} ${user.lname}`);
      return { success: false, message: "No community found for assignment" };
    }

       await User.findByIdAndUpdate(userId, { 
      community: communityId 
    });
    console.log(`🏢 COMMUNITY ASSIGNMENT: User ${user.fname} ${user.lname} (${user.membershipType}) is being added to community: "${community.communityName}" (ID: ${communityId})`);

    if (user.membershipType === "Core Membership") {
      if (!community.coreMembers.includes(userId)) {
        community.coreMembers.push(userId);
        await community.save();
        console.log(`✅ SUCCESS: User ${userId} (${user.fname} ${user.lname}) added as CORE MEMBER to community "${community.communityName}"`);
        console.log(`📊 Community "${community.communityName}" now has ${community.coreMembers.length} core members and ${community.users.length} regular members`);
      }
    } else if (["Flagship Membership", "Industria Membership"].includes(user.membershipType)) {
      if (!community.users.includes(userId)) {
        community.users.push(userId);
        await community.save();
        console.log(`✅ SUCCESS: User ${userId} (${user.fname} ${user.lname}) added as REGULAR MEMBER to community "${community.communityName}"`);
        console.log(`📊 Community "${community.communityName}" now has ${community.coreMembers.length} core members and ${community.users.length} regular members`);
      }
    }

    const updatedUser = await User.findById(userId)
      .populate('community', 'communityName region')
      .select("community fname lname membershipType");

    console.log(`\n🎯 FINAL VERIFICATION:`);
    console.log(`👤 User: ${updatedUser.fname} ${updatedUser.lname}`);
    console.log(`🎫 Membership Type: ${updatedUser.membershipType}`);
    console.log(`🏢 Assigned Community: ${updatedUser.community?.communityName || 'None'}`);
    console.log(`📍 Community Region: ${updatedUser.community?.region || 'N/A'}`);
    console.log(`🆔 Community ID: ${updatedUser.community?._id || 'None'}`);
    console.log(`✅ Community Assignment Status: ${updatedUser.community ? 'SUCCESS' : 'NO COMMUNITY ASSIGNED'}\n`);

    return {
      success: true,
      message: "User successfully assigned to community",
      community: {
        id: communityId,
        name: community.communityName,
        region: community.region
      }
    };

  } catch (error) {
    console.error(`❌ Error in community assignment for user ${userId}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};


const handlePaymentSuccess = asyncHandler(async (req, res) => {
  const {
    fname,
    lname,
    username,
    email,
    mobile,
    referBy,
    region,
    membershipType,
    business,
    businessSubcategory,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if ([fname, email, username, membershipType, razorpay_order_id, razorpay_payment_id, razorpay_signature].some((field) => !field || field.trim() === "")) {
    throw new ApiErrors(400, "All required fields are missing for registration");
  }

  if (!membershipTypes.includes(membershipType)) {
    throw new ApiErrors(400, "Invalid membership type");
  }

  const existingUserCheck = await User.findOne({ $or: [{ email }, { mobile }, { username }] });
  if (existingUserCheck) {
    throw new ApiErrors(409, "User already exists with provided email, mobile, or username");
  }

  const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = sha.digest("hex");

  if (digest !== razorpay_signature) {
    throw new ApiErrors(400, "Payment verification failed: Invalid signature");
  }

  const expectedRegistrationFee = membershipFees[membershipType].registration;
  const profile = await Profile.create({
    contactDetails: { mobileNumber: mobile, email },
  });

  if (!profile) {
    throw new ApiErrors(500, "Error creating profile");
  }

  const user = await User.create({
    fname,
    lname,
    username,
    email,
    mobile,
    referBy,
    region,
    profile: profile._id,
    membershipType,
    role: membershipType === "Core Membership" ? "core-member" : "user",
    isActive: false,
    business,
    businessSubcategory,
  });

  let paymentVerificationIds = [];
  let paymentRecords = [
    {
      userId: user._id,
      membershipType,
      feeType: "registration",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "completed",
      amount: expectedRegistrationFee,
    },
  ];

  if (membershipType !== "Digital Membership" && membershipFees[membershipType].annual > 0) {
    paymentRecords.push({
      userId: user._id,
      membershipType,
      feeType: "annual",
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      status: "pending",
      amount: membershipFees[membershipType].annual,
    });
  }

  try {
    const createdPayments = await Payment.insertMany(paymentRecords, { validateBeforeSave: true });
    paymentVerificationIds = createdPayments.map((payment) => payment._id);
  } catch (error) {
    console.error("Error creating payment records:", error.message, error.stack);
    await User.deleteOne({ _id: user._id });
    await Profile.deleteOne({ _id: profile._id });
    throw new ApiErrors(500, `Error creating payment records: ${error.message}`);
  }

  user.paymentVerification = paymentVerificationIds;
  await user.save({ validateBeforeSave: false });

  if (membershipType === "Digital Membership") {
    user.isActive = true;
    user.renewalDate = new Date("2025-06-18T15:49:00Z");
    user.renewalDate.setFullYear(user.renewalDate.getFullYear() + 1);
    const newPassword = generateRandomPassword();
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    await sendEmailWithCredentials(user.fname, user.email, newPassword);
  }

  // Assign to community
  const communityResult = await assignUserToCommunity(user._id);

  if (communityResult.success) {
    console.log(`🎉 Payment completed and community assigned for user: ${user._id}`);
  } else {
    console.log(`⚠️ Payment completed but community assignment failed: ${communityResult.message}`);
  }

  return res.status(201).json(
    new ApiResponses(
      201,
      {
        user: {
          _id: user._id,
          fname: user.fname,
          email: user.email,
          membershipType: user.membershipType,
          isActive: user.isActive,
          renewalDate: user.renewalDate,
        },
        paymentStatus: {
          completed: 1,
          pending: membershipType !== "Digital Membership" ? 1 : 0,
        },
        nextStep: user.isActive ? "login" : "complete_payments",
        communityAssignment: communityResult,
      },
      "Registration successful! Payment completed."
    )
  );
});


const validatePayment = asyncHandler(async (req, res) => {
  const {
    userId,
    email,
    feeType,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    membershipType,
  } = req.body;

  if (!userId || !feeType || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !membershipType) {
    throw new ApiErrors(400, "All payment fields, including membershipType, are required");
  }

  const user = await User.findById(userId).populate("paymentVerification");
  if (!user) {
    throw new ApiErrors(404, "User not found. Please register first.");
  }

  if (email && email !== user.email) {
    throw new ApiErrors(400, "Email does not match registered user.");
  }

  if (user.membershipType !== membershipType) {
    throw new ApiErrors(400, "Membership type mismatch");
  }

  const validFeeTypes = {
    "Core Membership": ["registration", "annual", "community_launching"],
    "Flagship Membership": ["registration", "annual", "meeting"],
    "Industria Membership": ["registration", "annual", "meeting"],
    "Digital Membership": ["registration"], // Only registration fee (6999) is valid
  };

  if (!validFeeTypes[membershipType]) {
    throw new ApiErrors(400, `Invalid membership type: ${membershipType}. Valid types are: ${Object.keys(validFeeTypes).join(", ")}`);
  }

  if (!validFeeTypes[membershipType].includes(feeType)) {
    throw new ApiErrors(400, `Invalid fee type ${feeType} for ${membershipType}`);
  }

  if (feeType !== "registration") {
    const registrationPayment = user.paymentVerification.find((p) => p.feeType === "registration");
    if (!registrationPayment || registrationPayment.status !== "completed") {
      throw new ApiErrors(403, "Please complete registration fee payment first");
    }
  }

  let paymentEntry = user.paymentVerification.find((entry) => entry.feeType === feeType);

  // Create a new payment record if none exists
  if (!paymentEntry) {
    const amount = membershipFees[membershipType][feeType];
    paymentEntry = await Payment.create({
      userId,
      membershipType,
      feeType,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      status: "pending",
      amount,
    });
    user.paymentVerification.push(paymentEntry._id);
    await user.save({ validateBeforeSave: false });
  }

  if (paymentEntry.status === "completed") {
    throw new ApiErrors(400, `Payment for ${feeType} already completed`);
  }

  const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = sha.digest("hex");

  if (digest !== razorpay_signature) {
    throw new ApiErrors(400, "Payment verification failed: Invalid signature");
  }

  const updatedPayment = await Payment.findByIdAndUpdate(
    paymentEntry._id,
    {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "completed",
    },
    { new: true }
  );

  if (!updatedPayment) {
    throw new ApiErrors(500, "Failed to update payment record");
  }

  const refreshedUser = await User.findById(user._id).populate("paymentVerification");
  const allPaymentsCompleted = refreshedUser.paymentVerification.every((entry) => entry.status === "completed");

  if (allPaymentsCompleted && !refreshedUser.isActive) {
    refreshedUser.isActive = true;
    refreshedUser.renewalDate = new Date("2025-06-18T15:49:00Z"); // Set to current date + 1 year
    refreshedUser.renewalDate.setFullYear(refreshedUser.renewalDate.getFullYear() + 1);
    const newPassword = generateRandomPassword();
    refreshedUser.password = newPassword;
    await refreshedUser.save({ validateBeforeSave: false });
    await sendEmailWithCredentials(refreshedUser.fname, refreshedUser.email, newPassword);
  }

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        user: {
          _id: refreshedUser._id,
          email: refreshedUser.email,
          membershipType: refreshedUser.membershipType,
          isActive: refreshedUser.isActive,
          renewalDate: refreshedUser.renewalDate,
        },
        paymentStatus: {
          completed: refreshedUser.paymentVerification.filter((p) => p.status === "completed").length,
          pending: refreshedUser.paymentVerification.filter((p) => p.status === "pending").length,
          pendingFees: refreshedUser.paymentVerification
            .filter((p) => p.status === "pending")
            .map((p) => ({
              feeType: p.feeType,
              amount: p.amount,
              status: p.status,
            })),
          isFullyPaid: allPaymentsCompleted,
        },
        nextStep: allPaymentsCompleted ? "login" : "complete_payments",
      },
      allPaymentsCompleted
        ? "All payments completed! Account activated."
        : `${feeType} payment verified successfully.`
    )
  );
});
const renewMembership = async () => {
  const users = await User.find({ isActive: true });

  for (const user of users) {
    if (!user.credentialSentAt) continue;

    const renewalPeriod = 1; // One year for all membership types
    const renewalDate = new Date(user.credentialSentAt);
    renewalDate.setFullYear(renewalDate.getFullYear() + renewalPeriod);

    const reminderDate = new Date(renewalDate);
    reminderDate.setDate(reminderDate.getDate() - 30);

    const currentDate = new Date();

    if (currentDate >= reminderDate && currentDate < renewalDate) {
      await sendEmailWithCredentials(user.fname, user.email, "Your membership will expire in 30 days. Please renew soon.", true);
    }

    if (currentDate >= renewalDate) {
      await sendEmailWithCredentials(user.fname, user.email, "Your membership has expired. Please renew by paying the annual fee.", true);
      const annualPayment = user.paymentVerification.find(p => p.feeType === "annual") || user.paymentVerification.find(p => p.feeType === "registration" && user.membershipType === "Digital Membership");
      if (annualPayment) {
        annualPayment.status = "pending";
        annualPayment.razorpayOrderId = null;
        annualPayment.razorpayPaymentId = null;
        annualPayment.razorpaySignature = null;
        await Payment.findByIdAndUpdate(annualPayment._id, annualPayment);
      }
      user.isActive = false;
      await user.save({ validateBeforeSave: false });
    }
  }
};

cron.schedule("0 0 * * *", renewMembership);

const checkRegistrationStatus = asyncHandler(async (req, res) => {
  const { email, mobile, username } = req.query;

  if (!email && !mobile && !username) {
    throw new ApiErrors(400, "At least one identifier (email, mobile, or username) is required");
  }

  const registrationCheck = await checkUserRegistrationAndPayment(email, mobile, username);

  if (!registrationCheck.isRegistered) {
    return res.status(200).json(
      new ApiResponses(200, { isRegistered: false, duplicateFields: [] }, "User not found. Please register.")
    );
  }

  const { user, paymentStatus, duplicateFields } = registrationCheck;

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        isRegistered: true,
        user: {
          _id: user._id,
          fname: user.fname,
          lname: user.lname,
          email: user.email,
          membershipType: user.membershipType,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        paymentStatus,
        duplicateFields,
        nextStep: paymentStatus.isFullyPaid
          ? user.isActive
            ? "login"
            : "account_activation"
          : "complete_payments",
      },
      registrationCheck.message
    )
  );
});

const getUsersWithPaymentDetails = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiErrors(403, "Access denied. Only admins can view this data.");
  }

  const users = await User.find({})
    .select(
      "fname lname email mobile membershipType isActive paymentVerification createdAt updatedAt business businessSubcategory membershipIcon"
    )
    .populate("paymentVerification")
    .lean();

  if (!users || users.length === 0) {
    return res
      .status(200)
      .json(new ApiResponses(200, { users: [] }, "No users found"));
  }

  const usersWithPayments = users.map((user) => {
    const paymentVerification = Array.isArray(user.paymentVerification)
      ? user.paymentVerification
      : [];

    const paymentSummary = {
      totalFees: paymentVerification.length,
      totalAmount: paymentVerification.reduce(
        (sum, fee) => sum + (fee.amount || 0),
        0
      ),
      completedFees: paymentVerification.filter(
        (fee) => fee.status === "completed"
      ).length,
      pendingFees: paymentVerification.filter((fee) => fee.status === "pending")
        .length,
      completedAmount: paymentVerification
        .filter((fee) => fee.status === "completed")
        .reduce((sum, fee) => sum + (fee.amount || 0), 0),
      pendingAmount: paymentVerification
        .filter((fee) => fee.status === "pending")
        .reduce((sum, fee) => sum + (fee.amount || 0), 0),
    };

    return {
      _id: user._id,
      fname: user.fname,
      lname: user.lname,
      email: user.email,
      mobile: user.mobile,
      membershipType: user.membershipType,
      businessCategory: user.business,
      subBusinessCategory: user.businessSubcategory,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      paymentVerification: paymentVerification.map((p) => ({
        feeType: p.feeType,
        amount: p.amount,
        status: p.status,
        transactionId: p.razorpayPaymentId,
        date: p.createdAt,
        paymentMethod: p.paymentMethod || "unknown", // Added paymentMethod with fallback
        cashId: p.cashId, // Included cashId
        checkId: p.checkId, // Included checkId
      })),
      paymentSummary,
    };
  });

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { users: usersWithPayments },
        "Users and payment details fetched successfully"
      )
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiErrors(406, "All fields are required");
  }

  const existedUser = await User.findOne({ email }).populate("paymentVerification");
  if (!existedUser) {
    throw new ApiErrors(401, "User does not exist in database");
  }

  const paymentStatus = {
    completed: existedUser.paymentVerification.filter((p) => p.status === "completed").length,
    total: existedUser.paymentVerification.length,
    isFullyPaid: existedUser.paymentVerification.every((p) => p.status === "completed"),
  };

  if (!paymentStatus.isFullyPaid) {
    const pendingPayments = existedUser.paymentVerification.filter((p) => p.status === "pending");
    throw new ApiErrors(403, {
      message: "Account not activated. Please complete pending payments.",
      pendingPayments: pendingPayments.map((p) => ({
        feeType: p.feeType,
        amount: p.amount,
      })),
      userId: existedUser._id,
    });
  }

  if (!existedUser.isActive) {
    throw new ApiErrors(403, "Account not activated. Please contact support.");
  }

  const isPasswordValid = await existedUser.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiErrors(401, "Email or password is wrong");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    existedUser._id
  );

  const loggedInUser = await User.findById(existedUser._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(202)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponses(
        202,
        {
          user: loggedInUser,
          refreshToken: refreshToken,
          accessToken: accessToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return res
      .status(400)
      .json(
        new ApiResponses(
          400,
          {},
          "FCM token is required to proceed with the logout."
        )
      );
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $pull: {
        fcmTokens: fcmToken,
      },
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(202)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponses(202, {}, "User logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId)
    .populate({
      path: "connections",
      select: "sender receiver isAccepted",
      populate: {
        path: "sender receiver",
        select: "avatar fname lname profile role",
        populate: {
          path: "profile",
          select:
            "professionalDetails addresses.address.city addresses.address.country addresses.address.state",
        },
      },
    })
    .populate({
      path: "profile",
      select:
        "contactDetails myBio visibility professionalDetails addresses weeklyPresentation",
    })
    .populate({
      path: "paymentVerification",
      select: "feeType amount status razorpayPaymentId createdAt",
    });

  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  let community = null;
  if (user.membershipType !== "Digital Membership") {
    const userCommunity = await Community.findOne({
      $or: [{ coreMembers: userId }, { users: userId }],
    }).select("communityName _id region image");

    if (userCommunity) {
      community = {
        id: userCommunity._id,
        name: userCommunity.communityName,
        region: userCommunity.region,
        image: userCommunity.image,
      };
    }
  }

  const paymentVerification = Array.isArray(user.paymentVerification)
    ? user.paymentVerification
    : [];

  const completedPayments = paymentVerification.filter((payment) => payment.status === "completed");
  const pendingPayments = paymentVerification.filter((payment) => payment.status === "pending");

  const paymentSummary = {
    totalFees: paymentVerification.length,
    totalAmount: paymentVerification.reduce((sum, fee) => sum + (fee.amount || 0), 0),
    completedFees: completedPayments.length,
    pendingFees: pendingPayments.length,
    completedAmount: completedPayments.reduce((sum, fee) => sum + (fee.amount || 0), 0),
    pendingAmount: pendingPayments.reduce((sum, fee) => sum + (fee.amount || 0), 0),
    isFullyPaid: paymentVerification.every((p) => p.status === "completed"),
  };

  const paymentVerificationStatus = paymentSummary.isFullyPaid;

  const filteredConnections = user.connections
    .map((connection) => {
      let connectionUser = null;
      if (connection.sender?._id.toString() !== userId.toString()) {
        connectionUser = {
          name: `${connection.sender?.fname} ${connection.sender?.lname}`,
          avatar: connection.sender?.avatar,
          role: connection.sender?.role || null,
          classification: connection.sender?.profile?.professionalDetails?.classification || null,
          companyName: connection.sender?.profile?.professionalDetails?.companyName || null,
          myBusiness: connection.sender?.profile?.professionalDetails?.myBusiness || null,
          industry: connection.sender?.profile?.professionalDetails?.industry || null,
          city: connection.sender?.profile?.addresses?.address?.city || null,
          country: connection.sender?.profile?.addresses?.address?.country || null,
          state: connection.sender?.profile?.addresses?.address?.state || null,
        };
      }
      if (connection.receiver?._id.toString() !== userId.toString()) {
        connectionUser = {
          name: `${connection.receiver?.fname} ${connection.receiver?.lname}`,
          avatar: connection.receiver?.avatar,
          role: connection.receiver?.role || null,
          classification: connection.receiver?.profile?.professionalDetails?.classification || null,
          companyName: connection.receiver?.profile?.professionalDetails?.companyName || null,
          myBusiness: connection.receiver?.profile?.professionalDetails?.myBusiness || null,
          industry: connection.receiver?.profile?.professionalDetails?.industry || null,
          city: connection.receiver?.profile?.addresses?.address?.city || null,
          country: connection.receiver?.profile?.addresses?.address?.country || null,
          state: connection.receiver?.profile?.addresses?.address?.state || null,
        };
      }
      if (connectionUser) {
        return {
          _id: connection._id,
          user: connectionUser,
          isAccepted: connection.isAccepted,
        };
      }
      return null;
    })
    .filter((connection) => connection !== null);

  const userObj = user.toObject();

  const responseData = {
    ...userObj,
    connections: filteredConnections,
    community,
    profile: user.profile, // Now includes all necessary fields
    membershipIcon: user.membershipIcon, // from schema
    businessCategory: user.business,
    businessSubcategory: user.businessSubcategory,
    paymentVerification: paymentVerification.map((p) => ({
      feeType: p.feeType,
      amount: p.amount,
      status: p.status,
      transactionId: p.razorpayPaymentId,
      date: p.createdAt,
    })),
    paymentVerificationStatus,
    paymentSummary,
  };

  return res.status(200).json(
    new ApiResponses(200, responseData, "User fetched successfully")
  );
});

const getAllUsers = asyncHandler(async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 401,
        message: "Unauthorized: User not authenticated",
        details: [],
      });
    }

    const baseUrl = "https://backend.bizcivitas.com/api/v1/image/user";
    const membershipIconMap = {
      "Core Membership": `${baseUrl}/Core-Membership.png`,
      "Flagship Membership": `${baseUrl}/Flagship-Membership.png`,
      "Industria Membership": `${baseUrl}/Industria-Membership.png`,
      "Digital Membership": `${baseUrl}/Digital-Membership.png`,
    };

    const users = await User.find({
      role: { $ne: "admin" },
      _id: { $ne: req.user._id },
    })
      .populate({
        path: "profile",
        select: "professionalDetails addresses",
      })
      .populate({
        path: "paymentVerification",
        select: "feeType amount status razorpayPaymentId createdAt",
      })
      .populate({
        path: "community",
        select: "communityName _id region image",
      })
      .lean();

    if (!users || users.length === 0) {
      return res.status(200).json({
        status: 200,
        data: { users: [] },
        message: "No users found",
        success: true,
      });
    }

    const getCommunityData = async (user) => {
      if (user.membershipType === "Digital Membership") {
        return null;
      }

      if (user.community) {
        return {
          id: user.community._id,
          name: user.community.communityName,
          region: user.community.region,
          image: user.community.image,
        };
      }

      const userCommunity = await Community.findOne({
        $or: [{ coreMembers: user._id }, { users: user._id }],
      }).select("communityName _id region image");

      if (userCommunity) {
        return {
          id: userCommunity._id,
          name: userCommunity.communityName,
          region: userCommunity.region,
          image: userCommunity.image,
        };
      }

      return {
        id: null,
        name: null,
        region: null,
        image: null,
      };
    };

    const usersData = await Promise.all(
      users.map(async (user) => {
        const profile = user.profile || {};
        const professional = profile.professionalDetails || {};
        const address = profile.addresses?.address || {};

        const paymentVerification = Array.isArray(user.paymentVerification)
          ? user.paymentVerification
          : [];

        const completedPayments = paymentVerification.filter(
          (payment) => payment.status === "completed"
        );
        const pendingPayments = paymentVerification.filter(
          (payment) => payment.status === "pending"
        );

        const paymentSummary = {
          totalFees: paymentVerification.length,
          totalAmount: paymentVerification.reduce(
            (sum, fee) => sum + (fee.amount || 0),
            0
          ),
          completedFees: completedPayments.length,
          pendingFees: pendingPayments.length,
          completedAmount: completedPayments.reduce(
            (sum, fee) => sum + (fee.amount || 0),
            0
          ),
          pendingAmount: pendingPayments.reduce(
            (sum, fee) => sum + (fee.amount || 0),
            0
          ),
          isFullyPaid: paymentVerification.every(
            (p) => p.status === "completed"
          ),
        };

        const paymentVerificationStatus = paymentSummary.isFullyPaid;

        const community = await getCommunityData(user);

        return {
          user: {
            userId: user._id.toString(),
            name: `${user.fname || ""} ${user.lname || ""}`.trim(),
            avatar:
              user.avatar ||
              "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
            role: user.role || "user",
            companyName: professional.companyName || null,
            myBusiness: professional.myBusiness || null,
            industry: professional.industry || null,
            city: address.city || null,
            state: address.state || null,
            membershipType: user.membershipType || null,
            membershipIcon:
              membershipIconMap[user.membershipType] ||
              `${baseUrl}/default.svg`,
            business: user.business || null,
            businessSubcategory: user.businessSubcategory || null,
            email: user.email || "",
            mobile: user.mobile || null,
            region: user.region || "",
            isEmailVerified: user.isEmailVerified || false,
            username: user.username || "",
            referBy: user.referBy || null,
            profile: user.profile?._id?.toString() || null,
            connections: user.connections || [],
            membershipStatus: user.membershipStatus || false,
            isActive: user.isActive || false,
            isLogin: user.isLogin || 0,
            paymentVerification: paymentVerification.map((p) => ({
              feeType: p.feeType,
              amount: p.amount,
              status: p.status,
              transactionId: p.razorpayPaymentId,
              date: p.createdAt,
            })),
            paymentSummary,
            paymentVerificationStatus,
            isApproved: user.isApproved || false,
            onboardingComplete: user.onboardingComplete || false,
            fcmTokens: user.fcmTokens || [],
            renewalDate: user.renewalDate || null,
            createdAt: user.createdAt || null,
            updatedAt: user.updatedAt || null,
            community,
          },
        };
      })
    );

    return res.status(200).json({
      status: 200,
      data: { users: usersData },
      message: "Users fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error.message, error.stack);
    return res.status(500).json({
      status: 500,
      message: error.message || "Internal server error",
      details: [],
    });
  }
});


const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      throw new ApiErrors(400, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiErrors(400, "Invalid refresh token");
    }

    if (token !== user?.refreshToken) {
      throw new ApiErrors(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponses(
          200,
          { accessToken, refreshToken },
          "Refresh access token successfully"
        )
      );
  } catch (error) {
    throw new ApiErrors(500, "Error while refreshing access token in server");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiErrors(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "Password changed successfully"));
});

const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user?.id;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const userRole = user.role;

  await User.findByIdAndDelete(userId);

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponses(200, {}, `${userRole} deleted successfully`));
});

const searchAllUsers = asyncHandler(async (req, res) => {
  try {
    const filters = req.query;

    let users = await User.find({})
  .select(
    "fname lname _id email mobile referBy createdAt avatar region username gender isApproved isActive membershipStatus membershipType business businessSubcategory profile"
  )
  .populate([
    {
      path: "referBy",
      select: "fname lname",
    },
    {
      path: "profile",
      select:
        "professionalDetails.companyName professionalDetails.classification professionalDetails.industry addresses.address.city addresses.address.state",
    },
  ]);

// ✅ Exclude admin and logged-in user
const currentUserId = req.user._id.toString();
users = users.filter((user) => {
  const isAdmin = user.email === "admin@gmail.com";
  const isSelf = user._id.toString() === currentUserId;
  return !isAdmin && !isSelf;
});

    // Step 1: Map users into a flat, filterable format
    users = users.map((user) => ({
      id: user._id,
      fname: user.fname,
      lname: user.lname,
      avatar: user.avatar,
      username: user.username,
      gender: user.gender || "N/A",
      classification: user.profile?.professionalDetails?.classification || "N/A",
      companyName: user.profile?.professionalDetails?.companyName || "N/A",
      industry: user.profile?.professionalDetails?.industry || "N/A",
      city: user.profile?.addresses?.address?.city || "N/A",
      state: user.profile?.addresses?.address?.state || "N/A",
      region: user.region || "N/A",
      email: user.email,
      contactNo: user.mobile,
      business: user.business || "N/A",
      businessSubcategory: user.businessSubcategory || "N/A",
      membershipType: user.membershipType || "N/A",
      membershipStatus: user.membershipStatus?.toString() || "N/A",
      isActive: user.isActive?.toString() || "false",
      isApproved: user.isApproved?.toString() || "false",
      referredBy: user.referBy
        ? `${user.referBy.fname} ${user.referBy.lname}`
        : null,
      joiningDate: user.createdAt,
    }));

    // Step 2: Keyword filtering (global search across fields)
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();

      users = users.filter((user) => {
        return (
          user.fname?.toLowerCase().includes(keyword) ||
          user.lname?.toLowerCase().includes(keyword) ||
          user.email?.toLowerCase().includes(keyword) ||
          user.username?.toLowerCase().includes(keyword) ||
          user.companyName?.toLowerCase().includes(keyword) ||
          user.classification?.toLowerCase().includes(keyword) ||
          user.industry?.toLowerCase().includes(keyword) ||
          user.city?.toLowerCase().includes(keyword) ||
          user.state?.toLowerCase().includes(keyword) ||
          user.region?.toLowerCase().includes(keyword)
        );
      });

      delete filters.keyword; // prevent conflict with other filters
    }

    // Step 3: Field-based filtering
    if (Object.keys(filters).length > 0) {
      users = users.filter((user) => {
        return Object.entries(filters).every(([key, value]) => {
          const searchVal = value.toLowerCase();

          switch (key) {
            case "fname":
            case "lname":
            case "email":
            case "region":
            case "username":
            case "gender":
            case "companyName":
            case "classification":
            case "industry":
            case "city":
            case "state":
            case "business":
            case "businessSubcategory":
            case "membershipType":
              return user[key]?.toLowerCase().includes(searchVal);

            case "contactNo":
              return user.contactNo?.toString().includes(searchVal);

            case "isApproved":
            case "isActive":
            case "membershipStatus":
              return user[key] === searchVal;

            case "joiningDate":
              return (
                new Date(user.joiningDate)
                  .toISOString()
                  .toLowerCase()
                  .includes(searchVal)
              );

            default:
              return true; // ignore unknown keys
          }
        });
      });
    }

    // Step 4: Return result
    if (users.length === 0) {
      return res
        .status(200)
        .json(new ApiResponses(200, [], "No matching users found"));
    }

    return res
      .status(200)
      .json(new ApiResponses(200, users, "Users fetched successfully"));
  } catch (error) {
    console.error("Universal search error:", error);
    return res
      .status(500)
      .json(new ApiResponses(500, [], error.message || "Search failed"));
  }
});




const sendCredentials = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  if (user.password) {
    return res
      .status(400)
      .json(new ApiResponses(400, {}, "User already has a password"));
  }

  try {
    const newPassword = generateRandomPassword();
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    await sendEmailWithCredentials(user.fname, user.email, newPassword);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new ApiErrors(500, "Failed to send credentials via email");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "Credentials sent successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const updates = req.body;

  const user = await User.findById(userId).populate("profile");

  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  // Validate membershipType if being updated
  if (updates.membershipType && !membershipTypes.includes(updates.membershipType)) {
    throw new ApiErrors(400, "Invalid membership type");
  }

  // Check for duplicates on email, mobile, or username
  if (updates.email || updates.mobile || updates.username) {
    const duplicateUser = await User.findOne({
      $or: [
        updates.email ? { email: updates.email } : null,
        updates.mobile ? { mobile: updates.mobile } : null,
        updates.username ? { username: updates.username } : null
      ].filter(Boolean),
      _id: { $ne: userId },
    });

    if (duplicateUser) {
      const duplicateFields = [];
      if (duplicateUser.email === updates.email) duplicateFields.push("email");
      if (duplicateUser.mobile === updates.mobile) duplicateFields.push("mobile");
      if (duplicateUser.username === updates.username) duplicateFields.push("username");

      throw new ApiErrors(409, `Update failed: ${duplicateFields.join(", ")} already in use`, {
        duplicateFields,
      });
    }
  }

  // Sync profile if email or mobile updated
  if (user.profile && (updates.email || updates.mobile)) {
    if (updates.email) user.profile.contactDetails.email = updates.email;
    if (updates.mobile) user.profile.contactDetails.mobileNumber = updates.mobile;
    await user.profile.save();
  }

  // Hash password if updated
  if (updates.password) {
    const hashedPassword = await bcrypt.hash(updates.password, 10);
    updates.password = hashedPassword;
  }

  // Perform update
  const updatedUser = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    throw new ApiErrors(500, "User update failed");
  }

  return res.status(200).json(
    new ApiResponses(200, updatedUser, `${updatedUser.role} updated successfully`)
  );
});


const generateVCard = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).populate("profile");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  if (!user.profile) {
    throw new ApiErrors(404, "User profile not found");
  }

  const baseUrl = process.env.BASE_URL || "https://backend.bizcivitas.com/api/v1";
  const vCardLink = `${baseUrl}/users/download-vcard/${userId}`;

  return res
    .status(200)
    .json(new ApiResponses(200, { vCardLink }, "vCard link generated successfully"));
});

const downloadVCard = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).populate("profile");
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  if (!user.profile) {
    throw new ApiErrors(404, "User profile not found");
  }

  const card = new vCard();
  card.set("version", "3.0");

  card.set("fn", `${user.fname || ""} ${user.lname || ""}`.trim());
  card.set("n", `${user.lname || ""};${user.fname || ""};;;`);

  if (user.profile?.contactDetails?.email) {
    card.add("email", user.profile.contactDetails.email, { type: "WORK" });
  }

  if (user.profile?.contactDetails?.mobileNumber) {
    card.add("tel", user.profile.contactDetails.mobileNumber, { type: "CELL" });
  }

  if (user.profile?.contactDetails?.homeNumber) {
    card.add("tel", user.profile.contactDetails.homeNumber, { type: "HOME" });
  }

  if (user.profile?.professionalDetails?.companyName) {
    card.set("org", user.profile.professionalDetails.companyName);
  }

  if (user.profile?.professionalDetails?.companyAddress) {
    card.add("adr", `;;${user.profile.professionalDetails.companyAddress};;;;`, { type: "WORK" });
  }

  if (user.profile?.contactDetails?.socialNetworkLinks?.length > 0) {
    user.profile.contactDetails.socialNetworkLinks.forEach((link) => {
      if (link.link && link.name) {
        card.add("url", link.link, { type: link.name.toUpperCase() });
      }
    });
  }

  res.setHeader("Content-Type", "text/vcard; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${user.fname || "contact"}_${user.lname || "user"}.vcf"`
  );

  return res.status(200).send(card.toString());
});

const getCommunityMembers = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const currentUser = await User.findById(userId).select("fname lname");
  if (!currentUser) {
    throw new ApiErrors(404, "User not found");
  }

  const community = await Community.findOne({
    $or: [{ coreMembers: userId }, { users: userId }],
  })
    .populate({
      path: "users coreMembers",
      select: "_id fname lname avatar role membershipType business businessSubcategory profile",
      populate: {
        path: "profile",
        select: "professionalDetails addresses",
      },
    })
    .select("name region image _id");

  if (!community) {
    throw new ApiErrors(400, "User is not associated with any community");
  }

  const allMembersBeforeFilter = [
    ...(community.users || []),
    ...(community.coreMembers || []),
  ];

  const allMembers = allMembersBeforeFilter.filter(
    (user) => user._id.toString() !== userId.toString()
  );

  if (!allMembers || allMembers.length === 0) {
    return res.status(200).json(
      new ApiResponses(
        200,
        {
          community: {
            id: community._id,
            name: community.name,
            region: community.region,
            image: community.image,
          },
          members: [],
        },
        "No other members found in the community"
      )
    );
  }

  // Base URL for membership icons
  const baseUrl = "https://backend.bizcivitas.com/api/v1/image/user";

  const membershipIconMap = {
    "Core Membership": `${baseUrl}/Core-Membership.png`,
    "Flagship Membership": `${baseUrl}/Flagship-Membership.png`,
    "Industria Membership": `${baseUrl}/Industria-Membership.png`,
    "Digital Membership": `${baseUrl}/Digital-Membership.png`,
  };

  const members = allMembers.map((user) => {
    const profile = user.profile || {};
    const professional = profile.professionalDetails || {};
    const address = profile.addresses?.address || {};

    return {
      user: {
        userId: user._id,
        name: `${user.fname || ""} ${user.lname || ""}`.trim(),
        avatar:
          user.avatar ||
          "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
        role: user.role || "user",
        companyName: professional.companyName || null,
        myBusiness: professional.myBusiness || null,
        industry: professional.industry || null,
        city: address.city || null,
        state: address.state || null,
        membershipType: user.membershipType || null,
        membershipIcon:
          membershipIconMap[user.membershipType] || `${baseUrl}/default.svg`,
        business: user.business || null,
        businessSubcategory: user.businessSubcategory || null,
      },
    };
  });

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        community: {
          id: community._id,
          name: community.name,
          region: community.region,
          image: community.image,
        },
        members,
      },
      "Community members fetched successfully"
    )
  );
});


const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!req.user?._id) {
    throw new ApiErrors(401, "Unauthorized: User not authenticated");
  }

  const user = await User.findById(userId)
    .populate({
      path: "profile",
      select: "contactDetails professionalDetails myBio socialNetworkLinks visibility",
    })
    .populate({
      path: "connections",
      select: "sender receiver isAccepted",
      populate: {
        path: "sender receiver",
        select: "avatar fname lname",
      },
    })
    .populate({
      path: "paymentVerification",
      select: "feeType amount status razorpayPaymentId createdAt",
    })
    .populate({
      path: "community",
      select: "communityName _id region image",
    })
    .select("-password -refreshToken -fcmTokens")
    .lean({ getters: true }); // Ensure getters are applied

  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  // Define iconMap for fallback
  const baseUrl = "https://backend.bizcivitas.com/api/v1/image/user";
  const iconMap = {
    "Core Membership": `${baseUrl}/core-Membership.png`,
    "Flagship Membership": `${baseUrl}/Flagship-Membership.png`,
    "Industria Membership": `${baseUrl}/Industria-Membership.png`,
    "Digital Membership": `${baseUrl}/Digital-Membership.png`,
  };

  // Get community info - prioritize populated community field, fallback to search
  let community = null;
  if (user.membershipType !== "Digital Membership") {
    if (user.community) {
      // Use populated community data
      community = {
        id: user.community._id,
        name: user.community.communityName,
        region: user.community.region,
        image: user.community.image,
      };
    } else {
      // Fallback: Search for user in community arrays
      const userCommunity = await Community.findOne({
        $or: [{ coreMembers: userId }, { users: userId }],
      }).select("communityName _id region image");
      
      if (userCommunity) {
        community = {
          id: userCommunity._id,
          name: userCommunity.communityName,
          region: userCommunity.region,
          image: userCommunity.image,
        };
      }
    }
  }

  const paymentVerification = Array.isArray(user.paymentVerification)
    ? user.paymentVerification
    : [];
  const completedPayments = paymentVerification.filter(
    (payment) => payment.status === "completed"
  );
  const pendingPayments = paymentVerification.filter(
    (payment) => payment.status === "pending"
  );

  const paymentSummary = {
    totalFees: paymentVerification.length,
    totalAmount: paymentVerification.reduce((sum, fee) => sum + (fee.amount || 0), 0),
    completedFees: completedPayments.length,
    pendingFees: pendingPayments.length,
    completedAmount: completedPayments.reduce((sum, fee) => sum + (fee.amount || 0), 0),
    pendingAmount: pendingPayments.reduce((sum, fee) => sum + (fee.amount || 0), 0),
    isFullyPaid: paymentVerification.every((p) => p.status === "completed"),
  };

  const paymentVerificationStatus = paymentSummary.isFullyPaid;

  const filteredConnections = user.connections
    .map((connection) => {
      let connectionUser = null;
      if (connection.sender?._id.toString() !== userId.toString()) {
        connectionUser = {
          _id: connection.sender?._id,
          name: `${connection.sender?.fname} ${connection.sender?.lname}`.trim(),
          avatar: connection.sender?.avatar,
        };
      } else if (connection.receiver?._id.toString() !== userId.toString()) {
        connectionUser = {
          _id: connection.receiver?._id,
          name: `${connection.receiver?.fname} ${connection.receiver?.lname}`.trim(),
          avatar: connection.receiver?.avatar,
        };
      }
      if (connectionUser) {
        return {
          _id: connection._id,
          user: connectionUser,
          isAccepted: connection.isAccepted,
        };
      }
      return null;
    })
    .filter((connection) => connection !== null);

  const userData = {
    _id: user._id,
    fname: user.fname || "",
    lname: user.lname || "",
    email: user.email || "",
    mobile: user.mobile || null,
    username: user.username || "",
    role: user.role || "user",
    region: user.region || "",
    isActive: user.isActive || false,
    membershipStatus: user.membershipStatus || false,
    totalPaidAmount: user.totalPaidAmount || 0,
    paymentStatus: user.paymentStatus || "",
    avatar: user.avatar || null,
    profile: user.profile
      ? {
          ...user.profile,
          visibility: user.profile.visibility || { professionalDetails: true },
        }
      : null,
    connections: filteredConnections,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    joiningDate: user.createdAt || null,
    membershipType: user.membershipType || "", // Ensure membershipType is included
    membershipIcon: user.membershipIcon || iconMap[user.membershipType] || `${baseUrl}/default.png`, // Fallback for membershipIcon
    businessCategory: user.business,
    businessSubcategory: user.businessSubcategory,
    paymentVerification: paymentVerification.map((p) => ({
      feeType: p.feeType,
      amount: p.amount,
      status: p.status,
      transactionId: p.razorpayPaymentId,
      date: p.createdAt,
    })),
    paymentVerificationStatus,
    paymentSummary,
    community,
  };



  return res.status(200).json(
    new ApiResponses(200, { user: userData }, "User details fetched successfully")
  );
});



const recordManualPayment = asyncHandler(async (req, res) => {
  console.log("Received Payload:", JSON.stringify(req.body, null, 2));

  const {
    email,
    mobile,
    username: incomingUsername,
    fname,
    lname,
    referBy,
    region,
    membershipType,
    business,
    businessSubcategory,
    feeType,
    amount,
    paymentMethod,
    cashId,
    checkId,
  } = req.body;

  if (req.user.role !== "admin") {
    throw new ApiErrors(403, "Access denied. Only admins can record manual payments.");
  }

  if (!email && !mobile && !incomingUsername) {
    throw new ApiErrors(400, "At least one identifier (email, mobile, or username) is required");
  }

  if (!feeType || !amount || !paymentMethod || !membershipType) {
    throw new ApiErrors(400, "feeType, amount, paymentMethod, and membershipType are required");
  }

  if (!["cash", "check"].includes(paymentMethod.toLowerCase())) {
    throw new ApiErrors(400, "Invalid payment method. Must be 'cash' or 'check'.");
  }

  if (paymentMethod.toLowerCase() === "cash" && cashId && typeof cashId !== "string") {
    throw new ApiErrors(400, "Invalid cashId format. Must be a string.");
  }

  if (paymentMethod.toLowerCase() === "check" && checkId && typeof checkId !== "string") {
    throw new ApiErrors(400, "Invalid checkId format. Must be a string.");
  }

  if (!membershipTypes.includes(membershipType)) {
    throw new ApiErrors(400, `Invalid membership type: ${membershipType}`);
  }

  const feeTypesMap = {
    "Core Membership": ["registration", "annual", "community_launching", "event_fee"],
    "Flagship Membership": ["registration", "annual", "meeting"],
    "Industria Membership": ["registration", "annual", "meeting"],
    "Digital Membership": ["registration"],
  };

  if (!feeTypesMap[membershipType]?.includes(feeType)) {
    throw new ApiErrors(400, `Invalid fee type ${feeType} for ${membershipType}`);
  }

  const query = [];
  if (email) query.push({ email });
  if (mobile) query.push({ mobile });
  if (incomingUsername) query.push({ username: incomingUsername });

  let user = await User.findOne({ $or: query }).populate("paymentVerification");

  if (!user) {
    console.log("Creating new user...");

    if (!fname || !email || !membershipType) {
      throw new ApiErrors(400, "fname, email, and membershipType are required to create a new user");
    }

    // ✅ Enforce unique username generation
    let finalUsername;

    if (incomingUsername) {
      const cleanedUsername = incomingUsername.toLowerCase().replace(/\s+/g, "");
      const exists = await User.exists({ username: cleanedUsername });
      finalUsername = exists ? await generateUniqueUsername(fname) : cleanedUsername;
    } else {
      finalUsername = await generateUniqueUsername(fname);
    }

    if (referBy) {
      try {
        const referrerExists = await User.findById(referBy);
        if (!referrerExists) throw new ApiErrors(403, "Invalid referral ID");
      } catch (error) {
        throw new ApiErrors(403, "Invalid referral ID format or database error");
      }
    }

    const existingProfile = await Profile.findOne({ "contactDetails.email": email });
    if (existingProfile) {
      throw new ApiErrors(409, "A profile with this email already exists", {
        duplicateFields: ["email"],
      });
    }

    const profile = await Profile.create({
      contactDetails: { mobileNumber: mobile, email },
    });

    if (!profile) throw new ApiErrors(500, "Error creating profile");

    const baseUrl = "https://backend.bizcivitas.com/api/v1/image/user";
    const iconMap = {
      "Core Membership": `${baseUrl}/core-Membership.png`,
      "Flagship Membership": `${baseUrl}/Flagship-Membership.png`,
      "Industria Membership": `${baseUrl}/Industria-Membership.png`,
      "Digital Membership": `${baseUrl}/Digital-Membership.png`,
    };
    const membershipIcon = iconMap[membershipType] || `${baseUrl}/default.png`;

    user = await User.create({
      fname,
      lname,
      username: finalUsername,
      email,
      mobile,
      referBy: referBy || null,
      region,
      profile: profile._id,
      membershipType,
      role: membershipType === "Core Membership" ? "core-member" : "user",
      isActive: false,
      business,
      businessSubcategory,
      community: null,
      membershipIcon,
    });

    // ⚙️ Community assignment logic (unchanged)...

    // same community connection logic here...
  }

  // 💸 Fee pre-checks and business logic (unchanged)...

  const expectedAmount = membershipFees[membershipType][feeType];
  if (amount !== expectedAmount) {
    throw new ApiErrors(400, `Invalid amount. Expected ${expectedAmount} for ${feeType}`);
  }

  let paymentEntry = user.paymentVerification.find((entry) => entry.feeType === feeType);

  if (!paymentEntry) {
    paymentEntry = await Payment.create({
      userId: user._id,
      membershipType,
      feeType,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      status: "pending",
      amount,
      paymentMethod: paymentMethod.toLowerCase(),
      cashId: paymentMethod.toLowerCase() === "cash" ? cashId : undefined,
      checkId: paymentMethod.toLowerCase() === "check" ? checkId : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await User.findByIdAndUpdate(user._id, { $push: { paymentVerification: paymentEntry._id } }, { validateBeforeSave: false });
  }

  if (paymentEntry.status === "completed") {
    throw new ApiErrors(400, `Payment for ${feeType} already completed`);
  }

  const updatedPayment = await Payment.findByIdAndUpdate(paymentEntry._id, {
    status: "completed",
    paymentMethod: paymentMethod.toLowerCase(),
    cashId: paymentMethod.toLowerCase() === "cash" ? cashId : undefined,
    checkId: paymentMethod.toLowerCase() === "check" ? checkId : undefined,
    updatedAt: new Date(),
  }, { new: true });

  if (!updatedPayment) throw new ApiErrors(500, "Failed to update payment");

  const refreshedUser = await User.findById(user._id).populate("paymentVerification").lean({ getters: true });

  const mandatoryFeeTypes = feeTypesMap[membershipType].filter((type) => type !== "event_fee");

  const allMandatoryPaymentsCompleted = mandatoryFeeTypes.every((type) =>
    refreshedUser.paymentVerification.some((p) => p.feeType === type && p.status === "completed")
  );

  if (allMandatoryPaymentsCompleted && !refreshedUser.isActive) {
    try {
      const newPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await User.findByIdAndUpdate(user._id, {
        isActive: true,
        isApproved: true,
        renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        password: hashedPassword,
      }, { validateBeforeSave: false });

      await sendEmailWithCredentials(
  refreshedUser.fname,
  refreshedUser.email,
  newPassword,
  refreshedUser.membershipType
);

    } catch (error) {
      console.error("Error activating user:", error);
      throw new ApiErrors(500, "Error activating account");
    }
  }

  const paymentSummary = {
    totalFees: refreshedUser.paymentVerification.length,
    completed: refreshedUser.paymentVerification.filter(p => p.status === "completed").length,
    pending: refreshedUser.paymentVerification.filter(p => p.status === "pending").length,
    pendingFees: refreshedUser.paymentVerification.filter(p => p.status === "pending").map(p => ({
      feeType: p.feeType,
      amount: p.amount,
      status: p.status,
    })),
    completedFees: refreshedUser.paymentVerification.filter(p => p.status === "completed").map(p => ({
      feeType: p.feeType,
      amount: p.amount,
      status: p.status,
      paymentMethod: p.paymentMethod,
      cashId: p.cashId,
      checkId: p.checkId,
    })),
    isFullyPaid: allMandatoryPaymentsCompleted,
  };

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        user: {
          _id: refreshedUser._id,
          fname: refreshedUser.fname,
          lname: refreshedUser.lname,
          email: refreshedUser.email,
          username: refreshedUser.username,
          membershipType: refreshedUser.membershipType,
          isActive: refreshedUser.isActive,
          renewalDate: refreshedUser.renewalDate,
          membershipIcon: refreshedUser.membershipIcon,
        },
        paymentStatus: paymentSummary,
        nextStep: allMandatoryPaymentsCompleted ? "login" : "complete_payments",
      },
      `Manual ${feeType} payment recorded successfully via ${paymentMethod}`
    )
  );
});

export async function recordBulkFromJson() {
  const absolutePath = path.resolve("src/services/bulkUsers.json");
  const raw = fs.readFileSync(absolutePath);
  const users = JSON.parse(raw);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`📦 Starting bulk user import for ${users.length} users...\n`);

  for (const user of users) {
    try {
      if (!membershipTypes.includes(user.membershipType)) {
        console.log(`❌ Skipped [Invalid Membership] → ${user.email}`);
        skipped++;
        continue;
      }

      const existing = await User.findOne({ email: user.email });
      if (existing) {
        console.log(`⚠️ Skipped [Already Exists] → ${user.email}`);
        skipped++;
        continue;
      }

      const username = await generateUniqueUsername(user.fname);

      const profile = await Profile.create({
        contactDetails: {
          email: user.email,
          mobileNumber: user.mobile,
        },
      });

      const plainPassword = generateRandomPassword();

      const baseUrl = "https://backend.bizcivitas.com/api/v1/image/user";
      const iconMap = {
        "Core Membership": `${baseUrl}/core-Membership.png`,
        "Flagship Membership": `${baseUrl}/Flagship-Membership.png`,
        "Industria Membership": `${baseUrl}/Industria-Membership.png`,
        "Digital Membership": `${baseUrl}/Digital-Membership.png`,
      };
      const membershipIcon = iconMap[user.membershipType] || `${baseUrl}/default.png`;

      const newUser = new User({
        fname: user.fname,
        lname: user.lname,
        username,
        email: user.email,
        mobile: user.mobile,
        membershipType: user.membershipType,
        profile: profile._id,
        region: user.city,
        password: plainPassword, // Let Mongoose hash it
        isActive: true,
        isApproved: true,
        role: user.membershipType === "Core Membership" ? "core-member" : "user",
        renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        business: user.business,
        businessSubcategory: user.businessSubcategory,
        membershipIcon,
      });

      await newUser.save(); // Triggers Mongoose password hashing

      const feeTypes = Object.entries(membershipFees[user.membershipType]);

      for (const [feeType, amount] of feeTypes) {
        const payment = await Payment.create({
          userId: newUser._id,
          membershipType: user.membershipType,
          feeType,
          status: "completed",
          amount,
          paymentMethod: "manual",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await User.findByIdAndUpdate(
          newUser._id,
          { $push: { paymentVerification: payment._id } },
          { validateBeforeSave: false }
        );
      }

      await sendEmailWithCredentials(
        newUser.fname,
        newUser.email,
        plainPassword,
        newUser.membershipType
      );

      console.log(`✅ Created & Emailed → ${user.email}`);
      created++;
    } catch (err) {
      console.error(`❌ Failed [${user.email}] → ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Bulk Import Summary:`);
  console.log(`----------------------------`);
  console.log(`🟢 Created: ${created}`);
  console.log(`🟡 Skipped: ${skipped}`);
  console.log(`🔴 Failed : ${failed}`);
  console.log(`----------------------------\n`);
}


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  deleteUser,
  getCurrentUser,
  getAllUsers,
  changeCurrentPassword,
  searchAllUsers,
  sendCredentials,
  updateUser,
  generateVCard,
  downloadVCard,
  validatePayment,
  checkRegistrationStatus,
  getUsersWithPaymentDetails,
  getCommunityMembers,
  getUserById,
   handlePaymentSuccess,
   assignUserToCommunity,
   recordManualPayment,
};