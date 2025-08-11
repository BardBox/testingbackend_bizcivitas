// guests.router.js
import express from 'express';
import {
  registerGuest,
  deregisterGuest,
  getAllGuests,
  setEntered,
  getOneGuest,
  addTableNo,
  deleteOneGuest,
  getEventParticipants,
} from '../controllers/guest.controller.js';
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Define specific routes first
router.get('/participants', getEventParticipants);

// Define generic routes after specific ones
router.post('/register',verifyJWT, registerGuest);
router.post('/deregister', verifyJWT, deregisterGuest);
router.get('/', getAllGuests);
router.get('/:id', getOneGuest); // Move this after /participants
router.patch('/set-entered/:id', setEntered);
router.post('/add-table', addTableNo);
router.delete('/:id', deleteOneGuest);

export default router;