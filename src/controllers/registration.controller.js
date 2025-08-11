import asyncHandler from "../utils/asyncHandler.js";
import ApiResponses from "../utils/ApiResponses.js";
import ApiErrors from "../utils/ApiErrors.js";
import { Registration } from "../models/registration.model.js";

//User Registeration
const createRegistration = asyncHandler(async (req, res) => {
    const { fname, lname, email, mobile, companyName, gstNo, amount } = req.body;
  
    //Check if any filed is missing
    if (
      [fname, email, mobile, amount].some((field) => {
        field?.trim() === "";
      })
    ) {
      throw new ApiErrors(401, "some fileds are missing");
    }
  
    //Check if email already exist
    // const existedUser = await Registration.findOne({ email });
    // if (existedUser) {
    //   throw new ApiErrors(401, "Email already exist");
    // }
  
    //Create
    const newRegistration = await Registration.create({
      fname: fname,
      lname: lname,
      email: email,
      mobile: mobile,
      companyName: companyName,
      gstNo: gstNo,
      amount: amount
    });
    if (!newRegistration) {
      throw new ApiErrors(500, "Some thing went wrong in creating user");
    }
  
    return res
      .status(200)
      .json(new ApiResponses(200, newRegistration, "User created Successfully"));
  
});

const changeRegistration = asyncHandler(async (req, res) => {
  const { order, newRegistration } = req.body;
  
  const registration = await Registration.findByIdAndUpdate(newRegistration._id, {
    $set: {
      order: order
    }
  },
{new: true});

  return res
    .status(200)
    .json(new ApiResponses(200, registration, "User created Successfully"));

});

export { createRegistration, changeRegistration };
