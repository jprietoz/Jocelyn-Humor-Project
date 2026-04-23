'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth-client-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

interface Caption {
  id: string
  content: string | null
  image_id: string
}

interface TrendingImage {
  id: string
  url: string | null
  captions: Caption[]
  totalScore: number
  topCaption: string
}

export default function TrendingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [trending, setTrending] = useState<TrendingImage[]>([])
  const [loading, setLoading] = useState(true)
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
    fetchTrending()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTrending = async () => {
    setLoading(true)
    try {
      const { data: images } = await supabase
        .from('images')
        .select(`
          id,
          url,
          image_description,
          captions (
            id,
            content,
            image_id
          )
        `)
        .not('url', 'is', null)
        .limit(100)

      if (!images) { setLoading(false); return }

      // Collect all caption IDs
      const allCaptionIds: string[] = []
      for (const img of images) {
        for (const cap of img.captions || []) {
          allCaptionIds.push(cap.id)
        }
      }

      // Fetch all vote totals
      const voteTotals = new Map<string, number>()
      if (allCaptionIds.length > 0) {
        const { data: votes } = await supabase
          .from('caption_votes')
          .select('caption_id, vote_value')
          .in('caption_id', allCaptionIds)

        votes?.forEach((v: { caption_id: string; vote_value: number }) => {
          voteTotals.set(v.caption_id, (voteTotals.get(v.caption_id) || 0) + v.vote_value)
        })
      }

      // Dedup and compute scores
      const seenKeys = new Set<string>()
      const scored: TrendingImage[] = []

      for (const img of images) {
        if (!img.url) continue
        let key: string
        try { key = new URL(img.url).pathname.toLowerCase() }
        catch { key = img.url.toLowerCase() }
        if (seenKeys.has(key)) continue
        seenKeys.add(key)

        const captions = (img.captions || []) as Caption[]
        const totalScore = captions.reduce((sum, c) => sum + (voteTotals.get(c.id) || 0), 0)
        const bestCaption = captions
          .slice()
          .sort((a, b) => (voteTotals.get(b.id) || 0) - (voteTotals.get(a.id) || 0))[0]

        scored.push({
          id: img.id,
          url: img.url,
          captions,
          totalScore,
          topCaption: bestCaption?.content || 'No captions yet',
        })
      }

      // Sort by total score descending
      scored.sort((a, b) => b.totalScore - a.totalScore)
      setTrending(scored.slice(0, 30))
    } catch (err) {
      console.error('Error fetching trending:', err)
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              The Humor Project<sup className="text-sm">™</sup>
            </h1>
            {user && (
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Welcome, {user.email}
              </p>
            )}
          </div>

          {/* Nav Tabs */}
          <div className={`flex gap-1 rounded-xl p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <Link href="/" className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>Gallery</Link>
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow'}`}>
              Trending
            </span>
            <Link href="/vote" className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>Vote</Link>
            <Link href="/profile" className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>Profile</Link>
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

        {/* Section title */}
        <div className="mb-6">
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            🔥 Trending Memes
          </h2>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Ranked by total community votes — highest rated first
          </p>
        </div>

        {trending.length === 0 ? (
          <div className={`text-center py-16 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No votes yet — be the first to vote!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trending.map((image, rank) => (
              <div
                key={image.id}
                className={`rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
              >
                {/* Rank badge */}
                <div className="relative">
                  <div className="aspect-square bg-gray-200">
                    <img
                      src={image.url!}
                      alt="Meme"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                    />
                  </div>
                  <div className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg ${
                    rank === 0 ? 'bg-yellow-400 text-yellow-900' :
                    rank === 1 ? 'bg-gray-300 text-gray-700' :
                    rank === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-700 text-white'
                  }`}>
                    {rank + 1}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Top caption:
                    </span>
                    <span className={`text-sm font-bold ${image.totalScore > 0 ? 'text-orange-400' : image.totalScore < 0 ? 'text-blue-400' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {image.totalScore > 0 ? `+${image.totalScore}` : image.totalScore} pts
                    </span>
                  </div>
                  <p className={`text-base leading-snug ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {image.topCaption}
                  </p>
                  <Link
                    href="/"
                    className={`block mt-3 text-sm font-medium text-center py-1.5 rounded-lg transition-colors ${darkMode ? 'text-purple-400 hover:bg-gray-700' : 'text-purple-600 hover:bg-purple-50'}`}
                  >
                    View in Gallery →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}