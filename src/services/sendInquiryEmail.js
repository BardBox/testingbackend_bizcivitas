import nodemailer from 'nodemailer';
import ApiErrors from '../utils/ApiErrors.js';

export const sendInquiryEmailToAdmin = async (name, email, phoneNumber, howDidYouFindUs) => {
  // Log environment variables to verify they're loaded
  console.log('CLIENT_EMAIL:', process.env.CLIENT_EMAIL);
  console.log('APP_PASSWORD_EMAIL:', process.env.APP_PASSWORD_EMAIL);

  // Validate environment variables
  if (!process.env.CLIENT_EMAIL || !process.env.APP_PASSWORD_EMAIL) {
    console.error('Missing email credentials in environment variables');
    throw new ApiErrors(500, 'Email service credentials are missing');
  }

  const emailHtmlContentAdmin = `
  <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
    <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center;">
            <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0 5px;">New Inquiry Submitted</h1>
            <p style="font-size: 1rem; color: #666; margin: 5px 0;">A new inquiry has been submitted by a user. Here are the details:</p>
        </div>
        <div style="text-align: left; margin-top: 30px; font-size: 1rem; color: #333; padding: 0 10px;">
            <p><b>Inquiry Details:</b></p>
            <ul>
                <li><b>Name:</b> ${name}</li>
                <li><b>Email:</b> ${email}</li>
                <li><b>Phone Number:</b> ${phoneNumber}</li>
                <li><b>How Did They Find Us?</b> ${howDidYouFindUs}</li>
            </ul>
        </div>
    </div>
</div>
  `;

  // Create a transporter to send the email via SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.CLIENT_EMAIL,
      pass: process.env.APP_PASSWORD_EMAIL,
    },
  });

  // Email options
  const mailOptions = {
    from: `"BizCivitas" <${process.env.CLIENT_EMAIL}>`,  // Add a display name for better email presentation
    to: process.env.CLIENT_EMAIL,
    subject: 'New Inquiry Submitted - BizCivitas',
    html: emailHtmlContentAdmin,
  };

  try {
    // Verify the transporter before sending
    await transporter.verify();
    console.log('SMTP transporter verified successfully');

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Admin email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Detailed error sending admin email:', error);
    throw new ApiErrors(500, `Failed to send email to admin: ${error.message}`);
  }
};

export const sendInquiryEmailToClient = async (name, email) => {
    const emailHtmlContentAdmin = `
     <div style="display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
    <div style="max-width: 600px; margin: 20px 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center;">
            <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto;">
            <h1 style="font-size: 1.5rem; color: #333; margin: 10px 0 5px;">Dear <b>${name}</b>,</h1>
            <p style="font-size: 1rem; color: #666; margin: 5px 0;">Thank you for reaching out to BizCivitas. We have received your inquiry and appreciate your interest in our services.</p>
            <p style="font-size: 1rem; color: #333; margin: 5px 0;">We are currently reviewing your message and will respond to you shortly.</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
            <h2 style="display: flex; font-size: 1.2rem;align-items: center; justify-content: center; margin: 20px 0; padding: 10px; background-color: #D2FEDB; ">Stay Connected</h2>
            <p style="font-size: 1rem; color: #333; padding: 0 10px; text-align: center;">
                In the meantime, feel free to explore our website for more information about our services and upcoming events. If you have any urgent questions, please contact us at <a href="mailto:info@bizcivitas.com" style="text-decoration: none; color: #3459FF; font-weight: bold;">info@bizcivitas.com</a>.
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
  
    // Create a transporter to send the email via SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.CLIENT_EMAIL,  
        pass: process.env.APP_PASSWORD_EMAIL, 
      },
    });
  
    // Email options
    const mailOptions = {
      from: process.env.CLIENT_EMAIL,  
      to: email,  
      subject: 'Thank You for Contacting BizCivitas – We’ll Be in Touch Soon!', 
      html: emailHtmlContentAdmin,  
    };
  
    try {
      // Send the email
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new ApiErrors(500, 'Failed to send email to admin');
    }
  };
