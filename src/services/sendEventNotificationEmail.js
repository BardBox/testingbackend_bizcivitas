import nodemailer from "nodemailer";
import ApiErrors from "../utils/ApiErrors.js";
import { Community } from "../models/community.model.js";
import  generateQRData  from "../services/generateQR.js";
import  sendWhatsappMessage  from "../services/sendWhatsappMessage.js";

const formatDate = (input) => {
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${dayName}, ${day}/${month}/${year}`;
};

const formatTime = (input) => {
  let date;
  if (input.includes(":") && input.length === 5) {
    const [hours, minutes] = input.split(":");
    date = new Date();
    date.setHours(hours, minutes, 0, 0);
  } else {
    date = new Date(input);
  }
  if (isNaN(date.getTime())) {
    return "Invalid Time";
  }
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

export const sendEventNotificationEmail = async (communityId, eventDetails) => {
  const community = await Community.findById(communityId).populate("users");
  if (!community) {
    throw new ApiErrors(404, "Community not found");
  }

  const users = community.users;
  if (!users || users.length === 0) {
    throw new ApiErrors(404, "No users found in the community");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.CLIENT_EMAIL,
      pass: process.env.APP_PASSWORD_EMAIL,
    },
  });

  for (const user of users) {
    try {
      // Generate QR code for the user
      const guestData = {
        _id: user._id,
        fname: user.fname,
        lname: user.lname || "",
        email: user.email,
        mobile: user.mobile,
        inviteBy: eventDetails.inviteBy || "Admin",
        createdAt: new Date(),
        eventId: eventDetails._id,
      };
      const { qrCodeImage } = await generateQRData(guestData);

      // Create email content
      const emailHtmlContent = `
        <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
          <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center;">
              <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto;">
              <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0 5px;">Hi <b>${user.fname}</b>,</h1>
              <p style="font-size: 1rem; color: #666; margin: 5px 0;">🎉 New Event in Your Community! 🎉</p>
              <p style="font-size: 1rem; color: #333; margin: 5px 0;">We’re excited to inform you that a new event has been created in the ${community.communityName} community.</p>
            </div>
            <div style="text-align: left; margin-top: 30px; font-size: 1rem; color: #333; padding: 0 10px;">
              <p><b>Event Details:</b></p>
              <ul>
                <li><b>Event Name:</b> ${eventDetails.name || eventDetails.eventName || "Unnamed Event"}</li>
                <li><b>Date:</b> ${
                  eventDetails.startDate
                    ? formatDate(eventDetails.startDate)
                    : eventDetails.eventDate
                    ? formatDate(eventDetails.eventDate)
                    : eventDetails.date
                    ? formatDate(eventDetails.date)
                    : "No date available"
                }</li>
                <li><b>Time:</b> ${formatTime(eventDetails.startTime)} - ${formatTime(eventDetails.endTime)}</li>
                <li><b>Location:</b> ${eventDetails.destination || eventDetails.location || "Online"}</li>
                <li><b>Description:</b> ${eventDetails.description || "No description available"}</li>
                <li><b>Invite By:</b> ${eventDetails.inviteBy || "Admin"}</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 20px 0; font-weight: 700;">
              <p>QR Code for Entry:</p>
              <img src="cid:qrcode" alt="QR Code" style="max-width: 100%; height: auto;">
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <h2 style="display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin: 20px 0; padding: 10px; background-color: #D2FEDB;">Join us for this exciting event!</h2>
              <p style="font-size: 1rem; color: #333; padding: 0 10px; text-align: center;">
                We look forward to seeing you there! If you have any questions, reach out to us at <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #3459FF; font-weight: bold;">info@bizcivitas.com</a>.
              </p>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; font-size: 0.9rem; padding: 10px; background-color: #9DB8EA; margin: 20px 0;">
              Contact us at: <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #343434; font-weight: bold;">info@bizcivitas.com</a>
            </div>
          </div>
        </div>
      `;

      // Send email
      const mailOptions = {
        from: process.env.CLIENT_EMAIL,
        to: user.email,
        subject: `New Event: ${eventDetails.name || eventDetails.eventName || "Unnamed Event"} in Your Community`,
        html: emailHtmlContent,
        attachments: [
          {
            filename: "qrcode.png",
            content: qrCodeImage,
            encoding: "base64",
            cid: "qrcode",
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${user.email}`);

      // Send WhatsApp message
      await sendWhatsappMessage(user.fname, user.mobile, user._id.toString());
      console.log(`WhatsApp message sent to ${user.mobile}`);
    } catch (error) {
      console.error(`Error processing notification for ${user.email}:`, error);
      // Continue to next user instead of throwing to ensure all users are processed
    }
  }
};