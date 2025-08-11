import ApiResponses from "../utils/ApiResponses.js";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import { Region } from "../models/region.model.js";

// CREATE - Add a new region
const createRegion = asyncHandler(async (req, res) => {
  
  if (!req.body.regionName || req.body.regionName.trim() === "") {
    throw new ApiErrors(400, "Region name is required");
  }

  const existingRegion = await Region.findOne({ regionName: req.body.regionName });
  if (existingRegion) {
    throw new ApiErrors(400, "Region name already exists");
  }

  const newRegion = new Region({
    regionName: req.body.regionName,
  });

  const savedRegion = await newRegion.save();

  return res
    .status(201)
    .json(
      new ApiResponses(
        201,
        savedRegion,
        "Region created successfully"
      )
    );
});

// READ - Get all regions
const getAllRegions = asyncHandler(async (req, res) => {
  const regions = await Region.find();
  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        regions,
        "Regions retrieved successfully"
      )
    );
});

// READ - Get a single region by ID


// UPDATE - Update a region by ID
const updateRegion = asyncHandler(async (req, res) => {
  
  if (!req.body.regionName || req.body.regionName.trim() === "") {
    throw new ApiErrors(400, "Region name is required");
  }

  const existingRegion = await Region.findOne({
    regionName: req.body.regionName,
    _id: { $ne: req.params.id }, // Exclude the current region
  });

  if (existingRegion) {
    throw new ApiErrors(400, "Region name already exists");
  }

  const updatedRegion = await Region.findByIdAndUpdate(
    req.params.id,
    { regionName: req.body.regionName },
    { 
      new: true, // Return the updated document
      runValidators: true // Ensure validation rules are applied
    }
  );

  if (!updatedRegion) {
    throw new ApiErrors(404, "Region not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        updatedRegion,
        "Region updated successfully"
      )
    );
});

// DELETE - Delete a region by ID
const deleteRegion = asyncHandler(async (req, res) => {
  const deletedRegion = await Region.findByIdAndDelete(req.params.id);
  if (!deletedRegion) {
    throw new ApiErrors(404, "Region not found");
  }
  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        null,
        "Region deleted successfully"
      )
    );
});

export {
  createRegion,
  getAllRegions,
  updateRegion,
  deleteRegion,
};