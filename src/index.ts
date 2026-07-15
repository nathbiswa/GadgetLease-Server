import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose'; 
import Gadget from './models/Gadget';
import Booking from './models/Booking';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*', 
  credentials: true
}));
app.use(express.json());

// MongoDB Cloud Connection
if (!MONGODB_URI) {
  console.error("❌ [database]: MONGODB_URI is missing!");
  process.exit(1);
}
mongoose.connect(MONGODB_URI)
  .then(() => console.log('🎯 [database]: Connected successfully to MongoDB Atlas!'))
  .catch((err) => console.error('❌ [database]: Connection error:', err));


// ==========================================
// 🛡️ JWKS & JWT VERIFICATION MIDDLEWARE
// ==========================================

const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

interface AuthenticatedRequest extends Request {
  user?: any;
}

const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1️⃣ ফাংশনের ভেতরে ডাইনামিক ইমপোর্ট করা হলো (টাইপস্ক্রিপ্ট এরর bypass করার জন্য)
    const { createRemoteJWKSet, jwtVerify } = await import('jose');

    // 2️⃣ JWKS তৈরির লজিকটি ফাংশনের ভেতরে নিয়ে আসা হলো
    const JWKS = createRemoteJWKSet(
      new URL(`${clientUrl.replace(/\/$/, '')}/api/auth/jwks`)
    );

    // 3️⃣ টোকেন ভেরিফাই করা হলো
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload; 
    console.log("👤 Authenticated User Payload:", payload);
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};

// ==========================================
// 🎯 PROTECTED ROUTE EXAMPLE
// ==========================================
app.post('/api/gadgets/verify', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  res.json({ 
    success: true, 
    message: "JWKS ভেরিফিকেশন সফল হয়েছে! 🎉",
    user: req.user
  });
});

// ====================== All Gadgets ======================
app.get('/api/gadgets', async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, category, maxPrice, location, sortBy, order, page, limit } = req.query;

    const query: any = {};
    query.status = 'approved';

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (maxPrice) {
      query.pricePerDay = { $lte: Number(maxPrice) };
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const sortField = (sortBy as string) || 'createdAt';
    const sortOrder = (order as string) === 'desc' ? -1 : 1;
    const sortOptions: any = { [sortField]: sortOrder };

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 8;
    const skip = (pageNumber - 1) * limitNumber;

    const totalGadgets = await Gadget.countDocuments(query);
    const gadgets = await Gadget.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);

    res.json({
      success: true,
      meta: {
        total: totalGadgets,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalGadgets / limitNumber)
      },
      data: gadgets
    });
  } catch (error) {
    console.error("Error fetching gadgets:", error);
    res.status(500).json({ success: false, message: "গ্যাজেট ডাটা ফিল্টার করতে সমস্যা হয়েছে।" });
  }
});

app.get('/api/gadgets/featured', async (req: Request, res: Response): Promise<any> => {
  try {
    const featuredGadgets = await Gadget.find({ featured: true }); 
    res.json({ success: true, data: featuredGadgets });
  } catch (error) {
    console.error("Error fetching featured gadgets:", error);
    res.status(500).json({ success: false, message: "There was a problem fetching featured gadget data." });
  }
});

app.get('/api/gadgets/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const gadget = await Gadget.findById(id); 
    
    if (!gadget) {
      return res.status(404).json({ success: false, message: "The gadget was not found." });
    }
    res.json({ success: true, data: gadget });
  } catch (error) {
    console.error("Error fetching single gadget:", error);
    res.status(500).json({ success: false, message: "There was a problem fetching the gadget data." });
  }
});

// ====================== All Bookings ======================
app.post('/api/bookings', async (req: Request, res: Response): Promise<any> => {
  try {
    const { gadgetId, userId, userEmail, startDate, endDate, totalCost } = req.body;

    if (!gadgetId || !userId || !userEmail || !startDate || !endDate || !totalCost) {
      return res.status(400).json({ 
        success: false, 
        message: "Necessary booking data is missing. Please provide all required fields."
      });
    }

    const newBooking = new Booking({
      gadgetId,
      userId,
      userEmail,
      startDate,
      endDate,
      totalCost: Number(totalCost),
      status: 'confirmed'
    });

    await newBooking.save();

    res.status(201).json({
      success: true,
      message: "Gadget Lease Booking Created Successfully!",
      data: newBooking
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ success: false, message: "Problem creating booking." });
  }
});

