import { Event } from "../models/Event.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiErrors from "../utils/ApiErrors.js";
import mongoose from "mongoose";
import ApiResponses from "../utils/ApiResponses.js";
import { User } from "../models/user.model.js";
import { Community } from "../models/community.model.js";
import fs from "fs";
import path from "path";
import { sendEventNotificationEmail } from "../services/sendEventNotificationEmail.js";
import { formatDate, formatTime } from "../services/formatDateTime.js";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");

// Helper to parse date string like "dd/MM/yyyy"
const parseEventDate = (dateStr) => {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day); // month is 0-based
};

// Helper to parse time string like "1:07 PM" and combine with date
const parseEventTime = (timeStr, dateObj) => {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const result = new Date(dateObj);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

// Create Event
const createEvent = asyncHandler(async (req, res) => {
  const {
    eventName,
    description,
    communities,
    eventType,
    location,
    date,
    onlineLink,
    startDate,
    endDate,
    startTime,
    endTime,
    region = [],
    state = [],
    eventOverview = '',
    subtitle = '',
    whyAttend = [],
    isPaid,
    membershipType = [],
    amount,
  } = req.body;

  const requiredFieldsMap = {
    onedayevent: ['eventName', 'date', 'startTime', 'endTime', 'location', 'description', 'communities'],
    onlineevent: ['eventName', 'date', 'startTime', 'endTime', 'onlineLink', 'description', 'communities'],
    tripevent: ['eventName', 'startDate', 'endDate', 'startTime', 'endTime', 'location', 'description', 'communities'],
  };

  const fieldValues = {
    eventName,
    date,
    startTime,
    endTime,
    location,
    description,
    communities,
    onlineLink,
    startDate,
    endDate,
  };

  const missingFields = requiredFieldsMap[eventType]?.filter(
    (key) => !fieldValues[key] || (typeof fieldValues[key] === 'string' && fieldValues[key].trim() === '')
  );

  if (missingFields?.length) {
    throw new ApiErrors(400, `Missing required fields: ${missingFields.join(', ')}`);
  }

  const now = new Date();
  if (['onedayevent', 'onlineevent'].includes(eventType)) {
    const eventDateObj = new Date(date);
    if (isNaN(eventDateObj.getTime()) || eventDateObj <= now) {
      throw new ApiErrors(400, 'Event date must be in the future');
    }
  }

  if (eventType === 'tripevent') {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj.getTime()) || startDateObj <= now) {
      throw new ApiErrors(400, 'Start date must be in the future');
    }
    if (isNaN(endDateObj.getTime()) || endDateObj < startDateObj) {
      throw new ApiErrors(400, 'End date must be after start date');
    }
  }

  const isPaidBoolean = isPaid === 'true' || isPaid === true;
  let membershipTypeArray = [];
  if (typeof membershipType === 'string') {
    try {
      membershipTypeArray = JSON.parse(membershipType);
    } catch (e) {
      throw new ApiErrors(400, 'Invalid membershipType format');
    }
  } else if (Array.isArray(membershipType)) {
    membershipTypeArray = membershipType;
  }

  const validMemberships = [
    'Core Membership',
    'Flagship Membership',
    'Industria Membership',
    'Digital Membership',
  ];

  const invalidTypes = membershipTypeArray.filter((type) => !validMemberships.includes(type));
  if (invalidTypes.length) {
    throw new ApiErrors(400, `Invalid membership types: ${invalidTypes.join(', ')}`);
  }

  if (isPaidBoolean && (amount === undefined || isNaN(amount) || Number(amount) <= 0)) {
    throw new ApiErrors(400, 'Valid amount is required for paid events');
  }

  const eventImageLocalPath = req.files?.img?.[0]?.path;
  if (!eventImageLocalPath) {
    throw new ApiErrors(400, 'Event image file is required');
  }

  const relativeImagePath = `event/${Date.now()}-${path.basename(eventImageLocalPath)}`;
  const destinationPath = path.join(baseImageDir, relativeImagePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(eventImageLocalPath, destinationPath);
  fs.unlinkSync(eventImageLocalPath);

  let communityIds = [];

  try {
    if (communities === 'ALL') {
      const allCommunities = await Community.find({ status: 'active' }).select('_id');
      if (!allCommunities.length) throw new Error('No active communities found');
      communityIds = allCommunities.map((c) => c._id);
    } else {
      let ids = [];
      if (typeof communities === 'string') {
        try {
          const parsed = JSON.parse(communities);
          ids = Array.isArray(parsed) ? parsed.map(c => c._id || c) : [parsed];
        } catch {
          ids = communities.replace(/[\[\]\s"]/g, '').split(',');
        }
      } else if (Array.isArray(communities)) {
        ids = communities.map(c => c._id || c);
      }
      const validIds = ids.map((id) => {
        if (!mongoose.Types.ObjectId.isValid(id)) throw new Error(`Invalid community ID: ${id}`);
        return new mongoose.Types.ObjectId(id);
      });
      const count = await Community.countDocuments({ _id: { $in: validIds } });
      if (count !== validIds.length) throw new Error('One or more communities not found');
      communityIds = validIds;
    }
  } catch (error) {
    throw new ApiErrors(400, error.message);
  }

  const newEventData = {
    eventName,
    date: ['onedayevent', 'onlineevent'].includes(eventType) ? new Date(date) : undefined,
    startTime: formatTime(startTime),
    endTime: formatTime(endTime),
    location: ['onedayevent', 'tripevent'].includes(eventType) ? location : undefined,
    description,
    img: relativeImagePath,
    eventType,
    communities: communityIds,
    region: typeof region === 'string' ? JSON.parse(region) : region,
    state: typeof state === 'string' ? JSON.parse(state) : state,
    eventOverview,
    subtitle,
    whyAttend: Array.isArray(whyAttend) ? whyAttend : [whyAttend].filter(Boolean),
    isPaid: isPaidBoolean,
    membershipType: membershipTypeArray,
    amount: isPaidBoolean ? Number(amount) : undefined,
    onlineLink: eventType === 'onlineevent' ? onlineLink : undefined,
    startDate: eventType === 'tripevent' ? new Date(startDate) : undefined,
    endDate: eventType === 'tripevent' ? new Date(endDate) : undefined,
  };

  const newEvent = await Event.create(newEventData);
  const populatedEvent = await Event.findById(newEvent._id)
    .populate('communities', 'name _id')
    .lean();

  res.status(201).json(new ApiResponses(201, populatedEvent, 'Event created successfully'));
});

// Get All Events
const getAllEvents = asyncHandler(async (req, res) => {
  const { community: communityFilter, state, region, eventType } = req.query;
  let query = {};
  if (communityFilter && communityFilter !== 'ALL') {
    query.communities = communityFilter;
  }
  if (state) {
    const stateArray = Array.isArray(state) ? state : [state];
    query.state = { $in: stateArray };
  }
  if (region) {
    const regionArray = Array.isArray(region) ? region : [region];
    query.region = { $in: regionArray };
  }
  if (eventType) {
    query.eventType = eventType;
  }

  const events = await Event.find(query)
    .populate('communities', 'name')
    .populate(
      'participants',
      'fname lname email mobile paymentStatus amountPaid tableNo attendance createdAt updatedAt'
    )
    .lean();

  const eventsWithParticipants = events.map((event) => ({
    ...event,
    totalParticipants: event.participants?.length || 0,
    participants: event.participants.map((p) => ({
      _id: p._id,
      fname: p.fname,
      lname: p.lname || '',
      email: p.email,
      mobile: p.mobile || 'Not provided',
      paymentStatus: p.paymentStatus,
      amountPaid: p.amountPaid || 0,
      tableNo: p.tableNo || null,
      attendance: p.attendance || false,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  }));

  return res.status(200).json(
    new ApiResponses(200, eventsWithParticipants, 'Events retrieved successfully')
  );
});

// Get Event by ID
const getEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiErrors(400, 'Invalid Event ID format');
  }

  const event = await Event.findById(id)
    .populate('communities', 'name')
    .populate(
      'participants',
      'fname lname email mobile paymentStatus amountPaid tableNo attendance createdAt updatedAt'
    )
    .lean();

  if (!event) {
    throw new ApiErrors(404, 'Event not found');
  }

  const eventWithParticipants = {
    ...event,
    totalParticipants: event.participants?.length || 0,
    participants: event.participants.map((p) => ({
      _id: p._id,
      fname: p.fname,
      lname: p.lname || '',
      email: p.email,
      mobile: p.mobile || 'Not provided',
      paymentStatus: p.paymentStatus,
      amountPaid: p.amountPaid || 0,
      tableNo: p.tableNo || null,
      attendance: p.attendance || false,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };

  return res.status(200).json(
    new ApiResponses(200, eventWithParticipants, 'Event retrieved successfully')
  );
});

// Edit Event
const editEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    eventName,
    description,
    communities,
    eventType,
    location,
    date,
    onlineLink,
    startDate,
    endDate,
    startTime,
    endTime,
    region = [],
    state = [],
    eventOverview = '',
    subtitle = '',
    whyAttend = [],
    isPaid,
    membershipType = [],
    amount,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiErrors(400, "Invalid event ID");
  }

  const validEventTypes = ['onedayevent', 'onlineevent', 'tripevent'];
  if (!eventType || !validEventTypes.includes(eventType)) {
    throw new ApiErrors(400, 'Valid eventType is required (onedayevent, onlineevent, tripevent)');
  }

  const requiredFieldsMap = {
    onedayevent: [eventName, date, startTime, endTime, location, description, communities],
    onlineevent: [eventName, date, startTime, endTime, onlineLink, description, communities],
    tripevent: [eventName, startDate, endDate, startTime, endTime, location, description, communities],
  };

  const requiredFields = requiredFieldsMap[eventType];
  const emptyFields = requiredFields
    .map((field) => ({
      field: field === eventName ? 'eventName' : field === date ? 'date' : field === location ? 'location' : field === onlineLink ? 'onlineLink' : field === startDate ? 'startDate' : field === endDate ? 'endDate' : field === description ? 'description' : field === communities ? 'communities' : field === startTime ? 'startTime' : field === endTime ? 'endTime' : 'unknown',
      value: field,
      isEmpty: field === undefined || field === null || (typeof field === 'string' && field.trim() === ''),
    }))
    .filter((f) => f.isEmpty);

  if (emptyFields.length > 0) {
    throw new ApiErrors(400, `Please fill in all required fields: ${emptyFields.map(f => f.field).join(", ")}`);
  }

  const currentDate = new Date();
  if (['onedayevent', 'onlineevent'].includes(eventType)) {
    const eventDateObj = new Date(date);
    if (isNaN(eventDateObj.getTime()) || eventDateObj <= currentDate) {
      throw new ApiErrors(400, 'Event date must be in the future');
    }
  } else if (eventType === 'tripevent') {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj.getTime()) || startDateObj <= currentDate) {
      throw new ApiErrors(400, 'Start date must be in the future');
    }
    if (isNaN(endDateObj.getTime()) || endDateObj < startDateObj) {
      throw new ApiErrors(400, 'End date must be after start date');
    }
  }

  const isPaidBoolean = isPaid === 'true' || isPaid === true;
  let membershipTypeArray;
  try {
    membershipTypeArray = typeof membershipType === 'string' && membershipType
      ? JSON.parse(membershipType)
      : Array.isArray(membershipType)
      ? membershipType
      : [];
  } catch (error) {
    throw new ApiErrors(400, "Invalid membershipType format");
  }

  const validMembershipTypes = [
    "Core Membership",
    "Flagship Membership",
    "Industria Membership",
    "Digital Membership",
  ];

  if (membershipTypeArray.length > 0) {
    const invalidTypes = membershipTypeArray.filter(type => !validMembershipTypes.includes(type));
    if (invalidTypes.length > 0) {
      throw new ApiErrors(400, `Invalid membership types: ${invalidTypes.join(", ")}`);
    }
  }

  if (isPaidBoolean && (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0)) {
    throw new ApiErrors(400, "Valid amount is required for paid events");
  }

  let relativeImagePath;
  const eventImageLocalPath = req.files?.img?.[0]?.path;
  if (eventImageLocalPath) {
    relativeImagePath = `event/${Date.now()}-${path.basename(eventImageLocalPath)}`;
    const destinationPath = path.join(baseImageDir, relativeImagePath);
    const directory = path.dirname(destinationPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.copyFileSync(eventImageLocalPath, destinationPath);
    fs.unlinkSync(eventImageLocalPath);
  }

  let communityIds = [];
  try {
    if (!communities) throw new Error("Communities is required");
    if (communities === "ALL") {
      const allCommunities = await Community.find({ status: "active" }).select("_id");
      if (!allCommunities.length) {
        throw new Error("No active communities found");
      }
      communityIds = allCommunities.map((c) => c._id);
    } else {
      let inputArray = communities;
      if (typeof communities === "string") {
        try {
          const parsed = JSON.parse(communities);
          inputArray = Array.isArray(parsed) ? parsed : [parsed];
          inputArray = inputArray.map(item => item._id || item);
        } catch (e) {
          inputArray = String(communities).replace(/[\[\]\s"]/g, "").split(",");
        }
      }
      const validIds = inputArray.map((id) => {
        const cleaned = typeof id === "string" ? id.trim().replace(/['"]/g, "") : id;
        if (!mongoose.Types.ObjectId.isValid(cleaned)) {
          throw new Error(`Invalid ID format: ${cleaned}`);
        }
        return new mongoose.Types.ObjectId(cleaned);
      });
      const count = await Community.countDocuments({ _id: { $in: validIds } });
      if (count !== validIds.length) {
        throw new Error("One or more communities not found");
      }
      communityIds = validIds;
    }
  } catch (error) {
    throw new ApiErrors(
      400,
      error.message.includes("Invalid ID format")
        ? "Invalid community ID format"
        : error.message
    );
  }

  const parsedRegion = typeof region === 'string' && region ? JSON.parse(region) : region;
  const parsedState = typeof state === 'string' && state ? JSON.parse(state) : state;

  const updatedEvent = await Event.findByIdAndUpdate(
    id,
    {
      ...(eventImageLocalPath && { img: relativeImagePath }),
      eventName,
      date: ['onedayevent', 'onlineevent'].includes(eventType) ? formatDate(date) : undefined,
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
      location: ['onedayevent', 'tripevent'].includes(eventType) ? location : undefined,
      description,
      eventType,
      communities: communityIds,
      region: parsedRegion,
      state: parsedState,
      eventOverview,
      subtitle,
      whyAttend: Array.isArray(whyAttend) ? whyAttend : [whyAttend].filter(Boolean),
      isPaid: isPaidBoolean,
      membershipType: membershipTypeArray,
      amount: isPaidBoolean ? Number(amount) : undefined,
      onlineLink: eventType === 'onlineevent' ? onlineLink : undefined,
      startDate: eventType === 'tripevent' ? formatDate(startDate) : undefined,
      endDate: eventType === 'tripevent' ? formatDate(endDate) : undefined,
      postEventImages: eventType === 'tripevent' ? [] : undefined,
    },
    { new: true, runValidators: true }
  ).populate("communities", "name _id");

  if (!updatedEvent) {
    throw new ApiErrors(404, "Event not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, updatedEvent, "Event updated successfully"));
});

// Delete Event
const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const event = await Event.findById(id);
  if (!event) {
    throw new ApiErrors(404, 'Event not found');
  }

  const imagePath = path.join(baseImageDir, event.img);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
    console.log('Main image deleted:', imagePath);
  }

  if (event.eventType === 'tripevent' && event.postEventImages?.length > 0) {
    event.postEventImages.forEach((image) => {
      const postImagePath = path.join(baseImageDir, image);
      if (fs.existsSync(postImagePath)) {
        fs.unlinkSync(postImagePath);
        console.log('Post-event image deleted:', postImagePath);
      }
    });
  }

  await Event.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponses(200, null, 'Event deleted successfully'));
});

// Add User to Event Participants
const addUserToEventParticipants = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user._id;

  if (!eventId || !userId) {
    throw new ApiErrors(400, "Event ID and User ID are required");
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new ApiErrors(404, "Event not found");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const community = await Community.findById(event.communities[0]);
  if (!community) {
    throw new ApiErrors(404, "Community not found");
  }

  if (!community.users.includes(userId)) {
    return res
      .status(403)
      .json(
        new ApiResponses(
          403,
          null,
          "You are not a member of this event's community."
        )
      );
  }

  if (event.participants.includes(userId)) {
    return res
      .status(400)
      .json(
        new ApiResponses(
          400,
          null,
          "You are already a participant in this event."
        )
      );
  }

  event.participants.push(userId);
  await event.save();

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        {},
        "You've successfully registered for the event. We look forward to seeing you there!"
      )
    );
});

