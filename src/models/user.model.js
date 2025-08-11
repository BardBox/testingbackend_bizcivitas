import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { roles, genders } from "../constants.js";


const userSchema = new Schema(
  {
    avatar: {
      type: String,
      required: true,
      default:
        "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
    role: {
      type: String,
      enum: roles,
      required: true,
      default: "user",
      trim: true,
    },
    fname: {
      type: String,
      required: true,
      trim: true,
    },
    lname: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      trim: true,
    },
    mobile: {
      type: Number,
      required: true,
      unique: true,
    },
    region: {
      type: String,
      required: true,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      unique: true,
    },
    gender: {
      type: String,
      enum: genders,
      trim: true,
    },
    referBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    password: {
      type: String,
    },
    business: {
      type: String,
      trim: true,
      default: "",
    },
    businessSubcategory: {
      type: String,
      trim: true,
      default: "",
    },
    profile: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
    },
    
     community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    index: true},
    connections: [
      {
        type: Schema.Types.ObjectId,
        ref: "Connection",
      },
    ],
    renewalDate: {
      type: Date,
      default: Date.now,
    },
    credentialSentAt: {
      type: Date,
    },
    membershipStatus: {
      type: Boolean,
      required: true,
      default: false,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    isLogin: {
      type: Number,
      required: true,
      default: 0,
    },
    refreshToken: {
      type: String,
    },
    membershipType: {
      type: String,
      enum: ["Core Membership", "Flagship Membership", "Industria Membership", "Digital Membership"],
      required: true,
      trim: true,
    },

       membershipIcon: {

      type: String,
      get: function () {
        const baseUrl = "https://backend.bizcivitas.com/api/v1/image/user";
        const iconMap = {

          "Core Membership": `${baseUrl}/core-Membership.png`,

          "Flagship Membership": `${baseUrl}/Flagship-Membership.png`,
          "Industria Membership": `${baseUrl}/Industria-Membership.png`,
          "Digital Membership": `${baseUrl}/Digital-Membership.png`,
        };
        return iconMap[this.membershipType] || `${baseUrl}/default.png`;
      },
    },
    paymentVerification: [
      {
        type: Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    fcmTokens: [
      {
        type: String,
        default: [],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { getters: true }, // Enable getters for toJSON
    toObject: { getters: true }, // Enable getters for toObject
  }
);

// Hash the password before saving
userSchema.pre("save", async function (next) {
  try {
    if (this.password) {
      if (!this.isModified("password")) return next();
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  } catch (error) {
    console.error("Error in pre-save hook:", error.message);
    next(error);
  }
});

// Verify Password
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      fname: this.fname,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

// Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};



export const User = mongoose.model("User", userSchema);


// Generate a username before validation
userSchema.pre("validate", async function (next) {
  if (!this.username && this.fname) {
    let baseUsername = this.fname.toLowerCase().replace(/\s+/g, "") + Math.floor(100 + Math.random() * 900); // fname + 3-digit number
    let usernameExists = await User.findOne({ username: baseUsername });

    // Keep trying until a unique username is found
    while (usernameExists) {
      baseUsername = this.fname.toLowerCase().replace(/\s+/g, "") + Math.floor(100 + Math.random() * 900);
      usernameExists = await User.findOne({ username: baseUsername });
    }

    this.username = baseUsername;
  }
  next();
});
