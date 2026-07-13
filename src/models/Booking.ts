// src/models/Booking.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  gadgetId: mongoose.Types.ObjectId;
  userId: string;       // Better Auth থেকে প্রাপ্ত User ID
  userEmail: string;    // ইউজারের ইমেইল
  startDate: string;    // লিজ শুরুর তারিখ
  endDate: string;      // লিজ শেষের তারিখ
  totalCost: number;    // মোট খরচ
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

const BookingSchema: Schema = new Schema({
  gadgetId: { type: Schema.Types.ObjectId, ref: 'Gadget', required: true },
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  totalCost: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'completed', 'cancelled'], 
    default: 'pending' 
  }
}, {
  timestamps: true
});

const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
export default Booking;