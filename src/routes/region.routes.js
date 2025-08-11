import express from "express";
import {
  createRegion,
  getAllRegions,
  updateRegion,
  deleteRegion,
} from "../controllers/region.controller.js";
import { authorizeRoles, verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/create").post(verifyJWT,authorizeRoles("admin"),createRegion);
router.route("/getallregions").get(getAllRegions);
router.route("/update/:id").put(verifyJWT,authorizeRoles("admin"),updateRegion);
router.route("/delete/:id").delete(verifyJWT,authorizeRoles("admin"),deleteRegion);

export default router;