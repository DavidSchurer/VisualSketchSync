// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from "firebase/auth"; // Import Firebase Authentication

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD_yxPOVMqh2thXE_RjpQxgM49MJc38rso",
  authDomain: "visualsketchsync.firebaseapp.com",
  projectId: "visualsketchsync",
  storageBucket: "visualsketchsync.firebasestorage.app",
  messagingSenderId: "1092098323148",
  appId: "1:1092098323148:web:2fcea07f7dba11cdeb0869",
  measurementId: "G-R19CC0VEVK",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app); // Initialize Firebase Authentication
const db = getFirestore(app); // Initialize Firestore

// Export auth for use in other components
export { auth, db };