'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/auth-client-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

interface Caption {
  id: string
  image_id: string
  content: string | null
  profile_id: string
  created_datetime_utc?: string
  is_public: boolean
}

interface Image {
  id: string
  url: string | null
  image_description: string | null
  created_datetime_utc?: string
  captions: Caption[]
}

interface CaptionVote {
  id: string
  caption_id: string
  profile_id: string
  vote_value: number
}

// ─── Upload modal states ───────────────────────────────────────────────────
type UploadStep =
  | 'idle'
  | 'uploading'   // Steps 1–2: presign + PUT to S3
  | 'registering' // Step 3: register CDN URL
  | 'generating'  // Step 4: generate captions
  | 'done'
  | 'error'

const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
const PAGE_SIZE = 20

// ─── Pipeline helper ───────────────────────────────────────────────────────
async function callPipeline(action: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = typeof err.error === 'string'
      ? err.error
      : JSON.stringify(err) || `Pipeline error (${res.status})`
    throw new Error(message)
  }
  return res.json()
}

// HEIC files report inconsistent MIME types across browsers — normalize them
function normalizeContentType(file: File): string {
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type === ''
  ) {
    return 'image/jpeg'
  }
  return file.type
}

export default function Home() {
  const [imagesWithCaptions, setImagesWithCaptions] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userVotes, setUserVotes] = useState<Map<string, number>>(new Map())
  const [voteCounts, setVoteCounts] = useState<Map<string, number>>(new Map())
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set())

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [newCaptions, setNewCaptions] = useState<{ content: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const fetchBatch = async (currentOffset: number, currentUser: User, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select(`
          id,
          url,
          image_description,
          created_datetime_utc,
          captions!inner (
            id,
            image_id,
            content,
            profile_id,
            created_datetime_utc,
            is_public
          )
        `)
        .order('created_datetime_utc', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (imagesError) throw imagesError

      const urlKey = (url: string | null): string => {
        if (!url) return ''
        try { return new URL(url).pathname.toLowerCase() }
        catch { return url.toLowerCase() }
      }
      const dedupKey = (image: { url: string | null; image_description: string | null }): string => {
        if (image.image_description?.trim()) {
          return `desc:${image.image_description.trim().toLowerCase()}`
        }
        return `url:${urlKey(image.url)}`
      }

      const urlMap = new Map<string, Image>()
      for (const image of images || []) {
        if (!image.url) continue
        const key = dedupKey(image)
        const captions = (image.captions || []) as Caption[]
        if (urlMap.has(key)) {
          urlMap.get(key)!.captions.push(...captions)
        } else {
          urlMap.set(key, {
            id: image.id,
            url: image.url,
            image_description: image.image_description ?? null,
            created_datetime_utc: image.created_datetime_utc,
            captions,
          })
        }
      }
      const seenIds = new Set<string>()
      const batch = Array.from(urlMap.values()).filter(img => {
        if (seenIds.has(img.id)) return false
        seenIds.add(img.id)
        return true
      })

      const allCaptionIds = batch.flatMap(img => img.captions.map(c => c.id))
      const counts = new Map<string, number>()
      const votesMap = new Map<string, number>()

      if (allCaptionIds.length > 0) {
        const [{ data: allVotes }, { data: userVotesData }] = await Promise.all([
          supabase.from('caption_votes').select('*').in('caption_id', allCaptionIds),
          supabase.from('caption_votes').select('*').eq('profile_id', currentUser.id).in('caption_id', allCaptionIds),
        ])

        allVotes?.forEach((vote: CaptionVote) => {
          counts.set(vote.caption_id, (counts.get(vote.caption_id) || 0) + vote.vote_value)
        })
        userVotesData?.forEach((vote: CaptionVote) => {
          votesMap.set(vote.caption_id, vote.vote_value)
        })
      }

      const nextOffset = currentOffset + PAGE_SIZE
      setHasMore((images || []).length === PAGE_SIZE)
      setOffset(nextOffset)

      if (append) {
        setImagesWithCaptions(prev => {
          const keyToIndex = new Map(prev.map((img, i) => [dedupKey(img), i]))
          const idToIndex = new Map(prev.map((img, i) => [img.id, i]))
          const result = [...prev]
          for (const img of batch) {
            const key = dedupKey(img)
            const existingIdx = keyToIndex.get(key) ?? idToIndex.get(img.id)
            if (existingIdx !== undefined) {
              result[existingIdx] = {
                ...result[existingIdx],
                captions: [...result[existingIdx].captions, ...img.captions],
              }
            } else {
              result.push(img)
              keyToIndex.set(key, result.length - 1)
              idToIndex.set(img.id, result.length - 1)
            }
          }
          return result
        })
        setVoteCounts(prev => new Map([...prev, ...counts]))
        setUserVotes(prev => new Map([...prev, ...votesMap]))
      } else {
        setImagesWithCaptions(batch)
        setVoteCounts(counts)
        setUserVotes(votesMap)
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    fetchBatch(0, user, false)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    if (!user || loadingMore || !hasMore) return
    fetchBatch(offset, user, true)
  }

  const getCaptionText = (caption: Caption) => caption.content || 'No text'

  const handleVote = async (captionId: string, voteValue: number) => {
    if (!user) { alert('You must be logged in to vote'); return }

    try {
      const currentVote = userVotes.get(captionId)

      if (currentVote === voteValue) {
        const { error } = await supabase
          .from('caption_votes').delete()
          .eq('caption_id', captionId).eq('profile_id', user.id)
        if (error) { console.error('Error removing vote:', error); alert('Failed to remove vote.'); return }
        const newVotes = new Map(userVotes); newVotes.delete(captionId); setUserVotes(newVotes)
        const newCounts = new Map(voteCounts); newCounts.set(captionId, (newCounts.get(captionId) || 0) - voteValue); setVoteCounts(newCounts)

      } else if (currentVote !== undefined) {
        const { error } = await supabase
          .from('caption_votes').update({ vote_value: voteValue })
          .eq('caption_id', captionId).eq('profile_id', user.id)
        if (error) { console.error('Error updating vote:', error); alert('Failed to update vote.'); return }
        const newVotes = new Map(userVotes); newVotes.set(captionId, voteValue); setUserVotes(newVotes)
        const newCounts = new Map(voteCounts); newCounts.set(captionId, (newCounts.get(captionId) || 0) - currentVote + voteValue); setVoteCounts(newCounts)

      } else {
        const { error } = await supabase
          .from('caption_votes').insert({
            caption_id: captionId, profile_id: user.id, vote_value: voteValue,
            created_datetime_utc: new Date().toISOString()
          })
        if (error) { console.error('Error inserting vote:', error); alert(`Failed to submit vote: ${error.message}`); return }
        const newVotes = new Map(userVotes); newVotes.set(captionId, voteValue); setUserVotes(newVotes)
        const newCounts = new Map(voteCounts); newCounts.set(captionId, (newCounts.get(captionId) || 0) + voteValue); setVoteCounts(newCounts)
      }
    } catch (err) {
      console.error('Unexpected error voting:', err)
      if (err instanceof Error) alert(`An unexpected error occurred: ${err.message}`)
    }
  }

  const getUserVote = (captionId: string) => userVotes.get(captionId)
  const getVoteCount = (captionId: string) => voteCounts.get(captionId) || 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ─── Upload handlers ─────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setUploadError('Unsupported file type. Please use JPEG, PNG, WEBP, GIF, or HEIC.')
      return
    }
    setUploadError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setUploadStep('idle')
    setNewCaptions([])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setUploadError('Unsupported file type. Please use JPEG, PNG, WEBP, GIF, or HEIC.')
      return
    }
    setUploadError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setUploadStep('idle')
    setNewCaptions([])
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploadError(null)
    setNewCaptions([])

    try {
      // Step 1 + 2: Get presigned URL, then PUT file directly to S3
      setUploadStep('uploading')
      const contentType = normalizeContentType(selectedFile)
      const { presignedUrl, cdnUrl } = await callPipeline('presigned-url', {
        contentType,
      })

      await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: selectedFile,
      })

      // Step 3: Register the CDN URL with the pipeline
      setUploadStep('registering')
      const { imageId } = await callPipeline('register-image', { imageUrl: cdnUrl })

      // Step 4: Generate captions
      setUploadStep('generating')
      const captionData = await callPipeline('generate-captions', { imageId })

      // captionData is an array of caption records
      const captions = Array.isArray(captionData)
        ? captionData.map((c: { content?: string }) => ({ content: c.content || '' }))
        : []

      setNewCaptions(captions)
      setUploadStep('done')

      // Refresh the gallery so the new image appears at the top
      if (user) fetchBatch(0, user, false)

    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setUploadStep('error')
    }
  }

  const resetUploadModal = () => {
    setShowUploadModal(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadStep('idle')
    setUploadError(null)
    setNewCaptions([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const stepLabel: Record<UploadStep, string> = {
    idle: '',
    uploading: 'Uploading image to S3…',
    registering: 'Registering with pipeline…',
    generating: 'Generating captions (this may take ~30s)…',
    done: 'Done!',
    error: 'Something went wrong.',
  }

  // ─── Render ───────────────────────────────────────────────────────────────

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
      <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-50 text-gray-700'}`}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleVote(caption.id, 1) }}
              className={`transition-colors ${userVote === 1 ? 'text-orange-500' : darkMode ? 'text-gray-400 hover:text-orange-400' : 'text-gray-500 hover:text-orange-500'}`}
              title="Upvote"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" />
              </svg>
            </button>
            <span className={`text-sm font-semibold ${voteCount > 0 ? 'text-orange-500' : voteCount < 0 ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {voteCount}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleVote(caption.id, -1) }}
              className={`transition-colors ${userVote === -1 ? 'text-blue-500' : darkMode ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500'}`}
              title="Downvote"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" />
              </svg>
            </button>
          </div>
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

        {/* Header */}
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

          {/* Nav Tabs */}
          <div className={`flex gap-1 rounded-xl p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <span className={`px-5 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow'}`}>
              Meme Gallery
            </span>
            <Link href="/vote" className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}>
              Vote
            </Link>
          </div>

          <div className="flex gap-3">
            {/* Upload Button */}
            <button
              onClick={() => setShowUploadModal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                darkMode
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
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

            {/* Logout */}
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {imagesWithCaptions.filter(img => !brokenImageIds.has(img.id)).map((image) => (
            <div
              key={image.id}
              className={`rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
            >
              <div
                className="aspect-square bg-gray-200 flex items-center justify-center cursor-pointer"
                onClick={() => setSelectedImage(image)}
              >
                <img
                  src={image.url!}
                  alt="Meme"
                  className="w-full h-full object-cover"
                  onError={() => setBrokenImageIds(prev => new Set([...prev, image.id]))}
                />
              </div>

              <div className="p-4">
                <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Captions ({image.captions.length})
                </h3>
                {image.captions.length > 0 ? (
                  <div className="space-y-2">
                    {image.captions.slice(0, 3).map((caption) => (
                      <CaptionCard key={caption.id} caption={caption} compact />
                    ))}
                    {image.captions.length > 3 && (
                      <div
                        className={`text-xs italic cursor-pointer hover:underline ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                        onClick={() => setSelectedImage(image)}
                      >
                        Click image to see all {image.captions.length} captions
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    No captions yet
                  </div>
                )}
              </div>

              <div className={`px-4 pb-4 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {image.created_datetime_utc
                  ? new Date(image.created_datetime_utc).toLocaleDateString()
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

        {hasMore && (
          <div className="flex justify-center mt-10">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50'
              }`}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {!hasMore && imagesWithCaptions.length > 0 && (
          <div className={`text-center mt-10 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            All memes loaded
          </div>
        )}
      </div>

      {/* Caption Detail Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className={`max-w-4xl w-full max-h-[90vh] rounded-lg shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row max-h-[90vh]">
              <div className="md:w-1/2 bg-gray-200 flex items-center justify-center">
                {selectedImage.url ? (
                  <img src={selectedImage.url} alt="Meme" className="w-full h-full object-contain max-h-[45vh] md:max-h-[90vh]" />
                ) : (
                  <div className="text-gray-400">No image</div>
                )}
              </div>
              <div className="md:w-1/2 flex flex-col">
                <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    All Captions ({selectedImage.captions.length})
                  </h2>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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

      {/* ─── Upload Modal ─────────────────────────────────────────────────── */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50"
          onClick={uploadStep === 'done' || uploadStep === 'idle' || uploadStep === 'error' ? resetUploadModal : undefined}
        >
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-5 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Upload a Meme
              </h2>
              <button
                onClick={resetUploadModal}
                disabled={uploadStep === 'uploading' || uploadStep === 'registering' || uploadStep === 'generating'}
                className={`p-2 rounded-full transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Drop zone / preview */}
              {!previewUrl ? (
                <div
                  className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 p-10 cursor-pointer transition-colors ${
                    darkMode
                      ? 'border-gray-600 hover:border-purple-500 text-gray-400'
                      : 'border-gray-300 hover:border-purple-400 text-gray-500'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="font-medium">Click or drag & drop an image</p>
                  <p className="text-xs opacity-70">JPEG, PNG, WEBP, GIF, HEIC</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center max-h-64">
                  <img src={previewUrl} alt="Preview" className="max-h-64 object-contain" />
                  {(uploadStep === 'idle' || uploadStep === 'error') && (
                    <button
                      onClick={() => { setPreviewUrl(null); setSelectedFile(null); setUploadStep('idle'); setUploadError(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full p-1.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_TYPES.join(',')}
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Progress indicator */}
              {uploadStep !== 'idle' && (
                <div className={`rounded-xl p-4 text-sm font-medium flex items-center gap-3 ${
                  uploadStep === 'done'
                    ? darkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-50 text-green-700'
                    : uploadStep === 'error'
                    ? darkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-50 text-red-700'
                    : darkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-50 text-purple-700'
                }`}>
                  {(uploadStep === 'uploading' || uploadStep === 'registering' || uploadStep === 'generating') && (
                    <svg className="animate-spin w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {uploadStep === 'done' && <span className="text-lg">✅</span>}
                  {uploadStep === 'error' && <span className="text-lg">❌</span>}
                  <span>{stepLabel[uploadStep]}</span>
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <p className="text-sm text-red-500">{uploadError}</p>
              )}

              {/* Generated captions display */}
              {uploadStep === 'done' && newCaptions.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Generated captions:
                  </p>
                  {newCaptions.map((c, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {c.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {uploadStep === 'done' ? (
                  <button
                    onClick={resetUploadModal}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
                  >
                    Back to Gallery
                  </button>
                ) : (
                  <>
                    <button
                      onClick={resetUploadModal}
                      disabled={uploadStep === 'uploading' || uploadStep === 'registering' || uploadStep === 'generating'}
                      className={`flex-1 py-3 rounded-xl font-semibold transition-colors disabled:opacity-40 ${
                        darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || uploadStep === 'uploading' || uploadStep === 'registering' || uploadStep === 'generating'}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {uploadStep === 'error' ? 'Retry' : 'Generate Captions'}
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}