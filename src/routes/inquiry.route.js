import { Router } from "express";
import { addInquiry, getAllInquiries, deleteInquiry } from "../controllers/inquiry.controller.js";

const router = Router();

router.post("/add", addInquiry);
router.get("/", getAllInquiries);
router.delete("/:id", deleteInquiry);

export default router;