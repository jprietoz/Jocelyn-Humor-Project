import { createClient } from '@/lib/auth-client-server'
import { NextResponse } from 'next/server'

const API_BASE = 'https://api.almostcrackd.ai'

async function getToken(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function POST(request: Request) {
  const token = await getToken()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action, payload } = await request.json()

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  try {
    if (action === 'presigned-url') {
      // Step 1: Get a presigned S3 upload URL
      const res = await fetch(`${API_BASE}/pipeline/generate-presigned-url`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ contentType: payload.contentType }),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })

    } else if (action === 'register-image') {
      // Step 3: Register the CDN URL with the pipeline
      const res = await fetch(`${API_BASE}/pipeline/upload-image-from-url`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ imageUrl: payload.imageUrl, isCommonUse: false }),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })

    } else if (action === 'generate-captions') {
      // Step 4: Generate captions for the registered image
      const res = await fetch(`${API_BASE}/pipeline/generate-captions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ imageId: payload.imageId }),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })

    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('Pipeline API error:', err)
    return NextResponse.json({ error: 'Pipeline request failed' }, { status: 500 })
  }
}