import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  createEvent,
  getAllEvents,
  getEventById,
  editEvent,
  deleteEvent,
  
  addUserToEventParticipants,
  removeUserFromEventParticipants,
  getAllEventsPass,
  getUserEvents,
  getUserCommunityAndEvents,
    
} from "../controllers/event.controller.js";
import { createUpload } from "../middlewares/multer.middleware.js";

const router = Router();

const upload = createUpload("event");
// One-day Events
router
  .route("/event/create")
  .post(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "img", maxCount: 1 }]),
    createEvent
  );
router.route("/event").get(getAllEvents);
router.route("/event/:id").get(getEventById);
router
  .route("/event/edit/:id")
  .put(
    verifyJWT,
    authorizeRoles("admin"),
    upload.fields([{ name: "img", maxCount: 1 }]),
    editEvent
  );
router
  .route("/event/delete/:id")
  .delete(verifyJWT, authorizeRoles("admin"), deleteEvent);

// Trip Events

router.route("/add-participant").post(verifyJWT, addUserToEventParticipants);
router.route("/remove-participant").post(verifyJWT, removeUserFromEventParticipants);
router.route("/pass-events").get(verifyJWT, getAllEventsPass);
router.route("/user-events").get(verifyJWT, getUserEvents);
router.route("/event-show/:eventType").get(verifyJWT, getUserCommunityAndEvents);


export default router;