app.get('/api/bookings/user/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const userBookings = await Booking.find({ userId })
      .populate('gadgetId') 
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: userBookings
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ success: false, message: "Error fetching user bookings." });
  }
});

app.post('/api/items/add', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("📥 Incoming Payload:", req.body);
    const { title, category, pricePerDay, shortDescription, fullDescription, images, location, availableDate, userId } = req.body;

    if (!userId || !title || !category || !pricePerDay || !shortDescription || !location) {
      return res.status(400).json({ 
        success: false, 
        message: "সবগুলো প্রয়োজনীয় ফিল্ড সঠিকভাবে পূরণ করুন।" 
      });
    }

    const newGadget = new Gadget({
      title,
      category,
      pricePerDay: Number(pricePerDay),
      shortDescription,
      fullDescription: fullDescription || shortDescription,
      images: images && images.length > 0 ? images : ['https://placehold.co/600x400'],
      location,
      availableDate: availableDate || new Date().toISOString().split('T')[0],
      rating: 5,
      specifications: [], 
      reviews: [], 
      addedBy: userId,
      status: 'pending'
    });

    await newGadget.save();
    
    return res.status(201).json({ 
      success: true, 
      message: "Product submitted successfully! Waiting for admin approval.", 
      data: newGadget 
    });

  } catch (error: any) {
    console.error("❌ Mongoose Save Error Details:", error); 
    return res.status(500).json({ 
      success: false, 
      message: "ডাটাবেজে প্রোডাক্ট সেভ করতে সমস্যা হয়েছে।", 
      error: error.message 
    });
  }
});

app.get('/api/user/my-items', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const myItems = await Gadget.find({ addedBy: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: myItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching your items." });
  }
});

app.delete('/api/gadgets/:id', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await Gadget.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

// ====================== Admin Routes ======================
app.get('/api/admin/bookings', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.query; 

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is missing." });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: "Database connection not ready yet." });
    }
    
    if (!Types.ObjectId.isValid(userId as string)) {
        return res.status(400).json({ success: false, message: "Invalid User ID." });
    }

    const targetId = new Types.ObjectId(userId as string); 

    const user = await db.collection('user').findOne({ _id: targetId }) 
               || await db.collection('users').findOne({ _id: targetId });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied! You are not an admin of this platform." 
      });
    }

    const allBookings = await Booking.find()
      .populate('gadgetId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: allBookings
    });
  } catch (error) {
    console.error("Express Admin Fetch Error:", error);
    res.status(500).json({ success: false, message: "Admin verification failed." });
  }
});

app.post('/api/admin/gadgets', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title, category, pricePerDay, shortDescription, fullDescription, images, location, availableDate, rating, specifications } = req.body;

    if (!title || !category || !pricePerDay || !shortDescription) {
      return res.status(400).json({ success: false, message: "প্রয়োজনীয় মূল তথ্যগুলো অবশ্যই দিতে হবে।" });
    }

    const newGadget = new Gadget({
      title,
      category,
      pricePerDay: Number(pricePerDay),
      shortDescription,
      fullDescription: fullDescription || shortDescription,
      images: images && images.length > 0 ? images : ['https://placehold.co/600x400'],
      location: location || 'Dhaka, Bangladesh',
      availableDate: availableDate || new Date().toISOString().split('T')[0],
      rating: Number(rating) || 5.0,
      specifications: specifications || []
    });

    await newGadget.save();

    res.status(201).json({
      success: true,
      message: "🎉 নতুন গ্যাজেটটি সফলভাবে প্ল্যাটফর্মে যুক্ত হয়েছে!",
      data: newGadget
    });
  } catch (error) {
    console.error("Error creating gadget:", error);
    res.status(500).json({ success: false, message: "গ্যাজেটটি যুক্ত করতে সার্ভারে সমস্যা হয়েছে।" });
  }
});

