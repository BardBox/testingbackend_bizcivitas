import mongoose, { Schema } from "mongoose";
import { User } from "./user.model.js";

const connectionSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isAccepted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Connection = mongoose.model("Connection", connectionSchema);
