import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import {
  sendConnectionRequest,
  acceptConnectionRequest,
  getUserConnections,
  deleteConnectionRequest,
  getUserConnectionRequests,
  getSuggestions,
  getUserDetails,
  getSuggestionsAll,
} from "../controllers/connection.controller.js";

const router = Router();

// Send connection request
router.post("/send-request", verifyJWT, sendConnectionRequest);

// Accept connection request
router.post("/accept-request", verifyJWT, acceptConnectionRequest);

// Reject connection request
router.delete("/delete-connection", verifyJWT, deleteConnectionRequest);

//get Suggestions
router.get("/getSuggestions", verifyJWT, getSuggestions);

router.get("/getSuggestionsAll", verifyJWT, getSuggestionsAll);

// Get user connections
router.get("/", verifyJWT, getUserConnections);

// Get user connection requests
router.get(
  "/:type/connection-requests",
  verifyJWT,
  getUserConnectionRequests
);

router.get(
  "/user/:id",
  verifyJWT,
  getUserDetails
);

export default router;
