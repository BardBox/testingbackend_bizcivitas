import twilio from 'twilio';
import ApiErrors from '../utils/ApiErrors.js';

const sendWhatsappMessage = async (fname, mobile, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new ApiErrors(500, 'Twilio credentials not configured');
  }

  const client = twilio(accountSid, authToken);

  const recipient = `whatsapp:+919104578558`; // e.g. '+919104578558'
  const sender = 'whatsapp:+12298505505'; // Your registered business number

  try {
    console.log(`Sending WhatsApp to ${recipient}: ${message}`);
    const msg = await client.messages.create({
      from: sender,
      body: message,
      to: recipient,
    });
    console.log('WhatsApp Message Sent! SID:', msg.sid, 'Status:', msg.status);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', {
      message: error.message,
      recipient,
      sender,
    });
    throw new ApiErrors(500, 'Failed to send WhatsApp message');
  }
};

export default sendWhatsappMessage;
