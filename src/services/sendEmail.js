import nodemailer from "nodemailer";
import ApiErrors from "../utils/ApiErrors.js";

// === EMAIL SENDER ===
const sendEmail = async ({
  fname,
  email,
  eventName,
  eventDate,
  startTime,
  endTime,
  location = "Online",
  qrCodeBuffer,
}) => {
  // Use pre-formatted values from caller
  const formattedDate = eventDate;
  const formattedStartTime = startTime;
  const formattedEndTime = endTime;

  console.log("📨 Email Payload:", {
    fname,
    email,
    eventName,
    eventDate: formattedDate,
    startTime: formattedStartTime,
    endTime: formattedEndTime,
    location,
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; color: #333; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px;">
          <h1 style="color: #333;">Hi <b>${fname}</b>,</h1>
          <p>🎉 You’ve successfully registered for <strong>${eventName}</strong> 🎉</p>
        </div>
        <hr style="margin: 20px 0;">
        <div style="font-size: 1rem;">
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}</li>
            <li><strong>Location:</strong> ${location}</li>
          </ul>
        </div>
        <div style="margin-top: 30px; text-align: center;">
          <p><strong>Show this QR code at entry:</strong></p>
          <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: auto;">
        </div>
        <div style="margin-top: 30px; font-size: 0.9rem;">
          <p>Stay tuned for more updates as we approach the event. Feel free to reach out if you have any questions.</p>
          <p>See you soon!</p>
        </div>
        <div style="margin-top: 20px; font-size: 0.9rem; text-align: center; background: #e0eaff; padding: 10px;">
          Contact us: <a href="mailto:info@bizcivitas.com" style="color: #333; font-weight: bold;">info@bizcivitas.com</a>
        </div>
      </div>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.CLIENT_EMAIL,
      pass: process.env.APP_PASSWORD_EMAIL,
    },
  });

  const mailOptions = {
    from: process.env.CLIENT_EMAIL,
    to: email,
    subject: `Registration Confirmation: ${eventName} - BizCivitas`,
    html: htmlContent,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrCodeBuffer,
        cid: "qrcode",
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw new ApiErrors(501, "Error occurred while sending email");
  }
};

export default sendEmail;
