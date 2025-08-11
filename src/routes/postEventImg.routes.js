import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  addPostEventImages,
  removePostEventImages,
  getPostEventImageById,
} from "../controllers/postEventImg.controller.js";
import { createUpload } from "../middlewares/multer.middleware.js";

const router = Router();
const upload = createUpload("event").array("images");

// Create Blog
router
  .route("/addPostEventImages")
  .post(verifyJWT, authorizeRoles("admin"), upload, addPostEventImages);

router
  .route("/removePostEventImages")
  .delete(verifyJWT, authorizeRoles("admin"), removePostEventImages);

router
  .route("/:eventId/:eventType")
  .get(verifyJWT, getPostEventImageById);

export default router;