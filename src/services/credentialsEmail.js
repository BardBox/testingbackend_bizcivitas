import nodemailer from "nodemailer";
import ApiErrors from "../utils/ApiErrors.js";

export const sendEmailWithCredentials = async (fname, email, password) => {
  const emailHtmlContentUser = `
  <div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #333;">
    <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center;">
        <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto; margin-bottom: 20px;">
        <h1 style="font-size: 24px; color: #333; margin: 0 0 10px;">You’re Invited: Exclusive First Access to the BizCivitas App</h1>
        <p style="font-size: 16px; color: #666; margin: 0 0 20px;">Dear ${fname},</p>
      </div>
      <div style="font-size: 16px; color: #333; line-height: 1.5; padding: 0 20px;">
        <p>We’re thrilled to share something special with you.</p>
        <p>As one of our valued Digital Members, you’ve officially been granted <b>early access</b> to the BizCivitas mobile application — a powerful ecosystem built just for modern entrepreneurs like you.</p>
        <p>This is not just an app launch. It’s a movement in the making — and you are part of the core circle shaping it.</p>
      </div>
      <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px; font-size: 14px; color: #333;">
        <p style="margin: 0 0 10px;"><b>💡 Please Note:</b></p>
        <p style="margin: 0;">You are accessing a test version of the application — before anyone else. While the experience is nearly complete, a few bugs may still exist, and our team is actively polishing things up.</p>
        <p style="margin: 10px 0 0;">We truly appreciate your patience, support, and feedback during this phase. Every click, scroll, and suggestion from you helps us improve and evolve BizCivitas.</p>
      </div>
      <div style="font-size: 16px; color: #333; padding: 0 20px;">
        <p><b>📲 Here’s How to Get Started:</b></p>
        <p><b>For Android Users:</b></p>
        <ol style="margin: 0 0 20px; padding-left: 20px;">
          <li>Open this download link: <a href="https://play.google.com/store/apps/details?id=com.bizcivitas" style="color: #3459FF; text-decoration: none; font-weight: bold;">Download from Google Play Store</a></li>
          <li>Install the app.</li>
          <li>Use the login credentials provided below.</li>
        </ol>
        <p><b>For iPhone Users:</b></p>
        <ol style="margin: 0 0 20px; padding-left: 20px;">
          <li>Open this TestFlight link: <a href="https://apps.apple.com/in/app/testflight/id899247664" style="color: #3459FF; text-decoration: none; font-weight: bold;">Open TestFlight</a></li>
          <li>Accept the invitation and install the app via TestFlight.</li>
          <li>Use the following link and install the BizCivitas App: <a href="https://testflight.apple.com/join/F5YusP1U" style="color: #3459FF; text-decoration: none; font-weight: bold;">https://testflight.apple.com/join/F5YusP1U</a></li>
          <li>Use the login credentials provided below.</li>
        </ol>
        <h2 style="font-size: 18px; color: #333; margin: 20px 0 10px;">🔐 Your Login Credentials:</h2>
        <ul style="margin: 0 0 20px; padding-left: 20px;">
          <li><b>Email:</b> <span style="color: #3459FF; font-weight: bold;">${email}</span></li>
          <li><b>Password:</b> <span style="color: #3459FF; font-weight: bold;">${password}</span></li>
        </ul>
        <h2 style="font-size: 18px; color: #333; margin: 20px 0 10px;">🎯 Need Help or Want to Share Feedback?</h2>
        <p style="margin: 0 0 20px;">We’re all ears. Just reply to this email or reach out at <a href="mailto:connect@bizcivitas.com" style="color: #3459FF; text-decoration: none; font-weight: bold;">connect@bizcivitas.com</a> — our team is listening.</p>
        <p style="margin: 0;">Once again, thank you for being a pioneer in this journey. Let’s build something extraordinary, together.</p>
      </div>
      <div style="text-align: center; font-size: 14px; color: #666; padding: 20px 0; border-top: 1px solid #ddd; margin-top: 20px;">
        <p style="margin: 0;">Warm regards,</p>
        <p style="margin: 5px 0;"><b>Team BizCivitas</b></p>
        <p style="margin: 5px 0;"><a href="https://www.bizcivitas.com" style="color: #3459FF; text-decoration: none;">www.bizcivitas.com</a></p>
        <p style="margin: 5px 0;"><a href="mailto:connect@bizcivitas.com" style="color: #3459FF; text-decoration: none;">connect@bizcivitas.com</a></p>
        <p style="margin: 5px 0;">+91 81606 79917</p>
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
    subject: "Exclusive First Access to BizCivitas App",
    html: emailHtmlContentUser,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ApiErrors(500, "Failed to send email");
  }
};