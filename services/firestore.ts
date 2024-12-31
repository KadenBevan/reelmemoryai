import { db } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Interface for message data to be stored in Firestore
 */
interface MessageData {
  text: string;
  mediaType?: string;
  instaId?: string;
  username?: string;
  name?: string;
  timestamp: string;
}

/**
 * Service for handling Firestore database operations
 * Uses Firebase Admin SDK for server-side operations
 */
export class FirestoreService {
  private static instance: FirestoreService;
  private db!: FirebaseFirestore.Firestore;
  private initialized: boolean = false;

  private constructor() {
    // Private constructor to enforce singleton
  }

  /**
   * Gets the singleton instance of FirestoreService
   * @returns Promise resolving to FirestoreService instance
   */
  public static async getInstance(): Promise<FirestoreService> {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
      await FirestoreService.instance.initialize();
    }
    return FirestoreService.instance;
  }

  /**
   * Initializes the Firestore connection
   * @throws {Error} If Firebase Admin is not initialized
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Wait for a short time to ensure Firebase Admin is initialized
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!db) {
      throw new Error('Firebase Admin not initialized. Check environment variables.');
    }

    this.db = db;
    this.initialized = true;
    console.log('[Firestore Service] Successfully initialized');
  }

  /**
   * Stores a message in Firestore under the webhook_users collection
   * Updates user's message count and last active timestamp
   * 
   * @param {string} userNS - The user's namespace ID
   * @param {MessageData} messageData - The message data to store
   * @returns {Promise<string>} The ID of the stored message
   * @throws {Error} If Firestore operation fails
   */
  async storeMessage(userNS: string, messageData: MessageData): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('[Firestore Service] Storing message for user:', userNS);
      
      // Create message document
      const messageRef = this.db.collection('webhook_users').doc(userNS).collection('messages').doc();
      await messageRef.set({
        ...messageData,
        messageId: messageRef.id,
        createdAt: new Date().toISOString()
      });

      // Update user document
      await this.db.collection('webhook_users').doc(userNS).set({
        lastActive: new Date(),
        totalMessages: FieldValue.increment(1)
      }, { merge: true });

      console.log('[Firestore Service] Message stored successfully:', messageRef.id);
      return messageRef.id;
    } catch (error) {
      console.error('[Firestore Service] Error storing message:', error);
      throw error;
    }
  }
} 