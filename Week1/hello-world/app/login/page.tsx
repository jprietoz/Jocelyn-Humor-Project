'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/auth-client-browser'

interface FloatingImage {
  id: string
  url: string
  left: number
  duration: number
  size: number
  opacity: number
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [floatingImages, setFloatingImages] = useState<FloatingImage[]>([])
  const supabase = createClient()

  // Fetch a pool of image URLs on mount (no auth required for public images)
  useEffect(() => {
    const fetchImages = async () => {
      const { data } = await supabase
        .from('images')
        .select('url')
        .not('url', 'is', null)
        .limit(80)
      if (data) {
        const urls = data.map((img: { url: string }) => img.url).filter(Boolean)
        setImageUrls(urls)
      }
    }
    fetchImages()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Spawn floating images from the pool, cycling continuously
  useEffect(() => {
    if (imageUrls.length === 0) return

    let counter = 0

    const spawnImage = () => {
      const url = imageUrls[counter % imageUrls.length]
      counter++

      const newImg: FloatingImage = {
        id: `${Date.now()}-${counter}`,
        url,
        left: 1 + Math.random() * 92,        // 1–93% from left
        duration: 13,                        // constant speed for all images
        size: 100 + Math.floor(Math.random() * 110), // 100–210px
        opacity: 0.35 + Math.random() * 0.3,         // 0.35–0.65
      }

      setFloatingImages(prev => [...prev.slice(-40), newImg])
    }

    // Stagger the initial burst so images are already on screen when the page loads
    for (let i = 0; i < 18; i++) {
      setTimeout(spawnImage, i * 200)
    }

    // Keep spawning new images regularly
    const interval = setInterval(spawnImage, 900)
    return () => clearInterval(interval)
  }, [imageUrls])

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
          },
        },
      })
      if (error) {
        console.error('Login error:', error)
        alert('Failed to login. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4 overflow-hidden">

      {/* Floating meme background */}
      {floatingImages.map(img => (
        <div
          key={img.id}
          className="absolute bottom-0 pointer-events-none rounded-xl overflow-hidden shadow-lg"
          style={{
            left: `${img.left}%`,
            width: `${img.size}px`,
            height: `${img.size}px`,
            animation: `floatUp ${img.duration}s linear forwards`,
            ['--float-opacity' as string]: img.opacity,
          }}
        >
          <img
            src={img.url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      ))}

      {/* Dark overlay so login card is readable */}
      <div className="absolute inset-0 bg-purple-950/40 backdrop-blur-[1px]" />

      {/* Login card — sits above the background */}
      <div className="relative z-10 max-w-md w-full">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            The Humor Project<sup className="text-2xl">™</sup>
          </h1>
          <p className="text-gray-300 text-lg">
            Sign in and let AI crack you... up.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
            <p className="text-gray-600">
              Please sign in with your Google account to continue
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all ${
              loading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-white border-2 border-gray-300 hover:border-gray-400 hover:shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-gray-600">Signing in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-gray-700">Continue with Google</span>
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to view the best memes on the internet
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Powered by Supabase Authentication
          </p>
        </div>
      </div>
    </div>
  )
}
