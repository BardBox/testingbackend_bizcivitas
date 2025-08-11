import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createMembershipBenefit,
  updateMembershipBenefit,
  deleteMembershipBenefit,
  getAllMembershipBenefits,
  getUserMembershipBenefits,
} from "../controllers/membershipBenefit.controller.js";

const router = Router();

// Admin routes – now only require JWT
router
  .route("/admin/benefits")
  .post(verifyJWT, createMembershipBenefit)
  .get(verifyJWT, getAllMembershipBenefits);

router
  .route("/admin/benefits/:id")
  .put(verifyJWT, updateMembershipBenefit)
  .delete(verifyJWT, deleteMembershipBenefit);

// User route
router
  .route("/benefits")
  .get(verifyJWT, getUserMembershipBenefits);

export default router;
