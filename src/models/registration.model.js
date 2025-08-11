import mongoose, {Schema} from "mongoose";

const registrationSchema = new Schema(
  {
    fname: {
      type: String,
      required: true, // Fixed typo: was "require"
      trim: true,
    },
    lname: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true, // Fixed typo: was "require"
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String, // Changed from Number to String to handle mobile numbers properly
      required: true, // Fixed typo: was "require"
    },
    referBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    region: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      default: "Digital Member",
    },
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    gstNo: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    isPaymentSuccessful: {
      type: Boolean,
      default: false
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
    },
    order: {
      type: {}
    },
    amount: {
      type: Number, // Changed from String to Number for better data handling
      required: true, // Fixed typo: was "require"
      default: 100000, // Default amount in paise (₹1000)
    }
  },
  {
    timestamps: true,
  }
);

export const Registration = mongoose.model('Registration', registrationSchema);