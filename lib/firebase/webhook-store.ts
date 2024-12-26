import { doc, setDoc, getDoc, Firestore, arrayUnion } from 'firebase/firestore'
import { db } from './config'

/**
 * Interface for tracking incoming messages
 */
export interface IncomingMessage {
  text: string
  timestamp: Date
  messageId?: string
}

/**
 * Interface for tracking outgoing messages
 */
export interface OutgoingMessage {
  text: string
  timestamp: Date
  messageId?: string
  type: 'ANALYSIS_RESULT' | 'ACKNOWLEDGMENT' | 'ERROR' | 'OTHER'
}

/**
 * Interface for tracking incoming videos
 */
export interface IncomingVideo {
  videoUrl: string
  timestamp: Date
  videoId?: string
  analysisRequested: boolean
}

/**
 * Interface for tracking outgoing videos
 */
export interface OutgoingVideo {
  videoUrl: string
  timestamp: Date
  videoId?: string
  type: 'ANALYSIS_RESULT' | 'OTHER'
}

/**
 * Interface representing a webhook user in Firestore
 */
export interface WebhookUser {
  // Basic user information
  name: string
  username: string
  userNS: string
  InstaId: string
  
  // Timestamps
  lastActive: Date
  createdAt: Date
  
  // Communication tracking
  incomingMessages: IncomingMessage[]
  outgoingMessages: OutgoingMessage[]
  incomingVideos: IncomingVideo[]
  outgoingVideos: OutgoingVideo[]
  
  // Statistics (updated automatically)
  totalIncomingMessages: number
  totalOutgoingMessages: number
  totalIncomingVideos: number
  totalOutgoingVideos: number
}

/**
 * Creates or updates a user document from webhook data in the "webhook_users" collection
 * Uses userNS as the document ID since it's unique per Instagram account
 *
 * @param {Omit<WebhookUser, 'createdAt' | 'lastActive' | 'incomingMessages' | 'outgoingMessages' | 'incomingVideos' | 'outgoingVideos' | 'totalIncomingMessages' | 'totalOutgoingMessages' | 'totalIncomingVideos' | 'totalOutgoingVideos'>} userData - User information from the webhook
 * @returns {Promise<void>} Returns a promise that resolves when the document is created/updated
 */
export async function upsertWebhookUser(userData: Omit<WebhookUser, 'createdAt' | 'lastActive' | 'incomingMessages' | 'outgoingMessages' | 'incomingVideos' | 'outgoingVideos' | 'totalIncomingMessages' | 'totalOutgoingMessages' | 'totalIncomingVideos' | 'totalOutgoingVideos'>): Promise<void> {
  console.log('[Firestore Webhook] Upserting webhook user:', userData.userNS)

  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    const userRef = doc(db as Firestore, 'webhook_users', userData.userNS)
    
    // Check if user already exists
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      // New user - include createdAt and initialize arrays and counters
      await setDoc(userRef, {
        ...userData,
        createdAt: new Date(),
        lastActive: new Date(),
        incomingMessages: [],
        outgoingMessages: [],
        incomingVideos: [],
        outgoingVideos: [],
        totalIncomingMessages: 0,
        totalOutgoingMessages: 0,
        totalIncomingVideos: 0,
        totalOutgoingVideos: 0
      })
      console.log('[Firestore Webhook] Created new webhook user:', userData.userNS)
    } else {
      // Existing user - only update basic info and lastActive
      await setDoc(userRef, {
        ...userData,
        lastActive: new Date()
      }, { merge: true })
      console.log('[Firestore Webhook] Updated webhook user:', userData.userNS)
    }
  } catch (error) {
    console.error('[Firestore Webhook] Error upserting webhook user:', error)
    throw error
  }
}

/**
 * Adds an incoming message to a user's document
 * 
 * @param {string} userNS - The unique userNS identifier
 * @param {IncomingMessage} message - The message to add
 * @returns {Promise<void>}
 */
export async function addIncomingMessage(userNS: string, message: IncomingMessage): Promise<void> {
  if (!db) throw new Error('Firestore not initialized')
  
  const userRef = doc(db as Firestore, 'webhook_users', userNS)
  
  await setDoc(userRef, {
    lastActive: new Date(),
    incomingMessages: arrayUnion(message),
    totalIncomingMessages: (await getDoc(userRef)).data()?.totalIncomingMessages + 1 || 1
  }, { merge: true })
}

/**
 * Adds an outgoing message to a user's document
 * 
 * @param {string} userNS - The unique userNS identifier
 * @param {OutgoingMessage} message - The message to add
 * @returns {Promise<void>}
 */
export async function addOutgoingMessage(userNS: string, message: OutgoingMessage): Promise<void> {
  if (!db) throw new Error('Firestore not initialized')
  
  const userRef = doc(db as Firestore, 'webhook_users', userNS)
  
  await setDoc(userRef, {
    lastActive: new Date(),
    outgoingMessages: arrayUnion(message),
    totalOutgoingMessages: (await getDoc(userRef)).data()?.totalOutgoingMessages + 1 || 1
  }, { merge: true })
}

/**
 * Adds an incoming video to a user's document
 * 
 * @param {string} userNS - The unique userNS identifier
 * @param {IncomingVideo} video - The video to add
 * @returns {Promise<void>}
 */
export async function addIncomingVideo(userNS: string, video: IncomingVideo): Promise<void> {
  if (!db) throw new Error('Firestore not initialized')
  
  const userRef = doc(db as Firestore, 'webhook_users', userNS)
  
  await setDoc(userRef, {
    lastActive: new Date(),
    incomingVideos: arrayUnion(video),
    totalIncomingVideos: (await getDoc(userRef)).data()?.totalIncomingVideos + 1 || 1
  }, { merge: true })
}

/**
 * Adds an outgoing video to a user's document
 * 
 * @param {string} userNS - The unique userNS identifier
 * @param {OutgoingVideo} video - The video to add
 * @returns {Promise<void>}
 */
export async function addOutgoingVideo(userNS: string, video: OutgoingVideo): Promise<void> {
  if (!db) throw new Error('Firestore not initialized')
  
  const userRef = doc(db as Firestore, 'webhook_users', userNS)
  
  await setDoc(userRef, {
    lastActive: new Date(),
    outgoingVideos: arrayUnion(video),
    totalOutgoingVideos: (await getDoc(userRef)).data()?.totalOutgoingVideos + 1 || 1
  }, { merge: true })
}

/**
 * Retrieves a webhook user document from Firestore
 *
 * @param {string} userNS - The unique userNS identifier
 * @returns {Promise<WebhookUser | null>} Returns the user data or null if not found
 */
export async function getWebhookUser(userNS: string): Promise<WebhookUser | null> {
  console.log('[Firestore Webhook] Retrieving webhook user:', userNS)

  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    const userSnapshot = await getDoc(doc(db as Firestore, 'webhook_users', userNS))
    if (!userSnapshot.exists()) {
      console.log('[Firestore Webhook] User not found:', userNS)
      return null
    }

    const data = userSnapshot.data() as WebhookUser
    console.log('[Firestore Webhook] User retrieved successfully:', userNS)
    return data
  } catch (error) {
    console.error('[Firestore Webhook] Error retrieving webhook user:', error)
    throw error
  }
} 