import asyncHandler from "../utils/asyncHandler.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import { Event } from "../models/Event.model.js";
import { OnlineEvent } from "../models/onlineEvent.model.js";
import { TripEvent } from "../models/tripEvent.model.js";
import fs from "fs";
import path from "path";

// Helper function to remove image from disk
const removeImageFromDisk = (imagePath) => {
  const imagePathToDelete = path.join(
    process.cwd(),
    "public",
    "assets",
    "images",
    imagePath
  );
  if (fs.existsSync(imagePathToDelete)) {
    fs.unlinkSync(imagePathToDelete);
  } else {
    console.log(`Image not found on disk: ${imagePathToDelete}`);
  }
};

// Add images to the post event (addPostEventImages)
const addPostEventImages = asyncHandler(async (req, res, next) => {
  const { eventId, eventType } = req.body;
  let event;

  // Choose the event model based on eventType
  if (eventType === "oneDay") {
    event = await OneDayEvent.findById(eventId);
  } else if (eventType === "online") {
    event = await OnlineEvent.findById(eventId);
  } else if (eventType === "trip") {
    event = await TripEvent.findById(eventId);
  } else {
    return next(new ApiErrors(400, "Invalid event type"));
  }

  if (!event) {
    return next(new ApiErrors(404, "Event not found"));
  }

  // Check if files were uploaded
  if (!req.files || req.files.length === 0) {
    return next(new ApiErrors(400, "No images uploaded"));
  }

  // Optional: Validate image file types
  const validFileTypes = ["image/jpeg", "image/png", "image/gif"];
  const invalidFiles = req.files.filter(
    (file) => !validFileTypes.includes(file.mimetype)
  );

  if (invalidFiles.length > 0) {
    return next(new ApiErrors(400, "Invalid file type"));
  }

  // Add the image paths to the event model
  const imagePaths = req.files.map((file) => `event/${file.filename}`);
  event.postEventImg.push(...imagePaths);

  // Save the updated event
  try {
    await event.save();
  } catch (err) {
    return next(new ApiErrors(500, "Error saving the event"));
  }

  // Return a success response with the event data
  return res
    .status(201)
    .json(new ApiResponses(201, event, "Images added successfully"));
});

// Remove image from event (removePostEventImages)
const removePostEventImages = asyncHandler(async (req, res, next) => {
  const { eventId, imageId, eventType } = req.body;
  let event;

  // Choose the event model based on eventType
  if (eventType === "oneDay") {
    event = await OneDayEvent.findById(eventId);
  } else if (eventType === "online") {
    event = await OnlineEvent.findById(eventId);
  } else if (eventType === "trip") {
    event = await TripEvent.findById(eventId);
  } else {
    return next(new ApiErrors(400, "Invalid event type"));
  }

  if (!event) {
    return next(new ApiErrors(404, "Event not found"));
  }

  // Remove the image from the `postEventImg` array if it exists
  const imageIndex = event.postEventImg.indexOf(imageId);

  if (imageIndex !== -1) {
    // Remove image path from the `postEventImg` array
    const imageToRemove = event.postEventImg[imageIndex];
    event.postEventImg.splice(imageIndex, 1); // Remove the image path from the array

    // Remove image from disk
    removeImageFromDisk(imageToRemove);
  } else {
    return next(new ApiErrors(404, "Image not found in postEventImg array"));
  }

  // Save the updated event document
  try {
    await event.save();
  } catch (err) {
    return next(new ApiErrors(500, "Error saving the event after removal"));
  }

  return res
    .status(200)
    .json(new ApiResponses(200, null, "Image removed successfully"));
});

// Get post event images by eventId (getPostEventImageById)
const getPostEventImageById = asyncHandler(async (req, res, next) => {
  const { eventId, eventType } = req.params;
  let event;

  // Choose the event model based on eventType
  if (eventType === "oneDay") {
    event = await OneDayEvent.findById(eventId);
  } else if (eventType === "online") {
    event = await OnlineEvent.findById(eventId);
  } else if (eventType === "trip") {
    event = await TripEvent.findById(eventId);
  } else {
    return next(new ApiErrors(400, "Invalid event type"));
  }

  if (!event) {
    return next(new ApiErrors(404, "Event not found"));
  }

  // Return the event's images
  return res.status(200).json(
    new ApiResponses(
      200,
      {
        eventName: event.name || event.eventName,
        images: event.postEventImg,
      },
      "Event images fetched successfully"
    )
  );
});

export { addPostEventImages, removePostEventImages, getPostEventImageById };