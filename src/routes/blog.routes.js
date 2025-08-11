import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogById,
  getAllBlogs,
} from "../controllers/blog.controller.js";
import { createUpload } from "../middlewares/multer.middleware.js";

const router = Router();
const upload = createUpload("blog");

// Create Blog
router
  .route("/create")
  .post(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "featuredImage", maxCount: 1 }]),
    createBlog
  );

// Get All Blogs
router.route("/").get(getAllBlogs);

// Get Single Blog by ID
router.route("/:id").get(getBlogById);

// Update Blog
router
  .route("/edit/:id")
  .put(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "featuredImage", maxCount: 1 }]),  // Handle image upload
    updateBlog  // Controller for updating a blog
  );

// Delete Blog
router
  .route("/delete/:id")
  .delete(verifyJWT, authorizeRoles("admin"), deleteBlog);


export default router;