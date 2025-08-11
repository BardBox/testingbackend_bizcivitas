import { User } from "../models/user.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";


export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "") || req.body.accessToken;
        
        if (!token) {
            throw new ApiErrors(401, "Unauthorized: No token provided")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if (!user) {
            throw new ApiErrors(401, "Unauthorized: User not found")
        }
        req.user = user;
        next();
    } catch (error) {
      console.error("JWT verification error:", error);  // Log the full error for debugging

      // Handle specific JWT errors
      if (error.name === "TokenExpiredError") {
        return next(new ApiErrors(401, "Your session has expired. Please log in again."))
      } else if (error.name === "JsonWebTokenError") {
          // This handles the case for invalid signature (also handles other JWT errors)
          return next(new ApiErrors(401, "Invalid token. Please log in again."))
      } else if (error.name === "NotBeforeError") {
          return next(new ApiErrors(401, "Token not active yet. Please try again later."))
      } else {
          // If an unexpected error occurs, still throw a 401 but give a general message
          return next(new ApiErrors(401, "Unauthorized: Invalid or expired token."))
      }
    }
    
})

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ApiErrors(403, "Forbidden: You do not have access to this resource");
    }
    next();
  };
};