'use client'

import React from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function DashboardPage(): JSX.Element {
  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full bg-gradient-to-b from-purple-50 to-pink-50 p-8">
        <h1 className="text-3xl font-bold text-purple-800 mb-6">
          Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome to your ReelMemory AI dashboard!
        </p>
      </div>
    </ErrorBoundary>
  )
} 