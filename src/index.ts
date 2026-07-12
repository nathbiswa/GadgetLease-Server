import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createRemoteJWKSet, jwtVerify } from 'jose'; // ➔ jose লাইব্রেরি
import Gadget  from './models/Gadget';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors({
  origin: "http://localhost:3000", // আপনার Next.js ফ্রন্টএন্ড ইউআরএল
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

// ১. Next.js ফ্রন্টএন্ডের Better Auth JWKS এন্ডপয়েন্ট সেটআপ
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL || 'http://localhost:3000'}/api/auth/jwks`)
);

// ২. টাইপস্ক্রিপ্ট রিকোয়েস্ট ইন্টারফেস বর্ধিতকরণ (ইউজার ডাটা পাস করার জন্য)
interface AuthenticatedRequest extends Request {
  user?: any;
}

// ৩. আপনার আইডিয়া অনুযায়ী ভেরিফাই টোকেন মিডলওয়্যার
const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(' ')[1];

    try {
        // JWKS ব্যবহার করে টোকেনটি আসল কিনা তা ক্রিপ্টোগ্রাফিক্যালি ভেরিফাই করা
        const { payload } = await jwtVerify(token, JWKS);
        
        // ভেরিফাইড ইউজারের ডাটা রিকোয়েস্টে সেট করে দেওয়া
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
app.post('/api/gadgets', verifyToken, (req: AuthenticatedRequest, res: Response) => {
    // এখন আপনি সহজেই req.user.sub (User ID) বা req.user.email পেয়ে যাবেন
    res.json({ 
      success: true, 
      message: "JWKS ভেরিফিকেশন সফল হয়েছে! 🎉",
      user: req.user
    });
});

// ====================== All Gadgets ======================
// 🌐 ১. সব গ্যাজেট পাওয়ার এপিআই (All Gadgets)
app.get('/api/gadgets', async (req, res): Promise<any> => {
  try {
    const gadgets = await Gadget.find(); // ডাটাবেজ থেকে সব ডাটা খুঁজে আনবে
    res.json({ success: true, data: gadgets });
  } catch (error) {
    console.error("Error fetching gadgets:", error);
    res.status(500).json({ success: false, message: "There was a problem fetching gadget data." });
  }
});

// 🌐 ২. শুধু ফিচারড গ্যাজেট পাওয়ার এপিআই (Featured Rental Gear)
app.get('/api/gadgets/featured', async (req, res): Promise<any> => {
  try {
    // শুধু যেগুলোর featured মান true, সেগুলো আনবে
    const featuredGadgets = await Gadget.find({ featured: true }); 
    res.json({ success: true, data: featuredGadgets });
  } catch (error) {
    console.error("Error fetching featured gadgets:", error);
    res.status(500).json({ success: false, message: "There was a problem fetching featured gadget data." });
  }
});

// 🌐 ৩. আইডি দিয়ে নির্দিষ্ট একটি গ্যাজেটের ডিটেইলস পাওয়ার এপিআই
app.get('/api/gadgets/:id', async (req, res): Promise<any> => {
  try {
    const { id } = req.params;
    
    // ডাটাবেজ থেকে আইডি ম্যাচ করে গ্যাজেট খুঁজবে
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

app.get('/', (req: Request, res: Response) => {
    res.send('GadgetLease API Backend with JWKS Verification is Live!');
});

app.listen(PORT, () => {
    console.log(`⚡ [server]: Server is listening on port ${PORT}`);
});