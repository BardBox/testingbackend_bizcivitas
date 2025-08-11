import asyncHandler from "../utils/asyncHandler.js";
import ApiErrors from "../utils/ApiErrors.js";
import { Connection } from "../models/connection.model.js";
import ApiResponses from "../utils/ApiResponses.js";
import { User } from "../models/user.model.js";
import { UserSuggestionHistory } from "../models/UserSuggestionHistory.model.js";

// Send Connection Request
const sendConnectionRequest = asyncHandler(async (req, res) => {
  /**
   * get sender and recivers id body
   * check if any connection is already exist with this two users
   * then create one connection
   * add its id in both users connection filed
   * and then return this connection
   */

  const { receiverId } = req.body;
  const senderId = req.user._id;
  if (senderId.toString() === receiverId.toString()) {
    throw new ApiErrors(400, "You can't send connection request to yourself");
  }
  // Check if a connection already exists
  const existingConnection = await Connection.findOne({
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId },
    ],
  });

  if (existingConnection) {
    if (existingConnection.isAccepted) {
      throw new ApiErrors(400, "Users are already connected");
    } else {
      throw new ApiErrors(400, "Connection request already exists");
    }
  }

  const connection = await Connection.create({
    sender: senderId,
    receiver: receiverId,
  });

  // Add the connection to the sender's connections array
  await User.findByIdAndUpdate(connection.sender, {
    $push: { connections: connection._id },
  });

  // Add the connection to the sender's connections array
  await User.findByIdAndUpdate(connection.receiver, {
    $push: { connections: connection._id },
  });

   const userSuggestionHistory = await UserSuggestionHistory.findOne({ userId: senderId });
  if (userSuggestionHistory && userSuggestionHistory.currentSuggestion?.toString() === receiverId) {
    userSuggestionHistory.currentSuggestion = null;
    userSuggestionHistory.suggestionStartDate = null;
    if (!userSuggestionHistory.suggestedUserIds.includes(receiverId)) {
      userSuggestionHistory.suggestedUserIds.push(receiverId);
    }
    await userSuggestionHistory.save();
  }

  return res
    .status(201)
    .json(
      new ApiResponses(
        201,
        { connection: connection },
        "Connection request sent successfully"
      )
    );
});

// Accept Connection Request
const acceptConnectionRequest = asyncHandler(async (req, res) => {
  const { connectionId } = req.body;
  const userId = req.user._id;

  // Update the connection request as accepted
  const connection = await Connection.findOneAndUpdate(
    { _id: connectionId, receiver: userId, isAccepted: false },
    { isAccepted: true },
    { new: true }
  );

  if (!connection) {
    throw new ApiErrors(
      404,
      "Connection request not found or it has already been accepted."
    );
  }

let userSuggestionHistory = await UserSuggestionHistory.findOne({ userId });
if (userSuggestionHistory) {
  if (!userSuggestionHistory.connectedUserIds.includes(connection.sender)) {
    userSuggestionHistory.connectedUserIds.push(connection.sender);
  }
  if (userSuggestionHistory.currentSuggestion?.toString() === connection.sender.toString()) {
    userSuggestionHistory.currentSuggestion = null;
    userSuggestionHistory.suggestionStartDate = null;
  }
  await userSuggestionHistory.save();
}

userSuggestionHistory = await UserSuggestionHistory.findOne({ userId: connection.sender });
if (userSuggestionHistory) {
  if (!userSuggestionHistory.connectedUserIds.includes(userId)) {
    userSuggestionHistory.connectedUserIds.push(userId);
  }
  if (userSuggestionHistory.currentSuggestion?.toString() === userId.toString()) {
    userSuggestionHistory.currentSuggestion = null;
    userSuggestionHistory.suggestionStartDate = null;
  }
  await userSuggestionHistory.save();
}

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { connection: connection },
        "Connection request accepted successfully."
      )
    );
});

// Reject Connection Request
const deleteConnectionRequest = asyncHandler(async (req, res) => {
  const { connectionId } = req.body;

  // Delete the connection request
  const connection = await Connection.findByIdAndDelete(connectionId);

  if (!connection) {
    throw new ApiErrors(401, "Connection doesn't exist");
  }

  // Remove the connection from the sender's connections array
  await User.findByIdAndUpdate(connection.sender, {
    $pull: { connections: connection._id },
  });

  // Remove the connection from the receiver's connections array
  await User.findByIdAndUpdate(connection.receiver, {
    $pull: { connections: connection._id },
  });

  return res
    .status(200)
    .json(new ApiResponses(200, connection, "Connection deleted successfully"));
});

