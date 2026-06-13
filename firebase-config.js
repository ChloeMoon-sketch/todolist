// Firebase configuration and initialization module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Default configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyDcCDCr0F5wrkewWYzV9_zm_1bdvo4-Tt4",
  authDomain: "mytodolist-a332b.firebaseapp.com",
  projectId: "mytodolist-a332b",
  storageBucket: "mytodolist-a332b.firebasestorage.app",
  messagingSenderId: "711214554935",
  appId: "1:711214554935:web:fdcf3ddb05f00f902bc4b2"
};

let app;
let db;
let auth;
let isFirebaseEnabled = false;

// Function to check if config is valid
function isValidConfig(config) {
  return config && config.apiKey && config.apiKey.startsWith("AIzaSy");
}

// Check if there is an overridden configuration in LocalStorage
let activeConfig = firebaseConfig;
const savedConfig = localStorage.getItem("firebase_custom_config");
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (isValidConfig(parsed)) {
      activeConfig = parsed;
    }
  } catch (e) {
    console.error("Failed to parse custom Firebase configuration", e);
  }
}

// Try to initialize Firebase
if (isValidConfig(activeConfig)) {
  try {
    app = initializeApp(activeConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseEnabled = true;
    console.log("Firebase initialized successfully with configuration:", activeConfig.projectId);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    isFirebaseEnabled = false;
  }
} else {
  console.warn("No valid Firebase configuration found. Running in LocalStorage Demo Mode.");
}

export { app, db, auth, isFirebaseEnabled, activeConfig };
