import mongoose, { Schema } from 'mongoose';

const eventSchema = new Schema(
  {
    eventName: {
      type: String,
      required: [true, 'Event name is required'],
    },
    date: {
      type: Date,
      required: function () {
        return ['onedayevent', 'onlineevent'].includes(this.eventType);
      },
    },
    startTime: {
      type: String,
      required: function () {
        return ['onedayevent', 'onlineevent', 'tripevent'].includes(this.eventType);
      },
    },
    endTime: {
      type: String,
      required: function () {
        return ['onedayevent', 'onlineevent', 'tripevent'].includes(this.eventType);
      },
    },
    location: {
      type: String,
      required: function () {
        return ['onedayevent', 'tripevent'].includes(this.eventType);
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    img: {
      type: String,
      required: [true, 'Event image is required'],
    },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    eventType: {
      type: String,
      enum: ['onedayevent', 'onlineevent', 'tripevent'],
      required: [true, 'Event type is required'],
      default: 'onedayevent',
    },
    communities: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Community',
        required: [true, 'At least one community is required'],
      },
    ],
    region: { type: [String], default: [] },
    eventOverview: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    whyAttend: [{ type: String, default: [] }],
    isPaid: {
      type: Boolean,
      default: false,
      required: [true, 'isPaid field is required'],
    },
    membershipType: [
      {
        type: String,
        enum: [
          'Core Membership',
          'Flagship Membership',
          'Industria Membership',
          'Digital Membership',
        ],
      },
    ],
    state: { type: [String], default: [] },
    amount: {
      type: Number,
      required: function () {
        return this.isPaid;
      },
      default: undefined,
    },
    onlineLink: {
      type: String,
      required: function () {
        return this.eventType === 'onlineevent';
      },
    },
    startDate: {
      type: Date,
      required: function () {
        return this.eventType === 'tripevent';
      },
    },
    endDate: {
      type: Date,
      required: function () {
        return this.eventType === 'tripevent';
      },
    },
    postEventImages: {
      type: [String],
      default: [],
      required: function () {
        return this.eventType === 'tripevent';
      },
    },
  },
  { timestamps: true }
);

// Validation
eventSchema.pre('save', function (next) {
  if (this.isPaid && (this.amount === undefined || isNaN(this.amount) || this.amount <= 0)) {
    return next(new Error('Valid amount is required for paid events'));
  }
  if (!this.isPaid) {
    this.amount = null;
  }

  const now = new Date();

  if (['onedayevent', 'onlineevent'].includes(this.eventType)) {
    if (!this.date || isNaN(this.date.getTime()) || this.date <= now) {
      return next(new Error(`Event date must be in the future for ${this.eventType} events`));
    }
  } else if (this.eventType === 'tripevent') {
    if (!this.startDate || isNaN(this.startDate.getTime()) || this.startDate <= now) {
      return next(new Error('Start date must be in the future for tripevent'));
    }
    if (!this.endDate || isNaN(this.endDate.getTime()) || this.endDate < this.startDate) {
      return next(new Error('End date must be after start date for tripevent'));
    }
  }

  next();
});

eventSchema.index({ communities: 1 });
eventSchema.index({ state: 1 });
eventSchema.index({ region: 1 });
eventSchema.index({ participants: 1 });

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export { Event };