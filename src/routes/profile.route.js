import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createUpload } from "../middlewares/multer.middleware.js";
import {
  getProfile,
  updateUserDetails,
  updatePersonalDetails,
  updateContactDetails,
  updateAddressDetails,
  updateBioDetails,
  updateProfessionalDetails,
  updateWeeklyPresentation,
  updateFullProfile,
  toggleProfessionalDetailsVisibility,
} from "../controllers/profile.controller.js";

const router = Router();
const upload = createUpload("user");
const uploadForLogo = createUpload("companyLogo");

router.route("/userDetails").patch(
  verifyJWT,
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  updateUserDetails
);
router.route("/personalDetails").patch(verifyJWT, updatePersonalDetails);
router.route("/contactDetails").patch(verifyJWT, updateContactDetails);
router.route("/addressesDetails").patch(verifyJWT, updateAddressDetails);
router.route("/bioDetails").patch(verifyJWT, updateBioDetails);
router.route("/professionalDetails")
  .patch(
    verifyJWT,
    uploadForLogo.fields([{ name: "companyLogo", maxCount: 1 }]),
    updateProfessionalDetails
  );
  
router.route("/professionalDetails/visibility")
  .patch(verifyJWT, toggleProfessionalDetailsVisibility);
router.route("/weeklyPresentation").patch(verifyJWT, updateWeeklyPresentation);
router.route("/updateFullProfile").patch(
  verifyJWT,
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  updateFullProfile
);

router.route("/getProfile").get(verifyJWT, getProfile);

// In profile.route.js, add this new route
router.route("/toggleProfessionalVisibility")
  .patch(verifyJWT, toggleProfessionalDetailsVisibility);

export default router;
