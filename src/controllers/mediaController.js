import * as mediaService from "../services/mediaService.js";
import path from "path";
import Media from "../models/media.model.js";

const uploadMedia = async (req, res) => {
  try {
    if (!req.files || !req.files.file || !req.files.file[0]) {
      return res.status(400).json({ message: "No file uploaded." });
    }
    

    const file = req.files.file[0];
    const fileSizeInBytes = file.size;
    const fileName = `${Date.now()}-${file.originalname}`;
    const mimeType = file.mimetype;
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let folderPath;

    const title = req.body.title;
    const thumbnail = req.files?.thumbnail?.[0]; // Get thumbnail if exists

    const MAX_PDF_SIZE = 20 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

    if (mimeType === "application/pdf" && fileExtension === ".pdf") {
      if (fileSizeInBytes > MAX_PDF_SIZE) {
        return res.status(400).json({
          message: `PDF file exceeds 20 MB. Size: ${(
            fileSizeInBytes /
            (1024 * 1024)
          ).toFixed(2)} MB.`,
        });
      }
      folderPath = "pdfs/";

      // Don't allow thumbnails for PDFs
      if (thumbnail) {
        return res.status(400).json({
          message: "Thumbnails are only allowed for video files.",
        });
      }
    } else if (mimeType.startsWith("video/")) {
      const allowedVideoExtensions = [".mp4", ".mov"];
      const allowedVideoMimeTypes = ["video/mp4", "video/quicktime"];

      if (
        !allowedVideoExtensions.includes(fileExtension) ||
        !allowedVideoMimeTypes.includes(mimeType)
      ) {
        return res.status(400).json({
          message: "Unsupported video format. Only .mp4 and .mov are allowed.",
        });
      }

      if (fileSizeInBytes > MAX_VIDEO_SIZE) {
        return res.status(400).json({
          message: `Video exceeds 500 MB. Size: ${(
            fileSizeInBytes /
            (1024 * 1024)
          ).toFixed(2)} MB.`,
        });
      }

      const category = req.query.category || "tutorial-videos";
      if (!["recordings", "tutorial-videos"].includes(category)) {
        return res.status(400).json({
          message: 'Invalid category. Use "recordings" or "tutorial-videos".',
        });
      }
      folderPath = `${category}/`;
    } else {
      return res.status(400).json({
        message: "Only PDFs (.pdf) and videos (.mp4, .mov) are allowed.",
      });
    }

    // Upload main file to S3
    const result = await mediaService.uploadToS3(file, fileName, folderPath);

    let thumbnailUrl = null;
    // Upload thumbnail if provided (only for videos)
    if (thumbnail && mimeType.startsWith("video/")) {
      // Validate thumbnail
      const allowedThumbnailTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedThumbnailTypes.includes(thumbnail.mimetype)) {
        return res.status(400).json({
          message: "Thumbnail must be a JPEG, PNG, or WebP image.",
        });
      }

      const thumbnailFileName = `thumbnail-${Date.now()}-${
        thumbnail.originalname
      }`;
      const thumbResult = await mediaService.uploadToS3(
        thumbnail,
        thumbnailFileName,
        "thumbnails/"
      );
      thumbnailUrl = thumbResult.Location;
    }

    // Create media document
    const mediaData = {
      url: result.Location,
      fileName,
      mimeType,
      fileExtension,
      folder: folderPath,
      sizeInBytes: fileSizeInBytes,
      uploadDate: new Date(),
      title: title || file.originalname, // Use title if provided, otherwise original filename
      thumbnailUrl, // Will be null if no thumbnail was uploaded
    };

    const media = new Media(mediaData);
    await media.save();

    res.status(200).json({
      message: `${
        folderPath === "pdfs/" ? "PDF" : "Video"
      } uploaded successfully`,
      data: mediaData,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      message: "Server error while uploading the file.",
      error: error.message,
    });
  }
};


const getAllMedia = async (req, res) => {
  try {
    const mediaFiles = await Media.find().sort({ uploadDate: -1 }); // Sort by upload date, newest first
    if (!mediaFiles || mediaFiles.length === 0) {
      return res
        .status(404)
        .json({ message: "No media files found in the database." });
    }
    res.status(200).json({
      message: "Media files retrieved successfully.",
      data: mediaFiles,
    });
  } catch (error) {
    console.error("Error retrieving media files:", error);
    res.status(500).json({
      message: "Server error while retrieving media files.",
      error: error.message,
    });
  }
};

const getMediaByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ["pdfs", "tutorial-videos", "recordings"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message:
          'Invalid category. Use "pdfs", "tutorial-videos", or "recordings".',
      });
    }

    const mediaFiles = await Media.find({ folder: `${category}/` }).sort({
      uploadDate: -1,
    });
    if (!mediaFiles || mediaFiles.length === 0) {
      return res.status(404).json({
        message: `No media files found for category "${category}".`,
      });
    }

    res.status(200).json({
      message: `Media files for category "${category}" retrieved successfully.`,
      data: mediaFiles,
    });
  } catch (error) {
    console.error("Error retrieving media files by category:", error);
    res.status(500).json({
      message: "Server error while retrieving media files by category.",
      error: error.message,
    });
  }
};


const saveMedia = async (req, res) => {
  try {
    const { mediaId, category } = req.body; // mediaId from the existing media, category from the UI
    const userId = req.user._id; // Assuming verifyJWT sets req.user

    if (!mediaId || !category) {
      return res
        .status(400)
        .json({ message: "mediaId and category are required." });
    }

    const validCategories = ["recordings", "tutorials", "pdfs"];
    if (!validCategories.includes(category)) {
      return res
        .status(400)
        .json({
          message:
            'Invalid category. Use "recordings", "tutorials", or "pdfs".',
        });
    }

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ message: "Media not found." });
    }

    // Check if already saved by this user in the same category
    const isAlreadySaved = media.savedBy.some(
      (save) =>
        save.userId.toString() === userId.toString() &&
        save.category === category
    );
    if (isAlreadySaved) {
      return res
        .status(400)
        .json({ message: "Media already saved in this category." });
    }

    // Add to savedBy array
    media.savedBy.push({ userId, category });
    await media.save();

    res.status(200).json({ message: "Media saved successfully.", data: media });
  } catch (error) {
    console.error("Error saving media:", error);
    res
      .status(500)
      .json({
        message: "Server error while saving media.",
        error: error.message,
      });
  }
};

const getSavedMedia = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming verifyJWT sets req.user

    const mediaFiles = await Media.find({ "savedBy.userId": userId }).sort({
      "savedBy.savedDate": -1,
    });
    if (!mediaFiles || mediaFiles.length === 0) {
      return res.status(404).json({ message: "No saved media found." });
    }

    res.status(200).json({
      message: "Saved media retrieved successfully.",
      data: mediaFiles,
    });
  } catch (error) {
    console.error("Error retrieving saved media:", error);
    res.status(500).json({
      message: "Server error while retrieving saved media.",
      error: error.message,
    });
  }
};



export { uploadMedia, getAllMedia, getMediaByCategory, saveMedia, getSavedMedia };
