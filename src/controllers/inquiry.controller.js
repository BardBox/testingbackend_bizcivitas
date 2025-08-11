import { Inquiry } from "../models/inquiry.model.js";
import { sendInquiryEmailToAdmin, sendInquiryEmailToClient } from "../services/sendInquiryEmail.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Add new Inquiry
const addInquiry = asyncHandler(async (req, res) => {
  const { name, email, phoneNumber, howDidYouFindUs } = req.body;

  // Check if required fields are missing or empty
  if ([name, email, phoneNumber].some((field) => !field || field.trim() === "")) {
    throw new ApiErrors(400, "Name, email, and phone number are required");
  }

  // Create new Inquiry
  const inquiry = await Inquiry.create({
    name: name.trim(),
    email: email.trim(),
    phoneNumber: phoneNumber.trim(),
    howDidYouFindUs: howDidYouFindUs ? howDidYouFindUs.trim() : undefined,
  });

  if (!inquiry) {
    throw new ApiErrors(500, "Error while creating new inquiry in server");
  }

  try {
    await sendInquiryEmailToAdmin(name, email, phoneNumber, howDidYouFindUs || "Not specified");
    await sendInquiryEmailToClient(name, email);
  } catch (error) {
    console.error("Error sending inquiry email to admin:", error);
    throw new ApiErrors(502, "Error sending email. Please try again later.");
  }

  // Return response with inquiry details
  return res.status(201).json(
    new ApiResponses(
      201,
      {
        name: inquiry.name,
        email: inquiry.email,
        phoneNumber: inquiry.phoneNumber,
        howDidYouFindUs: inquiry.howDidYouFindUs || "Not specified",
        createdAt: inquiry.createdAt,
        updatedAt: inquiry.updatedAt,
      },
      "Inquiry added successfully"
    )
  );
});

// Get all inquiries
const getAllInquiries = asyncHandler(async (req, res) => {
  const allInquiries = await Inquiry.find().select("name email phoneNumber howDidYouFindUs");

  if (!allInquiries || allInquiries.length === 0) {
    return res
      .status(200)
      .json(new ApiResponses(200, [], "No inquiries are available in database"));
  }

  return res
    .status(200)
    .json(new ApiResponses(200, allInquiries, "All inquiries fetched successfully"));
});

// Delete an inquiry
const deleteInquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inquiry = await Inquiry.findByIdAndDelete(id);

  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, null, "Inquiry deleted successfully"));
});

export { addInquiry, getAllInquiries, deleteInquiry };