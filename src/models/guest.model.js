import mongoose, { Schema } from 'mongoose';

const guestSchema = new Schema(
  {
    fname: {
      type: String,
      required: true,
      trim: true,
    },
    lname: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
      default: '',
    },
    mobile: {
      type: String,
      trim: true,
      match: [/^(?:\+91|91)?\d{10}$/, 'Please provide a valid Indian mobile number'],
      default: '',
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'OneDayEvent',
      index: true,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['free', 'pending', 'completed', 'failed'],
      default: 'pending',
    },
    paymentInfo: {
      razorpay_order_id: { type: String, sparse: true },
      razorpay_payment_id: { type: String },
      razorpay_signature: { type: String },
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Amount paid cannot be negative'],
    },
    tableNo: {
      type: String,
      default: null,
      trim: true,
    },
    attendance: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate registrations
guestSchema.index(
  { eventId: 1, email: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { eventId: { $exists: true } },
  }
);

// Index for payment order ID lookup
guestSchema.index({ 'paymentInfo.razorpay_order_id': 1 }, { sparse: true });

export const Guest = mongoose.model('Guest', guestSchema);
