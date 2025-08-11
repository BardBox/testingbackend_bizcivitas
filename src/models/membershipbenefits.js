import mongoose, { Schema } from "mongoose";

const membershipTypes = [
  "Core Membership",
  "Flagship Membership",
  "Industria Membership",
  "Digital Membership",
];

const membershipBenefitSchema = new Schema(
  {
    membershipType: {
      type: String,
      enum: membershipTypes,
      required: true,
      trim: true,
    },
    content: {
      type: [String],
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const MembershipBenefit = mongoose.model("MembershipBenefit", membershipBenefitSchema);