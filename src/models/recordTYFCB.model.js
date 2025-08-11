import mongoose, { Schema } from "mongoose";

const recordTYFCBSchema = new Schema(
  {
    from: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comments: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

export const RecordTYFCB = mongoose.model("RecordTYFCB", recordTYFCBSchema);
