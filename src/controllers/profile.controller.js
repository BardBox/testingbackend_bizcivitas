import asyncHandler from "../utils/asyncHandler.js";
import ApiResponses from "../utils/ApiResponses.js";
import { Profile } from "../models/profile.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import { User } from "../models/user.model.js";
import path from "path";
import fs from "fs";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");

// User Details
const updateUserDetails = asyncHandler(async (req, res) => {
  const { fname, lname, username, email, companyName, companyAddress } = req.body;
  const image = req.files?.avatar?.[0]; // Preserve existing avatar if no new upload

  const userDetails = {
    fname,
    lname,
    username,
    email,
    avatar: req.user.avatar, // Preserve existing avatar by default
  };

  if (image) {
    // If an avatar is already present, delete it first
    if (req.user.avatar) {
      const oldAvatarPath = path.join(baseImageDir, req.user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath); // Delete the old avatar
      }
    }
    const avatarPath = `user/${path.basename(image.path)}`;
    userDetails.avatar = avatarPath;
  }

  const personalDetails = { companyName, companyAddress };

  const userUpdateFields = Object.entries(userDetails || {}).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    },
    {}
  );

  const profileUpdateFields = Object.entries(personalDetails || {}).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    },
    {}
  );

  let profile;
  if (Object.keys(profileUpdateFields).length > 0) {
    profile = await Profile.findOne({ _id: req.user.profile });

    if (!profile) {
      profile = await new Profile({
        professionalDetails: profileUpdateFields,
        contactDetails: {
          mobileNumber: req.user.mobile?.toString(),
          email: req.user.email,
        },
      }).save();
      userUpdateFields.profile = profile._id;
    } else {
      profile = await Profile.findOneAndUpdate(
        { _id: req.user.profile },
        {
          $set: {
            "professionalDetails.companyName": profileUpdateFields?.companyName,
            "professionalDetails.companyAddress": profileUpdateFields?.companyAddress,
            "contactDetails.email": userDetails?.email,
          },
        },
        { new: true }
      );
    }

    if (!profile) {
      throw new ApiErrors(500, "Failed to update profile details");
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: userUpdateFields },
    { new: true, runValidators: true }
  );
  if (!user) {
    throw new ApiErrors(401, "Can't find the user in database");
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { user, profile: profile },
        "Personal details updated successfully"
      )
    );
});

// Personal Details
const updatePersonalDetails = asyncHandler(async (req, res) => {
  const { personalDetails } = req.body;

  // Build dynamic update object for user model
  const userUpdateFields = Object.entries(personalDetails || {}).reduce(
    (acc, [key, value]) => {
      if (
        value !== undefined &&
        ["fname", "lname", "username", "gender"].includes(key)
      ) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );

  // Update user details
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: userUpdateFields },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new ApiErrors(
      404,
      "User not found or failed to update personal details"
    );
  }

  return res
    .status(200)
    .json(new ApiResponses(200, user, "Personal details updated successfully"));
});

// Update Contact Details
const updateContactDetails = asyncHandler(async (req, res) => {
  const { contactDetails } = req.body;
  // Check which fields are provided in the request body and clean undefined values
  const updateFields = Object.entries(contactDetails || {}).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    },
    {}
  );

  // Only update the fields that are provided
  const profile = await Profile.findById(req.user.profile);

  if (!profile) {
    throw new ApiErrors(404, "Profile not found");
  }

  // Update only the provided fields in the contactDetails
  for (let [key, value] of Object.entries(updateFields)) {
    profile.contactDetails[key] = value;
  }

  // Save the updated profile
  await profile.save();

  // Update user with new values if necessary
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        email: profile.contactDetails.email,
        mobile: profile.contactDetails.mobileNumber,
        isEmailVerified: profile.contactDetails.isEmailVerified,
      },
    },
    { new: true }
  );

  if (!user) {
    throw new ApiErrors(500, "Something went wrong while updating user");
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, profile, "Contact details updated successfully")
    );
});

