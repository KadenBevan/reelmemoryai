'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { styles } from './SignUpModal.styles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils'
import { GoogleButton } from '@/components/ui/GoogleButton'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { createUserDocument } from '@/lib/firebase/firestore'
import InstagramUsernameModal from '@/components/InstagramUsernameModal'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * AuthModal component that handles both sign-in and sign-up functionality
 * 
 * @param {AuthModalProps} props - The component props
 * @returns {JSX.Element} The AuthModal component
 */
export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [instagramUsername, setInstagramUsername] = useState('')
  const [showInstagramModal, setShowInstagramModal] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  console.log('[AuthModal] Rendering with active tab:', activeTab)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      console.log('[AuthModal] Form submitted for:', activeTab)
      
      if (!auth) {
        throw new Error('Authentication is not initialized')
      }
      
      if (activeTab === 'signup') {
        // Create new user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        
        // Create user document in Firestore with Instagram username
        await createUserDocument({
          userId: userCredential.user.uid,
          email: userCredential.user.email!,
          instagramUsername,
          createdAt: new Date()
        })

        toast({
          title: "Account created!",
          description: "Welcome to Reel Memory AI",
        })
        
        onClose()
        router.push('/dashboard')
      } else {
        // Sign in existing user
        await signInWithEmailAndPassword(auth, email, password)
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        })
      }

      // Close modal and redirect
      onClose()
      router.push('/dashboard')
    } catch (error) {
      console.error('[AuthModal] Authentication error:', error)
      toast({
        title: "Authentication Error",
        description: (error as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthSuccess = async () => {
    console.log('[AuthModal] Authentication successful')
    
    // For Google sign-in, show the Instagram username modal
    if (auth?.currentUser?.uid) {
      setCurrentUserId(auth.currentUser.uid)
      setShowInstagramModal(true)
    } else {
      onClose()
      router.push('/dashboard')
    }
  }

  const handleAuthError = (error: Error) => {
    console.error('[AuthModal] Authentication error:', error)
    toast({
      title: "Authentication Error",
      description: error.message,
      variant: "destructive",
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={styles.dialog}>
          <DialogHeader>
            <DialogTitle className="sr-only">
              {activeTab === 'signin' ? 'Sign In' : 'Sign Up'} to Reel Memory AI
            </DialogTitle>
            <div className={styles.tabContainer}>
              <button
                onClick={() => setActiveTab('signin')}
                className={cn(styles.tab, activeTab === 'signin' && styles.activeTab)}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={cn(styles.tab, activeTab === 'signup' && styles.activeTab)}
              >
                Sign Up
              </button>
            </div>
            <DialogDescription className={styles.description}>
              {activeTab === 'signin' 
                ? 'Welcome back! Sign in to your account'
                : 'Create an account to start analyzing videos with AI'}
            </DialogDescription>
          </DialogHeader>

          <div className={styles.formContainer}>
            <GoogleButton 
              variant={activeTab}
              className={styles.googleButton}
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
            />
            
            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with email</span>
              <span className={styles.dividerLine} />
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="Enter your email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div className={styles.inputGroup}>
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder={activeTab === 'signin' ? 'Enter your password' : 'Create a password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
              {activeTab === 'signin' && (
                <Button 
                  variant="link" 
                  className={styles.forgotPassword}
                  type="button"
                >
                  Forgot password?
                </Button>
              )}
              {activeTab === 'signup' && (
                <div className={styles.inputGroup}>
                  <Label htmlFor="instagram">Instagram Username</Label>
                  <Input 
                    id="instagram" 
                    type="text" 
                    placeholder="@yourusername" 
                    value={instagramUsername}
                    onChange={(e) => setInstagramUsername(e.target.value)}
                    required={activeTab === 'signup'}
                  />
                </div>
              )}
              <Button 
                type="submit" 
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading ? 'Please wait...' : (activeTab === 'signin' ? 'Sign In' : 'Sign Up')}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Username Modal for Google Sign-in */}
      {showInstagramModal && currentUserId && (
        <InstagramUsernameModal
          isOpen={showInstagramModal}
          onClose={() => {
            setShowInstagramModal(false)
            router.push('/dashboard')
          }}
          userId={currentUserId}
        />
      )}
    </>
  )
}

