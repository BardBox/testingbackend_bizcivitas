import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileExtension: {
      type: String,
      required: true,
    },
    folder: {
      type: String,
      required: true,
      enum: ["pdfs/", "tutorial-videos/", "recordings/"],
    },
    sizeInBytes: {
      type: Number,
      required: true,
    },
    uploadDate: {
      type: Date,
      required: true,
    },
    title: {
      type: String,
      required: true,
      default: function () {
        return this.fileName; // Default to fileName if title not provided
      },
    },
    thumbnailUrl: {
      type: String,
      validate: {
        validator: function (v) {
          // Thumbnail is only required for videos
          if (this.mimeType.startsWith("video/")) {
            return v != null;
          }
          return true; // Not required for PDFs
        },
        message: "Thumbnail is required for video files",
      },
    },

    savedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        }, // Reference to User model
        category: {
          type: String,
          required: true,
          enum: ["recordings", "tutorials", "pdfs"],
        }, // Save category
        savedDate: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
const Media = mongoose.model("Media", mediaSchema);

export default Media;