// Update Addresses Details
const updateAddressDetails = asyncHandler(async (req, res) => {
  const { addresses } = req.body;

  const updateFields = {};

  // Validate and update addresses fields
  if (addresses) {
    if (addresses.address.addressLine1 !== undefined)
      updateFields["addresses.address.addressLine1"] = addresses.address.addressLine1;
    if (addresses.address.addressLine2 !== undefined)
      updateFields["addresses.address.addressLine2"] = addresses.address.addressLine2;
    if (addresses.address.city !== undefined)
      updateFields["addresses.address.city"] = addresses.address.city;
    if (addresses.address.state !== undefined)
      updateFields["addresses.address.state"] = addresses.address.state;
    if (addresses.address.country !== undefined)
      updateFields["addresses.address.country"] = addresses.address.country;
    if (addresses.address.pincode !== undefined)
      updateFields["addresses.address.pincode"] = addresses.address.pincode;

    if (addresses.billing.addressLine1 !== undefined)
      updateFields["addresses.billing.addressLine1"] = addresses.billing.addressLine1;
    if (addresses.billing.addressLine2 !== undefined)
      updateFields["addresses.billing.addressLine2"] = addresses.billing.addressLine2;
    if (addresses.billing.city !== undefined)
      updateFields["addresses.billing.city"] = addresses.billing.city;
    if (addresses.billing.state !== undefined)
      updateFields["addresses.billing.state"] = addresses.billing.state;
    if (addresses.billing.country !== undefined)
      updateFields["addresses.billing.country"] = addresses.billing.country;
    if (addresses.billing.pincode !== undefined)
      updateFields["addresses.billing.pincode"] = addresses.billing.pincode;
  }

  const profile = await Profile.findByIdAndUpdate(
    req.user.profile,
    { $set: updateFields },
    { new: true }
  );

  if (!profile) {
    throw new ApiErrors(
      500,
      "Something went wrong while updating profile in server"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, profile, "Profile details updated successfully")
    );
});

// Update Bio Details
const updateBioDetails = asyncHandler(async (req, res) => {
  const { myBio } = req.body;

  const updateFields = Object.entries(myBio || {}).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) acc[`myBio.${key}`] = value;
      return acc;
    },
    {}
  );

  const profile = await Profile.findByIdAndUpdate(
    req.user.profile,
    { $set: updateFields },
    { new: true }
  );

  if (!profile) {
    throw new ApiErrors(
      500,
      "Something went wrong while updating profile in server"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, profile, "Profile details updated successfully")
    );
});

// Update Professional Details
const updateProfessionalDetails = asyncHandler(async (req, res) => {
  // Extract professionalDetails from body and file from req.files
  const {
    companyName,
    companyAddress,
    industry,
    classification,
    directNumber,
    gstRegisteredState,
    membershipStatus,
    renewalDueDate,
    myBusiness,
  } = req.body;
  const companyLogo = req.files?.companyLogo?.[0];

  const professionalDetails = {
    companyName,
    companyAddress,
    industry,
    classification,
    directNumber,
    gstRegisteredState,
    membershipStatus,
    renewalDueDate,
    myBusiness,
  };

  // Prepare update fields
  const updateFields = Object.entries(professionalDetails || {}).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) acc[`professionalDetails.${key}`] = value;
      return acc;
    },
    {}
  );

  const currentProfile = await Profile.findOne({ _id: req.user.profile });
  if (companyLogo && currentProfile.professionalDetails.companyLogo) {
    const oldImagePath = path.join(
      baseImageDir,
      currentProfile.professionalDetails?.companyLogo
    );
    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }
  }
  if (companyLogo) {
    updateFields[
      "professionalDetails.companyLogo"
    ] = `companyLogo/${path.basename(companyLogo.path)}`;
  }

  const profile = await Profile.findByIdAndUpdate(
    req.user.profile,
    { $set: updateFields },
    { new: true }
  );

  if (!profile) {
    throw new ApiErrors(
      500,
      "Something went wrong while updating profile in server"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, profile, "Profile details updated successfully")
    );
});

// Update Weekly Presentation
const updateWeeklyPresentation = asyncHandler(async (req, res) => {
  const { weeklyPresentation } = req.body;

  if (!weeklyPresentation) {
    throw new ApiErrors(
      500,
      "Weekly Presentation is required. Please provide weekly Presentation"
    );
  }

  const profile = await Profile.findByIdAndUpdate(
    req.user.profile,
    { weeklyPresentation: weeklyPresentation },
    { new: true }
  );

  if (!profile) {
    throw new ApiErrors(
      500,
      "Something went wrong while updating profile in server"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, profile, "Profile details updated successfully")
    );
});

// Get Profile Details
const getProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findById(req.user.profile);
  
  if (!profile) {
    throw new ApiErrors(404, "Profile not found");
  }

  // Create a response object that filters out hidden fields
  const response = profile.toObject();
  
  if (profile.visibility?.professionalDetails === false) {
    delete response.professionalDetails;
  }

  return res
    .status(200)
    .json(new ApiResponses(200, response, "User fetched successfully"));
});

