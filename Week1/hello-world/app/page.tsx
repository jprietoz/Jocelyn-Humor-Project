'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth-client-browser'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface Image {
  id: string
  url: string
  created_at?: string
  created_at_utc?: string
}

interface Caption {
  id: string
  image_id: string
  text?: string
  caption_text?: string
  content?: string
  profile_id: string
  created_at?: string
  created_at_utc?: string
}

interface CaptionVote {
  id: string
  caption_id: string
  profile_id: string
  vote_value: number
}

interface ImageWithCaptions extends Image {
  captions: Caption[]
}

export default function Home() {
  const [imagesWithCaptions, setImagesWithCaptions] = useState<ImageWithCaptions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [selectedImage, setSelectedImage] = useState<ImageWithCaptions | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userVotes, setUserVotes] = useState<Map<string, number>>(new Map())
  const [voteCounts, setVoteCounts] = useState<Map<string, number>>(new Map())
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (!user) {
        router.push('/login')
      }
    }

    checkAuth()
  }, [router, supabase.auth])

  useEffect(() => {
    if (!user) return

    async function fetchData() {
      try {
        console.log('Starting to fetch images...')

        // Fetch images
        const { data: images, error: imagesError } = await supabase
          .from('images')
          .select('*')
          .limit(20)

        if (imagesError) {
          console.error('Images error details:', imagesError)
          throw imagesError
        }

        // Fetch captions
        const { data: captions, error: captionsError } = await supabase
          .from('captions')
          .select('*')

        if (captionsError) {
          console.error('Captions error details:', captionsError)
          throw captionsError
        }

        // Fetch all votes to calculate vote counts
        const { data: allVotes, error: allVotesError } = await supabase
          .from('caption_votes')
          .select('*')

        if (allVotesError) {
          console.error('All votes error:', allVotesError)
        }

        // Calculate vote counts per caption
        const counts = new Map<string, number>()
        if (allVotes) {
          allVotes.forEach((vote: CaptionVote) => {
            const current = counts.get(vote.caption_id) || 0
            counts.set(vote.caption_id, current + vote.vote_value)
          })
        }
        setVoteCounts(counts)

        // Fetch user's votes
        const { data: votes, error: votesError } = await supabase
          .from('caption_votes')
          .select('*')
          .eq('profile_id', user.id)

        if (votesError) {
          console.error('Votes error:', votesError)
        }

        // Store user's votes in a map for quick lookup
        const votesMap = new Map<string, number>()
        if (votes) {
          votes.forEach((vote: CaptionVote) => {
            votesMap.set(vote.caption_id, vote.vote_value)
          })
        }
        setUserVotes(votesMap)

        // Combine images with their captions
        const combined = (images || []).map(image => ({
          ...image,
          captions: (captions || []).filter(caption => caption.image_id === image.id)
        }))

        // Sort by number of captions (most captions first)
        const sorted = combined.sort((a, b) => b.captions.length - a.captions.length)

        setImagesWithCaptions(sorted)
      } catch (err) {
        console.error('Full error object:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, supabase])

  const getCaptionText = (caption: Caption) => {
    return caption.text || caption.caption_text || caption.content || 'No text'
  }

  const handleVote = async (captionId: string, voteValue: number) => {
    if (!user) {
      alert('You must be logged in to vote')
      return
    }

    try {
      const currentVote = userVotes.get(captionId)

      // If user is clicking the same vote, remove it
      if (currentVote === voteValue) {
        const { error } = await supabase
          .from('caption_votes')
          .delete()
          .eq('caption_id', captionId)
          .eq('profile_id', user.id)

        if (error) {
          console.error('Error removing vote:', error)
          alert('Failed to remove vote. Please try again.')
          return
        }

        // Update local state
        const newVotes = new Map(userVotes)
        newVotes.delete(captionId)
        setUserVotes(newVotes)

        // Update vote count
        const newCounts = new Map(voteCounts)
        const currentCount = newCounts.get(captionId) || 0
        newCounts.set(captionId, currentCount - voteValue)
        setVoteCounts(newCounts)

      } else if (currentVote !== undefined) {
        // User is changing their vote
        const { error } = await supabase
          .from('caption_votes')
          .update({ vote_value: voteValue })
          .eq('caption_id', captionId)
          .eq('profile_id', user.id)

        if (error) {
          console.error('Error updating vote:', error)
          alert('Failed to update vote. Please try again.')
          return
        }

        // Update local state
        const newVotes = new Map(userVotes)
        newVotes.set(captionId, voteValue)
        setUserVotes(newVotes)

        // Update vote count
        const newCounts = new Map(voteCounts)
        const currentCount = newCounts.get(captionId) || 0
        newCounts.set(captionId, currentCount - currentVote + voteValue)
        setVoteCounts(newCounts)

      }
        else {
        // User is voting for the first time
        console.log('Attempting to insert vote:', {
            caption_id: captionId,
            profile_id: user.id,
            vote_value: voteValue
        })

        const { error } = await supabase
          .from('caption_votes')
          .insert({
              caption_id: captionId,
              profile_id: user.id,
              vote_value: voteValue,
              created_datetime_utc: new Date().toISOString()
          })

        if (error) {
          console.error('Error inserting vote:', error)
          alert(`Failed to submit vote: ${error.message || 'Unknown error'}`)
          return
        }

        // Update local state
        const newVotes = new Map(userVotes)
        newVotes.set(captionId, voteValue)
        setUserVotes(newVotes)

        // Update vote count
        const newCounts = new Map(voteCounts)
        const currentCount = newCounts.get(captionId) || 0
        newCounts.set(captionId, currentCount + voteValue)
        setVoteCounts(newCounts)
      }
    } catch (err) {
        console.error('Unexpected error voting:', err)
        console.error('Error type:', typeof err)
        console.error('Error stringified:', JSON.stringify(err, null, 2))
        if (err instanceof Error) {
          console.error('Error message:', err.message)
          console.error('Error stack:', err.stack)
        }
        alert(`An unexpected error occurred: ${err instanceof Error ? err.message : JSON.stringify(err)}`)
    }
  }

  const getUserVote = (captionId: string): number | undefined => {
    return userVotes.get(captionId)
  }

  const getVoteCount = (captionId: string): number => {
    return voteCounts.get(captionId) || 0
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

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    )
  }

  const CaptionCard = ({ caption, compact = false }: { caption: Caption; compact?: boolean }) => {
    const userVote = getUserVote(caption.id)
    const voteCount = getVoteCount(caption.id)

    return (
      <div
        className={`p-3 rounded-lg ${
          darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-50 text-gray-700'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleVote(caption.id, 1)
              }}
              className={`transition-colors ${
                userVote === 1
                  ? 'text-orange-500'
                  : darkMode
                  ? 'text-gray-400 hover:text-orange-400'
                  : 'text-gray-500 hover:text-orange-500'
              }`}
              title="Upvote"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" />
              </svg>
            </button>
            <span className={`text-sm font-semibold ${
              voteCount > 0
                ? 'text-orange-500'
                : voteCount < 0
                ? 'text-blue-500'
                : darkMode
                ? 'text-gray-400'
                : 'text-gray-600'
            }`}>
              {voteCount}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleVote(caption.id, -1)
              }}
              className={`transition-colors ${
                userVote === -1
                  ? 'text-blue-500'
                  : darkMode
                  ? 'text-gray-400 hover:text-blue-400'
                  : 'text-gray-500 hover:text-blue-500'
              }`}
              title="Downvote"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" />
              </svg>
            </button>
          </div>

          {/* Caption text */}
          <div className="flex-1">
            <p className={compact ? 'text-sm' : 'text-base'}>{getCaptionText(caption)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Dark Mode Toggle and Logout */}
        <div className="flex justify-between items-center mb-8">
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

          <div className="flex gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {darkMode ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                  </svg>
                  Light
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                  Dark
                </>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                darkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Grid of Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {imagesWithCaptions.map((image) => (
            <div
              key={image.id}
              className={`rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 ${
                darkMode ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              {/* Image */}
              <div
                className="aspect-square bg-gray-200 flex items-center justify-center cursor-pointer"
                onClick={() => setSelectedImage(image)}
              >
                {image.url ? (
                  <img
                    src={image.url}
                    alt="Meme"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400">No image</div>
                )}
              </div>

              {/* Caption Preview */}
              <div className="p-4">
                <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Captions ({image.captions.length})
                </h3>
                {image.captions.length > 0 ? (
                  <div className="space-y-2">
                    {image.captions.slice(0, 2).map((caption) => (
                      <CaptionCard key={caption.id} caption={caption} compact />
                    ))}
                    {image.captions.length > 2 && (
                      <div
                        className={`text-xs italic cursor-pointer hover:underline ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                        onClick={() => setSelectedImage(image)}
                      >
                        Click to see all {image.captions.length} captions
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    No captions yet
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className={`px-4 pb-4 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {image.created_at || image.created_at_utc
                  ? new Date(image.created_at || image.created_at_utc || '').toLocaleDateString()
                  : 'No date'}
              </div>
            </div>
          ))}
        </div>

        {imagesWithCaptions.length === 0 && (
          <div className={`text-center mt-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No images found
          </div>
        )}
      </div>

      {/* Modal for All Captions */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className={`max-w-4xl w-full max-h-[90vh] rounded-lg shadow-2xl overflow-hidden ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row max-h-[90vh]">
              {/* Image Side */}
              <div className="md:w-1/2 bg-gray-200 flex items-center justify-center">
                {selectedImage.url ? (
                  <img
                    src={selectedImage.url}
                    alt="Meme"
                    className="w-full h-full object-contain max-h-[45vh] md:max-h-[90vh]"
                  />
                ) : (
                  <div className="text-gray-400">No image</div>
                )}
              </div>

              {/* Captions Side */}
              <div className="md:w-1/2 flex flex-col">
                {/* Header */}
                <div className={`p-4 border-b flex justify-between items-center ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    All Captions ({selectedImage.captions.length})
                  </h2>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className={`p-2 rounded-full transition-colors ${
                      darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Scrollable Captions List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selectedImage.captions.length > 0 ? (
                    selectedImage.captions.map((caption) => (
                      <CaptionCard key={caption.id} caption={caption} />
                    ))
                  ) : (
                    <div className={`text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      No captions for this image
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}