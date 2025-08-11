import admin from "../config/firebaseAdmin.js";
import ApiErrors from "../utils/ApiErrors.js";

const sendNotification = async(payload) =>{

    const message = {
      notification: { title : payload.notification.title, body:payload.notification.body },
      token: payload.token,
    };

    console.log("message for notification : ", message);
    try {
      await admin.messaging().send(message);
    } catch (error) {
      console.log(error);
      throw new ApiErrors(500, "error in sending push notification");
    }
    return message;
};

export default sendNotification;