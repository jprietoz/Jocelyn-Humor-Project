'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth-client-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

interface UserCaption {
  id: string
  content: string | null
  created_datetime_utc?: string
  image_id: string
  image_url: string | null
  vote_count: number
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [captions, setCaptions] = useState<UserCaption[]>([])
  const [loading, setLoading] = useState(true)
  const [totalVotes, setTotalVotes] = useState(0)
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
    fetchUserContent()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUserContent = async () => {
    setLoading(true)
    try {
      // Fetch captions created by this user
      const { data: captionData } = await supabase
        .from('captions')
        .select(`
          id,
          content,
          created_datetime_utc,
          image_id,
          images (url)
        `)
        .eq('profile_id', user!.id)
        .order('created_datetime_utc', { ascending: false })
        .limit(50)

      if (!captionData) { setLoading(false); return }

      const captionIds = captionData.map((c: { id: string }) => c.id)

      // Fetch vote totals for these captions
      const voteTotals = new Map<string, number>()
      if (captionIds.length > 0) {
        const { data: votes } = await supabase
          .from('caption_votes')
          .select('caption_id, vote_value')
          .in('caption_id', captionIds)

        votes?.forEach((v: { caption_id: string; vote_value: number }) => {
          voteTotals.set(v.caption_id, (voteTotals.get(v.caption_id) || 0) + v.vote_value)
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enriched: UserCaption[] = captionData.map((c: any) => ({
        id: c.id,
        content: c.content,
        created_datetime_utc: c.created_datetime_utc,
        image_id: c.image_id,
        image_url: Array.isArray(c.images) ? (c.images[0]?.url ?? null) : (c.images?.url ?? null),
        vote_count: voteTotals.get(c.id) || 0,
      }))

      setCaptions(enriched)
      setTotalVotes(enriched.reduce((sum, c) => sum + c.vote_count, 0))
    } catch (err) {
      console.error('Error fetching profile data:', err)
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              The Humor Project<sup className="text-sm">™</sup>
            </h1>
          </div>

          {/* Nav Tabs */}
          <div className={`flex gap-1 rounded-xl p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <Link href="/" className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>Gallery</Link>
            <Link href="/trending" className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>Trending</Link>
            <Link href="/vote" className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>Vote</Link>
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow'}`}>
              Profile
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

        {/* Profile Card */}
        <div className={`rounded-2xl p-6 mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${darkMode ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700'}`}>
              {user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.email}</p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className={`rounded-xl p-4 text-center ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{captions.length}</p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Captions Created</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-3xl font-bold ${totalVotes > 0 ? 'text-orange-400' : totalVotes < 0 ? 'text-blue-400' : darkMode ? 'text-white' : 'text-gray-900'}`}>
                {totalVotes > 0 ? `+${totalVotes}` : totalVotes}
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Votes Received</p>
            </div>
          </div>
        </div>

        {/* Captions List */}
        <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Your Captions
        </h2>

        {captions.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500 shadow-md'}`}>
            <p className="text-5xl mb-4">🤔</p>
            <p className="text-lg font-medium">No captions yet</p>
            <p className="text-sm mt-1">Upload a meme and AI will generate captions for you!</p>
            <Link href="/" className="inline-block mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">
              Go to Gallery
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {captions.map((caption) => (
              <div key={caption.id} className={`rounded-xl p-4 flex gap-4 items-start ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
                {caption.image_url && (
                  <img
                    src={caption.image_url}
                    alt="Meme"
                    className="w-20 h-20 object-cover rounded-lg shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div className="flex-1">
                  <p className={`text-base ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {caption.content || 'No text'}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-sm font-semibold ${caption.vote_count > 0 ? 'text-orange-400' : caption.vote_count < 0 ? 'text-blue-400' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {caption.vote_count > 0 ? `+${caption.vote_count}` : caption.vote_count} votes
                    </span>
                    {caption.created_datetime_utc && (
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(caption.created_datetime_utc).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}