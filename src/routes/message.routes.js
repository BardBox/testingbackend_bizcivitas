import express from "express";
import { allMessages, sendMessage ,markMessageAsSeen,deleteMessage , editMessage} from "../controllers/message.controller.js";
import { verifyJWT} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/:chatId").get(verifyJWT, allMessages);
router.route("/").post(verifyJWT, sendMessage);
router.route("/seen").put(verifyJWT, markMessageAsSeen);
router.route("/delete").delete(verifyJWT, deleteMessage);
router.route("/edit/:id").put(verifyJWT, editMessage); // Added edit route

export default router;
