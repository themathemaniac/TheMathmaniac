import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

let db: ReturnType<typeof getFirestore> | null = null;
let isFirebaseEnabled = false;

if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin SDK initialized successfully.');
    }
    db = getFirestore();
    isFirebaseEnabled = true;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
} else {
  console.warn('Firebase Admin environment variables missing. Firebase user sync is disabled.');
}

export { db, isFirebaseEnabled };