// Get User Connections
const getUserConnections = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find the user and populate their connections
  const user = await User.findById(userId).populate({
    path: "connections",
    match: { isAccepted: true }, // Only accepted connections
    populate: [
      {
        path: "sender receiver", // Populate sender and receiver with user details
        select:
          "fname lname email avatar profile role business businessSubcategory membershipType membershipStatus isActive isApproved region username gender mobile createdAt referBy",
        populate: [
          {
            path: "profile",
            select:
              "professionalDetails.companyName professionalDetails.classification professionalDetails.industry addresses.address.city addresses.address.state",
          },
          {
            path: "referBy",
            select: "fname lname",
          },
        ],
      },
    ],
  });

  if (!user) {
    throw new ApiErrors(401, "User doesn't exist");
  }

  // Initialize an empty array to hold all connected users
  let allConnectedUsers = [];

  // Iterate through the user's connections
  user.connections.forEach((connection) => {
    // Process sender (if not the logged-in user)
    if (connection.sender && connection.sender._id.toString() !== userId.toString()) {
      allConnectedUsers.push({
        id: connection.sender._id,
        fname: connection.sender.fname || "",
        lname: connection.sender.lname || "",
        avatar: connection.sender.avatar || null,
        username: connection.sender.username || "",
        gender: connection.sender.gender || "N/A",
        classification: connection.sender.profile?.professionalDetails?.classification || "N/A",
        companyName: connection.sender.profile?.professionalDetails?.companyName || "N/A",
        industry: connection.sender.profile?.professionalDetails?.industry || "N/A",
        city: connection.sender.profile?.addresses?.address?.city || "N/A",
        state: connection.sender.profile?.addresses?.address?.state || "N/A",
        region: connection.sender.region || "N/A",
        email: connection.sender.email || "",
        contactNo: connection.sender.mobile || null,
        business: connection.sender.business || "N/A",
        businessSubcategory: connection.sender.businessSubcategory || "N/A",
        membershipType: connection.sender.membershipType || "N/A",
        membershipStatus: connection.sender.membershipStatus.toString(),
        isActive: connection.sender.isActive.toString(),
        isApproved: connection.sender.isApproved.toString(),
        referredBy: connection.sender.referBy
          ? `${connection.sender.referBy.fname} ${connection.sender.referBy.lname}`
          : null,
        joiningDate: connection.sender.createdAt || null,
      });
    }

    // Process receiver (if not the logged-in user)
    if (connection.receiver && connection.receiver._id.toString() !== userId.toString()) {
      allConnectedUsers.push({
        id: connection.receiver._id,
        fname: connection.receiver.fname || "",
        lname: connection.receiver.lname || "",
        avatar: connection.receiver.avatar || null,
        username: connection.receiver.username || "",
        gender: connection.receiver.gender || "N/A",
        classification: connection.receiver.profile?.professionalDetails?.classification || "N/A",
        companyName: connection.receiver.profile?.professionalDetails?.companyName || "N/A",
        industry: connection.receiver.profile?.professionalDetails?.industry || "N/A",
        city: connection.receiver.profile?.addresses?.address?.city || "N/A",
        state: connection.receiver.profile?.addresses?.address?.state || "N/A",
        region: connection.receiver.region || "N/A",
        email: connection.receiver.email || "",
        contactNo: connection.receiver.mobile || null,
        business: connection.receiver.business || "N/A",
        businessSubcategory: connection.receiver.businessSubcategory || "N/A",
        membershipType: connection.receiver.membershipType || "N/A",
        membershipStatus: connection.receiver.membershipStatus.toString(),
        isActive: connection.receiver.isActive.toString(),
        isApproved: connection.receiver.isApproved.toString(),
        referredBy: connection.receiver.referBy
          ? `${connection.receiver.referBy.fname} ${connection.receiver.referBy.lname}`
          : null,
        joiningDate: connection.receiver.createdAt || null,
      });
    }
  });

  if (allConnectedUsers.length === 0) {
    return res
      .status(200)
      .json(new ApiResponses(200, [], "No connections found"));
  }

  return res
    .status(200)
    .json(new ApiResponses(200, { connections: allConnectedUsers }, "Connections fetched successfully"));
});

