import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// .env ফাইল থেকে ক্লাউড ইউআরএলটি রিড করবে
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Atlas Cloud Connection
if (!MONGODB_URI) {
  console.error("❌ [database]: MONGODB_URI is missing in .env file!");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('🎯 [database]: Connected successfully to MongoDB Atlas Cloud!'))
  .catch((err) => console.error('❌ [database]: Connection error:', err));

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World! GadgetLease Backend is live with MongoDB Atlas Cloud.');
});

app.listen(PORT, () => {
    console.log(`⚡ [server]: Server is listening on port ${PORT}`);
});