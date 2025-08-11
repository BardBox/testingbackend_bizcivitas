import mongoose, { Schema } from "mongoose";

const regionSchema = new Schema(
  {
    regionName: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const Region = mongoose.model("Region", regionSchema);