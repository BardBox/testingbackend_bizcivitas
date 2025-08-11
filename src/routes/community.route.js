import { Router } from "express";
import {
  createCommunity,
  getUserIdsByCommunityId,
  updateCommunity,
  getAllCommunities,
  removeUserFromCommunity,
  deleteCommunity,
  searchUsersInCommunity,
} from "../controllers/community.controller.js";
import { createUpload } from "../middlewares/multer.middleware.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();
const upload = createUpload("community");

router.route("/").post(
  verifyJWT,
  authorizeRoles("admin", "core-member"),
  upload.fields([
    {
      name: "image",
      maxCount: 1,
    },
  ]),
  createCommunity
);

router.route("/:id").put(
  verifyJWT,
  authorizeRoles("admin", "core-member"),
  upload.fields([
    {
      name: "image",
      maxCount: 1,
    },
  ]),
  updateCommunity
);

router
  .route("/:id")
  .delete(verifyJWT, authorizeRoles("admin", "core-member"), deleteCommunity);

router
  .route("/:id")
  .get(verifyJWT, authorizeRoles("admin", "core-member", "user"), getUserIdsByCommunityId);

router
  .route("/:id/search")
  .get(verifyJWT, authorizeRoles("admin", "core-member", "user"), searchUsersInCommunity);

router.route("/").get(verifyJWT, authorizeRoles("admin", "core-member"), getAllCommunities);

router
  .route("/user/remove")
  .post(verifyJWT, authorizeRoles("admin", "core-member"), removeUserFromCommunity);

export default router;