// Update Full Profile
const updateFullProfile = asyncHandler(async (req, res) => {
  const {
    fname,
    lname,
    username,
    email,
    gender,
    contactDetails,
    addresses,
    myBio,
    professionalDetails,
    weeklyPresentation,
  } = req.body;

  const avatar = req.files?.avatar?.[0];
  const companyLogo = req.files?.companyLogo?.[0];

  const userUpdateFields = {
    fname,
    lname,
    username,
    email,
    gender,
    avatar: req.user.avatar,
    mobile: contactDetails?.mobileNumber,
  };

  if (avatar) {
    if (req.user.avatar) {
      const oldAvatarPath = path.join(baseImageDir, req.user.avatar);
      if (fs.existsSync(oldAvatarPath)) fs.unlinkSync(oldAvatarPath);
    }
    userUpdateFields.avatar = `user/${path.basename(avatar.path)}`;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: userUpdateFields },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiErrors(404, "User not found");

  let profile = await Profile.findById(req.user.profile);

  if (!profile) {
    profile = await new Profile({
      contactDetails: {
        ...contactDetails,
        email: userUpdateFields.email,
      },
      addresses,
      myBio: {
        ...myBio,
        mySkills: myBio?.mySkills || [],
        myAsk: myBio?.myAsk || [],
        myGives: myBio?.myGives || [],
        tags: myBio?.tags || [],
      },
      professionalDetails: {
        ...professionalDetails,
        companyLogo: companyLogo
          ? `companyLogo/${path.basename(companyLogo.path)}`
          : undefined,
      },
      weeklyPresentation,
    }).save();

    await User.findByIdAndUpdate(req.user._id, { profile: profile._id });
  } else {
    const updateFields = {};

    if (contactDetails) {
      for (const [key, value] of Object.entries(contactDetails)) {
        if (value !== undefined) updateFields[`contactDetails.${key}`] = value;
      }
      if (userUpdateFields.email) {
        updateFields["contactDetails.email"] = userUpdateFields.email;
      }
    }

    if (addresses?.address || addresses?.billing) {
      for (const type of ["address", "billing"]) {
        for (const [key, value] of Object.entries(addresses?.[type] || {})) {
          if (value !== undefined)
            updateFields[`addresses.${type}.${key}`] = value;
        }
      }
    }

    if (myBio) {
      for (const [key, value] of Object.entries(myBio)) {
        if (value !== undefined) updateFields[`myBio.${key}`] = value;
      }
    }

    if (professionalDetails) {
      for (const [key, value] of Object.entries(professionalDetails)) {
        if (value !== undefined)
          updateFields[`professionalDetails.${key}`] = value;
      }
    }

    if (companyLogo) {
      if (profile.professionalDetails?.companyLogo) {
        const oldLogoPath = path.join(
          baseImageDir,
          profile.professionalDetails.companyLogo
        );
        if (fs.existsSync(oldLogoPath)) fs.unlinkSync(oldLogoPath);
      }
      updateFields[
        "professionalDetails.companyLogo"
      ] = `companyLogo/${path.basename(companyLogo.path)}`;
    }

    if (weeklyPresentation !== undefined) {
      updateFields.weeklyPresentation = weeklyPresentation;
    }

    profile = await Profile.findByIdAndUpdate(
      req.user.profile,
      { $set: updateFields },
      { new: true }
    );

    if (!profile) {
      throw new ApiErrors(500, "Failed to update profile");
    }
  }

  return res.status(200).json(
    new ApiResponses(
      200,
      { user, profile },
      "Full profile updated successfully"
    )
  );
});

// In profile.controller.js, add this new function
const toggleProfessionalDetailsVisibility = asyncHandler(async (req, res) => {
  const profile = await Profile.findById(req.user.profile);
  
  if (!profile) {
    throw new ApiErrors(404, "Profile not found");
  }

  // Toggle the visibility
  const newVisibility = !profile.visibility?.professionalDetails;
  
  const updatedProfile = await Profile.findByIdAndUpdate(
    req.user.profile,
    { $set: { "visibility.professionalDetails": newVisibility } },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponses(
        200, 
        { isVisible: newVisibility },
        `Professional details are now ${newVisibility ? 'visible' : 'hidden'}`
      )
    );
});

export {
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
};