import express from 'express';
import { getImage } from '../controllers/image.controller.js';

const router = express.Router();

// Define the route for serving the image
router.get("/:category/:filename", getImage);

export default router;