'use client'

import React from 'react'
import { UserPlusIcon, SendIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AuthModal from '@/components/SignUpModal'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Testimonials from '@/components/Testimonials'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function LandingPage(): JSX.Element {
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false)

  console.log('[LandingPage] Rendering the LandingPage component.')

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-purple-50 to-pink-50">
      <ErrorBoundary>
        <Navbar />
        <Hero onSignUp={() => setIsAuthModalOpen(true)} />

        {/* How It Works */}
        <section className="container mx-auto px-6 py-24">
          <h2 className="text-4xl font-bold text-purple-800 text-center mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            Follow these simple steps to get started with Reel Memory AI
          </p>

          {/* Timeline Container */}
          <div className="relative">
            {/* Decorative vertical line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[2px] bg-purple-200 transform -translate-x-1/2" />
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-6 bg-gradient-to-r from-purple-200 to-transparent transform -translate-x-1/2" />

            {/* Steps */}
            <div className="flex flex-col gap-24">
              <Step
                number={1}
                title="Sign Up"
                description="Create your account to start organizing your media with AI"
                icon={<UserPlusIcon className="w-8 h-8 text-purple-600" />}
                alignment="left"
              >
                <Button onClick={() => setIsAuthModalOpen(true)} className="mt-6">
                  Sign Up Now
                </Button>
              </Step>

              <Step
                number={2}
                title="Send"
                description="Send your reels or images to our Instagram profile"
                icon={<SendIcon className="w-8 h-8 text-purple-600" />}
                alignment="right"
              >
                <p className="mt-4 text-lg text-gray-600">
                  Our Instagram handle: <span className="font-semibold">@reelmemoryai</span>
                </p>
              </Step>

              <Step
                number={3}
                title="Retrieve"
                description="Ask our AI to find the most relevant videos or images"
                icon={<SearchIcon className="w-8 h-8 text-purple-600" />}
                alignment="left"
              />
            </div>
          </div>
        </section>

        <Testimonials />

        {/* Footer */}
        <footer className="container mx-auto px-6 py-8 text-center text-gray-600 text-sm">
          <p>&copy; {new Date().getFullYear()} Reel Memory AI. All rights reserved.</p>
        </footer>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </ErrorBoundary>
    </div>
  )
}

function Step({
  number,
  title,
  description,
  icon,
  children,
  alignment
}: {
  number: number
  title: string
  description: string
  icon: React.ReactNode
  children?: React.ReactNode
  alignment: 'left' | 'right'
}): JSX.Element {
  console.log(`[Step ${number}] Rendering with alignment: ${alignment}`)

  const isRight = alignment === 'right'

  return (
    <div
      className={`relative flex flex-col md:flex-row items-center ${
        isRight ? 'md:flex-row-reverse' : ''
      }`}
    >
      {/* Timeline Icon Circle */}
      <div
        className={`
          absolute md:static left-1/2 transform -translate-x-1/2 md:transform-none
          flex items-center justify-center w-14 h-14 rounded-full border-4 border-purple-300 bg-white z-10
          shadow-lg
        `}
      >
        {icon}
      </div>

      {/* Step Content */}
      <div
        className={`
          mt-16 md:mt-0 
          w-full md:w-1/2
          bg-white shadow-xl rounded-lg p-6 
          transform-gpu transition-transform duration-300 ease-out 
          hover:-translate-y-1 hover:shadow-2xl
          ${isRight ? 'md:mr-16' : 'md:ml-16'}
        `}
      >
        <div className="flex items-center mb-4">
          <div className="bg-purple-100 text-purple-800 rounded-full p-3 mr-4 min-w-[48px] min-h-[48px] flex items-center justify-center text-xl font-bold">
            {number}
          </div>
          <h3 className="text-2xl font-semibold text-purple-700">{title}</h3>
        </div>
        <p className="text-lg text-gray-600 mb-4 leading-relaxed">{description}</p>
        {children}
      </div>
    </div>
  )
}

