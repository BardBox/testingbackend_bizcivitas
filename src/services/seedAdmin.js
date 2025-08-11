import { User } from "../models/user.model.js"; // Adjust the path accordingly
import dotenv from "dotenv";
import { roles } from "../constants.js";
import ApiErrors from "../utils/ApiErrors.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
      
      const adminUser = new User({
        fname: "Bizcivitas",
        lname: "admin",
        email: "admin@gmail.com",
        mobile: 9999999999, 
        region : "Ahmedabad",
        username: "admin",
        gender: "male",
        password: "Admin@123",
        role: roles[2],
        isApproved: true,
        isActive: true,
        isEmailVerified: true,
      });

      await adminUser.save();
      console.log("Admin user created successfully");
    } else {
      console.log("Admin user already exists");
    }
  } catch (error) {
     throw new ApiErrors(500, "Error seeding admin user: " + error.message);
  }
};

export default seedAdmin;