import mongoose, { Schema } from "mongoose";

const blogSchema = new Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    featuredImage: { type: String, required: true }, // Main blog image
    sections: [
      {
        heading: { type: String, required: true },
        content: { type: String,},
        image: { type: String }, // Optional section image
        subsections: [
          {
            heading: { type: String, },
            content: { type: String, }
          }
        ]
      }
    ]
  },
  { timestamps: true }
);

export const Blog = mongoose.model("Blog", blogSchema);