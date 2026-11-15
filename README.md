# Visual

Visual is a React + TypeScript short-video app. Without Supabase environment variables it opens in demo mode with sample content; when Supabase is configured, users sign in or create an account first.

The interface is being restyled to match `visual-app.html` (kept at the project root as the design reference). The phone bottom nav and the home feed tabs (Live / Following / For you) are done; the remaining screens follow in the same order as the reference.

## Run locally

```bash
npm install
npm run dev
```

## Connect Supabase

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the files in `supabase/migrations` in filename order. They create `profiles`, `videos`, likes, comments, follows, the storage buckets, and row-level security.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings.
4. In Supabase Authentication settings, set the site URL to `http://localhost:5173` and enable email/password sign-in.
5. Restart the dev server after changing environment variables.

Only use the publishable/anon key in the browser app. Never put a service-role key in a `VITE_` variable.

## Folders

- `index.html` + `src/` — the app. `src/App.tsx` holds every screen and component; `src/styles.css` is the base stylesheet and `src/styles.visual.css` is the restyle layer that is being filled in feature by feature.
- `supabase/migrations` — the schema the app uses today.
- `supabase/legacy` — empty; kept as a folder for superseded files.
- `supabase/proposed` — a newer schema (roles, coins, stories, messages, lives, reposts, saves, tickets, `send_gift`, `claim_coins`) that is **not** applied. It does not match the app's current columns and would need its own migration before use.
- `visual-prototype.html` — the standalone prototype the new design came from.
- `ui-preview.html` — an offline preview of an earlier interface.

## Deploy

`netlify.toml` builds with `npm run build` and publishes `dist`; `.github/workflows/deploy.yml` does the same for GitHub Pages. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build-time environment variables.

In Supabase Authentication URL Configuration, set the Site URL to the deployed HTTPS origin and add that origin to the allowed redirect URLs, keeping `http://localhost:5173` for local development.