app.get('/api/admin/pending-gadgets', async (req: Request, res: Response): Promise<any> => {
  try {
    const pendingGadgets = await Gadget.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Pending gadgets fetched successfully",
      data: pendingGadgets
    });
  } catch (error) {
    console.error("Error fetching pending gadgets:", error);
    res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে।" });
  }
});

app.patch('/api/gadgets/:id/status', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    const updatedGadget = await Gadget.findByIdAndUpdate(id, { status }, { new: true });

    res.status(200).json({
      success: true,
      message: `Gadget status updated to ${status}`,
      data: updatedGadget
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

app.get('/api/admin/pending-items', async (req: Request, res: Response) => {
  try {
    const pendingItems = await Gadget.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, data: pendingItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching pending items." });
  }
});

app.patch('/api/admin/approve-item/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body; 
    const updatedGadget = await Gadget.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ success: true, message: `Product ${status} successfully!`, data: updatedGadget });
  } catch (error) {
    res.status(500).json({ success: false, message: "Action failed." });
  }
});

// 🎯 রুট রাউট (Vercel 404 আটকাতে)
app.get('/', (req: Request, res: Response) => {
    res.send('🚀 GadgetLease TypeScript API Backend is Live!');
});

app.listen(PORT, () => {
    console.log(`⚡ [server]: Server is listening on port ${PORT}`);
});

export default app;
// import express, { Express, Request, Response, NextFunction } from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';
// import { createRemoteJWKSet, jwtVerify } from 'jose'; // ➔ jose লাইব্রেরি
// import Gadget  from './models/Gadget';
// import Booking from './models/Booking';

// dotenv.config();

// const app: Express = express();
// const PORT = process.env.PORT || 5000;
// const MONGODB_URI = process.env.MONGODB_URI;

// // Middleware
// app.use(cors({
//   origin: process.env.CLIENT_URL, // আপনার Next.js ফ্রন্টএন্ড ইউআরএল
//   credentials: true
// }));
// app.use(express.json());

// // MongoDB Cloud Connection
// if (!MONGODB_URI) {
//   console.error("❌ [database]: MONGODB_URI is missing!");
//   process.exit(1);
// }
// mongoose.connect(MONGODB_URI)
//   .then(() => console.log('🎯 [database]: Connected successfully to MongoDB Atlas!'))
//   .catch((err) => console.error('❌ [database]: Connection error:', err));


// // ==========================================
// // 🛡️ JWKS & JWT VERIFICATION MIDDLEWARE
// // ==========================================

// // ১. Next.js ফ্রন্টএন্ডের Better Auth JWKS এন্ডপয়েন্ট সেটআপ
// const JWKS = createRemoteJWKSet(
//   new URL(`${process.env.CLIENT_URL || 'http://localhost:3000'}/api/auth/jwks`)
// );

// // ২. টাইপস্ক্রিপ্ট রিকোয়েস্ট ইন্টারফেস বর্ধিতকরণ (ইউজার ডাটা পাস করার জন্য)
// interface AuthenticatedRequest extends Request {
//   user?: any;
// }

// // ৩. আপনার আইডিয়া অনুযায়ী ভেরিফাই টোকেন মিডলওয়্যার
// const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return res.status(401).json({ message: "Unauthorized: No token provided" });
//     }

//     const token = authHeader.split(' ')[1];

//     try {
//         // JWKS ব্যবহার করে টোকেনটি আসল কিনা তা ক্রিপ্টোগ্রাফিক্যালি ভেরিফাই করা
//         const { payload } = await jwtVerify(token, JWKS);
        
//         // ভেরিফাইড ইউজারের ডাটা রিকোয়েস্টে সেট করে দেওয়া
//         req.user = payload; 
        
//         console.log("👤 Authenticated User Payload:", payload);
//         next();
//     } catch (error) {
//         console.error("JWT Verification Error:", error);
//         return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
//     }
// };


