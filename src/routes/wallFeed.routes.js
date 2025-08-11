import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  createEventWallFeed,
  updateEventWallFeed,
  createPollWallFeed,
  updatePollWallFeed,
  voteOnPoll,
  removeVoteFromPoll,
  createArticleWallFeed,
  updateArticleWallFeed,
  createAnnouncementWallFeed,
  updateAnnouncementWallFeed,
  createGenericWallFeed,
  updateGenericWallFeed,
  deleteWallFeed,
  getWallFeed,
  getWallFeedById,
  addCommentToWallFeed,
  likeWallFeed,
  deleteCommentFromWallFeed,
  likeComment,
  editCommentOnWallFeed,
} from "../controllers/wallFeed.controller.js";
import { createUpload } from "../middlewares/multer.middleware.js";

const router = Router();
const upload = createUpload("wallFeed");

// CREATE Wall Feed
router
  .route("/create-event")
  .post(verifyJWT, authorizeRoles("admin"), createEventWallFeed);

router
  .route("/edit-event/:id")
  .put(verifyJWT, authorizeRoles("admin"), updateEventWallFeed);

router
  .route("/create-poll")
  .post(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "image", maxCount: 1 }]),
    createPollWallFeed
  );

router
  .route("/edit-poll/:id")
  .put(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "image", maxCount: 1 }]),
    updatePollWallFeed
  );

router.route("/vote/:id").put(verifyJWT, voteOnPoll);

router.route("/vote/remove/:id").put(verifyJWT, removeVoteFromPoll);

router
  .route("/create-article")
  .post(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "image", maxCount: 1 }]),
    createArticleWallFeed
  );

router
  .route("/edit-article/:id")
  .put(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "image", maxCount: 1 }]),
    updateArticleWallFeed
  );

router
  .route("/create-announcement")
  .post(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "image", maxCount: 1 }]),
    createAnnouncementWallFeed
  );

router
  .route("/edit-announcement/:id")
  .put(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "image", maxCount: 1 }]),
    updateAnnouncementWallFeed
  );

router.route("/create-generic").post(
  verifyJWT,
  authorizeRoles("admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  createGenericWallFeed
);

router.route("/edit-generic/:id").put(
  verifyJWT,
  authorizeRoles("admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  updateGenericWallFeed
);

router
  .route("/delete/:id")
  .delete(verifyJWT, authorizeRoles("admin"), deleteWallFeed);

router.route("/").get(verifyJWT, getWallFeed);

router.route("/:id").get(verifyJWT, getWallFeedById);

router
  .route("/comment/:id")
  .post(verifyJWT, upload.single("image"), addCommentToWallFeed);

router
  .route("/comment/:wallFeedId/:commentId")
  .delete(verifyJWT, deleteCommentFromWallFeed);

  router
  .route("/comment/:wallFeedId/:commentId/edit")
  .put(verifyJWT, upload.single("image"), editCommentOnWallFeed);
  // Add this route
router
  .route("/:wallFeedId/comments/:commentId/like")
  .post(verifyJWT, likeComment);

router.route("/like").post(verifyJWT, likeWallFeed);

export default router;
