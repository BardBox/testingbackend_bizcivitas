import mongoose, { Schema } from "mongoose";

const profileSchema = new Schema(
  {
    contactDetails: {
      mobileNumber: {
        type: String,
      },
      homeNumber: {
        type: String,
      },
      email: {
        type: String,
        unique: true,
      },
      isEmailVerified: {
        type: Boolean,
        default: false,
      },
      website: {
        type: String,
      },
      socialNetworkLinks: [
        {
          type: { type: String }, // Dropdown selection type (e.g., LinkedIn, Facebook)
          name: String,
          link: String,
        },
      ],
    },
    addresses: {
      address: {
        addressLine1: {
          type: String,
        },
        addressLine2: {
          type: String,
        },
        city: {
          type: String,
        },
        state: {
          type: String,
        },
        country: {
          type: String,
        },
        pincode: {
          type: Number,
        },
      },
      billing: {
        addressLine1: {
          type: String,
        },
        addressLine2: {
          type: String,
        },
        city: {
          type: String,
        },
        state: {
          type: String,
        },
        country: {
          type: String,
        },
        pincode: {
          type: Number,
        },
      },
    },
    myBio: {
      yearsInBusiness: {
        type: Number,
      },
      previousTypesOfJobs: {
        type: String,
      },
      hobbiesAndInterests: {
        type: String,
      },
      cityOfResidence: {
        type: String,
      },
      yearsInThatCity: {
        type: Number,
      },
      myBurningDesireIsTo: {
        type: String,
      },
      somethingNoOneHereKnowsAboutMe: {
        type: String,
      },
      myKeyToSuccess: {
        type: String,
      },
      
      mySkills: {
        type: [String], // Array of skills
        default: [],
      },
      myAsk: {
        type: [String], // Array of asks
        default: [],
      },
      myGives: {
        type: [String], // Array of gives
        default: [],
      },
      tags: {
        type: [String], // Array of tags
        default: [],
      },
    },
    weeklyPresentation: {
      type: String,
    },
    professionalDetails: {
      companyLogo: { type: String },
      companyName: { type: String },
      companyAddress: { type: String },
      industry: { type: String },
      classification: { type: String },
      directNumber: { type: String },
      gstRegisteredState: { type: String, trim: true },
      membershipStatus: { type: String },
      renewalDueDate: { type: String },
      myBusiness: { type: String },
    },

    visibility: {
      professionalDetails: {
        type: Boolean,
        default: true // Visible by default
      },
    }
  },
  {
    timestamps: true,
  }
);

export const Profile = mongoose.model("Profile", profileSchema);