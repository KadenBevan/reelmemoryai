'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import Lottie from 'lottie-react'
import googleAnimation from '@/public/assets/animations/Google.json'
import { cn } from '@/lib/utils'
import { authService } from '@/lib/firebase/auth'
import { useRouter } from 'next/navigation'

interface GoogleButtonProps {
  variant?: 'signin' | 'signup'
  onSuccess?: () => void
  onError?: (error: Error) => void
  className?: string
}

const getErrorMessage = (error: Error): string => {
  if (error.message.includes('Invalid Firebase configuration')) {
    return 'Authentication service is not properly configured. Please try again later.'
  }
  if (error.message.includes('popup-closed-by-user')) {
    return 'Sign in was cancelled. Please try again.'
  }
  return 'An error occurred during sign in. Please try again.'
}

/**
 * Animated Google authentication button component
 */
export function GoogleButton({ 
  variant = 'signin',
  className,
  onSuccess,
  onError,
  ...props 
}: GoogleButtonProps): JSX.Element {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const lottieRef = useRef<any>(null)

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true)
      
      if (!authService) {
        throw new Error('Authentication service is not initialized')
      }

      const result = await authService.signInWithGoogle()
      console.log('[GoogleButton] Authentication successful')
      
      onSuccess?.()
    } catch (error) {
      console.error('[GoogleButton] Authentication error:', error)
      onError?.(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMouseEnter = () => {
    if (lottieRef.current) {
      setIsPlaying(true)
      lottieRef.current.play()
    }
  }

  const handleMouseLeave = () => {
    if (lottieRef.current) {
      setIsPlaying(false)
      lottieRef.current.stop()
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "w-full relative flex items-center justify-center gap-2 py-6 hover:bg-gray-50",
        isLoading && "opacity-70 cursor-not-allowed",
        className
      )}
      onClick={handleGoogleAuth}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={isLoading}
      {...props}
    >
      <div className="w-6 h-6">
        <Lottie
          lottieRef={lottieRef}
          animationData={googleAnimation}
          loop={false}
          autoplay={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <span>
        {isLoading ? 'Please wait...' : `${variant === 'signin' ? 'Sign in' : 'Sign up'} with Google`}
      </span>
    </Button>
  )
} 