// // ==========================================
// // 🎯 PROTECTED ROUTE EXAMPLE
// // ==========================================
// app.post('/api/gadgets', verifyToken, (req: AuthenticatedRequest, res: Response) => {
//     // এখন আপনি সহজেই req.user.sub (User ID) বা req.user.email পেয়ে যাবেন
//     res.json({ 
//       success: true, 
//       message: "JWKS ভেরিফিকেশন সফল হয়েছে! 🎉",
//       user: req.user
//     });
// });

// // ====================== All Gadgets ======================
// // 🌐 ১. সব গ্যাজেট পাওয়ার এপিআই (Advanced Search, Filter, Sort, Pagination)
// app.get('/api/gadgets', async (req: Request, res: Response): Promise<any> => {
//   try {
//     const { search, category, maxPrice, location, sortBy, order, page, limit } = req.query;

//     // ১. ফিল্টারিং অবজেক্ট তৈরি (Query Object)
//     const query: any = {};
//     query.status = 'approved';

//     // 🔍 সার্চ ফিল্টার (নাম বা ডেসক্রিপশনে খুঁজবে)
//     if (search) {
//       query.$or = [
//         { title: { $regex: search, $options: 'i' } },
//         { shortDescription: { $regex: search, $options: 'i' } }
//       ];
//     }

//     // 📁 ক্যাটাগরি ফিল্টার
//     if (category) {
//       query.category = category;
//     }

//     // 💰 সর্বোচ্চ প্রাইস ফিল্টার
//     if (maxPrice) {
//       query.pricePerDay = { $lte: Number(maxPrice) };
//     }

//     // 📍 লোকেশন ফিল্টার
//     if (location) {
//       query.location = { $regex: location, $options: 'i' };
//     }

//     // ২. সর্টিং লজিক (Sorting)
//     const sortField = (sortBy as string) || 'createdAt'; // ডিফল্ট তৈরি হওয়ার সময় অনুযায়ী
//     const sortOrder = (order as string) === 'desc' ? -1 : 1; // asc বা desc
//     const sortOptions: any = { [sortField]: sortOrder };

//     // ৩. পেজিনেশন লজিক (Pagination)
//     const pageNumber = Number(page) || 1;
//     const limitNumber = Number(limit) || 8; // প্রতি পেজে ৮টি করে ডাটা দেখাবে
//     const skip = (pageNumber - 1) * limitNumber;

//     // ডাটাবেজ থেকে ডাটা এবং মোট সংখ্যা আনা
//     const totalGadgets = await Gadget.countDocuments(query);
//     const gadgets = await Gadget.find(query)
//       .sort(sortOptions)
//       .skip(skip)
//       .limit(limitNumber);

//     // রেসপন্স পাঠানো
//     res.json({
//       success: true,
//       meta: {
//         total: totalGadgets,
//         page: pageNumber,
//         limit: limitNumber,
//         totalPages: Math.ceil(totalGadgets / limitNumber)
//       },
//       data: gadgets
//     });
//   } catch (error) {
//     console.error("Error fetching gadgets:", error);
//     res.status(500).json({ success: false, message: "গ্যাজেট ডাটা ফিল্টার করতে সমস্যা হয়েছে।" });
//   }
// });

// // 🌐 ২. শুধু ফিচারড গ্যাজেট পাওয়ার এপিআই (Featured Rental Gear)
// app.get('/api/gadgets/featured', async (req, res): Promise<any> => {
//   try {
//     // শুধু যেগুলোর featured মান true, সেগুলো আনবে
//     const featuredGadgets = await Gadget.find({ featured: true }); 
//     res.json({ success: true, data: featuredGadgets });
//   } catch (error) {
//     console.error("Error fetching featured gadgets:", error);
//     res.status(500).json({ success: false, message: "There was a problem fetching featured gadget data." });
//   }
// });

// // 🌐 ৩. আইডি দিয়ে নির্দিষ্ট একটি গ্যাজেটের ডিটেইলস পাওয়ার এপিআই
// app.get('/api/gadgets/:id', async (req, res): Promise<any> => {
//   try {
//     const { id } = req.params;
    
