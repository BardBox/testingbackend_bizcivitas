import { Router } from "express";
import {
  addCoreMember,
  getAllCoreMembers,
  searchCoreMembers,
  getCorememberStats,
  getUsersReferredByCoreMember,
  getHighestPayingReferredUser,
  getAllCommunitiesOfCoreMember,
} from "../controllers/coremember.controller.js";
import { deleteUser, updateUser } from "../controllers/user.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
const router = Router();

router.post("/add", verifyJWT, authorizeRoles("admin"), addCoreMember);
router.put("/:id", verifyJWT, authorizeRoles("admin" ,"core-member"), updateUser );
router.delete("/:id", verifyJWT, authorizeRoles("admin"), deleteUser);

router.get(
  "/",
  // verifyJWT,
  // authorizeRoles("admin", "core-member"),
  getAllCoreMembers
);
router.get("/search", searchCoreMembers);

//core-member dashboard
router.get(
  "/dashboard",
  verifyJWT,
  authorizeRoles("core-member"),
  getCorememberStats
);

router.get(
  "/referred-users",
  verifyJWT,
  authorizeRoles("core-member"),
  getUsersReferredByCoreMember
);

router.get(
  "/highest-paying-referred-user",
  verifyJWT,
  authorizeRoles("core-member"),
  getHighestPayingReferredUser
);

router.get(
  "/getAllCommunitiesOfCoreMember",
  verifyJWT,
  authorizeRoles("core-member"),
  getAllCommunitiesOfCoreMember
);

//core-member dashboard for admin
router.get(
  "/dashboard/:id",
  verifyJWT,
  authorizeRoles("admin"),
  getCorememberStats
);

router.get(
  "/referred-users/:id",
  verifyJWT,
  authorizeRoles("admin" ,"core-member"),
  getUsersReferredByCoreMember
);

router.get(
  "/highest-paying-referred-user/:id",
  verifyJWT,
  authorizeRoles("admin"),
  getHighestPayingReferredUser
);

router.get(
  "/getAllCommunitiesOfCoreMember/:id",
  verifyJWT,
  authorizeRoles("admin"),
  getAllCommunitiesOfCoreMember
);

export default router;