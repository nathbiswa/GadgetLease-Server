import mongoose, { Schema, Document } from 'mongoose';

// ১. টাইপস্ক্রিপ্ট ইন্টারফেস
export interface IGadget extends Document {
  name: string;
  category: string;
  pricePerDay: number;
  image: string;
  isAvailable: boolean;
  featured: boolean; // এটি দিয়ে আমরা 'Featured Rental Gear' ফিল্টার করব
  description?: string;
}

// ২. মঙ্গুজ স্কিমা (ছাঁচ)
const GadgetSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  pricePerDay: { type: Number, required: true },
  image: { type: String, required: true }, // ইমেজের অনলাইন ইউআরএল
  isAvailable: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  description: { type: String }
}, {
  timestamps: true // এটি দিলে createdAt এবং updatedAt অটো তৈরি হবে
});

// ৩. মডেল এক্সপোর্ট (এটি মঙ্গোডিবিতে 'gadgets' নামে কালেকশন তৈরি করবে)
export const Gadget = mongoose.model<IGadget>('Gadget', GadgetSchema);