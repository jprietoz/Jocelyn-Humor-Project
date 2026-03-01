'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/auth-client-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

// Each voteable item = one image + one caption
interface VoteItem {
  captionId: string
  captionText: string
  imageUrl: string
}

const FETCH_LIMIT = 60

export default function VotePage() {
  const [items, setItems] = useState<VoteItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [likedCount, setLikedCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) router.push('/login')
    }
    checkAuth()
  }, [router, supabase.auth])

  useEffect(() => {
    if (!user) return
    fetchItems()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchItems = async () => {
    setLoading(true)
    try {
      const { data: images, error: fetchError } = await supabase
        .from('images')
        .select(`
          id,
          url,
          image_description,
          created_datetime_utc,
          captions (
            id,
            image_id,
            content,
            profile_id
          )
        `)
        .not('url', 'is', null)
        .order('created_datetime_utc', { ascending: false })
        .limit(FETCH_LIMIT)

      if (fetchError) throw fetchError

      // Dedup images by description then URL pathname
      const seenKeys = new Set<string>()
      const flat: VoteItem[] = []

      for (const img of images || []) {
        if (!img.url) continue
        let key: string
        if (img.image_description?.trim()) {
          key = `desc:${img.image_description.trim().toLowerCase()}`
        } else {
          try { key = `url:${new URL(img.url).pathname.toLowerCase()}` }
          catch { key = `url:${img.url.toLowerCase()}` }
        }
        if (seenKeys.has(key)) continue
        seenKeys.add(key)

        // One vote item per caption on this image
        for (const caption of img.captions || []) {
          if (!caption.content) continue
          flat.push({
            captionId: caption.id,
            captionText: caption.content,
            imageUrl: img.url,
          })
        }
      }

      setItems(flat)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memes')
    } finally {
      setLoading(false)
    }
  }

  const current = items[currentIndex]
  const done = currentIndex >= items.length && items.length > 0

  const advance = useCallback(async (dir: 'left' | 'right') => {
    if (!current || !user || swipeDir) return

    setSwipeDir(dir)

    if (dir === 'right') {
      await supabase.from('caption_votes').upsert(
        {
          caption_id: current.captionId,
          profile_id: user.id,
          vote_value: 1,
          created_datetime_utc: new Date().toISOString(),
        },
        { onConflict: 'caption_id,profile_id' }
      )
      setLikedCount(prev => prev + 1)
    }

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1)
      setSwipeDir(null)
    }, 280)
  }, [current, user, supabase, swipeDir])

  // Keyboard arrow support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') advance('right')
      if (e.key === 'ArrowLeft') advance('left')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-xl ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-red-400">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} py-8`}>
      <div className="max-w-xl mx-auto px-4">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              The Humor Project<sup className="text-sm">™</sup>
            </h1>
            {user && (
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{user.email}</p>
            )}
          </div>

          {/* Nav Tabs */}
          <div className={`flex gap-1 rounded-xl p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <Link href="/" className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>
              Meme Gallery
            </Link>
            <span className={`px-5 py-2 rounded-lg text-sm font-semibold ${
              darkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow'
            }`}>
              Vote
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Done screen */}
        {done ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="text-7xl">🎉</div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              You've seen them all!
            </h2>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
              You liked {likedCount} out of {items.length} captions.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setCurrentIndex(0); setLikedCount(0) }}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
              >
                Start Over
              </button>
              <Link href="/" className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors">
                Back to Gallery
              </Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className={`text-center py-24 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No captions to vote on yet.
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                  {currentIndex + 1} / {items.length}
                </span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                  ❤️ {likedCount} liked
                </span>
              </div>
              <div className={`w-full h-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${(currentIndex / items.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Card */}
            {current && (
              <div
                className={`relative rounded-2xl shadow-2xl overflow-hidden transition-all duration-[280ms] ${
                  darkMode ? 'bg-gray-800' : 'bg-white'
                } ${
                  swipeDir === 'left'
                    ? '-translate-x-full opacity-0 -rotate-6'
                    : swipeDir === 'right'
                    ? 'translate-x-full opacity-0 rotate-6'
                    : 'translate-x-0 opacity-100 rotate-0'
                }`}
              >
                {/* Like / Nope stamp */}
                {swipeDir && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className={`text-5xl font-black border-4 rounded-xl px-5 py-2 rotate-[-15deg] ${
                      swipeDir === 'right'
                        ? 'text-green-400 border-green-400'
                        : 'text-red-400 border-red-400'
                    }`}>
                      {swipeDir === 'right' ? 'LIKE' : 'NOPE'}
                    </span>
                  </div>
                )}

                {/* Image */}
                <div className="w-full bg-black flex items-center justify-center" style={{ minHeight: '320px', maxHeight: '460px' }}>
                  <img
                    src={current.imageUrl}
                    alt="Meme"
                    className="w-full object-contain"
                    style={{ maxHeight: '460px' }}
                  />
                </div>

                {/* Single caption */}
                <div className="px-6 py-5">
                  <div className={`p-4 rounded-xl text-base text-center font-medium ${
                    darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {current.captionText}
                  </div>
                </div>

                {/* Vote buttons */}
                <div className="flex justify-center gap-12 pb-6">
                  <button
                    onClick={() => advance('left')}
                    disabled={!!swipeDir}
                    className="w-16 h-16 rounded-full bg-gray-700 hover:bg-red-600 flex items-center justify-center text-2xl shadow-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                    title="Skip (← arrow key)"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => advance('right')}
                    disabled={!!swipeDir}
                    className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-2xl shadow-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                    title="Like (→ arrow key)"
                  >
                    ♥
                  </button>
                </div>

                <p className={`text-center text-xs pb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  ← skip &nbsp;·&nbsp; → like
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}