// Get User Connection requirest
const getUserConnectionRequests = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { type } = req.params;

  // Check if the type query parameter is valid
  if (type !== "sent" && type !== "received") {
    throw new ApiErrors(
      400,
      "Invalid 'type' query parameter. It must be either 'sent' or 'received'."
    );
  }

  // Find user by ID
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiErrors(401, "User doesn't exist in the database");
  }

  let connectionRequests = [];

  // Fetch sent connection requests where the user is the sender and the request is not accepted
  if (type === "sent") {
    connectionRequests = await Connection.find({
      sender: userId,
      isAccepted: false,
    }).populate({
      path: "receiver sender",
      select: "fname lname email avatar username profile", // Include receiver details
    });
  }

  // Fetch received connection requests where the user is the receiver and the request is not accepted
  if (type === "received") {
    connectionRequests = await Connection.find({
      receiver: userId,
      isAccepted: false,
    }).populate({
      path: "sender receiver",
      select: "fname lname email avatar username profile", // Include sender details
    });
  }

  // Map the results and add type info, including sender and receiver details
  const formattedRequests = connectionRequests.map((request) => ({
    connectionId: request._id,
    type: type, // Either 'sent' or 'received'
    sender: {
      id: request.sender ? request.sender._id : null,
      fname: request.sender ? request.sender.fname : null,
      lname: request.sender ? request.sender.lname : null,
      email: request.sender ? request.sender.email : null,
      avatar: request.sender ? request.sender.avatar : null,
      profile :request.sender ? request.sender.profile : null
    },
    receiver: {
      id: request.receiver ? request.receiver._id : null,
      fname: request.receiver ? request.receiver.fname : null,
      lname: request.receiver ? request.receiver.lname : null,
      email: request.receiver ? request.receiver.email : null,
      avatar: request.receiver ? request.receiver.avatar : null,
      profile: request.receiver ? request.receiver.profile : null,
    },
  }));

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { connections: formattedRequests },
        "Connections fetch successfully"
      )
    );
});

