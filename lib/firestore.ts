import * as admin from 'firebase-admin';

/**
 * Interface representing the User document structure in Firestore.
 */
export interface FirestoreUser {
  userId: string;
  email: string;
  displayName?: string;
  createdAt?: Date;
  // Add other user-related fields as needed
}

/**
 * A singleton pattern to ensure Firebase Admin is only initialized once.
 */
if (!admin.apps.length) {
  console.log('[Firestore] Initializing Firebase Admin...');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * The Firestore instance to use for all database operations.
 */
const db = admin.firestore();

/**
 * Creates a new user document in the "users" collection.
 *
 * @param {FirestoreUser} userData - An object containing user information.
 * @returns {Promise<void>} Returns a promise that resolves when the document is created.
 */
export async function createUserDocument(userData: FirestoreUser): Promise<void> {
  console.log('[Firestore] Attempting to create user document:', userData.userId);

  try {
    // Firestore doc reference (userId as doc ID)
    const userRef = db.collection('users').doc(userData.userId);

    // Set the doc with userData, adding a timestamp if needed
    await userRef.set({
      ...userData,
      createdAt: new Date(),
    });

    console.log('[Firestore] Successfully created user document:', userData.userId);
  } catch (error) {
    console.error('[Firestore] Error creating user document:', error);
    throw error;
  }
}

/**
 * Retrieves a user document from the "users" collection.
 *
 * @param {string} userId - The unique ID of the user (document ID).
 * @returns {Promise<FirestoreUser | null>} Returns the user data, or null if not found.
 */
export async function getUserDocument(userId: string): Promise<FirestoreUser | null> {
  console.log('[Firestore] Retrieving user document:', userId);

  try {
    const userSnapshot = await db.collection('users').doc(userId).get();
    if (!userSnapshot.exists) {
      console.log('[Firestore] User document not found for:', userId);
      return null;
    }
    const data = userSnapshot.data() as FirestoreUser;
    console.log('[Firestore] User document retrieved successfully:', userId);
    return data;
  } catch (error) {
    console.error('[Firestore] Error retrieving user document:', error);
    throw error;
  }
}

/**
 * Updates an existing user document in the "users" collection.
 *
 * @param {string} userId - The ID of the user document to update.
 * @param {Partial<FirestoreUser>} updatedFields - Fields to update.
 * @returns {Promise<void>} Returns a promise that resolves after successful update.
 */
export async function updateUserDocument(
  userId: string,
  updatedFields: Partial<FirestoreUser>
): Promise<void> {
  console.log('[Firestore] Updating user document:', userId);

  try {
    await db.collection('users').doc(userId).update(updatedFields);
    console.log('[Firestore] User document updated:', userId);
  } catch (error) {
    console.error('[Firestore] Error updating user document:', error);
    throw error;
  }
}

/**
 * Deletes a user document from the "users" collection.
 *
 * @param {string} userId - The ID of the user document to delete.
 * @returns {Promise<void>} Returns a promise that resolves after successful deletion.
 */
export async function deleteUserDocument(userId: string): Promise<void> {
  console.log('[Firestore] Deleting user document:', userId);

  try {
    await db.collection('users').doc(userId).delete();
    console.log('[Firestore] User document deleted:', userId);
  } catch (error) {
    console.error('[Firestore] Error deleting user document:', error);
    throw error;
  }
} 