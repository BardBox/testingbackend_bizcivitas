import mongoose, { Schema } from 'mongoose';

const tripEventSchema = new Schema(
  {
    eventName: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    destination: { type: String, required: true },
    description: { type: String, required: true },
    eventImg: { type: String, required: true },
participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    communities: [{ type: Schema.Types.ObjectId, ref: 'Community', required: true }], // Changed to array to match OneDayEvent
    region: { type: [String], default: [] }, // Changed to array, optional
    state: { type: [String], default: [] }, // Added, optional
    postEventImg: [{ type: String }], // Kept as is
    eventOverview: { type: String, default: '' }, // Optional
    subtitle: { type: String, default: '' }, // Optional
    whyAttend: [{ type: String }, { default: [] }], // Optional
    isPaid: { type: Boolean, default: false, required: true },
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
    ], // Added, optional
    amount: {
      type: Number,
      required: function () {
        return this.isPaid;
      },
      default: undefined,
    },
  },
  { timestamps: true }
);

tripEventSchema.pre('save', function (next) {
  if (this.isPaid && !this.amount) {
    return next(new Error('Amount is required for paid events'));
  }
  if (!this.isPaid) {
    this.amount = null;
  }
  next();
});

tripEventSchema.index({ communities: 1 });
tripEventSchema.index({ state: 1 });
tripEventSchema.index({ region: 1 });
tripEventSchema.index({ participants: 1 });

export const TripEvent = mongoose.model('TripEvent', tripEventSchema);