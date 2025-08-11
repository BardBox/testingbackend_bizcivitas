import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ApiErrors from "../utils/ApiErrors.js";

// Load environment variables
dotenv.config({ path: "./.env" });

// Validate environment variables
const isEmailConfigValid = process.env.CLIENT_EMAIL && process.env.APP_PASSWORD_EMAIL;
if (!isEmailConfigValid) {
  console.error("Missing CLIENT_EMAIL or APP_PASSWORD_EMAIL in environment variables");
  throw new Error("Email configuration is incomplete");
}

// Singleton transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.CLIENT_EMAIL,
    pass: process.env.APP_PASSWORD_EMAIL,
  },
});

// Function to send invitation email
const sendInvitationMeetingEmail = async (
  visitorName,
  email,
  inviter,
  meeting,
  paymentLink = null,
  meetingLink = null,
  extraDetails = {}
) => {
  const { businessCategory, businessSubcategory, mobile } = extraDetails;

  // Fallback for inviter name to prevent undefined
  const inviterName = inviter?.fullName || inviter?.email || "Unknown Inviter";

  let subject, html;

  if (paymentLink) {
    subject = `Invitation to ${meeting.title} - Action Required`;
    html = `
      <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
        <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center;">
            <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/BizCivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto;" onerror="this.src='https://via.placeholder.com/150';">
            <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0 5px;">Dear <b>${visitorName}</b>,</h1>
            <p style="font-size: 1rem; color: #666; margin: 5px 0;">You have been invited by <b>${inviterName}</b> to the meeting "${meeting.title}".</p>
          </div>
          <div style="text-align: left; margin-top: 30px; font-size: 1rem; color: #333; padding: 0 10px;">
            <p><b>Meeting Details:</b></p>
            <ul>
              <li><b>Title:</b> ${meeting.title}</li>
              <li><b>Date:</b> ${new Date(meeting.date).toLocaleDateString()}</li>
              <li><b>Time:</b> ${meeting.time}</li>
              <li><b>Place:</b> ${meeting.place}</li>
              <li><b>Agenda:</b> ${meeting.agenda}</li>
              ${meetingLink ? `<li><b>Meeting Link:</b> <a href="${meetingLink}" style="color: #3459FF; text-decoration: none;">Join Meeting</a></li>` : ""}
            </ul>
            <p><b>Your Details:</b></p>
            <ul>
              <li><b>Name:</b> ${visitorName}</li>
              <li><b>Email:</b> ${email}</li>
              <li><b>Business Category:</b> ${businessCategory || "N/A"}</li>
              <li><b>Business Subcategory:</b> ${businessSubcategory || "N/A"}</li>
              <li><b>Mobile:</b> ${mobile || "N/A"}</li>
            </ul>
            <p>To confirm your attendance, please complete the payment of INR ${meeting.visitorFee} using the following link:</p>
            <p><a href="${paymentLink}" style="display: inline-block; padding: 10px 20px; background-color: #3459FF; color: #fff; text-decoration: none; border-radius: 5px;">Pay Now</a></p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <h2 style="display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin: 20px 0; padding: 10px; background-color: #D2FEDB;">Stay Connected</h2>
            <p style="font-size: 1rem; color: #333; padding: 0 10px; text-align: center;">
              We look forward to seeing you! For any questions, contact us at <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #3459FF; font-weight: bold;">info@bizcivitas.com</a>.
            </p>
          </div>
          <div style="text-align: left; font-size: 0.9rem; padding-top: 20px; margin: 20px 0; padding: 0 10px;">
            <p><b>About BizCivitas</b></p>
            <p>BizCivitas blends travel with professional networking through curated trips, small group experiences, and meaningful conversations. By exploring new destinations together, members build authentic business relationships and grow both personally and professionally.</p>
            <p>We look forward to connecting with you soon!</p>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; font-size: 0.9rem; padding: 10px; background-color: #9DB8EA; margin: 20px 0;">
            Contact us at: <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #343434; font-weight: bold;">info@bizcivitas.com</a>
          </div>
        </div>
      </div>
    `;
  } else {
    subject = `Invitation to ${meeting.title}`;
    html = `
      <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
        <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center;">
                  <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto;">
            <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0 5px;">Dear <b>${visitorName}</b>,</h1>
            <p style="font-size: 1rem; color: #666; margin: 5px 0;">You have been invited by <b>${inviterName}</b> to the meeting "${meeting.title}".</p>
          </div>
          <div style="text-align: left; margin-top: 30px; font-size: 1rem; color: #333; padding: 0 10px;">
            <p><b>Meeting Details:</b></p>
            <ul>
              <li><b>Title:</b> ${meeting.title}</li>
              <li><b>Date:</b> ${new Date(meeting.date).toLocaleDateString()}</li>
              <li><b>Time:</b> ${meeting.time}</li>
              <li><b>Place:</b> ${meeting.place}</li>
              <li><b>Agenda:</b> ${meeting.agenda}</li>
              ${meetingLink ? `<li><b>Meeting Link:</b> <a href="${meetingLink}" style="color: #3459FF; text-decoration: none;">Join Meeting</a></li>` : ""}
            </ul>
            <p><b>Your Details:</b></p>
            <ul>
              <li><b>Name:</b> ${visitorName}</li>
              <li><b>Email:</b> ${email}</li>
              <li><b>Business Category:</b> ${businessCategory || "N/A"}</li>
              <li><b>Business Subcategory:</b> ${businessSubcategory || "N/A"}</li>
              <li><b>Mobile:</b> ${mobile || "N/A"}</li>
            </ul>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <h2 style="display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin: 20px 0; padding: 10px; background-color: #D2FEDB;">Stay Connected</h2>
            <p style="font-size: 1rem; color: #333; padding: 0 10px; text-align: center;">
              Your attendance is confirmed! For any questions, contact us at <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #3459FF; font-weight: bold;">info@bizcivitas.com</a>.
            </p>
          </div>
          <div style="text-align: left; font-size: 0.9rem; padding-top: 20px; margin: 20px 0; padding: 0 10px;">
            <p><b>About BizCivitas</b></p>
            <p>BizCivitas blends travel with professional networking through curated trips, small group experiences, and meaningful conversations. By exploring new destinations together, members build authentic business relationships and grow both personally and professionally.</p>
            <p>We look forward to connecting with you soon!</p>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; font-size: 0.9rem; padding: 10px; background-color: #9DB8EA; margin: 20px 0;">
            Contact us at: <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #343434; font-weight: bold;">info@bizcivitas.com</a>
          </div>
        </div>
      </div>
    `;
  }

  try {
    await transporter.sendMail({
      from: process.env.CLIENT_EMAIL,
      to: email,
      subject,
      html,
    });
    console.log(`Email sent successfully to ${email} for meeting ${meeting.title}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw new ApiErrors(500, `Failed to send invitation email: ${error.message}`);
  }
};

// Function to send payment confirmation email
const sendPaymentConfirmationEmail = async (visitorName, email, meeting) => {
  const subject = `Confirmation: You're Invited to ${meeting.title}`;
  const html = `
    <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
      <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); text-align: center;">
      <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto;">
    
        <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0;">You are successfully invited to ${meeting.title}!</h1>
        <p style="font-size: 1rem; color: #666; margin: 5px 0;">We look forward to seeing you at the meeting.</p>
        <p style="font-size: 1rem; color: #333; margin-top: 20px;">
          For any questions, contact us at <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #3459FF; font-weight: bold;">info@bizcivitas.com</a>.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.CLIENT_EMAIL,
      to: email,
      subject,
      html,
    });
    console.log(`Payment confirmation email sent successfully to ${email} for meeting ${meeting.title}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send payment confirmation email to ${email}:`, error);
    throw new ApiErrors(500, `Failed to send payment confirmation email: ${error.message}`);
  }
};

export { sendInvitationMeetingEmail, sendPaymentConfirmationEmail };