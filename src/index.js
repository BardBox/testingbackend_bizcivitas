import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Debug environment variables
// console.log('Environment variables loaded from:', envPath);
// console.log('CLIENT_EMAIL:', process.env.CLIENT_EMAIL);
// console.log('APP_PASSWORD_EMAIL:', process.env.APP_PASSWORD_EMAIL);
// console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID);
// console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET);
// console.log('RAZORPAY_WEBHOOK_SECRET:', process.env.RAZORPAY_WEBHOOK_SECRET);
// console.log('MONGO_URI:', process.env.MONGO_URI);

// Import modules after dotenv
import server from './app.js';
import connectDb from './db/index.js';

const PORT = process.env.PORT || 8080;

connectDb()
  .then(() => {
    server.on('error', (error) => {
      console.error('Server error:', error);
    });
    server.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });