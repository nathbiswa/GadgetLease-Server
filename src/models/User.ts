import mongoose, { Schema, Document } from 'mongoose';

// ১. টাইপস্ক্রিপ্টের গাইডলাইন (ইন্টারফেস)
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// ২. মঙ্গুজের আসল ছাঁচ (Schema)
const UserSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ৩. মডেল এক্সপোর্ট
export const User = mongoose.model<IUser>('User', UserSchema);