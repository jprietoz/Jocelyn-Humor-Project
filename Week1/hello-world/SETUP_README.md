# Assignment 2: Supabase Integration

This Next.js app connects to Supabase to display images and captions from the class database.

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Copy files to your project:**
   - Copy `lib/supabase-client.ts` to `Week1/hello-world/lib/supabase-client.ts`
   - Copy `app/page.tsx` to `Week1/hello-world/app/page.tsx`
   - Copy `.env.local` to `Week1/hello-world/.env.local`
   - Copy `schema.sql` to `Week1/hello-world/schema.sql`

3. **Create the lib directory if it doesn't exist:**
   ```bash
   mkdir -p lib
   ```

4. **Test locally:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

5. **Deploy to Vercel:**
   - Add environment variables in Vercel dashboard:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Push to GitHub:
     ```bash
     git add .
     git commit -m "Add Supabase integration with images and captions"
     git push
     ```

## Project Structure

```
Week1/hello-world/
├── app/
│   └── page.tsx          # Main page component
├── lib/
│   └── supabase-client.ts # Supabase client setup
├── .env.local            # Environment variables (not committed)
├── schema.sql            # Database schema documentation
└── package.json
```

## Features

- Fetches images from Supabase `images` table
- Fetches captions from Supabase `captions` table
- Displays images in a responsive grid layout
- Shows up to 3 captions per image
- Uses Tailwind CSS for styling
- Ready for Vercel deployment