const getSuggestions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get current user's details with profile populated
  const currentUser = await User.findById(userId).populate('profile');
  
  if (!currentUser) {
    throw new ApiErrors(404, "User not found");
  }

  // Get user's existing connections
  const userConnections = await Connection.find({
    $or: [
      { sender: userId },
      { receiver: userId },
    ],
    isAccepted: true,
  });

  // Extract connected user IDs
  const connectedUserIds = userConnections.reduce((acc, connection) => {
    acc.add(connection.sender.toString());
    acc.add(connection.receiver.toString());
    return acc;
  }, new Set());

  // Get pending connection requests
  const pendingRequests = await Connection.find({
    $or: [
      { sender: userId },
      { receiver: userId },
    ],
    isAccepted: false,
  });

  // Extract pending request user IDs
  const pendingRequestUserIds = pendingRequests.reduce((acc, request) => {
    acc.add(request.sender.toString());
    acc.add(request.receiver.toString());
    return acc;
  }, new Set());

  // Check if user has existing suggestion history
  let userSuggestionHistory = await UserSuggestionHistory.findOne({ userId });
  
  // Initialize suggestion history if doesn't exist
  if (!userSuggestionHistory) {
    userSuggestionHistory = await UserSuggestionHistory.create({
      userId,
      currentSuggestion: null,
      suggestionStartDate: null,
      suggestedUserIds: [],
      connectedUserIds: []
    });
  }

  // Check if current suggestion needs to be rotated
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  let needsNewSuggestion = false;
  
  // Check if 30 days have passed since last suggestion
  if (!userSuggestionHistory.suggestionStartDate || 
      userSuggestionHistory.suggestionStartDate < thirtyDaysAgo) {
    needsNewSuggestion = true;
  }
  
  // Check if current suggested user is now connected
  if (userSuggestionHistory.currentSuggestion && 
      connectedUserIds.has(userSuggestionHistory.currentSuggestion.toString())) {
    needsNewSuggestion = true;
    
    // Add to connected users list to avoid future suggestions
    if (!userSuggestionHistory.connectedUserIds.includes(userSuggestionHistory.currentSuggestion)) {
      userSuggestionHistory.connectedUserIds.push(userSuggestionHistory.currentSuggestion);
    }
  }

  let currentSuggestedUser = null;

  if (needsNewSuggestion) {
    // Get current user's details for matching
    const currentUserRegion = currentUser.region || currentUser.city;
    const currentUserIndustry = currentUser.profile?.professionalDetails?.industry;
    const currentUserHobbies = currentUser.profile?.myBio?.hobbiesAndInterests;

    // Create exclusion list: connected + pending + previously suggested + admin users
  const exclusionList = [
  userId,
  ...connectedUserIds,
  ...pendingRequestUserIds,
  ...userSuggestionHistory.connectedUserIds,
];

    // Get all eligible users
    const allUsers = await User.find({
      _id: { $nin: exclusionList },
      role: { $nin: ["admin", "connection"] },
    }).populate('profile');

    // If no new users available, reset the suggestion history (except connected users)
    if (allUsers.length === 0) {
      userSuggestionHistory.suggestedUserIds = [];
      await userSuggestionHistory.save();
      
      // Try again with reset history
      const resetExclusionList = [
        userId,
        ...connectedUserIds,
        ...pendingRequestUserIds,
        ...userSuggestionHistory.connectedUserIds
      ];
      
      const resetUsers = await User.find({
        _id: { $nin: resetExclusionList },
        role: { $nin: ["admin", "connection"] },
      }).populate('profile');
      
      if (resetUsers.length === 0) {
        return res.status(200).json(
          new ApiResponses(
            200,
            { 
              suggestions: [],
              totalSuggestions: 0,
              message: "No new users available for suggestions"
            },
            "No suggestions available"
          )
        );
      }
      
      allUsers.push(...resetUsers);
    }

    // Categorize suggestions by priority
    const regionMatches = [];
    const industryMatches = [];
    const hobbyMatches = [];
    const otherUsers = [];

    allUsers.forEach(user => {
      let matched = false;

      // Priority 1: Region match (handle both region and city fields, case-insensitive)
      const userLocation = user.region || user.city;
      if (currentUserRegion && userLocation && 
          currentUserRegion.toLowerCase() === userLocation.toLowerCase()) {
        regionMatches.push(user);
        matched = true;
      }
      // Priority 2: Industry match (only if region doesn't match)
      else if (currentUserIndustry && 
               user.profile?.professionalDetails?.industry === currentUserIndustry) {
        industryMatches.push(user);
        matched = true;
      }
      // Priority 3: Hobbies and interests match (only if region and industry don't match)
      else if (currentUserHobbies && 
               user.profile?.myBio?.hobbiesAndInterests) {
        // Simple string match - you can make this more sophisticated with keyword matching
        const currentHobbiesLower = currentUserHobbies.toLowerCase();
        const userHobbiesLower = user.profile.myBio.hobbiesAndInterests.toLowerCase();
        
        // Check if there are common words/interests
        const currentHobbiesWords = currentHobbiesLower.split(/[\s,]+/).filter(word => word.length > 2);
        const hasCommonInterest = currentHobbiesWords.some(hobby => 
          userHobbiesLower.includes(hobby)
        );
        
        if (hasCommonInterest) {
          hobbyMatches.push(user);
          matched = true;
        }
      }

      // Add to other users if no specific match found
      if (!matched) {
        otherUsers.push(user);
      }
    });

    // Get the first available suggestion from priority order
    const allSuggestions = [
      ...regionMatches,
      ...industryMatches,
      ...hobbyMatches,
      ...otherUsers
    ];

    if (allSuggestions.length > 0) {
      currentSuggestedUser = allSuggestions[0];
      
      // Update suggestion history
      userSuggestionHistory.currentSuggestion = currentSuggestedUser._id;
      userSuggestionHistory.suggestionStartDate = now;
      userSuggestionHistory.suggestedUserIds.push(currentSuggestedUser._id);
      await userSuggestionHistory.save();
    }
  } else {
    // Return existing suggestion
    if (userSuggestionHistory.currentSuggestion) {
      currentSuggestedUser = await User.findById(userSuggestionHistory.currentSuggestion).populate('profile');
    }
  }

  if (!currentSuggestedUser) {
    return res.status(200).json(
      new ApiResponses(
        200,
        { 
          suggestions: [],
          totalSuggestions: 0,
          message: "No suggestions available"
        },
        "No suggestions available"
      )
    );
  }

  // Determine match reason for the suggested user
  let matchReason = 'other';
  let matchDetails = '';

  const currentUserRegion = currentUser.region || currentUser.city;
  const currentUserIndustry = currentUser.profile?.professionalDetails?.industry;
  const currentUserHobbies = currentUser.profile?.myBio?.hobbiesAndInterests;

  const userLocation = currentSuggestedUser.region || currentSuggestedUser.city;
  
  if (currentUserRegion && userLocation && 
      currentUserRegion.toLowerCase() === userLocation.toLowerCase()) {
    matchReason = 'region';
    matchDetails = `Same region: ${userLocation}`;
  } else if (currentUserIndustry && 
             currentSuggestedUser.profile?.professionalDetails?.industry === currentUserIndustry) {
    matchReason = 'industry';
    matchDetails = `Same industry: ${currentSuggestedUser.profile.professionalDetails.industry}`;
  } else if (currentUserHobbies && currentSuggestedUser.profile?.myBio?.hobbiesAndInterests) {
    const currentHobbiesLower = currentUserHobbies.toLowerCase();
    const userHobbiesLower = currentSuggestedUser.profile.myBio.hobbiesAndInterests.toLowerCase();
    const currentHobbiesWords = currentHobbiesLower.split(/[\s,]+/).filter(word => word.length > 2);
    const hasCommonInterest = currentHobbiesWords.some(hobby => 
      userHobbiesLower.includes(hobby)
    );
    
    if (hasCommonInterest) {
      matchReason = 'interests';
      matchDetails = 'Similar interests';
    }
  }

  const suggestionWithReason = {
    ...currentSuggestedUser.toObject(),
    matchReason,
    matchDetails,
    suggestionStartDate: userSuggestionHistory.suggestionStartDate,
    daysRemaining: Math.max(0, 30 - Math.floor((now - userSuggestionHistory.suggestionStartDate) / (24 * 60 * 60 * 1000)))
  };

  return res.status(200).json(
    new ApiResponses(
      200,
      { 
        suggestions: [suggestionWithReason],
        totalSuggestions: 1,
        suggestionHistory: {
          totalSuggested: userSuggestionHistory.suggestedUserIds.length,
          totalConnected: userSuggestionHistory.connectedUserIds.length,
          currentSuggestionAge: Math.floor((now - userSuggestionHistory.suggestionStartDate) / (24 * 60 * 60 * 1000))
        }
      },
      "Suggestions fetched successfully"
    )
  );
});

