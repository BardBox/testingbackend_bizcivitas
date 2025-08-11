import express from "express";
import { payNow } from "../controllers/payment.controller.js";

const router = express.Router();

router.route("/pay-now").post(payNow);

export default router;