//     // ডাটাবেজ থেকে আইডি ম্যাচ করে গ্যাজেট খুঁজবে
//     const gadget = await Gadget.findById(id); 
    
//     if (!gadget) {
//       return res.status(404).json({ success: false, message: "The gadget was not found." });
//     }
    
//     res.json({ success: true, data: gadget });
//   } catch (error) {
//     console.error("Error fetching single gadget:", error);
//     res.status(500).json({ success: false, message: "There was a problem fetching the gadget data." });
//   }
// });

// // ====================== All Bookings ======================
// // 🌐 ৪. নতুন লিজ/বুকিং তৈরি করার এপিআই
// app.post('/api/bookings', async (req, res): Promise<any> => {
//   try {
//     const { gadgetId, userId, userEmail, startDate, endDate, totalCost } = req.body;

//     // 🔍 ডিবাগিং: সার্ভার টার্মিনালে ডাটা আসছে কিনা তা দেখার জন্য
//     // console.log("Received Booking Data:", req.body);

//     // ভ্যালিডেশন চেক (এখানে আমরা নিশ্চিত করছি যেন সব ডেটা থাকে)
//     if (!gadgetId || !userId || !userEmail || !startDate || !endDate || !totalCost) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Necessary booking data is missing. Please provide all required fields."
//       });
//     }

//     // নতুন বুকিং ডকুমেন্ট তৈরি
//     const newBooking = new Booking({
//       gadgetId, // এটি মঙ্গোডিবি ও মঙ্গুজ অবজেক্ট আইডি হিসেবে রিড করবে
//       userId,
//       userEmail,
//       startDate,
//       endDate,
//       totalCost: Number(totalCost), // নাম্বার নিশ্চিত করা হলো
//       status: 'confirmed'
//     });

//     await newBooking.save();

//     res.status(201).json({
//       success: true,
//       message: "Gadget Lease Booking Created Successfully!",
//       data: newBooking
//     });
//   } catch (error) {
//     console.error("Error creating booking:", error);
//     res.status(500).json({ success: false, message: "Problem creating booking." });
//   }
// });

// // 🌐 ৫. নির্দিষ্ট ইউজারের সব বুকিং হিস্ট্রি পাওয়ার এপিআই (Dashboard)
// app.get('/api/bookings/user/:userId', async (req, res): Promise<any> => {
//   try {
//     const { userId } = req.params;

//     // ১. ডাটাবেজ থেকে ওই ইউজারের বুকিং খোঁজা হচ্ছে
//     // ২. populate('gadgetId') দিয়ে Gadget কালেকশন থেকে ডাটা অটো জয়েন করা হচ্ছে
//     const userBookings = await Booking.find({ userId })
//       .populate('gadgetId') 
//       .sort({ createdAt: -1 }); // সর্বশেষ বুকিং আগে দেখাবে

//     res.json({
//       success: true,
//       data: userBookings
//     });
//   } catch (error) {
//     console.error("Error fetching user bookings:", error);
//     res.status(500).json({ success: false, message: "Error fetching user bookings." });
//   }
// });
// // 🌐 ফিক্সড করা এপিআই (আপনার আগের কোডটির পরিবর্তে এটি বসান)
// app.post('/api/items/add', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
//   try {
//     console.log("📥 Incoming Payload:", req.body); // সার্ভার টার্মিনালে ডাটা চেক করার জন্য

//     const { title, category, pricePerDay, shortDescription, fullDescription, images, location, availableDate, userId } = req.body;

//     // ১. 🔒 সিকিউরিটি ও ভ্যালিডেশন চেক (বাধ্যতামূলক ফিল্ডগুলো আছে কিনা)
//     if (!userId || !title || !category || !pricePerDay || !shortDescription || !location) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "সবগুলো প্রয়োজনীয় ফিল্ড (Title, Price, Category, Location, Description) সঠিকভাবে পূরণ করুন।" 
//       });
//     }