const getSuggestionsAll = asyncHandler(async (req, res) => {
  const userId = req.user._id;

 
  const userConnections = await Connection.find({
    $or: [
      { sender: userId },
      { receiver: userId },
    ],
    isAccepted: true,
  });

 
  const connectedUserIds = userConnections.reduce((acc, connection) => {
    acc.add(connection.sender.toString());
    acc.add(connection.receiver.toString());
    return acc;
  }, new Set());

  
  const pendingRequests = await Connection.find({
    $or: [
      { sender: userId },
      { receiver: userId },
    ],
    isAccepted: false,
  });

 
  const pendingRequestUserIds = pendingRequests.reduce((acc, request) => {
    acc.add(request.sender.toString());
    acc.add(request.receiver.toString());
    return acc;
  }, new Set());

 
  const suggestedUsers = await User.find({
    _id: { $nin: [userId, ...connectedUserIds, ...pendingRequestUserIds] },
    role: { $nin: ["admin", "connection"] }, 
  });

  return res.status(200).json(
    new ApiResponses(
      200,
      { suggestions: suggestedUsers },
      "Suggestions fetched successfully"
    )
  );
});

const getUserDetails = asyncHandler(async (req, res) => {
  const userId  = req.params.id; 

  const user = await User.findById(userId).populate("profile connections");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json(
    new ApiResponses(200, { userDetails: user }, "User details fetched successfully")
  );
});


export {
  sendConnectionRequest,
  acceptConnectionRequest,
  deleteConnectionRequest,
  getUserConnections,
  getUserConnectionRequests,
  getSuggestions,
  getUserDetails,
  getSuggestionsAll,
};
