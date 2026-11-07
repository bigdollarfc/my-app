# Arc

Arc is a React + TypeScript short-video social app prototype. Without Supabase environment variables, it opens in demo mode. When Supabase is configured, users must sign in or create an account before entering the app.

## Run locally

```bash
npm install
npm run dev
```

## Connect Supabase

1. Create a Supabase project.
2. In the Supabase SQL Editor, run these migrations in order: `supabase/migrations/20261106000000_initial_schema.sql`, `supabase/migrations/20261106001000_video_storage.sql`, then `supabase/migrations/20261106002000_profile_media.sql`. They create profiles, videos, likes, follows, comments, the `arc-videos` and `arc-profiles` Storage buckets, and their row-level security policies. A profile row is created automatically when a user signs up.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings.
4. In Supabase Authentication settings, set the site URL to `http://localhost:5173` and enable email/password sign-in.
5. Restart the Vite server after changing environment variables.

Only use the project's publishable/anon key in the browser app. Never put a Supabase service-role key in a `VITE_` variable or client-side file.

## Record and post videos

Open Create and select **Enable camera & mic**. The browser asks for camera and microphone permission; camera access works on `localhost` or HTTPS. Choose a clip from your device instead, or record up to 60 seconds. Review it, add a caption, then post. Signed-in users upload to the `arc-videos` bucket and save metadata in `public.videos`. The bucket accepts MP4, WebM, and QuickTime video files up to 100 MB. In demo mode, posts are only kept in the current browser session.

Live camera capture requires a browser/device with `getUserMedia` and `MediaRecorder` support. Video files use public URLs for playback in this prototype; do not upload private or sensitive footage.

The feed still includes sample clips, and it does not yet load the full feed from Supabase. Likes, follows, and comments are also still local UI interactions.

## Edit your profile

Open **Profile → Edit profile** to update your display name, username, bio, profile photo, and banner. Image uploads accept JPG, PNG, and WebP files up to 5 MB. The profile images are public for profile display; do not upload private images.

## Deploy to Netlify

1. Push this project to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project**, connect GitHub, and select this repository. `netlify.toml` sets the build command to `npm run build`, the publish directory to `dist`, and the SPA fallback.
3. In the Netlify site's **Environment variables** settings, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use the publishable/anon key, never the secret key.
4. Deploy. Netlify will provide one HTTPS URL that automatically serves the phone layout on narrow screens and the desktop layout on wide screens.
5. In Supabase Authentication URL Configuration, set the Site URL to the deployed HTTPS origin and add that origin to the allowed redirect URLs. Keep `http://localhost:5173` in the redirect list for local development.

The repository is deployment-ready, but a live public deployment still requires connecting it to your Netlify account and GitHub repository.