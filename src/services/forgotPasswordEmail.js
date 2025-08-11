import nodemailer from "nodemailer";
import ApiErrors from "../utils/ApiErrors.js";

export const sendOtpEmail = async (fname, email, otp) => {
  const emailHtmlContentUser = `
  <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
    <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center;">
            <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto;">
            <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0 5px;">Hello <b>${fname}</b>,</h1>
            <p style="font-size: 1rem; color: #666; margin: 5px 0;">We received a request to reset your password. Below is your OTP:</p>
        </div>
        <div style="text-align: left; margin-top: 30px; font-size: 1rem; color: #333; padding: 0 10px;">
            <p><b>Your OTP for password reset:</b></p>
            <ul>
                <li>OTP: <span style="color: #3459FF; font-weight: bold;">${otp}</span></li>
            </ul>
        </div>
        <div style="text-align: center; margin-top: 30px;">
            <h2 style="display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin: 20px 0; padding: 10px; background-color: #D2FEDB; ">Reset Your Password</h2>
            <p style="font-size: 1rem; color: #333; padding: 0 10px; text-align: center;">
                If you did not request a password reset, please ignore this email. The OTP will expire in 10 minutes.
            </p>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; font-size: 0.9rem; padding: 10px; background-color: #9DB8EA; margin: 20px 0;">
            Contact us at: <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #343434; font-weight: bold;">info@bizcivitas.com</a>
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
    subject: "Password Reset OTP - BizCivitas",
    html: emailHtmlContentUser,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ApiErrors(500, "Failed to send OTP email");
  }
};