import mongoose, { Schema, Document } from 'mongoose';

// ১. নেস্টেড ইন্টারফেসসমূহ
export interface ISpecification {
  label: string;
  value: string;
}

export interface IReview {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface IGadget extends Document {
  title: string;
  shortDescription: string;
  fullDescription: string;
  images: string[]; 
  pricePerDay: number;
  rating: number;
  location: string;
  availableDate: string;
  category: string;
  specifications: ISpecification[];
  reviews: IReview[];
  // 🎯 [যোগ করা হয়েছে] ইন্টারফেসে নতুন ফিল্ডসমূহ
  status: 'pending' | 'approved' | 'rejected';
  addedBy: string; // যে ইউজার প্রোডাক্টটি অ্যাড করেছে তার userId
}

// ২. মঙ্গুজ স্কিমা (ছাঁচ)
const SpecificationSchema = new Schema({
  label: { type: String, required: true },
  value: { type: String, required: true }
}, { _id: false }); 

const ReviewSchema = new Schema({
  id: { type: String, required: true },
  reviewerName: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  date: { type: String, required: true }
}, { _id: false });

const GadgetSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  shortDescription: { type: String, required: true },
  fullDescription: { type: String, required: true },
  images: [{ type: String, required: true }], 
  pricePerDay: { type: Number, required: true },
  rating: { type: Number, required: true, default: 5 },
  location: { type: String, required: true },
  availableDate: { type: String, required: true },
  category: { type: String, required: true },
  specifications: [SpecificationSchema], 
  reviews: [ReviewSchema],
  
  // 🎯 [যোগ করা হয়েছে] মঙ্গুজ স্কিমাতে নতুন ফিল্ডসমূহ
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' // ✅ নতুন কোনো গ্যাজেট অ্যাড হলেই সেটি অটোমেটিক 'pending' স্টেটে থাকবে
  },
  addedBy: { 
    type: String, 
    required: true // কোন ইউজার অ্যাড করেছে তা ট্র্যাক করার জন্য এটি বাধ্যতামূলক
  }
}, {
  timestamps: true
});

// মঙ্গুজের ওভাররাইট এরর এড়াতে এই কন্ডিশনটি ব্যবহার করা বেস্ট প্র্যাকটিস
const Gadget = mongoose.models.Gadget || mongoose.model<IGadget>('Gadget', GadgetSchema);
export default Gadget;


// import mongoose, { Schema, Document } from 'mongoose';

// // ১. নেস্টেড ইন্টারফেসসমূহ
// export interface ISpecification {
//   label: string;
//   value: string;
// }

// export interface IReview {
//   id: string;
//   reviewerName: string;
//   rating: number;
//   comment: string;
//   date: string;
// }

// export interface IGadget extends Document {
//   title: string;
//   shortDescription: string;
//   fullDescription: string;
//   images: string[]; // একাধিক ইমেজের জন্য স্ট্রিং অ্যারে
//   pricePerDay: number;
//   rating: number;
//   location: string;
//   availableDate: string;
//   category: string;
//   specifications: ISpecification[];
//   reviews: IReview[];
// }

// // ২. মঙ্গুজ স্কিমা (ছাঁচ)
// const SpecificationSchema = new Schema({
//   label: { type: String, required: true },
//   value: { type: String, required: true }
// }, { _id: false }); // সাব-ডকুমেন্টে আলাদা ID জেনারেট হওয়া বন্ধ রাখতে

// const ReviewSchema = new Schema({
//   id: { type: String, required: true },
//   reviewerName: { type: String, required: true },
//   rating: { type: Number, required: true },
//   comment: { type: String, required: true },
//   date: { type: String, required: true }
// }, { _id: false });

// const GadgetSchema: Schema = new Schema({
//   title: { type: String, required: true, trim: true },
//   shortDescription: { type: String, required: true },
//   fullDescription: { type: String, required: true },
//   images: [{ type: String, required: true }], // String Array
//   pricePerDay: { type: Number, required: true },
//   rating: { type: Number, required: true, default: 5 },
//   location: { type: String, required: true },
//   availableDate: { type: String, required: true },
//   category: { type: String, required: true },
//   specifications: [SpecificationSchema], // Nested Schema Array
//   reviews: [ReviewSchema] // Nested Schema Array
// }, {
//   timestamps: true
// });

// const Gadget = mongoose.model<IGadget>('Gadget', GadgetSchema);
// export default Gadget;