import dayjs from 'dayjs';
import generateQR from './generateQR.js';
import sendEmail from './sendEmail.js';
// import sendWhatsAppMessage from './sendWhatsAppMessage.js'; // Uncomment when ready

export const sendRegistrationNotifications = async (guest, event, isPaid, options = {}) => {
  const {
    skipWhatsapp = true,
  } = options;

  const eventType = event.eventType?.toLowerCase() || 'unknown';
  const eventName = event.eventName || event.name || 'Unnamed Event';

  // Determine the event date (trip vs one-day)
  const eventDate = eventType === 'tripevent' ? event.startDate : event.date;
  const formattedDate = dayjs(eventDate).format('dddd, DD/MM/YYYY');

  // 🕒 Time formatting block
  let formattedStartTime = 'N/A';
  let formattedEndTime = 'N/A';

  if (eventDate && event.startTime && event.endTime) {
    const dateStr = dayjs(eventDate).format('YYYY-MM-DD');

    // Try parsing in both 12hr and 24hr formats
    const start = dayjs(`${dateStr} ${event.startTime}`, ['YYYY-MM-DD hh:mm A', 'YYYY-MM-DD HH:mm']);
    const end = dayjs(`${dateStr} ${event.endTime}`, ['YYYY-MM-DD hh:mm A', 'YYYY-MM-DD HH:mm']);

    formattedStartTime = start.isValid() ? start.format('hh:mm A') : 'Invalid Time';
    formattedEndTime = end.isValid() ? end.format('hh:mm A') : 'Invalid Time';

    console.log('🕒 Time formatting details:', {
      rawStart: event.startTime,
      rawEnd: event.endTime,
      parsedStart: start.toISOString(),
      parsedEnd: end.toISOString(),
      formattedStartTime,
      formattedEndTime,
    });
  }

  // 📍 Location
  let location = 'Online';
  if (eventType === 'tripevent' || eventType === 'onedayevent') {
    location = event.location || 'TBA';
  } else if (eventType === 'onlineevent') {
    location = event.onlineLink || 'Online';
  }

  // 👤 Guest Name
  const membershipType = guest.membershipType || 'General';
  guest.name = `${guest.fname || ''} ${guest.lname || ''}`.trim();

  // 🔳 Generate QR
  const { qrCodeBuffer } = await generateQR(guest);
  const qrCodeUrl = `https://yourdomain.com/qrcodes/${guest._id}.png`;

  // 📨 Email Payload
  const emailPayload = {
    fname: guest.fname,
    email: guest.email,
    eventName,
    eventDate: formattedDate,
    startTime: formattedStartTime,
    endTime: formattedEndTime,
    location,
    membershipType,
    qrCodeBuffer,
  };

  console.log('📨 Email Payload:', emailPayload);

  // ✅ Send Email
  if (guest.email) {
    try {
      await sendEmail(emailPayload);
      console.log(`📧 Email sent to ${guest.email}`);
    } catch (err) {
      console.error('❌ Failed to send email:', err.message);
    }
  }

  // ✅ Send WhatsApp
  if (!skipWhatsapp && guest.mobile) {
    const message = `👋 Hello ${guest.name},

You have successfully registered for *${eventName}* on *${formattedDate}* from *${formattedStartTime}* to *${formattedEndTime}* at *${location}*.

Membership Type: ${membershipType}
${isPaid ? `💳 Payment: ₹${event.amount}\n` : '🆓 This is a free event.\n'}
🆔 Your QR Code: ${qrCodeUrl}`;

    console.log('📱 WhatsApp Message:', message);

    try {
      await sendWhatsAppMessage({
        mobile: guest.mobile,
        message,
      });
      console.log(`📲 WhatsApp sent to ${guest.mobile}`);
    } catch (err) {
      console.error('❌ Failed to send WhatsApp:', err.message);
    }
  }

  console.log(`✅ Notifications sent for guest ${guest._id}`);
};
