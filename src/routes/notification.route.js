// src/routes/notification.routes.js
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getUnread,
  sendToAll,
  updateFcmToken,
  sendToUser,
  sendNotification,
  markRead,
  markAllAsRead,
  getAllNotifications,
    deleteNotification,      // ✅ added
  deleteAllNotifications,  // ✅ added

} from "../controllers/notification.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/getUnread").get(getUnread);

router.route("/getAllnotifications").get(getAllNotifications);
router.route("/markAsRead").put(markRead);
router.route("/markAsRead/:id").put(markRead);
router.route("/send").post(sendToUser);
router.route("/sendToAll").post(sendToAll);
router.route("/updateFcmToken").post(updateFcmToken);
router.route("/send-notification").post(sendNotification);
router.route("/mark-all-read").patch( markAllAsRead);
router.route("/notifications/:id").delete(deleteNotification);
router.route("/notifications").delete(deleteAllNotifications);



export default router;
