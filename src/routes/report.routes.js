import express from "express";
import ReportController from "../controllers/report.controller.js"; // Adjust path as needed
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js"; // Adjust path as needed

const router = express.Router();

// POST /api/v1/report - Create a new report
router.route("/")
  .post(verifyJWT, ReportController.createReport);

// GET /api/v1/report/check/:postId - Check if the authenticated user has reported the post
router.route("/check/:postId")
  .get(verifyJWT, ReportController.checkPostReported);

// GET /api/v1/report/admin/reports - Get all pending reports for admin
router.route("/admin/reports")
  .get(verifyJWT, authorizeRoles("admin"), ReportController.getReports);

// PUT /api/v1/report/admin/reports/:reportId - Update report status
router.route("/admin/reports/:reportId")
  .put(verifyJWT, authorizeRoles("admin"), ReportController.updateReport);

export default router;