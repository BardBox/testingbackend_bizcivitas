import { Router } from "express";
import { getDashboardStats ,getUpcomingEvents,getLastRegisteredUsers ,getLastCoreMembers , getPaymentTotals, getUserStatistics, getUpcomingEventsForUser ,getReferralAndTYFCBStats} from "../controllers/dashboard.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/stats").get(verifyJWT, authorizeRoles("admin"),getDashboardStats);
router.route("/upcoming-events").get(verifyJWT, authorizeRoles("admin"),getUpcomingEvents);
router.route("/registered-users").get(verifyJWT, authorizeRoles("admin"),getLastRegisteredUsers);
router.route("/registered-coremember").get(verifyJWT, authorizeRoles("admin"),getLastCoreMembers);
router.route("/payment-stats").get(verifyJWT, authorizeRoles("admin"),getPaymentTotals);
router.route("/user-stats").get(verifyJWT, authorizeRoles("admin"),getUserStatistics);
router.route("/upcomingevents").get(verifyJWT,getUpcomingEventsForUser);
router.route("/user-referralstate/:id").get(verifyJWT,getReferralAndTYFCBStats);
router.route("/user-referralstate").get(verifyJWT,getReferralAndTYFCBStats);


export default router;