// Remove User from Event Participants
const removeUserFromEventParticipants = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user._id;

  if (!eventId || !userId) {
    throw new ApiErrors(400, "Event ID and User ID are required");
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new ApiErrors(404, "Event not found");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  if (!event.participants.includes(userId)) {
    return res.status(400).json(
      new ApiResponses(400, null, "You are not a participant in this event.")
    );
  }

  event.participants = event.participants.filter(
    (participantId) => participantId.toString() !== userId.toString()
  );

  await event.save();

  return res.status(200).json(
    new ApiResponses(
      200,
      {},
      "You've successfully been removed from the event."
    )
  );
});

// Get All Past Events
const getAllEventsPass = asyncHandler(async (req, res) => {
  const currentDate = new Date();

  const events = await Event.find()
    .populate({
      path: "communities",
      select: "name",
    })
    .lean();

  const allPastEvents = events
    .filter(event => {
      if (event.eventType === 'onedayevent' || event.eventType === 'onlineevent') {
        return new Date(event.date) < currentDate;
      } else if (event.eventType === 'tripevent') {
        return new Date(event.startDate) < currentDate;
      }
      return false;
    })
    .map(event => ({
      id: event._id,
      eventName: event.eventName,
      description: event.description,
      eventType: event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1),
      totalParticipants: event.participants?.length || 0,
      communityName: event.communities?.[0]?.name || "Unknown Community",
      image: event.img,
      subtitle: event.subtitle,
    }));

  if (!allPastEvents.length) {
    throw new ApiErrors(404, "No past events found");
  }

  allPastEvents.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA.getTime() === dateB.getTime()) {
      return a.startTime.localeCompare(b.startTime);
    }
    return dateB - dateA;
  });

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        allPastEvents,
        "All past events retrieved successfully"
      )
    );
});

