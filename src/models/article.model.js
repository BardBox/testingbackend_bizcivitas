import mongoose from "mongoose";

const { Schema } = mongoose;

const articleSchema = new Schema(
  {
    title: String,
    contents: [
      {
        content: String,
        subsections: [
          {
            title: String,
            content: String,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

export const Article = mongoose.model("Article", articleSchema);
