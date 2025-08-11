import QRCode from "qrcode";
import fs from "fs";
import path from "path";


const generateQRData = async (newGuest) => {
  try {
    const qrData = JSON.stringify({
      _id: newGuest._id,
      fname: newGuest.fname,
      lname: newGuest.lname,
      email: newGuest.email,
      mobile: newGuest.mobile,
      inviteBy: newGuest.inviteBy,
      createdAt: newGuest.createdAt,
      eventId: newGuest.eventId || newGuest.tripEventId || "unknown-event-id",
    });

    const qrCodeBuffer = await QRCode.toBuffer(qrData);

    const qrFolderPath = path.join(process.cwd(), "public", "qrcodes");
    if (!fs.existsSync(qrFolderPath)) {
      fs.mkdirSync(qrFolderPath, { recursive: true });
    }

    const fileName = `${newGuest._id}.png`;
    const qrFilePath = path.join(qrFolderPath, fileName);
    fs.writeFileSync(qrFilePath, qrCodeBuffer);

    const qrUrl = `https://backend.bizcivitas.com/public/qrcodes/${fileName}`;

    console.log("QR code available at:", qrUrl);

    return { qrCodeBuffer, qrFilePath, qrUrl };
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
};


export default generateQRData;