// Get User Events
const getUserEvents = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const events = await Event.find({ participants: userId }).lean();

  const upcomingEvents = [];
  const pastEvents = [];

  events.forEach(event => {
    const processedEvent = {
      id: event._id,
      eventName: event.eventName,
      description: event.description,
      destination: event.location || event.destination || "Online",
      date: event.date || event.startDate,
      time: event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : "Time TBD",
      eventType: event.eventType,
      image: event.img,
      participants: event.participants,
      subtitle: event.subtitle,
    };

    const eventDate = parseEventDate(processedEvent.date);
    let isUpcoming = eventDate > currentDate;

    if (eventDate.getTime() === currentDate.getTime() && event.startTime) {
      const eventDateTime = parseEventTime(event.startTime, eventDate);
      isUpcoming = eventDateTime > new Date();
    }

    if (isUpcoming) {
      upcomingEvents.push(processedEvent);
    } else {
      pastEvents.push(processedEvent);
    }
  });

  if (!upcomingEvents.length && !pastEvents.length) {
    throw new ApiErrors(404, "No events found where user is a participant");
  }

  upcomingEvents.sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date));
  pastEvents.sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date));

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { upcomingEvents, pastEvents },
        "User's participated events retrieved successfully"
      )
    );
});

// Get User Community and Events
const getUserCommunityAndEvents = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const eventType = req.params.eventType;

  const validEventTypes = {
    OneDay: 'onedayevent',
    Online: 'onlineevent',
    Trip: 'tripevent',
  };

  if (!validEventTypes[eventType]) {
    throw new ApiErrors(400, "Invalid event type. Valid options are 'OneDay', 'Online', 'Trip'");
  }

  const userCommunity = await Community.findOne({ users: userId });
  if (!userCommunity) {
    throw new ApiErrors(404, "User is not part of any community");
  }

  const events = await Event.find({
    communities: userCommunity._id,
    eventType: validEventTypes[eventType],
  }).lean();

  if (!events.length) {
    throw new ApiErrors(404, `No ${eventType} events found for your community`);
  }

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { events },
        "User's community and events retrieved successfully"
      )
    );
});

export {
  createEvent,
  getAllEvents,
  getEventById,
  editEvent,
  deleteEvent,
  addUserToEventParticipants,
  removeUserFromEventParticipants,
  getAllEventsPass,
  getUserEvents,
  getUserCommunityAndEvents,
};