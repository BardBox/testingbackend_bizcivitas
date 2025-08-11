import mongoose from "mongoose";

const { Schema } = mongoose;

const pollSchema = new Schema(
  {
    question: String,
    options: [
      {
        text: String,
        votes: { type: Number, default: 0 },
      },
    ],
    totalVotes: { type: Number, default: 0 },
    voters: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        optionIndex: Number,
        votedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Poll = mongoose.model("Poll", pollSchema);
