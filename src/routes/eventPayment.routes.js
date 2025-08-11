import { Router } from "express";
import { createPaymentOrder, verifyPayment } from "../controllers/eventPayment.controller.js"; // Removed handleWebhook
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/create-order", createPaymentOrder);
router.post("/verify",  verifyPayment);
// Removed: router.post("/webhook", handleWebhook);

export default router;