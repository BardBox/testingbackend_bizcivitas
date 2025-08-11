import mongoose from "mongoose";

const { Schema } = mongoose;

const ICON_MAP = {
  trip: "icon/Trip.png",
  upcomingEvent: "icon/event.png",
  article: "icon/Article.png",
  poll: "icon/polling.png",
  announcement: "icon/announcement.png",
  travelStories: "icon/TravelStories.png",
  lightPulse: "icon/LightPulse.png",
  spotlightStories: "icon/SpotlightStories.png",
  pulsePolls: "icon/PulsePolls.png",
  businessBoosters: "icon/BusinessBoosters.png",
  foundersDesk: "icon/FoundersDesk.png",
};

const wallFeedSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "trip",
        "upcomingEvent",
        "article",
        "poll",
        "announcement",
        "travelStories",
        "lightPulse",
        "spotlightStories",
        "pulsePolls",
        "businessBoosters",
        "foundersDesk",
      ],
    },
    eventRef: {
      type: Schema.Types.ObjectId,
      refPath: "eventModel",
      required: function () {
        return this.type === "trip" || this.type === "upcomingEvent";
      },
    },
    eventModel: {
      type: String,
      enum: ["TripEvent", "OnlineEvent", "OneDayEvent"],
      required: function () {
        return this.type === "trip" || this.type === "upcomingEvent";
      },
    },
    image: String,
    video: String, // Added to support video uploads
    article: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: function () {
        return this.type === "article";
      },
    },
    poll: {
      type: Schema.Types.ObjectId,
      ref: "Poll",
      required: function () {
        return this.type === "poll" || this.type === "pulsePolls";
      },
    },
    announcement: {
      type: Schema.Types.ObjectId,
      ref: "Announcement",
      required: function () {
        return this.type === "announcement";
      },
    },
    title: String, // Added for new types
    description: [String], // Added for new types, array to match announcement
    icon: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    visibility: {
      type: String,
      enum: ["public", "connections", "community"],
      default: "public",
    },
    communityId: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: function () {
        return this.visibility === "community";
      },
    },
    badge: {
      type: String,
      default: "Biz pulse",
    },
    comments: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        content: {
          type: String,
          required: false,
        },
        mediaUrl: {
          type: String,
          required: false,
        },
        mentions: [
          {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        likes: [
          {
            userId: {
              type: Schema.Types.ObjectId,
              ref: "User",
            },
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    likes: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  { timestamps: true }
);

wallFeedSchema.pre("save", function (next) {
  const feed = this;
  feed.icon = ICON_MAP[feed.type] || "";

  if (feed.type !== "article") {
    feed.article = undefined;
  }

  if (feed.type !== "poll" && feed.type !== "pulsePolls") {
    feed.poll = undefined;
  }

  if (feed.type !== "announcement") {
    feed.announcement = undefined;
  }

  if (feed.type !== "trip" && feed.type !== "upcomingEvent") {
    feed.eventRef = undefined;
    feed.eventModel = undefined;
  }

  // Ensure title and description are undefined for types that don't use them
  if (
    ![
      "travelStories",
      "lightPulse",
      "spotlightStories",
      "businessBoosters",
      "foundersDesk",
    ].includes(feed.type)
  ) {
    feed.title = undefined;
    feed.description = undefined;
  }

  next();
});

// Add a compound index to ensure a user can only like a WallFeed once
wallFeedSchema.index(
  { _id: 1, "likes.userId": 1 },
  { unique: true, sparse: true }
);

export const WallFeed = mongoose.model("WallFeed", wallFeedSchema);
