import { Router } from "express";
import {
  createPost,
  getPosts,
  addComment,
  likePost,
  votePoll,
  removeVote,
  deletePost,
  upload,
  editPost,
  getPostById,
  handleMulterError,
  likeComment,
  editComment,
   deleteComment,
} from "../controllers/post.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Routes
router.route("/create").post(verifyJWT, upload.fields([{ name: "media", maxCount: 1 }]), handleMulterError, createPost);
router.route("/").get(verifyJWT, getPosts);
router.route("/:id").get(verifyJWT, getPostById);
router.route("/:id/comment").post(verifyJWT, upload.fields([{ name: "media", maxCount: 1 }]), handleMulterError, addComment);
router.route("/like").post(verifyJWT, likePost);
router.route("/vote").post(verifyJWT, votePoll);
router.route("/remove-vote").post(verifyJWT, removeVote);
router.route("/:id").delete(verifyJWT, deletePost);

router.route("/:id").patch(verifyJWT, upload.fields([{ name: "media", maxCount: 1 }]), handleMulterError, editPost);
router.route("/:postId/comments/:commentId/like")
  .post(verifyJWT, likeComment);
router.route("/comments/edit").put(
  verifyJWT,
  upload.fields([{ name: "media", maxCount: 1 }]),
  handleMulterError,
  editComment
);
router
  .route("/:postId/comments/:commentId")
  .delete(verifyJWT, deleteComment);

export default router;