import express from "express";
import multer from "multer";
import {
  uploadMedia,
  getAllMedia,
  getMediaByCategory,
  saveMedia,
  getSavedMedia,
} from "../controllers/mediaController.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Configure multer for file upload with a size limit of 500 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB in bytes
    files: 2, // Allow main file + thumbnail
  },
  fileFilter: (req, file, cb) => {
    // Allow only certain file types
    if (
      file.fieldname === "file" &&
      !["application/pdf", "video/mp4", "video/quicktime"].includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error("Only PDF and video files are allowed for main upload")
      );
    }

    if (
      file.fieldname === "thumbnail" &&
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    ) {
      return cb(
        new Error("Only JPEG, PNG, and WebP images are allowed for thumbnails")
      );
    }

    cb(null, true);
  },
});

// Upload media (requires authentication)
// Upload media with optional thumbnail and title
router.post(
  "/upload-media",
  verifyJWT,
  //verifyAdmin, // Only allow admins to upload
  (req, res, next) => {
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ])(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message:
              "Max file upload size is 500 MB for videos and 20 MB for PDFs.",
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            message:
              "Unexpected file field. Only 'file' and 'thumbnail' are allowed.",
          });
        }
      } else if (err) {
        return res.status(400).json({
          message: err.message,
        });
      }
      next();
    });
  },
  uploadMedia
);



// Get all media files (requires authentication)
router.get("/media", verifyJWT, getAllMedia);

// Get media files by category (requires authentication)
router.get("/media/:category", verifyJWT, getMediaByCategory);

router.post("/save-media", verifyJWT, saveMedia);
router.get("/saved-media", verifyJWT, getSavedMedia);

export default router;
