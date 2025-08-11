import mongoose, { Schema } from "mongoose";

const inquirySchema = new Schema(
  {
    name: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      require: true,
    },
    phoneNumber: {
      type: String,
      require: true,
    },
    howDidYouFindUs: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Inquiry = mongoose.model("Inquiry", inquirySchema);
