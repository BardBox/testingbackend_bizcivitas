import express from "express";

import { createRegistration, changeRegistration } from "../controllers/registration.controller.js";

const router=express.Router()

router.route('/create').post(createRegistration);
router.route('/changeRegistration').post(changeRegistration);

export default router;