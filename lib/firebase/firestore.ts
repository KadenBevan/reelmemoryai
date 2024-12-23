import { doc, setDoc, getDoc, updateDoc, Firestore } from 'firebase/firestore'
import { db } from './config'

/**
 * Interface representing the User document structure in Firestore.
 */
export interface FirestoreUser {
  userId: string
  email: string
  displayName?: string
  instagramUsername: string
  createdAt?: Date
}

/**
 * Creates a new user document in the "users" collection.
 *
 * @param {FirestoreUser} userData - An object containing user information.
 * @returns {Promise<void>} Returns a promise that resolves when the document is created.
 */
export async function createUserDocument(userData: FirestoreUser): Promise<void> {
  console.log('[Firestore] Attempting to create user document:', userData.userId)

  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    const userRef = doc(db as Firestore, 'users', userData.userId)
    await setDoc(userRef, {
      ...userData,
      createdAt: new Date(),
    })
    console.log('[Firestore] Successfully created user document:', userData.userId)
  } catch (error) {
    console.error('[Firestore] Error creating user document:', error)
    throw error
  }
}

/**
 * Retrieves a user document from the "users" collection.
 *
 * @param {string} userId - The unique ID of the user (document ID).
 * @returns {Promise<FirestoreUser | null>} Returns the user data, or null if not found.
 */
export async function getUserDocument(userId: string): Promise<FirestoreUser | null> {
  console.log('[Firestore] Retrieving user document:', userId)

  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    const userSnapshot = await getDoc(doc(db as Firestore, 'users', userId))
    if (!userSnapshot.exists()) {
      console.log('[Firestore] User document not found for:', userId)
      return null
    }
    const data = userSnapshot.data() as FirestoreUser
    console.log('[Firestore] User document retrieved successfully:', userId)
    return data
  } catch (error) {
    console.error('[Firestore] Error retrieving user document:', error)
    throw error
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
  console.log('[Firestore] Updating user document:', userId)

  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    const userRef = doc(db as Firestore, 'users', userId)
    await updateDoc(userRef, updatedFields)
    console.log('[Firestore] User document updated:', userId)
  } catch (error) {
    console.error('[Firestore] Error updating user document:', error)
    throw error
  }
} 