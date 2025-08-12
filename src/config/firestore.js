import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  FIREBASE_API,
  FIREBASE_APP_ID,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_MEASUREMENT_ID,
  FIREBASE_MESSAGING_SENDER_ID,
} from "../utils";

/**
 * Firebase configuration. Replace the placeholder values with your own
 * project settings. See https://firebase.google.com/docs/web/setup for
 * guidance on obtaining these fields from the Firebase console.
 */
const firebaseConfig = {
  apiKey: FIREBASE_API,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
