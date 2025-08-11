import mongoose from "mongoose";
import { Report } from "../models/report.model.js"; // Adjust path as needed
import { Post } from "../models/post.model.js"; // Adjust path as needed

// Controller class for report-related API endpoints
class ReportController {
  // POST /report - Create a new report
  static async createReport(req, res) {
    try {
      const { postId, reason } = req.body;
      const reporterId = req.user.id; // From auth middleware

      // Validate input
      if (!postId || !reason) {
        return res.status(400).json({ error: "postId and reason are required" });
      }

      // Validate postId and reporterId as valid ObjectIds
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ error: "Invalid postId format" });
      }
      if (!mongoose.Types.ObjectId.isValid(reporterId)) {
        return res.status(400).json({ error: "Invalid reporterId format" });
      }

      // Create report (duplicate check handled by unique index)
      const report = await Report.create({ postId, reporterId, reason });
      console.log(`Created report ${report._id}: createdAt = ${report.createdAt}, timeAgo = ${report.timeAgo}`);
      return res.status(201).json({ message: "Report created successfully", report });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ error: "You have already reported this post" });
      }
      console.error("Error in createReport:", error);
      return res.status(400).json({ error: `Failed to create report: ${error.message}` });
    }
  }

  // GET /report/check/:postId - Check if the authenticated user has reported the post (for hiding in their feed)
  static async checkPostReported(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.user?.id; // From auth middleware (optional, if user is authenticated)

      // Validate postId
      if (!postId) {
        return res.status(400).json({ error: "postId is required" });
      }
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ error: "Invalid postId format" });
      }

      // If no user is authenticated, return isReported: false (public access case)
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(200).json({ isReported: false });
      }

      // Check if the authenticated user has reported this post (regardless of report status)
      const report = await Report.findOne({ postId, reporterId: userId });
      const isReported = !!report; // True if the user has reported the post
      if (report) {
        console.log(`Post ${postId} is reported by user ${userId}: createdAt = ${report.createdAt}, timeAgo = ${report.timeAgo}`);
      }
      return res.status(200).json({ isReported });
    } catch (error) {
      console.error("Error in checkPostReported:", error);
      return res.status(500).json({ error: `Failed to check report status: ${error.message}` });
    }
  }

  // GET /admin/reports - Get all pending reports for admin
  static async getReports(req, res) {
    try {
      // Fetch pending reports with populated post and reporter details
      const reports = await Report.find({ status: "pending" })
        .populate("postId", "title description")
        .populate("reporterId", "username")
        .sort({ createdAt: -1 });

      // Log time information for each report
      reports.forEach(report => {
        console.log(`Report ${report._id}: createdAt = ${report.createdAt}, timeAgo = ${report.timeAgo}`);
      });

      return res.status(200).json(reports);
    } catch (error) {
      console.error("Error in getReports:", error);
      return res.status(500).json({ error: `Failed to fetch reports: ${error.message}` });
    }
  }

  // PUT /admin/reports/:reportId - Update report status and admin action
  static async updateReport(req, res) {
    try {
      const { reportId } = req.params;
      const { status, adminAction } = req.body;

      // Validate reportId
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(400).json({ error: "Invalid reportId format" });
      }

      // Validate status
      if (!status || !["pending", "reviewed", "resolved"].includes(status)) {
        return res.status(400).json({ error: "Valid status is required" });
      }

      // Update report
      const report = await Report.findByIdAndUpdate(
        reportId,
        { status, adminAction },
        { new: true, runValidators: true }
      );

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      // If the admin resolves the report and the action indicates the post should be hidden, update the post
      if (status === "resolved" && adminAction && adminAction.toLowerCase().includes("hidden")) {
        await Post.findByIdAndUpdate(report.postId, { isHidden: true });
        console.log(`Post ${report.postId} set to hidden globally due to admin action`);
      }

      console.log(`Updated report ${reportId}: createdAt = ${report.createdAt}, timeAgo = ${report.timeAgo}`);
      return res.status(200).json({ message: "Report updated successfully", report });
    } catch (error) {
      console.error("Error in updateReport:", error);
      return res.status(400).json({ error: `Failed to update report: ${error.message}` });
    }
  }
}

export default ReportController;