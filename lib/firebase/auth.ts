import { 
  GoogleAuthProvider, 
  signInWithPopup,
  UserCredential,
  signOut as firebaseSignOut,
  AuthError,
  Auth
} from 'firebase/auth'
import { auth } from './config'
import { createUserDocument } from './firestore'

/**
 * Service for handling Firebase authentication operations
 */
export class AuthService {
  private provider: GoogleAuthProvider
  private auth: Auth

  constructor() {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized')
    }
    
    this.provider = new GoogleAuthProvider()
    this.provider.setCustomParameters({
      client_id: '79105828888-6q77f9rsemsj9kg8p9i0tbsrnpemgp9k.apps.googleusercontent.com',
      prompt: 'select_account'
    })
    
    this.auth = auth
    console.log('[AuthService] Initialized')
  }

  /**
   * Signs in or signs up a user with Google
   * @returns {Promise<UserCredential>} The user credentials
   */
  async signInWithGoogle(): Promise<UserCredential> {
    try {
      console.log('[AuthService] Attempting Google sign in')
      
      const result = await signInWithPopup(this.auth, this.provider)
      
      // Create/update user document in Firestore
      await createUserDocument({
        userId: result.user.uid,
        email: result.user.email!,
        displayName: result.user.displayName || undefined,
        createdAt: new Date()
      })

      console.log('[AuthService] Google sign in successful:', result.user.uid)
      return result
    } catch (error) {
      console.error('[AuthService] Google sign in error:', error)
      
      // Handle specific Firebase auth errors
      if ((error as AuthError).code === 'auth/invalid-api-key') {
        throw new Error('Invalid Firebase configuration. Please check your environment variables.')
      }
      
      if ((error as AuthError).code === 'auth/popup-closed-by-user') {
        throw new Error('Sign in was cancelled by user.')
      }
      
      throw error
    }
  }

  /**
   * Signs out the current user
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(this.auth)
      console.log('[AuthService] Sign out successful')
    } catch (error) {
      console.error('[AuthService] Sign out error:', error)
      throw error
    }
  }
}

// Create singleton instance only if auth is initialized
let authService: AuthService | undefined

try {
  authService = new AuthService()
} catch (error) {
  console.error('[AuthService] Failed to initialize:', error)
}

export { authService } 