import express from "express";
import {
  accessChat,
  fetchChats,
  deleteChat,
} from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/").post(verifyJWT, accessChat);
router.route("/").get(verifyJWT, fetchChats);
router.route("/:chatId").delete(verifyJWT, deleteChat);

export default router;