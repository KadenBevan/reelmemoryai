import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;
let storage: admin.storage.Storage;

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing required Firebase Admin configuration. Check environment variables.');
    }

    // Initialize the admin SDK
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });

    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
    
    console.log('[Firebase Admin] Successfully initialized Firebase Admin SDK');
  } catch (error) {
    console.error('[Firebase Admin] Error initializing Firebase Admin SDK:', error);
    throw error; // Re-throw the error instead of creating mock instances
  }
} else {
  db = admin.firestore();
  auth = admin.auth();
  storage = admin.storage();
}

export { db, auth, storage }; 