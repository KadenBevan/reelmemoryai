'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateUserDocument } from '@/lib/firebase/firestore'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface InstagramUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function InstagramUsernameModal({ 
  isOpen, 
  onClose,
  userId 
}: InstagramUsernameModalProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validateUsername = (username: string): boolean => {
    // Remove @ if present at start
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username
    
    // Instagram username rules:
    // - 1-30 characters
    // - Letters, numbers, periods, and underscores only
    // - Can't start or end with period
    const usernameRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_.]*[a-zA-Z0-9_]$/
    return cleanUsername.length >= 1 && 
           cleanUsername.length <= 30 && 
           usernameRegex.test(cleanUsername)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate username format
    if (!validateUsername(username)) {
      toast({
        title: "Invalid Username",
        description: "Please enter a valid Instagram username.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      console.log('[InstagramUsernameModal] Updating user document with Instagram username')
      
      await updateUserDocument(userId, {
        instagramUsername: username
      })

      toast({
        title: "Profile Updated",
        description: "Your Instagram username has been saved.",
      })

      onClose()
      router.push('/dashboard')
    } catch (error) {
      console.error('[InstagramUsernameModal] Error updating user:', error)
      toast({
        title: "Error",
        description: "Failed to save Instagram username. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect Your Instagram</DialogTitle>
          <DialogDescription>
            Please provide your Instagram username to complete the setup.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instagram-username">Instagram Username</Label>
            <Input
              id="instagram-username"
              placeholder="@yourusername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Username'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
} 