//     // ২. 🎯 মঙ্গুজ স্কিমার সাথে মিল রেখে অবজেক্ট তৈরি
//     const newGadget = new Gadget({
//       title,
//       category,
//       pricePerDay: Number(pricePerDay),
//       shortDescription,
//       fullDescription: fullDescription || shortDescription, // ফুল ডেসক্রিপশন না থাকলে শর্টটাই বসে যাবে
//       images: images && images.length > 0 ? images : ['https://placehold.co/600x400'], // ডিফল্ট ইমেজ গ্যারান্টি
//       location,
//       availableDate: availableDate || new Date().toISOString().split('T')[0], // যদি ফ্রন্টএন্ড থেকে ডেট না আসে, আজকের ডেট বসে যাবে
//       rating: 5, // ডিফল্ট রেটিং
//       specifications: [], 
//       reviews: [], 
//       addedBy: userId,
//       status: 'pending' // 🔒 সরাসরি অ্যাডমিনের এপ্রুভালের জন্য পেন্ডিং স্টেটে যাবে
//     });

//     // ৩. ডাটাবেজে সেভ করা
//     await newGadget.save();
    
//     return res.status(201).json({ 
//       success: true, 
//       message: "Product submitted successfully! Waiting for admin approval.", 
//       data: newGadget 
//     });

//   } catch (error: any) {
//     // 🔍 যদি কোনো কারণে আবারও ৫০০ এরর আসে, আপনার নোড বা এক্সপ্রেস টার্মিনালে এই নিচের কনসোলটি আসল কারণ বলে দেবে
//     console.error("❌ Mongoose Save Error Details:", error); 
//     return res.status(500).json({ 
//       success: false, 
//       message: "ডাটাবেজে প্রোডাক্ট সেভ করতে সমস্যা হয়েছে।", 
//       error: error.message 
//     });
//   }
// });


// app.get('/api/user/my-items', async (req: Request, res: Response) => {
//   try {
//     const { userId } = req.query;
//     const myItems = await Gadget.find({ addedBy: userId }).sort({ createdAt: -1 });
//     res.json({ success: true, data: myItems });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error fetching your items." });
//   }
// });

// app.delete('/api/gadgets/:id', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
//     try {
//         await Gadget.findByIdAndDelete(req.params.id);
//         res.status(200).json({ success: true, message: "Deleted successfully" });
//     } catch (err) {
//         res.status(500).json({ success: false, message: "Failed to delete" });
//     }
// });

// // ====================== Admin Routes ======================
// // 🌐 ফিক্সড করা এপিআই (আপনার আগের কোডটির পরিবর্তে এটি বসান)
// app.get('/api/admin/bookings', async (req: Request, res: Response): Promise<any> => {
//   try {
//     const { userId } = req.query; 

//     if (!userId) {
//       return res.status(400).json({ success: false, message: "User ID is missing." });
//     }

//     // ১. মঙ্গুজের ডাইনামিক কানেকশন থেকে সরাসরি 'user' বা 'users' কালেকশন ধরা হচ্ছে
//     const db = mongoose.connection.db;
//     const { ObjectId } = require('mongoose').Types;
    
//     if (!ObjectId.isValid(userId)) {
//         return res.status(400).json({ success: false, message: "Invalid User ID." });
//     }

//     // Better Auth মঙ্গোডিবিতে যে কালেকশনই বানাক না কেন, এটি ডাটা খুঁজে বের করবেই
//     const user = await db.collection('user').findOne({ _id: new ObjectId(userId as string) }) 
//                || await db.collection('users').findOne({ _id: new ObjectId(userId as string) });

//     // ২. 🔒 রোল চেকিং
//     if (!user || user.role !== 'admin') {
//       return res.status(403).json({ 
//         success: false, 
//         message: "Access Denied! You are not an admin of this platform." 
//       });
//     }

//     // ৩. অ্যাডমিন ভেরিফাইড হলে সব বুকিং নিয়ে আসা
//     const allBookings = await Booking.find()
//       .populate('gadgetId')
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data: allBookings
//     });
//   } catch (error) {
//     console.error("Express Admin Fetch Error:", error);
//     res.status(500).json({ success: false, message: "Admin login failed. Please try again." });
//   }
// });


