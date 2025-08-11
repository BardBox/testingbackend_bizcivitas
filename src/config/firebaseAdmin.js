// firebase.js (or firebaseConfig.js)
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseAdmin = admin;

// Initialize Firebase Admin only if not already initialized
const initializeFirebase = () => {
  try {
    // Construct the path to serviceAccountKey.json
    const serviceAccountPath = path.join(__dirname, '../config/serviceAccountKey.json');
    
    // Check if file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service account key file not found');
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    // Only initialize if not already initialized
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
      });
      // console.log('Firebase Admin initialized successfully');
    }
    
    return firebaseAdmin;

  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
    throw error;
  }
};

// Export initialized admin instance
export default initializeFirebase();