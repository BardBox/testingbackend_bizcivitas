import path from "path";
import fs from "fs";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";

const getImage = asyncHandler(async (req, res) => {
  const { category, filename } = req.params;

  const validCategories = ["user", "event", "community","blog", "companyLogo" ,"meeting","wallFeed","icon","post"];
  if (!validCategories.includes(category)) {
    throw new ApiErrors(
      400,
      "Invalid category. Must be user, event, or community"
    );
  }

  const imagePath = path.join(
    process.cwd(),
    "public",
    "assets",
    "images",
    category,
    filename
  );

  // Check if the image exists
  await new Promise((resolve, reject) => {
    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (err) {
        reject(new ApiErrors(404, "Image not found"));
      } else {
        resolve();
      }
    });
  });

  // Send the image
  res.sendFile(imagePath, (err) => {
    if (err) {
      throw new ApiErrors(500, "Error sending the image");
    }
  });
});

export { getImage };