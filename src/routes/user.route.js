import {
  registerUser,
  validatePayment,
  loginUser,
  logoutUser,
  refreshAccessToken,
  deleteUser,
  getCurrentUser,
  getAllUsers,
  changeCurrentPassword,
  searchAllUsers,
  sendCredentials,
  updateUser,
  generateVCard,
  downloadVCard,
  checkRegistrationStatus,
  getUsersWithPaymentDetails,
  getCommunityMembers,
  getUserById,
  handlePaymentSuccess,
  recordManualPayment,
} from "../controllers/user.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { Router } from "express";

const router = Router();

// Public routes
router.route("/register").post(registerUser);

// Login user
router.route("/login").post(loginUser);
router.route("/validate-payment").post(validatePayment);
router.route("/check-registration").get(checkRegistrationStatus);
router.route("/search").get(verifyJWT, searchAllUsers);
router.route("/vcard/:userId").get(generateVCard);
router.route("/download-vcard/:userId").get(downloadVCard);
router.route("/handle-payment-success").post(handlePaymentSuccess); 
// Authenticated routes
router.route("/get-user").get(verifyJWT, getCurrentUser);
router.route("/getallusers").get(verifyJWT, getAllUsers);
router.route("/refresh-access-token").patch(refreshAccessToken);
router.route("/changepassword").patch(verifyJWT, changeCurrentPassword);
router.route("/logout").patch(verifyJWT, logoutUser);
router.route("/delete").delete(verifyJWT, deleteUser);

// Admin or core-member routes
router.route("/delete/:id").delete(verifyJWT, authorizeRoles("admin"), deleteUser);
router.route("/send-credentials/:id").post(verifyJWT, authorizeRoles("admin"), sendCredentials);
router.route("/update/:id").put(verifyJWT, authorizeRoles("admin", "core-member"), updateUser);

// Admin-only routes for fees, payments, and manual payment handling
router.route("/admin/fees-payments").get(verifyJWT, authorizeRoles("admin"), getUsersWithPaymentDetails);

// Community members route
router.route("/community-members").get(verifyJWT, getCommunityMembers);

// Get user by ID
router.route("/user/:userId").get(verifyJWT, getUserById);

router.post("/manual-payment", verifyJWT, recordManualPayment);

export default router;