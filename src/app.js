import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import configureSocket  from "./socket.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { recordBulkFromJson } from "./controllers/user.controller.js";

const app = express();
const server = http.createServer(app);
configureSocket(server);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true); // Allow non-browser requests (e.g., Postman)
    }

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8888",
      "http://localhost:5173",
      "https://bizcivitas-web.vercel.app",
      
      "https://bizcivitas-admin-panel.vercel.app",
      "https://www.bizcivitas.com",
      "https://bizcivitas.com",
      "https://bizcivitas-admin-panel-kwgx.vercel.app",
      "https://bizcivitas-web-dynamic-6ih6.vercel.app",
      "https://bizcivitas-dynamic-web.vercel.app"
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization","X-Requested-With"]
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.options('*', cors(corsOptions));
// recordBulkFromJson('./services/bulkUsers.json');



//route declaration
import userRouter from "./routes/user.route.js";
import chatRouter from "./routes/chat.route.js";
import profileRouter from "./routes/profile.route.js";
import guestRouter from "./routes/guest.route.js";
import connectionRouter from "./routes/connection.route.js";
import inquiryRouter from "./routes/inquiry.route.js";
import eventRouter from "./routes/event.route.js";
import paymentRouter from "./routes/payment.route.js";
import registrationRouter from "./routes/registration.route.js";
import notificationRouter from "./routes/notification.route.js";
import communityRouter from "./routes/community.route.js";
import corememberRouter from "./routes/coreMember.routes.js";
import dashboardRouter from "./routes/dashboard.route.js";
import showImageRoutes from "./routes/image.routes.js";
import regionRoutes from "./routes/region.routes.js";
import forgotPasswordRouter from "./routes/forgotPassword.route.js";
import blogRouter from "./routes/blog.routes.js";
import postEventImagesRouter from "./routes/postEventImg.routes.js";
import referralSlipRouter from "./routes/referralSlip.routes.js";
import recordTYFCBRouter from "./routes/recordTYFCB.routes.js";
import messageRouter from "./routes/message.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import wallFeedRoutes from "./routes/wallFeed.routes.js";
import meetupRoutes from "./routes/meetup.routes.js";
import postRoutes from "./routes/post.routes.js";
import reportRoutes from "./routes/report.routes.js";
import membershipBenefitRoutes from "./routes/membershipBenefits.route.js";
import eventPaymnetRoutes from "./routes/eventPayment.routes.js"

import mediaRoutes from "./routes/mediaRoutes.js";
import categoryRoutes from './routes/categoryRoutes.js'; // Add .js extension explicitly

//routes implementation

//Admin
app.use("/api/v1/core-members", corememberRouter);

//Memebers web-app
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chats", chatRouter);
app.use("/api/v1/connections", connectionRouter);
app.use("/api/v1/profiles", profileRouter);
app.use("/api/v1/guests", guestRouter);
app.use("/api/v1/events", eventRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/registrations", registrationRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/community", communityRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/regions", regionRoutes);
app.use("/api/v1/forgetpassword", forgotPasswordRouter);
app.use("/api/v1/postEventImages", postEventImagesRouter);
app.use("/api/v1/referrals", referralSlipRouter);
app.use("/api/v1/record", recordTYFCBRouter);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/meetings", meetingRoutes);
app.use("/api/v1/wallfeed", wallFeedRoutes);
app.use("/api/v1/meetup", meetupRoutes);
app.use("/api/v1/post", postRoutes);

app.use("/api/v1/", mediaRoutes);
app.use("/api/v1/", categoryRoutes);
app.use("/api/v1/eventpayment", eventPaymnetRoutes);



//Static Website
app.use("/api/v1/inquiry", inquiryRouter);
app.use("/api/v1/blogs", blogRouter);
app.use("/api/v1/report", reportRoutes);
//img
app.use("/api/v1/image", showImageRoutes);
app.use("/api/v1/memberships", membershipBenefitRoutes);

//Handling errors
app.use(errorHandler);
app.use((error, req, res, next) => {
  console.error('Global error handler:', error.message, error.stack);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    errors: error.errors || [],
    data: null,
  });
});

export default server;
