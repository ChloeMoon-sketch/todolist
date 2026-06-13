// Authentication service wrapper for Firebase Auth and LocalStorage Demo Mode
import { auth, isFirebaseEnabled } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Mock User info for Demo Mode
const DEMO_USER = {
  uid: "demo-user-123",
  email: "demo@example.com",
  displayName: "GUEST USER",
  photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=guest",
  isDemo: true
};

let currentMockUser = null;
const authListeners = new Set();

function getActiveMockUser() {
  if (currentMockUser) return currentMockUser;
  const saved = localStorage.getItem("schedule_mock_user");
  if (saved) {
    try {
      currentMockUser = JSON.parse(saved);
      return currentMockUser;
    } catch (e) {
      localStorage.removeItem("schedule_mock_user");
    }
  }
  return null;
}

function notifyListeners(user) {
  authListeners.forEach(listener => listener(user));
}

export const AuthService = {
  // Sign up
  async signUp(email, password, displayName = "") {
    // teacher 아이디 자동 변환
    if (email === 'teacher') {
      email = 'teacher@admin.com';
    }

    if (isFirebaseEnabled && auth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Optionally update profile display name here if desired
        return userCredential.user;
      } catch (error) {
        console.error("Firebase Sign Up error:", error);
        throw error;
      }
    } else {
      // Mock Sign Up
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      if (users.find(u => u.email === email)) {
        throw new Error("Email already in use.");
      }
      const newUser = {
        uid: "mock_" + Math.random().toString(36).substr(2, 9),
        email,
        displayName: displayName || email.split("@")[0].toUpperCase(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
        isDemo: true
      };
      users.push({ ...newUser, password }); // Storing pass in plaintext ONLY for local mock demo mode
      localStorage.setItem("mock_users", JSON.stringify(users));
      
      currentMockUser = newUser;
      localStorage.setItem("schedule_mock_user", JSON.stringify(newUser));
      notifyListeners(newUser);
      return newUser;
    }
  },

  // Log in with Email and Password
  async login(email, password) {
    // teacher 아이디 자동 변환
    if (email === 'teacher') {
      email = 'teacher@admin.com';
    }

    if (isFirebaseEnabled && auth) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
      } catch (error) {
        console.error("Firebase Login error:", error);
        // Self-healing for guest or admin account: if it doesn't exist, create it automatically
        const isSpecialAccount = email === DEMO_USER.email || email === 'teacher@admin.com';
        if (isSpecialAccount && (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/invalid-login-credentials")) {
          try {
            console.log("Special user not found on Firebase. Creating account...");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            return userCredential.user;
          } catch (createError) {
            console.error("Failed to automatically create special user:", createError);
          }
        }
        throw error;
      }
    } else {
      // Mock Login
      if (email === DEMO_USER.email && password === "demo1234") {
        currentMockUser = DEMO_USER;
        localStorage.setItem("schedule_mock_user", JSON.stringify(DEMO_USER));
        notifyListeners(DEMO_USER);
        return DEMO_USER;
      }
      
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const matched = users.find(u => u.email === email && u.password === password);
      if (!matched) {
        throw new Error("Invalid email or password. (For default Demo, use email: demo@example.com / password: demo1234)");
      }
      
      const loggedUser = {
        uid: matched.uid,
        email: matched.email,
        displayName: matched.displayName,
        photoURL: matched.photoURL,
        isDemo: true
      };
      currentMockUser = loggedUser;
      localStorage.setItem("schedule_mock_user", JSON.stringify(loggedUser));
      notifyListeners(loggedUser);
      return loggedUser;
    }
  },

  // Log in with Google (Firebase only)
  async loginWithGoogle() {
    if (isFirebaseEnabled && auth) {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
      } catch (error) {
        console.error("Firebase Google Login error:", error);
        throw error;
      }
    } else {
      throw new Error("Google login is only available when Firebase is configured.");
    }
  },

  // Log out
  async logout() {
    if (isFirebaseEnabled && auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Firebase Logout error:", error);
        throw error;
      }
    } else {
      currentMockUser = null;
      localStorage.removeItem("schedule_mock_user");
      notifyListeners(null);
    }
  },

  // Get current user
  getCurrentUser() {
    if (isFirebaseEnabled && auth) {
      return auth.currentUser;
    } else {
      return getActiveMockUser();
    }
  },

  // Subscribe to authentication changes
  onAuthStateChanged(callback) {
    if (isFirebaseEnabled && auth) {
      return onAuthStateChanged(auth, (user) => {
        callback(user);
      });
    } else {
      authListeners.add(callback);
      // Run immediately with current state
      const user = getActiveMockUser();
      callback(user);

      // Return unsubscribe function
      return () => {
        authListeners.delete(callback);
      };
    }
  }
};
