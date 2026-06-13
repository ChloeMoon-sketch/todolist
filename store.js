// Database service to manage schedules (CRUD & Real-time Subscriptions)
import { db, isFirebaseEnabled } from "./firebase-config.js";
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Local listeners for Mock (LocalStorage) Mode
const localListeners = new Set();

function triggerLocalListeners(userId) {
  const events = getLocalEvents(userId);
  localListeners.forEach(listener => {
    if (listener.userId === userId) {
      listener.callback(events);
    }
  });
}

function getLocalEvents(userId) {
  const allEvents = JSON.parse(localStorage.getItem("schedule_events") || "[]");
  return allEvents
    .filter(event => event.userId === userId)
    .sort((a, b) => {
      // Sort by date then start time
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
}

export const DatabaseService = {
  // Add a new event
  async addEvent(eventData) {
    if (isFirebaseEnabled && db) {
      try {
        const docRef = await addDoc(collection(db, "events"), {
          ...eventData,
          createdAt: new Date().toISOString()
        });
        return docRef.id;
      } catch (error) {
        console.error("Firestore addEvent error:", error);
        throw error;
      }
    } else {
      // LocalStorage fallback
      const allEvents = JSON.parse(localStorage.getItem("schedule_events") || "[]");
      const newEvent = {
        ...eventData,
        id: "local_" + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      allEvents.push(newEvent);
      localStorage.setItem("schedule_events", JSON.stringify(allEvents));
      triggerLocalListeners(eventData.userId);
      return newEvent.id;
    }
  },

  // Update an event
  async updateEvent(eventId, updatedData) {
    if (isFirebaseEnabled && db) {
      try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, updatedData);
      } catch (error) {
        console.error("Firestore updateEvent error:", error);
        throw error;
      }
    } else {
      // LocalStorage fallback
      const allEvents = JSON.parse(localStorage.getItem("schedule_events") || "[]");
      const index = allEvents.findIndex(e => e.id === eventId);
      if (index !== -1) {
        const userId = allEvents[index].userId;
        allEvents[index] = { ...allEvents[index], ...updatedData };
        localStorage.setItem("schedule_events", JSON.stringify(allEvents));
        triggerLocalListeners(userId);
      }
    }
  },

  // Delete an event
  async deleteEvent(eventId, userId) {
    if (isFirebaseEnabled && db) {
      try {
        const eventRef = doc(db, "events", eventId);
        await deleteDoc(eventRef);
      } catch (error) {
        console.error("Firestore deleteEvent error:", error);
        throw error;
      }
    } else {
      // LocalStorage fallback
      let allEvents = JSON.parse(localStorage.getItem("schedule_events") || "[]");
      allEvents = allEvents.filter(e => e.id !== eventId);
      localStorage.setItem("schedule_events", JSON.stringify(allEvents));
      triggerLocalListeners(userId);
    }
  },

  // Real-time synchronization subscription
  subscribeToEvents(userId, callback) {
    if (!userId) {
      callback([]);
      return () => {};
    }

    if (isFirebaseEnabled && db) {
      const q = query(
        collection(db, "events"),
        where("userId", "==", userId),
        orderBy("date", "asc"),
        orderBy("startTime", "asc")
      );

      // Returns the unsubscribe function directly from Firestore
      return onSnapshot(q, (snapshot) => {
        const events = [];
        snapshot.forEach((doc) => {
          events.push({ id: doc.id, ...doc.data() });
        });
        callback(events);
      }, (error) => {
        console.error("Firestore subscription error:", error);
        // Fallback to local on error
        callback(getLocalEvents(userId));
      });
    } else {
      // LocalStorage fallback observer
      const listenerObj = { userId, callback };
      localListeners.add(listenerObj);

      // Trigger initial load
      callback(getLocalEvents(userId));

      // Return unsubscribe function
      return () => {
        localListeners.delete(listenerObj);
      };
    }
  }
};