// // Admin Gadget Management API (CRUD Operations)
// // 🌐 ৭. অ্যাডমিন প্যানেল থেকে নতুন গ্যাজেট যুক্ত করার API
// app.post('/api/admin/gadgets', async (req: Request, res: Response): Promise<any> => {
//   try {
//     const { title, category, pricePerDay, shortDescription, fullDescription, images, location, availableDate, rating, specifications } = req.body;

//     // সিম্পল ফিল্ড ভ্যালিডেশন
//     if (!title || !category || !pricePerDay || !shortDescription) {
//       return res.status(400).json({ success: false, message: "প্রয়োজনীয় মূল তথ্যগুলো (Title, Category, Price) অবশ্যই দিতে হবে।" });
//     }

//     // নতুন গ্যাজেট অবজেক্ট তৈরি
//     const newGadget = new Gadget({
//       title,
//       category,
//       pricePerDay: Number(pricePerDay),
//       shortDescription,
//       fullDescription: fullDescription || shortDescription,
//       images: images && images.length > 0 ? images : ['https://placehold.co/600x400'],
//       location: location || 'Dhaka, Bangladesh',
//       availableDate: availableDate || new Date().toISOString().split('T')[0],
//       rating: Number(rating) || 5.0,
//       specifications: specifications || []
//     });

//     await newGadget.save();

//     res.status(201).json({
//       success: true,
//       message: "🎉 নতুন গ্যাজেটটি সফলভাবে প্ল্যাটফর্মে যুক্ত হয়েছে!",
//       data: newGadget
//     });
//   } catch (error) {
//     console.error("Error creating gadget:", error);
//     res.status(500).json({ success: false, message: "গ্যাজেটটি যুক্ত করতে সার্ভারে সমস্যা হয়েছে।" });
//   }
// });

// // 🎯 ব্যাকএন্ডে এই নতুন GET রাউটটি কপি-পেস্ট করুন
// app.get('/api/admin/pending-gadgets', async (req: Request, res: Response): Promise<any> => {
//   try {
//     // ডাটাবেজ থেকে শুধুমাত্র pending স্ট্যাটাসের গ্যাজেটগুলো খোঁজা হচ্ছে
//     const pendingGadgets = await Gadget.find({ status: 'pending' }).sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       message: "Pending gadgets fetched successfully",
//       data: pendingGadgets
//     });
//   } catch (error) {
//     console.error("Error fetching pending gadgets:", error);
//     res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে।" });
//   }
// });

// // ⚡ স্ট্যাটাস আপডেট করার ব্যাকএন্ড রাউট
// app.patch('/api/gadgets/:id/status', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body; // approved বা rejected

//     const updatedGadget = await Gadget.findByIdAndUpdate(id, { status }, { new: true });

//     res.status(200).json({
//       success: true,
//       message: `Gadget status updated to ${status}`,
//       data: updatedGadget
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Failed to update status" });
//   }
// });

// // ক) অ্যাডমিনের জন্য সব পেন্ডিং প্রোডাক্ট গেট করা
// app.get('/api/admin/pending-items', async (req: Request, res: Response) => {
//   try {
//     const pendingItems = await Gadget.find({ status: 'pending' }).sort({ createdAt: -1 });
//     res.json({ success: true, data: pendingItems });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error fetching pending items." });
//   }
// });

// // খ) অ্যাডমিন দ্বারা প্রোডাক্ট স্ট্যাটাস পরিবর্তন (Approve/Reject) করা
// app.patch('/api/admin/approve-item/:id', async (req: Request, res: Response) => {
//   try {
//     const { status } = req.body; // 'approved' অথবা 'rejected' আসবে
//     const updatedGadget = await Gadget.findByIdAndUpdate(req.params.id, { status }, { new: true });
//     res.json({ success: true, message: `Product ${status} successfully!`, data: updatedGadget });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Action failed." });
//   }
// });

// app.get('/', (req: Request, res: Response) => {
//     res.send('GadgetLease API Backend with JWKS Verification is Live!');
// });

// app.listen(PORT, () => {
//     console.log(`⚡ [server]: Server is listening on port ${PORT}`);
// });

// export default app;