import { Blog } from "../models/blog.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import path from "path";
import fs from "fs";
import asyncHandler from "../utils/asyncHandler.js"

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");
// Helper function to delete an image file
const deleteImage = (imagePath) => {
    if (imagePath) {
      const fullPath = path.join(baseImageDir, imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  };

  const createBlog = asyncHandler(async (req, res) => {
    const { title, author, sections } = req.body;
    const image = req.files?.featuredImage?.[0];
  
    // Check required fields
    const requiredFields = [title, author];
    const isFieldMissing = requiredFields.some(field => !field);
  
    if (isFieldMissing) {
      throw new ApiErrors(400, "Please fill in all required fields");
    }
  
    if (!image) {
      throw new ApiErrors(400, "Featured image file is required");
    }
  
    const featuredImage = `blog/${path.basename(image.path)}`;
  
    try {
      const blog = new Blog({
        title,
        author,
        featuredImage,
        sections: sections ? JSON.parse(sections) : []
      });
  
      await blog.save();
      return res
        .status(201)
        .json(new ApiResponses(201, blog, "Blog created successfully"));
    } catch (error) {
      if (image && image.path) {
        const imagePath = path.join(baseImageDir, "blog", path.basename(image.path));
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log("Uploaded image deleted due to error");
        }
      }
      console.log(error);
      throw error;
    }
  });

// Update Blog
const updateBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, author, sections } = req.body;
    const image = req.files?.featuredImage?.[0];
  
    try {
      const blog = await Blog.findById(id);
      if (!blog) {
        throw new ApiErrors(404, "Blog not found");
      }
  
      blog.title = title || blog.title;
      blog.author = author || blog.author;
      blog.sections = sections ? JSON.parse(sections) : blog.sections;
  
      if (image) {
        // Delete old image if exists
        if (blog.featuredImage) {
          const oldImagePath = path.join(baseImageDir, blog.featuredImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("Old image deleted");
          }
        }
        // Set new image path
        const updatedImage = `blog/${path.basename(image.path)}`;
        blog.featuredImage = updatedImage;
      }
  
      await blog.save();
      return res
        .status(200)
        .json(new ApiResponses(200, blog, "Blog updated successfully"));
    } catch (error) {
      if (image && image.path) {
        const uploadedImagePath = path.join(baseImageDir, "blog", path.basename(image.path));
        if (fs.existsSync(uploadedImagePath)) {
          fs.unlinkSync(uploadedImagePath);
          console.log("Uploaded image deleted due to error");
        }
      }
      console.log(error);
      throw error;
    }
  });

// Delete Blog
const deleteBlog = asyncHandler(async (req, res) => {
    const blogId = req.params.id;
  
    try {
      const blog = await Blog.findById(blogId);
      if (!blog) {
        throw new ApiErrors(404, "Blog not found");
      }
  
      // Delete featured image
      if (blog.featuredImage) {
        const imagePath = path.join(baseImageDir, blog.featuredImage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log("Featured image deleted");
        }
      }
  
      // Delete section images if they exist
      if (blog.sections && blog.sections.length > 0) {
        blog.sections.forEach((section) => {
          if (section.image) {
            const sectionImagePath = path.join(baseImageDir, section.image);
            if (fs.existsSync(sectionImagePath)) {
              fs.unlinkSync(sectionImagePath);
              console.log("Section image deleted");
            }
          }
        });
      }
  
      await Blog.findByIdAndDelete(blogId);
      return res
        .status(200)
        .json(new ApiResponses(200, {}, "Blog deleted successfully"));
    } catch (error) {
      console.log(error);
      throw new ApiErrors(500, "Failed to delete blog");
    }
  });

// Get All Blogs
const getAllBlogs = async (req, res, next) => {
  try {
    const blogs = await Blog.find();
    return res
      .status(200)
      .json(new ApiResponses(200, blogs, "Blogs retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

// Get Blog by ID
const getBlogById = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) throw new ApiErrors(404, "Blog not found");

    return res
      .status(200)
      .json(new ApiResponses(200, blog, "Blog retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

// Export the functions
export { createBlog, updateBlog, deleteBlog, getBlogById, getAllBlogs };