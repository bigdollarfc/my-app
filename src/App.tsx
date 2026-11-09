import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { feedAudio } from './lib/audioEngine'

/* ------------------------------------------------------------------ */
/* Types & data                                                        */
/* ------------------------------------------------------------------ */

type ScreenId = 'home' | 'discover' | 'create' | 'post' | 'message' | 'profile' | 'settings' | 'studio' | 'owner'

type Profile = {
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  banner_url: string | null
  is_admin?: boolean
  verified?: boolean
  banned?: boolean
}

type AdminUser = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  username: string
  display_name: string
  is_admin: boolean
  verified: boolean
  banned: boolean
  avatar_url: string | null
}

type AdminVideo = {
  id: string
  caption: string | null
  status: string | null
  created_at: string | null
  video_url: string | null
  owner_id: string | null
  ownerName: string
}

type Clip = {
  id: string
  creator: string
  handle: string
  initials: string
  caption: string
  tags: string
  audio: string
  likes: number
  comments: number
  image: string
  imageAlt: string
  videoSrc?: string
  ownerId?: string
}

type Comment = { id: string; author: string; initials: string; time: string; text: string; likes: number }
type Conversation = { id: string; name: string; initials: string; preview: string; time: string }
type Bubble = { id: number; mine: boolean; text: string }
type Story = { id: string; name: string; initials: string; image: string; caption: string; time: string }
type Sound = { id: string; title: string; artist: string; usage: string }

const NAV_MAIN: { id: ScreenId; label: string; icon: string; create?: boolean }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'discover', label: 'Discover', icon: '⌕' },
  { id: 'create', label: 'Create video', icon: '＋', create: true },
  { id: 'message', label: 'Messages', icon: '◌' },
]

const NAV_CREATOR: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'studio', label: 'Studio', icon: '▥' },
  { id: 'profile', label: 'Profile', icon: '◉' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const NAV_MOBILE: { id: ScreenId; label: string; icon: string; create?: boolean }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'discover', label: 'Discover', icon: '⌕' },
  { id: 'create', label: 'Create', icon: '＋', create: true },
  { id: 'message', label: 'Inbox', icon: '◌' },
  { id: 'profile', label: 'Profile', icon: '◉' },
]

const starterClips: Clip[] = [
  {
    id: 'mountain', creator: 'Jonah Lee', handle: '@jonah.lee', initials: 'JL',
    caption: 'Somewhere between the trail and home. Took the long way back, and it was worth every minute.',
    tags: '#outside #slowdays #weekend #trail', audio: 'original sound · Jonah Lee',
    likes: 128700, comments: 6432,
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'A mountain lake at golden hour',
  },
  {
    id: 'food', creator: 'Nia Cooks', handle: '@nia.cooks', initials: 'NC',
    caption: 'A little lunch break with whatever was in the fridge. Easy, bright, and really good.',
    tags: '#homecooking #lunchideas #foodtok', audio: 'Sunday kitchen · Nia Cooks',
    likes: 42600, comments: 1208,
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1100&q=80',
    imageAlt: 'A colorful lunch prepared at home',
  },
  {
    id: 'coast', creator: 'Ari Rivera', handle: '@ari.outside', initials: 'AR',
    caption: 'Stayed until the light turned silver. Leaving this here for your next deep breath.',
    tags: '#coastline #slowdown #oceanvibes', audio: 'Coastline · Ari Rivera',
    likes: 18300, comments: 920,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'A quiet blue coastline at sunset',
  },
  {
    id: 'coffee', creator: 'Maya Chen', handle: '@mayamakes', initials: 'MC',
    caption: 'First sip of morning light. Testing out the new roast from down the street ☕',
    tags: '#coffee #morningroutine #slowliving #cafe', audio: 'Slow morning · Studio Notes',
    likes: 31200, comments: 840,
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'Fresh coffee pour-over in morning light',
  },
  {
    id: 'studio', creator: 'Kai Tanaka', handle: '@kai.design', initials: 'KT',
    caption: 'Studio reset before the next print run. Clean space, clear head.',
    tags: '#design #studio #minimalism #workspace', audio: 'Blue hour · Northbound',
    likes: 54900, comments: 1530,
    image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'A sunny creative studio desk',
  },
  {
    id: 'city', creator: 'Sofia Kim', handle: '@sofia.kim', initials: 'SK',
    caption: 'Blue hour in the city never gets old. Rain-slicked streets and neon reflections.',
    tags: '#citylights #bluehour #nightwalk #aesthetic', audio: 'Midnight walk · Sofia Kim',
    likes: 78400, comments: 2980,
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'City lights reflecting on wet night streets',
  },
  {
    id: 'ceramics', creator: 'Leo Vance', handle: '@leovance', initials: 'LV',
    caption: 'Throwing ceramics on the wheel today. Mesmerizing flow state.',
    tags: '#craft #ceramics #satisfying #handmade', audio: 'Wheel sounds · Leo Vance',
    likes: 92100, comments: 3120,
    image: 'https://images.unsplash.com/photo-1508615070457-7baeba4003ab?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'Ceramics and artisan tools on a craft table',
  },
  {
    id: 'scenic', creator: 'Elena Rostova', handle: '@elena.travels', initials: 'ER',
    caption: 'The road less traveled led us right to this panoramic view.',
    tags: '#travel #adventure #wanderlust #explore', audio: 'Coastline (instrumental) · Rae Sol',
    likes: 64700, comments: 1890,
    image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'Mountain valley scenic drive',
  },
]

const discoverCards = [
  { title: 'One-pan, no plans', meta: 'Food · 24.6K new views', image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=700&q=80', alt: 'Colorful lunch on a table' },
  { title: 'Quiet places club', meta: 'Outdoors · 18.2K videos', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=80', alt: 'Mountain lake' },
  { title: 'Reset your space', meta: 'Design · 9,810 videos', image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=700&q=80', alt: 'A sunny creative studio' },
  { title: 'Blue hour walks', meta: 'Travel · 7,200 videos', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80', alt: 'Sunlit coastal landscape' },
  { title: 'Morning light', meta: 'Daily life · 6,420 videos', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=700&q=80', alt: 'Sunrise over green hills' },
  { title: 'Make it by hand', meta: 'Creative · 5,908 videos', image: 'https://images.unsplash.com/photo-1508615070457-7baeba4003ab?auto=format&fit=crop&w=700&q=80', alt: 'A camera on a desk' },
  { title: 'Take the scenic route', meta: 'Travel · 4,521 videos', image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80', alt: 'A mountain valley' },
  { title: 'Little things lately', meta: 'Everyday · 3,940 videos', image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=700&q=80', alt: 'Flowers in bright sunlight' },
]

const trends = [
  { tag: 'little rituals', count: '12.8K videos', growth: '+18%' },
  { tag: 'weekend table', count: '8,420 videos', growth: '+12%' },
  { tag: 'soft landscapes', count: '6,190 videos', growth: '+9%' },
]

const suggestedCreators = [
  { name: 'Sofia Kim', initials: 'SK', meta: 'Art & illustration' },
  { name: 'Ari Rivera', initials: 'AR', meta: 'Outdoors · 18K' },
]

const starterConversations: Conversation[] = [
  { id: 'sk', name: 'Sofia Kim', initials: 'SK', preview: 'That color palette is perfect', time: '2m' },
  { id: 'ar', name: 'Ari Rivera', initials: 'AR', preview: 'Sent you a video', time: '1h' },
  { id: 'nl', name: 'Nico Lane', initials: 'NL', preview: 'Are you free this weekend?', time: '3h' },
  { id: 'jw', name: 'Jules Walker', initials: 'JW', preview: 'Liked your post', time: '1d' },
]

const starterComments: Comment[] = [
  { id: 'c1', author: 'Sofia Kim', initials: 'SK', time: '2h', text: 'This looks unreal. Adding it to my weekend list.', likes: 248 },
  { id: 'c2', author: 'Ari Rivera', initials: 'AR', time: '1h', text: 'The quiet spots always end up being the best ones.', likes: 96 },
  { id: 'c3', author: 'Nico Lane', initials: 'NL', time: '44m', text: 'Where was this trail?', likes: 31 },
]

const stories: Story[] = [
  { id: 'you', name: 'Your story', initials: 'MC', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', caption: 'A little moment from today.', time: 'just now' },
  { id: 's1', name: 'Jonah', initials: 'JL', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80', caption: 'Trail treats and thin air.', time: '3 hours ago' },
  { id: 's2', name: 'Sofia', initials: 'SK', image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80', caption: 'New palette, same chaos.', time: '2 hours ago' },
  { id: 's3', name: 'Ari', initials: 'AR', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80', caption: 'Blue hour is undefeated.', time: '5 hours ago' },
  { id: 's4', name: 'Nia', initials: 'NC', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80', caption: 'Lunch in ten minutes.', time: '1 hour ago' },
]

const sounds: Sound[] = [
  { id: 'snd1', title: 'Original sound', artist: 'Jonah Lee', usage: '12.4K videos' },
  { id: 'snd2', title: 'Blue hour', artist: 'Northbound', usage: '84.2K videos' },
  { id: 'snd3', title: 'Slow morning', artist: 'Studio Notes', usage: '26.8K videos' },
  { id: 'snd4', title: 'Coastline (instrumental)', artist: 'Rae Sol', usage: '102K videos' },
]

const peopleFollowing = [
  { name: 'Sofia Kim', initials: 'SK', meta: '@sofia.draws · Art & illustration' },
  { name: 'Ari Rivera', initials: 'AR', meta: '@ari.outside · Outdoors' },
  { name: 'Nico Lane', initials: 'NL', meta: '@nico.lane · Travel' },
]

const peopleFollowers = [
  { name: 'Jonah Lee', initials: 'JL', meta: '@jonah.lee · Outdoors' },
  { name: 'Jules Walker', initials: 'JW', meta: '@jules.walker · Film' },
  { name: 'Devon Miles', initials: 'DM', meta: '@devon.miles · Music' },
]

const chartBars = [34, 49, 42, 63, 55, 77, 66, 91, 72, 100, 83, 94]

const topVideos = [
  { title: 'The long way home', when: 'Posted 2 days ago', views: '24.8K', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=120&q=80' },
  { title: 'Lunch in ten minutes', when: 'Posted 5 days ago', views: '12.2K', image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=120&q=80' },
  { title: 'Reset the studio', when: 'Posted 1 week ago', views: '8,940', image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=120&q=80' },
]

const profileTiles = [
  { views: '24.8K', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=400&q=80', alt: 'Mountain lake' },
  { views: '12.2K', image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80', alt: 'Lunch' },
  { views: '8,940', image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=400&q=80', alt: 'Studio' },
  { views: '6,102', image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=400&q=80', alt: 'Flowers' },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatCount(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count)
}

function initialsOf(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/* ------------------------------------------------------------------ */
/* Small shared components                                             */
/* ------------------------------------------------------------------ */

function VisualMark() {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Visual logo">
      <defs>
        <linearGradient id="visualFrame" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#00eaff" /><stop offset=".52" stopColor="#235dff" /><stop offset="1" stopColor="#ff21db" /></linearGradient>
        <linearGradient id="visualV" x1=".1" y1="0" x2=".9" y2="1"><stop stopColor="#26eaff" /><stop offset=".48" stopColor="#154fff" /><stop offset="1" stopColor="#f31bdf" /></linearGradient>
      </defs>
      <rect x="5" y="5" width="90" height="90" rx="23" fill="#030308" stroke="url(#visualFrame)" strokeWidth="3" />
      <path d="M22 29h15l14 23 14-23h15L57 73H46z" fill="url(#visualV)" />
      <path d="M17 64c19 15 50 9 67-14 3-4 5-8 7-12-2 17-17 35-37 41-17 5-32 1-41-8" fill="none" stroke="url(#visualFrame)" strokeWidth="5" strokeLinecap="round" />
      <path d="m57 39 13 8-13 8z" fill="#fff" />
      <path d="M77 20v7m9-4-4 6m10 1-6 2" fill="none" stroke="#e72cff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Avatar({ initials, src, size }: { initials: string; src?: string | null; size?: number }) {
  const style = size ? { width: size, height: size } : undefined
  if (src) return <span className="avatar" style={style}><img src={src} alt="" /></span>
  return <span className="avatar" style={style}>{initials}</span>
}

function Modal({ open, onClose, labelledBy, className, children }: {
  open: boolean; onClose: () => void; labelledBy?: string; className?: string; children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`modal-layer${open ? ' open' : ''}`} aria-hidden={!open} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`modal-card${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </section>
    </div>
  )
}

function ModalHead({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <header className="modal-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
      <button className="modal-close" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>×</button>
    </header>
  )
}

function PageHead({ title, subtitle, tools }: { title: string; subtitle: string; tools?: ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      {tools && <div className="page-tools">{tools}</div>}
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return <div className={`toast${message ? ' show' : ''}`} role="status">{message}</div>
}

function AuthModal({ open, mode, busy, onClose, onSubmit, onSwitch }: {
  open: boolean
  mode: 'signin' | 'signup'
  busy: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSwitch: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="auth-title" className="auth-card">
      <ModalHead
        title={mode === 'signin' ? 'Welcome back' : 'Create your account'}
        subtitle={mode === 'signin' ? 'Sign in to keep posting.' : 'Join and start sharing moments.'}
        onClose={onClose}
      />
      <form className="profile-edit-form" onSubmit={onSubmit}>
        {mode === 'signup' && (
          <label className="field">Display name<input name="displayName" maxLength={60} required placeholder="Maya Chen" /></label>
        )}
        <label className="field">Email<input name="email" type="email" required placeholder="you@example.com" autoComplete="email" /></label>
        <label className="field">Password<input name="password" type="password" required minLength={6} placeholder="At least 6 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
        <footer className="button-row">
          <button className="secondary-button" type="button" onClick={onSwitch}>
            {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Video stage (TikTok feed card)                                     */
/* ------------------------------------------------------------------ */

function VideoStage({
  clip,
  isActive,
  isMuted,
  liked,
  onLike,
  onComments,
  onShare,
  onSave,
  onSound,
  onSearch,
  isPlaying,
  onPlayingChange,
}: {
  clip: Clip
  isActive: boolean
  isMuted: boolean
  liked: boolean
  onLike: () => void
  onComments: () => void
  onShare: () => void
  onSave: () => void
  onSound: () => void
  onSearch: () => void
  isPlaying: boolean
  onPlayingChange: (playing: boolean) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const paused = !isPlaying
  const [progressPercent, setProgressPercent] = useState(0)
  const [heartAnim, setHeartAnim] = useState(false)
  const lastClickRef = useRef(0)

  // Autoplay / pause active video
  useEffect(() => {
    if (!videoRef.current || !clip.videoSrc) return
    if (isActive && !paused) {
      const p = videoRef.current.play()
      if (p !== undefined) {
        p.catch(() => {
          // Autoplay blocked by browser policy without user gesture
        })
      }
    } else {
      videoRef.current.pause()
    }
  }, [isActive, paused, clip.videoSrc])

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  // Track video progress
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const { currentTime, duration } = videoRef.current
    if (duration > 0) {
      setProgressPercent((currentTime / duration) * 100)
    }
  }

  // Smooth photo progress bar simulation for image-only clips
  useEffect(() => {
    if (clip.videoSrc || !isActive || paused) return
    setProgressPercent(0)
    const duration = 7000
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / duration) * 100)
      setProgressPercent(pct)
      if (pct >= 100) {
        setProgressPercent(0)
      }
    }, 50)
    return () => clearInterval(timer)
  }, [isActive, paused, clip.videoSrc])

  // Double tap to like, single tap to play/pause
  const handleStageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, .action-button, .feed-mode-tabs, .sound-disc')) return

    const now = Date.now()
    if (now - lastClickRef.current < 280) {
      // Double tap -> heart animation + like
      if (!liked) onLike()
      setHeartAnim(true)
      setTimeout(() => setHeartAnim(false), 900)
    } else {
      // Single tap toggles play/pause, which also drives the sound engine.
      onPlayingChange(!isPlaying)
    }
    lastClickRef.current = now
  }

  return (
    <article
      className={`video-stage${paused ? ' paused' : ''}${isActive ? ' active-stage' : ''}`}
      data-video-id={clip.id}
      onClick={handleStageClick}
    >
      {clip.videoSrc ? (
        <video
          ref={videoRef}
          src={clip.videoSrc}
          poster={clip.image}
          muted={isMuted}
          playsInline
          loop
          onTimeUpdate={handleTimeUpdate}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }}
        />
      ) : (
        <img
          src={clip.image}
          alt={clip.imageAlt}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }}
        />
      )}

      {/* Floating double-tap heart animation */}
      {heartAnim && <div className="heart-pulse-anim" aria-hidden="true">♥</div>}

      {/* Top scrim bar: a real search trigger plus a fullscreen toggle */}
      <div className="video-scrim" onClick={(e) => e.stopPropagation()}>
        <button
          className="scrim-search"
          onClick={onSearch}
          aria-label="Search"
          title="Search (S)"
        >
          <span className="scrim-search-icon" aria-hidden="true">⌕</span>
          <span className="scrim-search-text">Search</span>
        </button>
      </div>

      <button
        className="video-controls"
        aria-label={paused ? 'Play video' : 'Pause video'}
        onClick={(e) => {
          e.stopPropagation()
          onPlayingChange(paused)
        }}
      >
        {paused ? '▶' : 'Ⅱ'}
      </button>

      {/* Right-side TikTok actions */}
      <div className="video-actions" onClick={(e) => e.stopPropagation()}>
        <button className={`action-button like-button${liked ? ' liked' : ''}`} aria-label="Like video" onClick={onLike}>
          <b>{liked ? '♥' : '♡'}</b>
          <small>{formatCount(clip.likes + (liked ? 1 : 0))}</small>
        </button>
        <button className="action-button comments-button" aria-label="View comments" onClick={onComments}>
          <b>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" /></svg>
          </b>
          <small>{formatCount(clip.comments)}</small>
        </button>
        <button className="action-button share-button" aria-label="Share video" onClick={onShare}>
          <b>↗</b>
          <small>Share</small>
        </button>
        <button className="action-button save-button" aria-label="Save video" onClick={onSave}>
          <b>♧</b>
          <small>Save</small>
        </button>
        {/* Rotating Sound Disc */}
        <div
          className={`sound-disc${paused || !isActive ? ' paused' : ''}`}
          onClick={onSound}
          title={clip.audio}
          aria-label="Sound track disc"
        >
          <img src={clip.image} alt="" className="sound-disc-art" />
        </div>
      </div>

      {/* Bottom video details */}
      <div className="video-bottom">
        <div className="video-user">
          <Avatar initials={clip.initials} />
          <span><strong>{clip.creator}</strong><small>{clip.handle} · 18 min ago</small></span>
          <button className="follow-button" onClick={(e) => e.stopPropagation()}>Follow</button>
        </div>
        <p className="caption">{clip.caption}</p>
        <div className="tags">{clip.tags}</div>
        <button className="audio-line" onClick={(e) => { e.stopPropagation(); onSound(); }}>♫ &nbsp; {clip.audio}</button>
      </div>

      {/* Scrub / Progress Bar */}
      <div className="video-progress">
        <span style={{ width: `${progressPercent}%`, transition: clip.videoSrc ? 'width 0.1s linear' : 'none' }} />
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Owner panel (hidden from regular users)                             */
/* ------------------------------------------------------------------ */

function OwnerPanel({ notify, refreshProfile }: { notify: (message: string) => void; refreshProfile?: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [tab, setTab] = useState<'users' | 'videos' | 'analytics' | 'announce' | 'settings'>('users')
  const [announceDraft, setAnnounceDraft] = useState('')
  const [announceBusy, setAnnounceBusy] = useState(false)

  async function loadData() {
    if (!supabase) return
    setLoading(true)
    try {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, username, display_name, is_admin, verified, banned, avatar_url, created_at')
        .order('created_at', { ascending: false })
      if (userError) throw userError
      setUsers((userData ?? []) as unknown as AdminUser[])

      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('id, caption, status, created_at, video_url, owner_id, profiles:owner_id(display_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (videoError) throw videoError
      const rows = (videoData ?? []) as unknown as Array<Record<string, unknown> & { profiles?: { display_name?: string } | { display_name?: string }[] }>
      setVideos(rows.map((row) => ({
        ...(row as unknown as AdminVideo),
        ownerName: Array.isArray(row.profiles) ? row.profiles[0]?.display_name ?? '' : row.profiles?.display_name ?? '',
      })))
    } catch (error) {
      notify(toErrorMessage(error, 'Could not load panel data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [])

  async function patchUser(id: string, patch: Partial<Pick<AdminUser, 'is_admin' | 'verified' | 'banned'>>, label: string) {
    if (!supabase) return
    setBusyId(id)
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id)
      if (error) throw error
      setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)))
      if (refreshProfile) refreshProfile()
      notify(label)
    } catch (error) {
      notify(toErrorMessage(error, 'Update failed.'))
    } finally {
      setBusyId('')
    }
  }

  async function removeVideo(video: AdminVideo) {
    if (!supabase) return
    if (!window.confirm('Delete this video permanently?')) return
    setBusyId(video.id)
    try {
      const { error } = await supabase.from('videos').delete().eq('id', video.id)
      if (error) throw error
      if (video.video_url?.includes('/arc-videos/')) {
        const path = video.video_url.split('/arc-videos/')[1]?.split('?')[0]
        if (path) await supabase.storage.from('arc-videos').remove([decodeURIComponent(path)])
      }
      setVideos((current) => current.filter((item) => item.id !== video.id))
      notify('Video removed.')
    } catch (error) {
      notify(toErrorMessage(error, 'Could not delete the video.'))
    } finally {
      setBusyId('')
    }
  }

  const filtered = users.filter((user) => `${user.display_name} ${user.username} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <section className="screen active" data-view="owner" aria-label="Owner panel">
      <PageHead
        title="Owner panel"
        subtitle="Manage accounts, verification, and content."
        tools={<>
          <button className="secondary-button" onClick={() => void loadData()}>{loading ? 'Loading…' : '↻ Refresh'}</button>
          <span className="owner-count">{users.length} accounts · {videos.length} videos</span>
        </>}
      />

      {/* Stat cards */}
      <div className="owner-stats">
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.verified).length}</div>
          <div className="stat-label">Verified</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.is_admin).length}</div>
          <div className="stat-label">Admins</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.banned).length}</div>
          <div className="stat-label">Banned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{videos.length}</div>
          <div className="stat-label">Videos</div>
        </div>
      </div>

      <div className="owner-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Accounts</button>
        <button className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>Videos</button>
        <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={tab === 'announce' ? 'active' : ''} onClick={() => setTab('announce')}>Announcements</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>System</button>
      </div>

      {tab === 'users' && (
        <>
          <input className="owner-search" placeholder="Search accounts by name, username, or email…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="owner-table-wrap">
            <table className="owner-table">
              <thead><tr><th>Account</th><th>Email</th><th>Verified</th><th>Admin</th><th>Banned</th><th></th></tr></thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} style={user.banned ? { opacity: 0.5 } : undefined}>
                    <td>
                      <span className="owner-user-cell">
                        <Avatar initials={initialsOf(user.display_name || user.username)} src={user.avatar_url} size={30} />
                        <span><b>{user.display_name || user.username || '—'}{user.verified && <span className="badge badge-verified" title="Verified account">✔</span>}</b><small>@{user.username || 'unset'}</small></span>
                      </span>
                    </td>
                    <td className="owner-email">{user.email || '—'}</td>
                    <td><button className={`pill${user.verified ? ' on-blue' : ''}`} disabled={busyId === user.id} onClick={() => void patchUser(user.id, { verified: !user.verified }, user.verified ? 'Verification removed.' : 'Blue badge granted.')}>{user.verified ? '✔ Verified' : 'Verify'}</button></td>
                    <td><button className={`pill${user.is_admin ? ' on' : ''}`} disabled={busyId === user.id} onClick={() => void patchUser(user.id, { is_admin: !user.is_admin }, user.is_admin ? 'Admin access removed.' : 'Promoted to admin.')}>{user.is_admin ? 'Owner' : 'Make admin'}</button></td>
                    <td><button className={`pill${user.banned ? ' on-red' : ''}`} disabled={busyId === user.id} onClick={() => void patchUser(user.id, { banned: !user.banned }, user.banned ? 'Account unbanned.' : 'Account banned.')}>{user.banned ? 'Banned' : 'Ban'}</button></td>
                    <td className="owner-joined">{user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} className="owner-empty">No accounts match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'videos' && (
        <div className="owner-videos">
          {videos.map((video) => (
            <div className="owner-video-row" key={video.id}>
              {video.video_url
                ? <video src={video.video_url} muted playsInline />
                : <span className="owner-video-blank">No file</span>}
              <span className="owner-video-meta">
                <b>{video.ownerName || 'Unknown'} · {video.status ?? 'published'}</b>
                <small>{video.caption || '(no caption)'} — {video.created_at ? new Date(video.created_at).toLocaleString() : ''}</small>
              </span>
              <button className="pill on-red" disabled={busyId === video.id} onClick={() => void removeVideo(video)}>{busyId === video.id ? 'Removing…' : 'Delete'}</button>
            </div>
          ))}
          {!loading && videos.length === 0 && <p className="panel-note">No videos posted yet.</p>}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="owner-analytics">
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-title">Total Accounts</div>
              <div className="analytics-number">{users.length}</div>
              <div className="analytics-sub">{users.filter(u => u.verified).length} verified · {users.filter(u => u.is_admin).length} admins</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-title">Active Users</div>
              <div className="analytics-number">{users.filter(u => !u.banned).length}</div>
              <div className="analytics-sub">{users.filter(u => u.banned).length} banned accounts</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-title">Total Videos</div>
              <div className="analytics-number">{videos.length}</div>
              <div className="analytics-sub">Published and hosted content</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-title">Platform Health</div>
              <div className="analytics-number" style={{ color: '#4ade80' }}>{supabase ? 'Online' : 'Demo Mode'}</div>
              <div className="analytics-sub">{supabase ? 'Supabase connected' : 'Running in demo mode'}</div>
            </div>
          </div>

          <div className="analytics-actions">
            <button className="primary-button" onClick={() => void loadData()}>Refresh Data</button>
            <button className="secondary-button" onClick={() => notify('Export feature coming soon.')}>Export CSV</button>
          </div>
        </div>
      )}

      {tab === 'announce' && (
        <div className="owner-announce">
          <div className="announce-card">
            <label className="announce-label">Broadcast Announcement</label>
            <textarea
              className="announce-input"
              placeholder="Type an announcement to send to all users…"
              value={announceDraft}
              onChange={(e) => setAnnounceDraft(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <div className="announce-footer">
              <span className="announce-count">{announceDraft.length}/500</span>
              <button
                className="primary-button"
                disabled={announceBusy || !announceDraft.trim()}
                onClick={async () => {
                  setAnnounceBusy(true)
                  try {
                    await new Promise((r) => setTimeout(r, 1000))
                    setAnnounceDraft('')
                    notify(`Announcement sent to ${users.length} users.`)
                  } catch {
                    notify('Failed to send announcement.')
                  } finally {
                    setAnnounceBusy(false)
                  }
                }}
              >
                {announceBusy ? 'Sending…' : 'Send Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="owner-settings">
          <div className="settings-card">
            <h3>System Settings</h3>
            <div className="settings-row">
              <span>Demo Mode</span>
              <span className={`pill${!supabase ? ' on-blue' : ''}`}>{!supabase ? 'Active' : 'Off'}</span>
            </div>
            <div className="settings-row">
              <span>Supabase Connection</span>
              <span className={`pill${supabase ? ' on-blue' : ' on-red'}`}>{supabase ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="settings-row">
              <span>Registration</span>
              <span className="pill on-blue">Open</span>
            </div>
            <div className="settings-row">
              <span>Video Upload Limit</span>
              <span>100 MB</span>
            </div>
            <div className="settings-row">
              <span>Profile Image Limit</span>
              <span>5 MB</span>
            </div>
          </div>

          <div className="settings-card">
            <h3>Danger Zone</h3>
            <div className="settings-row">
              <span>Reset All Data</span>
              <button className="pill on-red" onClick={() => notify('Reset disabled in demo mode.')}>Disabled</button>
            </div>
            <div className="settings-row">
              <span>Clear Cache</span>
              <button className="secondary-button" onClick={() => notify('Cache cleared.')}>Clear</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  /* --- navigation & toast --- */
  const [screen, setScreen] = useState<ScreenId>('home')
  const [toastMessage, setToastMessage] = useState('')
  const toastTimer = useRef<number | null>(null)

  function notify(message: string) {
    setToastMessage(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 2200)
  }
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  /* --- auth --- */
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    const client = supabase
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })
    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function fetchProfile() {
    if (!supabase || !session) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('username, display_name, bio, avatar_url, banner_url, is_admin, verified, banned')
      .eq('id', session.user.id).maybeSingle()
    setProfile(data ?? null)
  }

  useEffect(() => { void fetchProfile() }, [session])

  /* --- auth modal --- */
  /* --- account identity --- */
  const accountEmail = session?.user.email ?? ''
  const accountName = profile?.display_name || String(session?.user.user_metadata?.display_name ?? '') || accountEmail.split('@')[0] || 'Maya Chen'
  const accountHandle = `@${profile?.username || accountEmail.split('@')[0] || 'mayamakes'}`
  const accountInitials = initialsOf(accountName) || 'MC'
  const isAdmin = supabase ? Boolean(profile?.is_admin) : true // demo mode (no backend): local user is the owner

  /* --- feed --- */
  const [clips, setClips] = useState<Clip[]>(starterClips)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  // The feed tabs UI was removed, but the selected feed still shapes how the
  // generated audio sounds. Kept as a constant here so the audio effect can read it.
  const [homeFeedTab, setHomeFeedTab] = useState<'following' | 'for-you' | 'live'>('for-you')
  const videoLayoutRef = useRef<HTMLDivElement>(null)
  const lastWheelTimeRef = useRef(0)

  // Playback state for the active clip. Tapping the stage (or the play control)
  // toggles this, and it feeds both the video element and the sound engine so
  // pausing halts the audio and resuming brings it back.
  const [feedPlaying, setFeedPlaying] = useState(true)

  const scrollToVideo = (index: number) => {
    const el = videoLayoutRef.current
    if (!el) return
    const targetIndex = Math.max(0, Math.min(index, clips.length - 1))
    const child = el.children[targetIndex] as HTMLElement | undefined
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      el.scrollTo({
        top: targetIndex * el.clientHeight,
        behavior: 'smooth',
      })
    }
    setActiveClipIndex(targetIndex)
  }

  const handleFeedScroll = () => {
    const el = videoLayoutRef.current
    if (!el) return
    const h = el.clientHeight
    if (!h) return
    const newIdx = Math.round(el.scrollTop / h)
    if (newIdx >= 0 && newIdx < clips.length && newIdx !== activeClipIndex) {
      setActiveClipIndex(newIdx)
    }
  }

  const handleFeedWheel = (e: React.WheelEvent) => {
    if (commentsOpen || soundsOpen) return
    const now = Date.now()
    if (now - lastWheelTimeRef.current < 380) return
    if (Math.abs(e.deltaY) < 25) return

    if (e.deltaY > 0 && activeClipIndex < clips.length - 1) {
      lastWheelTimeRef.current = now
      scrollToVideo(activeClipIndex + 1)
    } else if (e.deltaY < 0 && activeClipIndex > 0) {
      lastWheelTimeRef.current = now
      scrollToVideo(activeClipIndex - 1)
    }
  }

  // Keyboard navigation for TikTok feed (ArrowDown, ArrowUp, PageDown, PageUp, M)
  const toggleFeedFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      notify('Fullscreen is not available in this browser.')
    }
  }, [])

  // Touch swipe navigation for mobile feed (vertical drag = next/previous clip).
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleFeedTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleFeedTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dy = touch.clientY - start.y
    const dx = touch.clientX - start.x
    // Ignore mostly-horizontal gestures and tiny taps.
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx)) return
    scrollToVideo(dy < 0 ? activeClipIndex + 1 : activeClipIndex - 1)
  }

  // Keyboard navigation for TikTok feed (ArrowDown, ArrowUp, PageDown, PageUp, M)
  useEffect(() => {
    if (screen !== 'home') return

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault()
        scrollToVideo(activeClipIndex + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        e.preventDefault()
        scrollToVideo(activeClipIndex - 1)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setIsMuted((prev) => !prev)
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        void toggleFeedFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen, activeClipIndex, clips.length, toggleFeedFullscreen])

  // Fetch published videos from Supabase on mount
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    async function loadFeedVideos() {
      try {
        const { data, error } = await supabase!
          .from('videos')
          .select('id, caption, status, created_at, storage_path, user_id, profiles:user_id(display_name, username, avatar_url)')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20)
        if (error || !data || cancelled) return
        if (data.length > 0) {
          const dbClips: Clip[] = data.map((v: any) => {
            const profileData = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles
            const creatorName = profileData?.display_name || profileData?.username || 'Creator'
            const creatorHandle = `@${profileData?.username || 'user'}`
            const url = v.storage_path ? supabase!.storage.from('arc-videos').getPublicUrl(v.storage_path).data.publicUrl : ''
            return {
              id: v.id,
              creator: creatorName,
              handle: creatorHandle,
              initials: initialsOf(creatorName) || 'CR',
              caption: v.caption || 'New video',
              tags: '#arc #trending #visual',
              audio: 'Original audio · ' + creatorName,
              likes: 120,
              comments: 14,
              image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1100&q=80',
              imageAlt: v.caption || 'Video',
              videoSrc: url,
              ownerId: v.user_id,
            }
          })
          setClips((prev) => {
            const existingIds = new Set(dbClips.map((c) => c.id))
            return [...dbClips, ...prev.filter((c) => !existingIds.has(c.id))]
          })
        }
      } catch {
        // keep starterClips
      }
    }
    void loadFeedVideos()
    return () => { cancelled = true }
  }, [])
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [soundsOpen, setSoundsOpen] = useState(false)

  // Drive the background-music engine from the active clip + mute state.
  // Clips that ship a real video file keep their own track; the rest get generated audio.
  useEffect(() => {
    if (screen !== 'home' || commentsOpen || soundsOpen || isMuted || !feedPlaying) {
      feedAudio.stop()
      return
    }
    const clip = clips[activeClipIndex]
    if (!clip || clip.videoSrc) {
      feedAudio.stop()
      return
    }
    // "For you" gets the full generated track; the "following" feed plays a
    // quieter, sparser version so the two feeds sound distinct.
    feedAudio.play(clip.id, homeFeedTab === 'following' ? 'following' : 'for-you')
    return () => feedAudio.stop()
  }, [screen, activeClipIndex, clips, isMuted, commentsOpen, soundsOpen, feedPlaying, homeFeedTab])

  // Reset playback to playing whenever the active clip changes or the user
  // leaves the home screen, so a clip never starts silently paused.
  useEffect(() => {
    setFeedPlaying(true)
  }, [activeClipIndex, screen])

  // Keep the engine's mute flag in sync so unmuting resumes the right track.
  useEffect(() => {
    feedAudio.setMuted(isMuted)
  }, [isMuted])
  const [selectedSound, setSelectedSound] = useState<Sound>(sounds[0])
  const [soundQuery, setSoundQuery] = useState('')

  function toggleLike(clipId: string) {
    setLiked((current) => ({ ...current, [clipId]: !current[clipId] }))
  }

  /* --- comments --- */
  const [commentList, setCommentList] = useState<Comment[]>(starterComments)
  const [commentDraft, setCommentDraft] = useState('')
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({})

  function submitComment(event: FormEvent) {
    event.preventDefault()
    const text = commentDraft.trim()
    if (!text) return
    setCommentList((current) => [{ id: crypto.randomUUID(), author: accountName, initials: accountInitials, time: 'now', text, likes: 0 }, ...current])
    setCommentDraft('')
    notify('Comment posted.')
  }

  /* --- stories --- */
  const [storyOpen, setStoryOpen] = useState(false)
  const [storyIndex, setStoryIndex] = useState(0)
  const [storyReply, setStoryReply] = useState('')
  const currentStory = stories[storyIndex]

  function openStory(index: number) {
    setStoryIndex(index)
    setStoryOpen(true)
  }
  function moveStory(direction: 1 | -1) {
    setStoryIndex((current) => (current + direction + stories.length) % stories.length)
  }
  function submitStoryReply(event: FormEvent) {
    event.preventDefault()
    if (!storyReply.trim()) return
    setStoryReply('')
    setStoryOpen(false)
    setScreen('message')
    notify('Story reply opened in Messages.')
  }

  /* --- studio --- */
  type StudioTab = 'overview' | 'rewards' | 'subscriptions' | 'promote' | 'gifts' | 'live'
  const [studioTab, setStudioTab] = useState<StudioTab>('overview')
  const [promoteClip, setPromoteClip] = useState(0)
  const [promoteGoal, setPromoteGoal] = useState<'views' | 'followers' | 'profile'>('views')
  const [promoteDays, setPromoteDays] = useState(7)
  const [promoteBudget, setPromoteBudget] = useState(20)
  const [subTier, setSubTier] = useState<'basic' | 'plus' | 'pro'>('plus')
  const [studioRewardClaimed, setStudioRewardClaimed] = useState(false)

  const promoteEstimate = useMemo(() => {
    const base = promoteGoal === 'views' ? 1100 : promoteGoal === 'followers' ? 90 : 260
    return Math.round((base * promoteBudget * promoteDays) / 20)
  }, [promoteGoal, promoteBudget, promoteDays])

  const subscriptionTiers = [
    { id: 'basic' as const, price: 2.99, perks: ['Subscriber badge', 'Members-only comments'] },
    { id: 'plus' as const, price: 5.99, perks: ['Everything in Basic', 'Exclusive videos', 'Priority replies'] },
    { id: 'pro' as const, price: 9.99, perks: ['Everything in Plus', 'Monthly live session', 'Early access drops'] },
  ]

  const studioFollowers = [
    { id: 1, name: 'Sofia Kim', initials: 'SK', tier: 'plus' as const, since: '3 months', paid: 17.97 },
    { id: 2, name: 'Ari Rivera', initials: 'AR', tier: 'pro' as const, since: '6 months', paid: 59.94 },
    { id: 3, name: 'Nia Cooks', initials: 'NC', tier: 'basic' as const, since: '1 month', paid: 2.99 },
    { id: 4, name: 'Kai Tanaka', initials: 'KT', tier: 'plus' as const, since: '2 months', paid: 11.98 },
  ]

  const studioRewardRequirements = [
    { label: 'Reach 1,000 followers', done: true, progress: 100 },
    { label: 'Post 3 videos in 30 days', done: true, progress: 100 },
    { label: 'Accumulate 100,000 eligible views', done: false, progress: 74 },
    { label: 'Keep a clean community record', done: true, progress: 100 },
  ]

  const studioGifts = [
    { id: 1, name: 'Rose', count: 412, coins: 1, from: 'Sofia Kim' },
    { id: 2, name: 'Doughnut', count: 128, coins: 30, from: 'Ari Rivera' },
    { id: 3, name: 'Galaxy', count: 9, coins: 1000, from: 'Elena Rostova' },
    { id: 4, name: 'Hand hearts', count: 903, coins: 5, from: 'Kai Tanaka' },
  ]

  const studioLiveHistory = [
    { id: 1, title: 'Sketchbook hour', when: 'Nov 22', viewers: 4820, minutes: 62, coins: 21400 },
    { id: 2, title: 'Q&A: growing on Arc', when: 'Nov 14', viewers: 3110, minutes: 48, coins: 12800 },
    { id: 3, title: 'Late night studio', when: 'Nov 3', viewers: 1980, minutes: 75, coins: 7300 },
  ]

  /* --- live --- */
  const [liveOpen, setLiveOpen] = useState(false)
  const [liveChat, setLiveChat] = useState([
    { id: 1, name: 'sofia.draws', text: 'This view is incredible!' },
    { id: 2, name: 'jonah.lee', text: 'Adding this spot to my list.' },
    { id: 3, name: 'nico.lane', text: 'Stay for the sunset 🌅' },
  ])
  const [liveDraft, setLiveDraft] = useState('')
  const [liveHeart, setLiveHeart] = useState(false)

  function submitLiveChat(event: FormEvent) {
    event.preventDefault()
    const text = liveDraft.trim()
    if (!text) return
    setLiveChat((current) => [...current, { id: Date.now(), name: 'you', text }])
    setLiveDraft('')
  }

  /* --- messages --- */
  const [conversations] = useState<Conversation[]>(starterConversations)
  const [activeConversation, setActiveConversation] = useState<Conversation>(starterConversations[0])
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { id: 1, mine: false, text: 'Hey Maya! I tried that blue wash you shared on my last edit.' },
    { id: 2, mine: true, text: 'Oh nice, how did it turn out?' },
    { id: 3, mine: false, text: 'That color palette is perfect. Sending you the result tonight ✨' },
  ])
  const [chatDraft, setChatDraft] = useState('')
  const [messageSearch, setMessageSearch] = useState('')

  function openConversation(conversation: Conversation) {
    setActiveConversation(conversation)
    setBubbles([{ id: 1, mine: false, text: conversation.preview }, { id: 2, mine: true, text: 'Thanks for sending that. I’ll take a look!' }])
  }
  function sendChat(event: FormEvent) {
    event.preventDefault()
    const text = chatDraft.trim()
    if (!text) return
    setBubbles((current) => [...current, { id: Date.now(), mine: true, text }])
    setChatDraft('')
  }

  /* --- people modal --- */
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [peopleGroup, setPeopleGroup] = useState<'followers' | 'following'>('following')
  const [personFollowState, setPersonFollowState] = useState<Record<string, string>>({})

  function openPeople(group: 'followers' | 'following') {
    setPeopleGroup(group)
    setPeopleOpen(true)
  }

  /* --- settings --- */
  type SettingsSection = 'Account' | 'Privacy' | 'Notifications' | 'Playback' | 'Accessibility'
  const SETTINGS_SECTIONS: SettingsSection[] = ['Account', 'Privacy', 'Notifications', 'Playback', 'Accessibility']
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('Account')

  // Persistent app settings. Every switch below is stored locally and the ones
  // that affect the app (playback, accessibility) are applied live.
  const defaultPrefs = {
    privateAccount: false, activityStatus: true, personalized: true,
    notifyLikes: true, notifyComments: true, notifyFollows: true, notifyUploads: true, notifyAnnouncements: true,
    autoplay: true, startMuted: true, dataSaver: false, quality: 'auto', volume: 60,
    reduceMotion: false, largeText: false, highContrast: false, captions: false,
  }
  const [prefs, setPrefs] = useState<typeof defaultPrefs>(() => {
    try {
      const stored = localStorage.getItem('visual-prefs')
      return stored ? { ...defaultPrefs, ...JSON.parse(stored) } : defaultPrefs
    } catch { return defaultPrefs }
  })
  function setPref<K extends keyof typeof defaultPrefs>(key: K, value: (typeof defaultPrefs)[K]) {
    setPrefs((current) => {
      const next = { ...current, [key]: value }
      try { localStorage.setItem('visual-prefs', JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  // Playback prefs and the five settings sections live in `prefs` above.

  // Apply playback preferences to the live feed.
  useEffect(() => {
    setIsMuted(prefs.startMuted)
    if (!prefs.autoplay) setFeedPlaying(false)
  }, [prefs.startMuted, prefs.autoplay])

  // Apply accessibility preferences as classes on the app shell.
  useEffect(() => {
    document.body.classList.toggle('a11y-reduce-motion', prefs.reduceMotion)
    document.body.classList.toggle('a11y-large-text', prefs.largeText)
    document.body.classList.toggle('a11y-high-contrast', prefs.highContrast)
    return () => {
      document.body.classList.remove('a11y-reduce-motion', 'a11y-large-text', 'a11y-high-contrast')
    }
  }, [prefs.reduceMotion, prefs.largeText, prefs.highContrast])

  /* --- profile editing --- */
  const [profileOpen, setProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)

  function beginProfileEdit() {
    setEditName(accountName)
    setEditUsername(profile?.username || accountHandle.replace(/^@/, ''))
    setEditBio(profile?.bio || 'Collecting small moments, good food, and places with no signal.')
    setAvatarFile(null)
    setBannerFile(null)
    setAvatarPreview('')
    setBannerPreview('')
    setProfileOpen(true)
  }

  function selectProfileImage(file: File | undefined, kind: 'avatar' | 'banner') {
    if (!file) return
    if (!file.type.startsWith('image/')) { notify('Choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { notify('Images must be 5 MB or smaller.'); return }
    const preview = URL.createObjectURL(file)
    if (kind === 'avatar') { setAvatarFile(file); setAvatarPreview(preview) }
    else { setBannerFile(file); setBannerPreview(preview) }
  }

  async function uploadProfileImage(file: File, kind: 'avatar' | 'banner') {
    if (!session) return ''
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `${session.user.id}/${kind}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase!.storage.from('arc-profiles').upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw error
    return supabase!.storage.from('arc-profiles').getPublicUrl(path).data.publicUrl
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = editUsername.trim().replace(/^@/, '').toLowerCase()
    const displayName = editName.trim()
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      notify('Username must be 3–24 characters using letters, numbers, or underscores.')
      return
    }
    if (!supabase || !session) {
      setProfile({ username, display_name: displayName, bio: editBio.trim(), avatar_url: profile?.avatar_url ?? null, banner_url: profile?.banner_url ?? null })
      setProfileOpen(false)
      notify('Profile preview updated.')
      return
    }
    setProfileBusy(true)
    try {
      const { data, error } = await supabase.from('profiles')
        .update({ display_name: displayName, username, bio: editBio.trim(), updated_at: new Date().toISOString() })
        .eq('id', session.user.id)
        .select('username, display_name, bio, avatar_url, banner_url')
        .single()
      if (error) throw error
      let newAvatar = data.avatar_url
      let newBanner = data.banner_url
      if (avatarFile) newAvatar = await uploadProfileImage(avatarFile, 'avatar')
      if (bannerFile) newBanner = await uploadProfileImage(bannerFile, 'banner')
      if (newAvatar !== data.avatar_url || newBanner !== data.banner_url) {
        const { data: updatedData, error: updateError } = await supabase.from('profiles')
          .update({ avatar_url: newAvatar, banner_url: newBanner })
          .eq('id', session.user.id)
          .select('username, display_name, bio, avatar_url, banner_url')
          .single()
        if (updateError) throw updateError
        setProfile(updatedData)
      } else {
        setProfile(data)
      }
      setProfileOpen(false)
      setAvatarFile(null)
      setBannerFile(null)
      setAvatarPreview('')
      setBannerPreview('')
      notify('Profile updated.')
    } catch (error) {
      notify(toErrorMessage(error, 'Could not save your profile. Try again.'))
    } finally {
      setProfileBusy(false)
    }
  }

  /* --- camera / recording / publishing (real functionality) --- */
  const [capturedUrl, setCapturedUrl] = useState('')
  const [capturedName, setCapturedName] = useState('')
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('A little more outside time. #weekend #bluehour')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timeoutRef = useRef<number | null>(null)
  const keepUrlsRef = useRef(new Set<string>())
  const startedAtRef = useRef(0)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  async function startCamera() {
    setScreen('create')
    if (!navigator.mediaDevices?.getUserMedia) {
      notify('Camera access needs HTTPS or localhost.')
      return
    }
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      notify(name === 'NotAllowedError' ? 'Camera permission was blocked. Allow access and try again.' : 'Could not open the camera. Try again.')
    }
  }

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.ondataavailable = null
      recorderRef.current.onstop = null
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    keepUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    if (!isRecording) return
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [isRecording])

  function adoptVideoFile(file: File) {
    if (capturedUrl.startsWith('blob:') && !keepUrlsRef.current.has(capturedUrl)) URL.revokeObjectURL(capturedUrl)
    setCapturedFile(file)
    setCapturedName(file.name)
    setCapturedUrl(URL.createObjectURL(file))
    stopCamera()
    setIsRecording(false)
    setScreen('post')
    notify('Media selected. Add details and publish.')
  }

  function selectUpload(file?: File) {
    if (!file) return
    if (!file.type.startsWith('video/')) { notify('Choose a video file to post.'); return }
    if (file.size > 100 * 1024 * 1024) { notify('Videos must be 100 MB or smaller.'); return }
    adoptVideoFile(file)
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream) { notify('Enable the camera before recording.'); return }
    if (typeof MediaRecorder === 'undefined') { notify('Recording is not supported in this browser.'); return }
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type))
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size > 0) {
          const extension = type.includes('mp4') ? 'mp4' : 'webm'
          adoptVideoFile(new File([blob], `arc-video-${Date.now()}.${extension}`, { type }))
        } else {
          notify('The recording was empty. Try again.')
        }
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      }
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setIsRecording(true)
      recorder.start(250)
      timeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 30000)
    } catch {
      notify('Could not start recording. Check camera permissions.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function toggleRecord() {
    if (isRecording) stopRecording()
    else if (streamRef.current) startRecording()
    else if (!session) { setScreen('create'); openAuth('signin') }
    else void startCamera()
  }

  function discardCapture() {
    if (capturedUrl.startsWith('blob:') && !keepUrlsRef.current.has(capturedUrl)) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl('')
    setCapturedName('')
    setCapturedFile(null)
    setCaption('')
    notify('Draft discarded.')
  }

  async function publishVideo() {
    if (!capturedFile) { notify('Record or choose a video first.'); return }
    setUploading(true)
    let videoUrl = capturedUrl
    try {
      if (supabase && session) {
        const extension = capturedFile.name.split('.').pop()?.toLowerCase() || 'webm'
        const storagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('arc-videos').upload(storagePath, capturedFile, {
          contentType: capturedFile.type || 'video/webm', upsert: false,
        })
        if (uploadError) throw uploadError
        videoUrl = supabase.storage.from('arc-videos').getPublicUrl(storagePath).data.publicUrl
        const { error: insertError } = await supabase.from('videos').insert({
          user_id: session.user.id,
          storage_path: storagePath,
          caption: caption.trim(),
          duration_seconds: recordingSeconds || null,
          status: 'published',
        })
        if (insertError) {
          await supabase.storage.from('arc-videos').remove([storagePath])
          throw insertError
        }
      } else {
        keepUrlsRef.current.add(capturedUrl)
      }
      const newClip: Clip = {
        id: crypto.randomUUID(),
        creator: session ? accountName : 'You',
        handle: session ? accountHandle : '@you',
        initials: session ? accountInitials : 'YU',
        caption: caption.trim() || 'A little more outside time.',
        tags: '#newpost',
        audio: selectedSound.title,
        likes: 0,
        comments: 0,
        image: '',
        imageAlt: 'Your newly posted video',
        videoSrc: videoUrl,
        ownerId: session?.user.id,
      }
      setClips((current) => [newClip, ...current])
      setActiveClipIndex(0)
      if (videoLayoutRef.current) {
        videoLayoutRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
      setCapturedUrl('')
      setCapturedName('')
      setCapturedFile(null)
      setCaption('')
      setRecordingSeconds(0)
      setScreen('home')
      notify('Post published. It is at the top of your feed.')
    } catch (error) {
      notify(toErrorMessage(error, 'Video upload failed. Check your connection and try again.'))
    } finally {
      setUploading(false)
    }
  }

  /* --- auth modal --- */
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authBusy, setAuthBusy] = useState(false)

  function openAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { notify('Sign in needs the app owner to configure Supabase.'); return }
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email'))
    const password = String(data.get('password'))
    const displayName = String(data.get('displayName') ?? '')
    setAuthBusy(true)
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        })
        if (error) throw error
        setAuthOpen(false)
        notify('Account created. You are signed in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthOpen(false)
        notify('Signed in.')
      }
      form.reset()
    } catch (error) {
      notify(toErrorMessage(error, 'Could not sign you in. Try again.'))
    } finally {
      setAuthBusy(false)
    }
  }

  /* --- search --- */
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const q = searchQuery.trim().toLowerCase()
  const searchClipResults = useMemo(
    () => (q ? clips.filter((c) => `${c.creator} ${c.caption} ${c.tags} ${c.audio}`.toLowerCase().includes(q)).slice(0, 6) : []),
    [q, clips],
  )
  const searchCreatorResults = useMemo(() => {
    if (!q) return []
    const seen = new Set<string>()
    const found: { name: string; handle: string; initials: string }[] = []
    clips.forEach((c) => {
      if (!seen.has(c.handle) && `${c.creator} ${c.handle}`.toLowerCase().includes(q)) {
        seen.add(c.handle)
        found.push({ name: c.creator, handle: c.handle, initials: c.initials })
      }
    })
    suggestedCreators.forEach((c) => {
      const handle = `@${c.name.toLowerCase().replace(/\s+/g, '.')}`
      if (!seen.has(handle) && c.name.toLowerCase().includes(q)) {
        seen.add(handle)
        found.push({ name: c.name, handle, initials: c.initials })
      }
    })
    return found.slice(0, 4)
  }, [q, clips])
  const searchSoundResults = useMemo(
    () => (q ? sounds.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q)).slice(0, 4) : []),
    [q],
  )

  function jumpToClip(clipId: string) {
    const index = clips.findIndex((c) => c.id === clipId)
    if (index >= 0) {
      setScreen('home')
      setSearchOpen(false)
      setTimeout(() => scrollToVideo(index), 60)
    }
  }

  /* --- derived --- */
  const myClips = useMemo(() => (session ? clips.filter((clip) => clip.ownerId === session.user.id) : []), [clips, session])
  const profileGridItems = session && myClips.length > 0
    ? myClips.map((clip) => ({ views: clip.likes ? formatCount(clip.likes) : 'New', image: clip.image, alt: clip.caption, video: clip.videoSrc }))
    : profileTiles.map((tile) => ({ ...tile, video: undefined as string | undefined }))
  const filteredSounds = sounds.filter((sound) => `${sound.title} ${sound.artist}`.toLowerCase().includes(soundQuery.trim().toLowerCase()))
  const filteredConversations = conversations.filter((conversation) => `${conversation.name} ${conversation.preview}`.toLowerCase().includes(messageSearch.trim().toLowerCase()))

  function navigate(next: ScreenId) {
    setScreen(next)
    if (next !== 'create') { stopCamera(); setIsRecording(false) }
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className={`app-shell${screen === 'home' ? ' home-open' : ''}${screen === 'message' ? ' conversation-open' : ''}`}>
      <div className="device-status"><span>9:41</span><span>◔ &nbsp; ◉ &nbsp; ▰</span></div>

      {/* ---------- Sidebar ---------- */}
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><VisualMark /></span><span>Visual</span></button>
        <div className="nav-label">YOUR FEED</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_MAIN.map((item) => (
            <button key={item.id} className={`${screen === item.id ? 'active' : ''}${item.create ? ' create-link' : ''}`} onClick={() => (item.create ? startCamera() : navigate(item.id))}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="nav-label" style={{ marginTop: 22 }}>CREATOR SPACE</div>
        <nav className="side-nav" aria-label="Creator navigation">
          {NAV_CREATOR.map((item) => (
            <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        {!session && (
          <div className="auth-buttons">
            <button className="primary-button" onClick={() => openAuth('signin')}>Sign in</button>
            <button className="secondary-button" onClick={() => openAuth('signup')}>Create account</button>
          </div>
        )}
        <div className="creator-mini">
        <Avatar initials={accountInitials} src={profile?.avatar_url} />
        <span><strong>{accountName}{profile?.verified && <span className="badge badge-verified" title="Verified account">✔</span>}</strong><small>{accountHandle}</small></span>
        {isAdmin && <button className="sidebar-more" onClick={() => navigate('owner')} aria-label="Owner panel" title="Owner panel">⬛</button>}
        {!isAdmin && <button className="sidebar-more" onClick={() => navigate('settings')} aria-label="Account settings">•••</button>}
      </div>
    </aside>

      {/* ---------- Main ---------- */ }
  <div className="main-area">
    <header className="topbar">
      <div className="mobile-brand"><span className="mobile-brand-mark"><VisualMark /></span>Visual</div>
      <label className="searchbox" onClick={() => setSearchOpen(true)}><span>⌕</span><input aria-label="Search" placeholder="Search creators, sounds, and videos" readOnly value="" /></label>
      <span className="topbar-spacer" />
      <span className="topbar-label">Make room for good things</span>
      <button className="phone-story-shortcut" onClick={() => openStory(2)} aria-label="Open stories"><Avatar initials="SK" src={stories[2].image} /></button>
      <button className="top-icon" onClick={() => navigate('studio')} aria-label="Open Studio">▥</button>
      <button className="top-icon" onClick={() => navigate('settings')} aria-label="Open settings">⚙</button>
      <button className="top-create" onClick={startCamera}>＋ Create</button>
      {!session && <button className="primary-button top-auth" onClick={() => openAuth('signin')}>Sign in</button>}
    </header>

    <main className="main-content">
      {/* ================= HOME ================= */}
      <section className={`screen${screen === 'home' ? ' active' : ''}`} data-view="home" aria-label="Home feed">
        <div className="feed-layout">
          <div className="feed-main">
            {/* Feed mode tabs: LIVE | Following | For you */}
            <div className="feed-mode-tabs" role="tablist" aria-label="Feed mode">
              <button
                type="button"
                role="tab"
                aria-selected={homeFeedTab === 'live'}
                className={`feed-mode-tab live-tab${homeFeedTab === 'live' ? ' active' : ''}`}
                onClick={() => setHomeFeedTab('live')}
              >
                <span className="live-dot" aria-hidden="true" />
                LIVE
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={homeFeedTab === 'following'}
                className={`feed-mode-tab${homeFeedTab === 'following' ? ' active' : ''}`}
                onClick={() => setHomeFeedTab('following')}
              >
                Following
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={homeFeedTab === 'for-you'}
                className={`feed-mode-tab${homeFeedTab === 'for-you' ? ' active' : ''}`}
                onClick={() => setHomeFeedTab('for-you')}
              >
                For you
              </button>
            </div>
            <div
              className="video-layout"
              ref={videoLayoutRef}
              onScroll={handleFeedScroll}
              onWheel={handleFeedWheel}
              onTouchStart={handleFeedTouchStart}
              onTouchEnd={handleFeedTouchEnd}
              aria-label="For you videos"
            >
              {clips.map((clip, index) => (
                <VideoStage
                  key={clip.id}
                  clip={clip}
                  isActive={screen === 'home' && activeClipIndex === index}
                  isMuted={isMuted}
                  liked={!!liked[clip.id]}
                  onLike={() => toggleLike(clip.id)}
                  onComments={() => setCommentsOpen(true)}
                  onShare={() => notify('Share link copied in this preview.')}
                  onSave={() => notify('Saved to your collection.')}
                  onSound={() => setSoundsOpen(true)}
                  onSearch={() => setSearchOpen(true)}
                  isPlaying={feedPlaying && activeClipIndex === index}
                  onPlayingChange={setFeedPlaying}
                />
              ))}
            </div>

            {/* Desktop floating Up/Down navigation buttons */}
            <div className="feed-nav-arrows" aria-label="Navigate videos">
              <button
                className="feed-nav-btn prev"
                aria-label="Previous video (Up Arrow)"
                title="Previous video (Up Arrow)"
                disabled={activeClipIndex === 0}
                onClick={() => scrollToVideo(activeClipIndex - 1)}
              >
                ▲
              </button>
              <button
                className="feed-nav-btn next"
                aria-label="Next video (Down Arrow)"
                title="Next video (Down Arrow)"
                disabled={activeClipIndex === clips.length - 1}
                onClick={() => scrollToVideo(activeClipIndex + 1)}
              >
                ▼
              </button>
            </div>
          </div>
          <aside className="feed-aside">
            <section className="aside-panel">
              <div className="panel-title"><strong>Trending now</strong><button onClick={() => navigate('discover')}>Explore all →</button></div>
              {trends.map((trend, index) => (
                <div className="trend-row" key={trend.tag}>
                  <span className="trend-number">{String(index + 1).padStart(2, '0')}</span>
                  <span><b>{trend.tag}</b><small>{trend.count}</small></span>
                  <span className="trend-growth">{trend.growth}</span>
                </div>
              ))}
            </section>
            <section className="aside-panel">
              <div className="panel-title"><strong>Creators to follow</strong><button onClick={() => notify('Suggestions refreshed.')}>Refresh</button></div>
              {suggestedCreators.map((creator) => (
                <div className="suggest-row" key={creator.name}>
                  <Avatar initials={creator.initials} size={30} />
                  <span><b>{creator.name}</b><small>{creator.meta}</small></span>
                  <button className="follow-button">Follow</button>
                </div>
              ))}
              <p className="panel-note">Your feed gets better when it sounds like you.</p>
            </section>
            <section className="aside-panel">
              <div className="panel-title"><strong>Today on Arc</strong><span style={{ color: '#68c4ff', fontSize: 9 }}>02 / 05</span></div>
              <p className="panel-note">New voices, good finds, and small moments worth keeping.</p>
            </section>
          </aside>
        </div>
      </section>

      {/* ================= DISCOVER ================= */}
      <section className={`screen${screen === 'discover' ? ' active' : ''}`} data-view="discover" aria-label="Discover videos">
        <PageHead
          title="Discover"
          subtitle="Find a new corner of the internet."
          tools={<><button className="secondary-button">⌕ Search sounds</button><button className="primary-button">Explore tags</button></>}
        />
        <div className="discover-grid">
          {discoverCards.map((card) => (
            <article className="discover-card" key={card.title}>
              <img src={card.image} alt={card.alt} />
              <div className="discover-card-info"><strong>{card.title}</strong><small>{card.meta}</small></div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= CREATE ================= */}
      <section className={`screen${screen === 'create' ? ' active' : ''}`} data-view="create" aria-label="Create video">
        <PageHead
          title="Create"
          subtitle="Capture a moment or bring in a clip."
          tools={<><button className="secondary-button">Drafts · 2</button><button className="primary-button" onClick={() => (capturedUrl ? navigate('post') : notify('Record or upload a clip first.'))}>Continue to post →</button></>}
        />
        <div className="compose-layout">
          <div className="capture-preview">
            <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }} />
            <span className="capture-status">{isRecording ? `● RECORDING · ${recordingSeconds}s` : 'CAMERA PREVIEW'}</span>
            <button className="capture-center" onClick={toggleRecord} aria-label={isRecording ? 'Stop recording' : 'Start camera'}>{isRecording ? '■' : '●'}</button>
            <div className="capture-tools">
              <button aria-label="Filters" onClick={() => notify('Filters are coming soon.')}>✧</button>
              <button aria-label="Timer" onClick={() => notify('Timer is coming soon.')}>◷</button>
            </div>
            <div className="capture-bottom">
              <label style={{ cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" hidden onChange={(event) => selectUpload(event.target.files?.[0])} />
                ▧ Upload clip
              </label>
              <button className="record" onClick={toggleRecord} aria-label={isRecording ? 'Stop recording' : 'Record'} />
              <button onClick={() => setSoundsOpen(true)}>♫ Sound</button>
            </div>
          </div>
          <div className="form-panel">
            <h2>Clip setup</h2>
            <label className="field">Recording length<select><option>30 seconds</option><option>60 seconds</option><option>3 minutes</option></select></label>
            <label className="field">Sound<select value={selectedSound.title} onChange={(event) => setSelectedSound(sounds.find((sound) => sound.title === event.target.value) ?? sounds[0])}>
              {sounds.map((sound) => <option key={sound.id}>{sound.title}</option>)}
            </select></label>
            <label className="field">Cover frame<button className="secondary-button" type="button" onClick={() => notify('Cover selection is a preview-only control.')}>Choose cover</button></label>
            <div className="switch-row"><span>Enhance video</span><button className="switch" aria-label="Enhance video enabled" /></div>
            <div className="switch-row"><span>Save to drafts automatically</span><button className="switch" aria-label="Auto save enabled" /></div>
            <div className="button-row"><button className="secondary-button" onClick={() => notify('Draft saved locally.')}>Save draft</button><button className="primary-button" onClick={() => (capturedUrl ? navigate('post') : notify('Record or upload a clip first.'))}>Next: Post</button></div>
            <p className="field-help">{capturedName ? `Selected: ${capturedName}` : 'Videos stay local until you publish.'}</p>
          </div>
        </div>
      </section>

      {/* ================= POST ================= */}
      <section className={`screen${screen === 'post' ? ' active' : ''}`} data-view="post" aria-label="Publish a post">
        <PageHead
          title="Post"
          subtitle="Choose how this video appears to your audience."
          tools={<button className="secondary-button" onClick={() => navigate('create')}>← Back to edit</button>}
        />
        <div className="compose-layout">
          <div className="capture-preview">
            {capturedUrl
              ? <video src={capturedUrl} muted playsInline controls style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }} />
              : <span className="capture-status">NO VIDEO YET</span>}
            <span className="capture-status" style={{ top: 13 }}>POST PREVIEW</span>
            <div className="capture-bottom"><span className="caption">{caption.trim() || 'Your caption will appear here.'}</span></div>
          </div>
          <div className="form-panel">
            <h2>Post details</h2>
            <label className="field">
              Caption
              <textarea maxLength={500} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write a caption..." />
              <span className="field-help">Add a thought, tag a topic, or keep it simple.</span>
            </label>
            <label className="field">Who can watch<select><option>Everyone</option><option>Followers</option><option>Only me</option></select></label>
            <div className="switch-row"><span>Allow comments</span><button className="switch" aria-label="Allow comments enabled" /></div>
            <div className="switch-row"><span>Allow remix</span><button className="switch" aria-label="Allow remix enabled" /></div>
            <div className="switch-row"><span>Show on profile</span><button className="switch" aria-label="Show on profile enabled" /></div>
            <div className="button-row">
              <button className="secondary-button" onClick={discardCapture}>Discard draft</button>
              <button className="primary-button" onClick={publishVideo} disabled={uploading}>{uploading ? 'Publishing…' : 'Publish video'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MESSAGES ================= */}
      <section className={`screen${screen === 'message' ? ' active' : ''}`} data-view="message" aria-label="Messages">
        <PageHead title="Messages" subtitle="Notes from your people." tools={<button className="primary-button" onClick={() => notify('Pick a conversation to keep chatting.')}>＋ New message</button>} />
        <div className="message-layout">
          <aside className="conversation-list">
            <div className="message-search"><input placeholder="Search messages" aria-label="Search messages" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} /></div>
            {filteredConversations.map((conversation) => (
              <button key={conversation.id} className={`conversation${activeConversation.id === conversation.id ? ' active' : ''}`} onClick={() => openConversation(conversation)}>
                <Avatar initials={conversation.initials} />
                <span className="conversation-copy"><b>{conversation.name}</b><small>{conversation.preview}</small></span>
                <time>{conversation.time}</time>
              </button>
            ))}
            {filteredConversations.length === 0 && <p className="panel-note" style={{ padding: 12 }}>No conversations match.</p>}
          </aside>
          <section className="chat-pane">
            <header className="chat-head">
              <button className="message-back" onClick={() => setScreen('discover')} aria-label="Back to messages">‹</button>
              <Avatar initials={activeConversation.initials} />
              <span><b>{activeConversation.name}</b><small>Active now</small></span>
              <button className="chat-more" aria-label="Conversation options">•••</button>
            </header>
            <div className="chat-body">
              <div className="chat-day">TODAY</div>
              {bubbles.map((bubble) => <div key={bubble.id} className={`bubble${bubble.mine ? ' mine' : ''}`}>{bubble.text}</div>)}
            </div>
            <form className="chat-compose" onSubmit={sendChat}>
              <input placeholder="Write a message..." aria-label="Write a message" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} />
              <button aria-label="Send message">➤</button>
            </form>
          </section>
        </div>
      </section>

      {/* ================= PROFILE ================= */}
      <section className={`screen${screen === 'profile' ? ' active' : ''}`} data-view="profile" aria-label="Profile">
        <PageHead
          title="Profile"
          subtitle="Your page, your point of view."
          tools={<><button className="secondary-button" onClick={() => navigate('settings')}>⚙ Settings</button><button className="primary-button" onClick={beginProfileEdit}>Edit profile</button></>}
        />
        <div className="profile-cover">
          {profile?.banner_url && <img src={profile.banner_url} alt="Profile banner" />}
          <span className="profile-cover-label">A little more outside time ↗</span>
        </div>
        <div className="profile-summary">
          <span className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt={`${accountName} profile`} /> : accountInitials}</span>
          <div className="profile-details"><h2>{accountName}{profile?.verified && <span className="badge badge-verified" title="Verified account">✔</span>}</h2><p>{accountHandle} · Portland, OR</p></div>
          <button className="secondary-button" onClick={() => navigate('studio')}>Open Studio</button>
        </div>
        <div className="profile-stats">
          <span><b>{myClips.length || 38}</b> videos</span>
          <button className="profile-stat-link" onClick={() => openPeople('followers')}><b>4,820</b> followers</button>
          <button className="profile-stat-link" onClick={() => openPeople('following')}><b>612</b> following</button>
          <span><b>82.4K</b> likes</span>
        </div>
        <p className="profile-bio">{profile?.bio || 'Collecting small moments, good food, and places with no signal. Here for the things that make an ordinary day feel like yours.'}</p>
        <div className="profile-tabs">
          {['Videos', 'Liked', 'Saved', 'Collections'].map((tab, index) => (
            <button key={tab} className={index === 0 ? 'active' : ''} onClick={() => notify(`${tab} tab selected.`)}>{tab}</button>
          ))}
        </div>
        <div className="profile-grid">
          {profileGridItems.map((tile, index) => (
            <button className="profile-tile" key={`${tile.alt}-${index}`} onClick={() => navigate('home')} aria-label={`Play video: ${tile.alt}`}>
              {'video' in tile && tile.video ? <video src={tile.video} muted playsInline /> : <img src={tile.image} alt={tile.alt} />}
              <span>▶ {tile.views}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ================= SETTINGS ================= */}
      <section className={`screen${screen === 'settings' ? ' active' : ''}`} data-view="settings" aria-label="Settings">
        <PageHead title="Settings" subtitle="Shape your account and your experience." />
        <div className="settings-layout">
          <nav className="settings-nav">
            {SETTINGS_SECTIONS.map((section) => (
              <button key={section} className={settingsSection === section ? 'active' : ''} onClick={() => setSettingsSection(section)}>{section}</button>
            ))}
          </nav>
          <section className="settings-content">
            {settingsSection === 'Account' && (
              <>
                <h2>Account</h2>
                <p>Who you are on Visual.</p>
                <div className="setting-item"><span><b>Display name</b><small>{accountName}</small></span><button className="secondary-button" onClick={beginProfileEdit}>Edit</button></div>
                <div className="setting-item"><span><b>Username</b><small>{accountHandle}</small></span><button className="secondary-button" onClick={beginProfileEdit}>Edit</button></div>
                <div className="setting-item"><span><b>Email</b><small>{session?.user.email ?? 'Not signed in'}</small></span><span className="pill on-blue">{session ? 'Verified' : 'Guest'}</span></div>
                <div className="setting-item"><span><b>Profile photos</b><small>Avatar and banner</small></span><button className="secondary-button" onClick={beginProfileEdit}>Change</button></div>
                {session && <div className="button-row"><button className="secondary-button" onClick={() => { void supabase?.auth.signOut(); notify('Signed out.'); setScreen('home') }}>Sign out</button></div>}
                {!session && <div className="button-row"><button className="primary-button" onClick={() => openAuth('signin')}>Sign in</button><button className="secondary-button" onClick={() => openAuth('signup')}>Create account</button></div>}
              </>
            )}
            {settingsSection === 'Privacy' && (
              <>
                <h2>Privacy</h2>
                <p>Control who sees you and your posts.</p>
                <div className="setting-item"><span><b>Private account</b><small>Only approved followers can see your posts.</small></span><input type="checkbox" checked={prefs.privateAccount} onChange={(e) => setPref('privateAccount', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Activity status</b><small>Let people you follow see when you are active.</small></span><input type="checkbox" checked={prefs.activityStatus} onChange={(e) => setPref('activityStatus', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Personalized recommendations</b><small>Use your interests to tune your For you feed.</small></span><input type="checkbox" checked={prefs.personalized} onChange={(e) => setPref('personalized', e.target.checked)} /></div>
                <label className="field">Who can send you messages<select defaultValue="followers"><option value="everyone">Everyone</option><option value="followers">Followers you follow back</option><option value="nobody">Nobody</option></select></label>
                <label className="field">Who can duet / remix your videos<select defaultValue="everyone"><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="nobody">Nobody</option></select></label>
              </>
            )}
            {settingsSection === 'Notifications' && (
              <>
                <h2>Notifications</h2>
                <p>Choose what reaches you.</p>
                <div className="setting-item"><span><b>Likes</b><small>When someone likes your video.</small></span><input type="checkbox" checked={prefs.notifyLikes} onChange={(e) => setPref('notifyLikes', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Comments</b><small>Replies and mentions.</small></span><input type="checkbox" checked={prefs.notifyComments} onChange={(e) => setPref('notifyComments', e.target.checked)} /></div>
                <div className="setting-item"><span><b>New followers</b><small>When someone follows you.</small></span><input type="checkbox" checked={prefs.notifyFollows} onChange={(e) => setPref('notifyFollows', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Uploads from creators</b><small>New videos from people you follow.</small></span><input type="checkbox" checked={prefs.notifyUploads} onChange={(e) => setPref('notifyUploads', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Announcements</b><small>Platform news from the owner.</small></span><input type="checkbox" checked={prefs.notifyAnnouncements} onChange={(e) => setPref('notifyAnnouncements', e.target.checked)} /></div>
              </>
            )}
            {settingsSection === 'Playback' && (
              <>
                <h2>Playback</h2>
                <p>How videos play in your feed.</p>
                <div className="setting-item"><span><b>Autoplay videos</b><small>Start playing when a video fills the screen.</small></span><input type="checkbox" checked={prefs.autoplay} onChange={(e) => setPref('autoplay', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Start muted</b><small>Videos begin silent until you unmute.</small></span><input type="checkbox" checked={prefs.startMuted} onChange={(e) => setPref('startMuted', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Data saver</b><small>Use less data when you are not on Wi-Fi.</small></span><input type="checkbox" checked={prefs.dataSaver} onChange={(e) => setPref('dataSaver', e.target.checked)} /></div>
                <label className="field">Video quality<select value={prefs.quality} onChange={(e) => setPref('quality', e.target.value)}><option value="auto">Auto</option><option value="high">High (1080p)</option><option value="medium">Medium (720p)</option><option value="low">Low (480p)</option></select></label>
                <label className="field">Default volume<b className="volume-value">{prefs.volume}%</b><input type="range" min={0} max={100} value={prefs.volume} onChange={(e) => setPref('volume', Number(e.target.value))} aria-label="Default volume" /></label>
              </>
            )}
            {settingsSection === 'Accessibility' && (
              <>
                <h2>Accessibility</h2>
                <p>Make Visual easier to see and use. Changes apply immediately.</p>
                <div className="setting-item"><span><b>Reduce motion</b><small>Turn off animated transitions and the rotating sound disc.</small></span><input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => setPref('reduceMotion', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Larger text</b><small>Increase the size of text across the app.</small></span><input type="checkbox" checked={prefs.largeText} onChange={(e) => setPref('largeText', e.target.checked)} /></div>
                <div className="setting-item"><span><b>High contrast</b><small>Stronger borders and brighter text.</small></span><input type="checkbox" checked={prefs.highContrast} onChange={(e) => setPref('highContrast', e.target.checked)} /></div>
                <div className="setting-item"><span><b>Captions</b><small>Show captions on videos when available.</small></span><input type="checkbox" checked={prefs.captions} onChange={(e) => setPref('captions', e.target.checked)} /></div>
              </>
            )}
            <p className="field-help">Preferences are saved automatically on this device.</p>
          </section>
        </div>
      </section>

      {/* ================= STUDIO ================= */}
      <section className={`screen${screen === 'studio' ? ' active' : ''}`} data-view="studio" aria-label="Creator Studio">
        <PageHead
          title="Studio"
          subtitle="Your videos are finding their people."
          tools={<><button className="secondary-button">Last 30 days⌄</button><button className="primary-button" onClick={startCamera}>＋ New video</button></>}
        />

        <nav className="studio-tabs" aria-label="Studio sections">
          {([
            { id: 'overview' as StudioTab, label: 'Insights' },
            { id: 'rewards' as StudioTab, label: 'Creator Rewards' },
            { id: 'subscriptions' as StudioTab, label: 'Subscriptions' },
            { id: 'promote' as StudioTab, label: 'Promote' },
            { id: 'gifts' as StudioTab, label: 'Video gifts' },
            { id: 'live' as StudioTab, label: 'Live rewards' },
          ]).map((tab) => (
            <button
              key={tab.id}
              className={`studio-tab-btn${studioTab === tab.id ? ' active' : ''}`}
              onClick={() => setStudioTab(tab.id)}
              aria-current={studioTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {studioTab === 'overview' && (
          <>
            <div className="studio-metrics">
              <div className="metric-card"><small>Video views</small><strong>128.7K</strong><span>↑ 18.4% this month</span></div>
              <div className="metric-card"><small>Profile visits</small><strong>24.6K</strong><span>↑ 12.1% this month</span></div>
              <div className="metric-card"><small>New followers</small><strong>3,248</strong><span>↑ 9.8% this month</span></div>
              <div className="metric-card"><small>Engagement</small><strong>8.6%</strong><span>↑ 2.3% this month</span></div>
            </div>
            <div className="studio-grid">
              <section className="studio-panel">
                <h2>Views over time</h2>
                <div className="chart-bars">{chartBars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
                <div className="chart-labels"><span>Nov 1</span><span>Nov 7</span><span>Nov 14</span><span>Nov 21</span><span>Nov 30</span></div>
              </section>
              <section className="studio-panel">
                <h2>Top videos</h2>
                {topVideos.map((video) => (
                  <div className="top-video" key={video.title}>
                    <img src={video.image} alt={`${video.title} thumbnail`} />
                    <span><b>{video.title}</b><small>{video.when}</small></span>
                    <strong>{video.views}</strong>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {studioTab === 'rewards' && (
          <section className="studio-card">
            <h3>Visual Creator Rewards</h3>
            <p>Eligible views in the last 30 days count toward creator rewards. Keep posting to stay in the programme.</p>
            <div className="rewards-grid">
              <div className="reward-stat-box"><small>Eligible views</small><strong>74.2K</strong><span>of 100K target</span></div>
              <div className="reward-stat-box"><small>Estimated reward</small><strong>$182.40</strong><span>This period</span></div>
              <div className="reward-stat-box"><small>Lifetime paid</small><strong>$1,204</strong><span>Since joining</span></div>
            </div>
            <div className="requirements-list">
              {studioRewardRequirements.map((req) => (
                <div className="req-item" key={req.label}>
                  <span className={`req-badge ${req.done ? 'done' : 'pending'}`}>{req.done ? '✓' : '•'}</span>
                  <div className="req-info">
                    <b>{req.label}</b>
                    <small>{req.done ? 'Completed' : `${req.progress}% complete`}</small>
                    <div className="req-progress"><span style={{ width: `${req.progress}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
            <footer className="button-row">
              <button
                className="primary-button"
                disabled={studioRewardClaimed || studioRewardRequirements.some((r) => !r.done)}
                onClick={() => { setStudioRewardClaimed(true); notify('Reward claim submitted.') }}
              >
                {studioRewardClaimed ? 'Claim submitted' : 'Claim available rewards'}
              </button>
            </footer>
          </section>
        )}

        {studioTab === 'subscriptions' && (
          <section className="studio-card">
            <h3>Subscriptions</h3>
            <p>Offer a recurring membership. Subscribers get your badge, perks, and members-only posts.</p>
            <div className="rewards-grid">
              <div className="reward-stat-box"><small>Active subscribers</small><strong>{studioFollowers.length}</strong><span>↑ 2 this month</span></div>
              <div className="reward-stat-box"><small>Monthly recurring</small><strong>${studioFollowers.reduce((sum, f) => sum + f.paid / 3, 0).toFixed(2)}</strong><span>Projected</span></div>
              <div className="reward-stat-box"><small>Churn</small><strong>4.1%</strong><span>Last 30 days</span></div>
            </div>
            <div className="promote-steps">
              <div className="promote-step">
                <h4>Choose your tier pricing</h4>
                <div className="promote-options">
                  {subscriptionTiers.map((tier) => (
                    <button
                      key={tier.id}
                      className={`promote-opt-btn${subTier === tier.id ? ' active' : ''}`}
                      onClick={() => setSubTier(tier.id)}
                    >
                      <b style={{ textTransform: 'capitalize' }}>{tier.id}</b>
                      <div style={{ color: '#8fa7c4', fontSize: 11, marginTop: 4 }}>${tier.price} / month</div>
                      <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: '#aaa', fontSize: 11, lineHeight: 1.6 }}>
                        {tier.perks.map((perk) => <li key={perk}>{perk}</li>)}
                      </ul>
                    </button>
                  ))}
                </div>
                <footer className="button-row">
                  <button className="primary-button" onClick={() => notify(`Subscriptions set to the ${subTier} tier.`)}>Save tier pricing</button>
                </footer>
              </div>
              <div className="promote-step">
                <h4>Your subscribers</h4>
                {studioFollowers.map((person) => (
                  <div className="top-video" key={person.id}>
                    <Avatar initials={person.initials} />
                    <span><b>{person.name}</b><small>{person.tier} · {person.since}</small></span>
                    <strong>${person.paid.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {studioTab === 'promote' && (
          <section className="studio-card">
            <h3>Promote content</h3>
            <p>Pick a video, set a goal, and grow its reach. You only pay for the budget you choose.</p>
            <div className="promote-steps">
              <div className="promote-step">
                <h4>1. Choose a video</h4>
                <div className="promote-options">
                  {clips.slice(0, 4).map((clip, index) => (
                    <button
                      key={clip.id ?? index}
                      className={`promote-opt-btn${promoteClip === index ? ' active' : ''}`}
                      onClick={() => setPromoteClip(index)}
                    >
                      <b>{clip.creator}</b>
                      <div style={{ color: '#8fa7c4', fontSize: 11, marginTop: 4 }}>
                        {clip.caption.length > 42 ? `${clip.caption.slice(0, 42)}…` : clip.caption}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="promote-step">
                <h4>2. Pick a goal</h4>
                <div className="promote-options">
                  {([
                    { id: 'views' as const, label: 'More video views' },
                    { id: 'followers' as const, label: 'More followers' },
                    { id: 'profile' as const, label: 'More profile visits' },
                  ]).map((goal) => (
                    <button
                      key={goal.id}
                      className={`promote-opt-btn${promoteGoal === goal.id ? ' active' : ''}`}
                      onClick={() => setPromoteGoal(goal.id)}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="promote-step">
                <h4>3. Set your budget</h4>
                <div className="slider-group">
                  <div className="slider-row"><span>Daily budget</span><b>${promoteBudget}</b></div>
                  <input
                    className="range-slider"
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={promoteBudget}
                    onChange={(event) => setPromoteBudget(Number(event.target.value))}
                    aria-label="Daily budget"
                  />
                  <div className="slider-row"><span>Duration</span><b>{promoteDays} days</b></div>
                  <input
                    className="range-slider"
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={promoteDays}
                    onChange={(event) => setPromoteDays(Number(event.target.value))}
                    aria-label="Campaign duration in days"
                  />
                </div>
                <div className="rewards-grid" style={{ marginTop: 16 }}>
                  <div className="reward-stat-box"><small>Estimated reach</small><strong>{promoteEstimate.toLocaleString()}</strong><span>{promoteGoal.replace('profile', 'profile visits')}</span></div>
                  <div className="reward-stat-box"><small>Total spend</small><strong>${promoteBudget * promoteDays}</strong><span>Over {promoteDays} days</span></div>
                </div>
              </div>
              <footer className="button-row">
                <button
                  className="primary-button"
                  onClick={() => notify(`Promotion started · ${promoteBudget * promoteDays} for ${promoteDays} days.`)}
                >
                  Start promotion
                </button>
              </footer>
            </div>
          </section>
        )}

        {studioTab === 'gifts' && (
          <section className="studio-card">
            <h3>Video gifts</h3>
            <p>Gifts viewers send on your videos. Coins convert to creator earnings at $0.01 per coin.</p>
            <div className="rewards-grid">
              <div className="reward-stat-box"><small>Gifts this month</small><strong>{studioGifts.reduce((s, g) => s + g.count, 0).toLocaleString()}</strong><span>↑ 27% this month</span></div>
              <div className="reward-stat-box"><small>Coins earned</small><strong>{studioGifts.reduce((s, g) => s + g.count * g.coins, 0).toLocaleString()}</strong><span>All gift types</span></div>
              <div className="reward-stat-box"><small>Estimated payout</small><strong>${(studioGifts.reduce((s, g) => s + g.count * g.coins, 0) * 0.01).toFixed(2)}</strong><span>Before fees</span></div>
            </div>
            {studioGifts.map((gift) => (
              <div className="top-video" key={gift.id}>
                <span className="sound-cover">🎁</span>
                <span><b>{gift.name}</b><small>{gift.count.toLocaleString()} sent · from {gift.from}</small></span>
                <strong>{(gift.count * gift.coins).toLocaleString()} coins</strong>
              </div>
            ))}
          </section>
        )}

        {studioTab === 'live' && (
          <section className="studio-card">
            <h3>Live rewards</h3>
            <p>Review how your live sessions performed and what viewers sent during each stream.</p>
            <div className="rewards-grid">
              <div className="reward-stat-box"><small>Hours streamed</small><strong>{(studioLiveHistory.reduce((s, l) => s + l.minutes, 0) / 60).toFixed(1)}</strong><span>Last 30 days</span></div>
              <div className="reward-stat-box"><small>Total viewers</small><strong>{studioLiveHistory.reduce((s, l) => s + l.viewers, 0).toLocaleString()}</strong><span>All sessions</span></div>
              <div className="reward-stat-box"><small>Coins from live</small><strong>{studioLiveHistory.reduce((s, l) => s + l.coins, 0).toLocaleString()}</strong><span>Before fees</span></div>
            </div>
            {studioLiveHistory.map((session) => (
              <div className="top-video" key={session.id}>
                <span className="sound-cover">◉</span>
                <span><b>{session.title}</b><small>{session.when} · {session.minutes} min · {session.viewers.toLocaleString()} viewers</small></span>
                <strong>{session.coins.toLocaleString()} coins</strong>
              </div>
            ))}
            <footer className="button-row">
              <button className="primary-button" onClick={() => setLiveOpen(true)}>Preview a live session</button>
            </footer>
          </section>
        )}
      </section>
      {/* ================= OWNER PANEL (admins only) ================= */}
      {isAdmin && screen === 'owner' && <OwnerPanel notify={notify} refreshProfile={fetchProfile} />}

    </main>
  </div>

  {/* ---------- Comments modal ---------- */ }
  <Modal open={commentsOpen} onClose={() => setCommentsOpen(false)} labelledBy="comments-title" className="comments-card">
    <ModalHead title="Comments" subtitle="6,432 responses" onClose={() => setCommentsOpen(false)} />
    <div className="comment-list">
      {commentList.map((comment) => (
        <div className="comment-row" key={comment.id}>
          <Avatar initials={comment.initials} />
          <div>
            <b>{comment.author} <small>{comment.time}</small></b>
            <p>{comment.text}</p>
            <button className="comment-like" onClick={() => setLikedComments((current) => ({ ...current, [comment.id]: !current[comment.id] }))}>
              {likedComments[comment.id] ? '♥' : '♡'} {comment.likes + (likedComments[comment.id] ? 1 : 0)}
            </button>
          </div>
        </div>
      ))}
    </div>
    <form className="comment-compose" onSubmit={submitComment}>
      <Avatar initials={accountInitials} size={30} />
      <input placeholder="Add a thoughtful comment..." aria-label="Add a comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
      <button className="primary-button">Post</button>
    </form>
  </Modal>

  {/* ---------- Story viewer ---------- */ }
  <div className={`story-overlay${storyOpen ? ' open' : ''}`} aria-hidden={!storyOpen}>
    <section className="story-viewer" role="dialog" aria-modal="true" aria-label="Story viewer">
      <img src={currentStory.image} alt={`${currentStory.name} story`} />
      <div className="story-scrim" />
      <div className="story-progress">{stories.map((story, index) => <i key={story.id} className={index <= storyIndex ? 'on' : ''} />)}</div>
      <header className="story-view-head">
        <button className="story-view-back" onClick={() => setStoryOpen(false)} aria-label="Close story">‹</button>
        <Avatar initials={currentStory.initials} />
        <span><b>{currentStory.name}</b><small>{currentStory.time}</small></span>
        <button className="story-view-close" onClick={() => setStoryOpen(false)} aria-label="Close story">×</button>
      </header>
      <button className="story-skip story-prev" onClick={() => moveStory(-1)} aria-label="Previous story">‹</button>
      <button className="story-skip story-next" onClick={() => moveStory(1)} aria-label="Next story">›</button>
      <div className="story-view-caption">{currentStory.caption}</div>
      <form className="story-reply" onSubmit={submitStoryReply}>
        <input placeholder="Reply to story..." aria-label="Reply to story" value={storyReply} onChange={(event) => setStoryReply(event.target.value)} />
        <button aria-label="Send reply">➤</button>
      </form>
    </section>
  </div>

  {/* ---------- Profile editor ---------- */ }
  <Modal open={profileOpen} onClose={() => setProfileOpen(false)} labelledBy="edit-profile-title" className="profile-modal-card">
    <ModalHead title="Edit profile" subtitle="Make your page feel like you." onClose={() => setProfileOpen(false)} />
    <form className="profile-edit-form" onSubmit={saveProfile}>
      <div className="profile-edit-pickers">
        <div className="profile-edit-avatar">
          {avatarPreview || profile?.avatar_url ? <img src={avatarPreview || profile?.avatar_url || ''} alt="Profile photo preview" /> : <span className="avatar-placeholder">{accountInitials}</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProfileImage(event.target.files?.[0], 'avatar')} />
          <span className="avatar-upload-overlay"><span>Change photo</span></span>
        </div>
        <div className="profile-edit-banner">
          {bannerPreview || profile?.banner_url ? <img src={bannerPreview || profile?.banner_url || ''} alt="Profile banner preview" /> : <span className="banner-placeholder">Add a banner</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProfileImage(event.target.files?.[0], 'banner')} />
          <span className="banner-upload-overlay"><span>Change banner</span></span>
        </div>
      </div>
      <p className="profile-image-hint">Images accepted: JPG, PNG, WebP · Max 5 MB each</p>
      <label className="field">Display name<input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={60} required /></label>
      <label className="field">Username
        <div className="handle-field"><span>@</span><input value={editUsername} onChange={(event) => setEditUsername(event.target.value)} maxLength={24} required /></div>
      </label>
      <label className="field">Bio<textarea value={editBio} onChange={(event) => setEditBio(event.target.value)} maxLength={160} rows={4} /></label>
      <footer className="button-row">
        <button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Cancel</button>
        <button className="primary-button" type="submit" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save profile'}</button>
      </footer>
    </form>
  </Modal>

  {/* ---------- People modal ---------- */ }
  <Modal open={peopleOpen} onClose={() => setPeopleOpen(false)} labelledBy="people-title" className="people-card">
    <ModalHead title={peopleGroup === 'followers' ? 'Followers' : 'Following'} onClose={() => setPeopleOpen(false)} />
    <div className="people-list">
      {(peopleGroup === 'followers' ? peopleFollowers : peopleFollowing).map((person) => {
        const state = personFollowState[person.name] ?? (peopleGroup === 'followers' ? 'Follow back' : 'Following')
        return (
          <button className="people-row" key={person.name} onClick={() => setPersonFollowState((current) => ({ ...current, [person.name]: state === 'Following' ? 'Follow' : 'Following' }))}>
            <Avatar initials={person.initials} />
            <span><b>{person.name}</b><small>{person.meta}</small></span>
            <span className="people-follow-state">{state}</span>
          </button>
        )
      })}
    </div>
  </Modal>

  {/* ---------- Live viewer ---------- */ }
  <div className={`live-overlay${liveOpen ? ' open' : ''}`} aria-hidden={!liveOpen}>
    <section className="live-viewer" role="dialog" aria-modal="true" aria-label="Live preview">
      <img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85" alt="Coastal live stream preview" />
      <div className="live-shade" />
      <header className="live-view-head">
        <span className="live-badge">● LIVE</span>
        <Avatar initials="AR" />
        <span><b>Ari Rivera</b><small>2.4K watching</small></span>
        <button className="modal-close" onClick={() => setLiveOpen(false)} aria-label="Close live preview">×</button>
      </header>
      <div className="live-chat">{liveChat.map((message) => <p key={message.id}><b>{message.name}</b> {message.text}</p>)}</div>
      <form className="live-compose" onSubmit={submitLiveChat}>
        <input placeholder="Say something..." aria-label="Send a live comment" value={liveDraft} onChange={(event) => setLiveDraft(event.target.value)} />
        <button aria-label="Send">➤</button>
        <button type="button" className="live-heart" onClick={() => setLiveHeart((value) => !value)}>{liveHeart ? '♥' : '♡'}</button>
      </form>
    </section>
  </div>

  {/* ---------- Search modal ---------- */ }
  <Modal open={searchOpen} onClose={() => setSearchOpen(false)} labelledBy="search-title" className="search-modal-card">
    <ModalHead title="Search" subtitle="Videos, creators, and sounds" onClose={() => setSearchOpen(false)} />
    <label className="sound-search">⌕<input autoFocus placeholder="Search creators, sounds, and videos" aria-label="Search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
    {q && (
      <div className="search-results">
        {searchClipResults.length > 0 && (
          <>
            <small className="search-group-label">Videos</small>
            {searchClipResults.map((clip) => (
              <button className="sound-row" key={clip.id} onClick={() => jumpToClip(clip.id)}>
                <span className="sound-cover"><img src={clip.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /></span>
                <span><b>{clip.caption.slice(0, 48)}{clip.caption.length > 48 ? '…' : ''}</b><small>{clip.creator} · {clip.audio}</small></span>
                <span className="sound-preview-button">Watch →</span>
              </button>
            ))}
          </>
        )}
        {searchCreatorResults.length > 0 && (
          <>
            <small className="search-group-label">Creators</small>
            {searchCreatorResults.map((creator) => (
              <button className="sound-row" key={creator.handle} onClick={() => { setSearchOpen(false); navigate('profile') }}>
                <span className="sound-cover"><Avatar initials={creator.initials} size={34} /></span>
                <span><b>{creator.name}</b><small>{creator.handle}</small></span>
                <span className="sound-preview-button">View →</span>
              </button>
            ))}
          </>
        )}
        {searchSoundResults.length > 0 && (
          <>
            <small className="search-group-label">Sounds</small>
            {searchSoundResults.map((sound) => (
              <button className="sound-row" key={sound.id} onClick={() => { setSearchOpen(false); setSoundsOpen(true) }}>
                <span className="sound-cover">♫</span>
                <span><b>{sound.title}</b><small>{sound.artist} · {sound.usage}</small></span>
                <span className="sound-preview-button">Open →</span>
              </button>
            ))}
          </>
        )}
        {searchClipResults.length === 0 && searchCreatorResults.length === 0 && searchSoundResults.length === 0 && (
          <p className="panel-note">No results for “{searchQuery.trim()}”.</p>
        )}
      </div>
    )}
    {!q && <p className="panel-note" style={{ padding: '8px 4px' }}>Start typing to search videos, creators, and sounds.</p>}
  </Modal>

  {/* ---------- Sounds modal ---------- */ }
  <Modal open={soundsOpen} onClose={() => setSoundsOpen(false)} labelledBy="sounds-title" className="sounds-card">
    <ModalHead title="Sounds" subtitle="Explore sounds used by the community" onClose={() => setSoundsOpen(false)} />
    <label className="sound-search">⌕<input placeholder="Search sounds" aria-label="Search sounds" value={soundQuery} onChange={(event) => setSoundQuery(event.target.value)} /></label>
    <div className="sound-list">
      {filteredSounds.map((sound) => (
        <button className={`sound-row${selectedSound.id === sound.id ? ' selected' : ''}`} key={sound.id} onClick={() => setSelectedSound(sound)}>
          <span className="sound-cover">♫</span>
          <span><b>{sound.title}</b><small>{sound.artist} · {sound.usage}</small></span>
          <span className="sound-preview-button">{selectedSound.id === sound.id ? 'Ⅱ Previewing' : '▶ Preview'}</span>
        </button>
      ))}
      {filteredSounds.length === 0 && <p className="panel-note">No sounds match that search.</p>}
    </div>
    <footer className="sound-footer">
      <button className="primary-button" onClick={() => { setSoundsOpen(false); notify(`${selectedSound.title} selected for your next video.`) }}>Use this sound</button>
    </footer>
  </Modal>

  {/* ---------- Auth modal ---------- */ }
  <AuthModal open={authOpen} mode={authMode} busy={authBusy} onClose={() => setAuthOpen(false)} onSubmit={submitAuth} onSwitch={() => setAuthMode((mode) => (mode === 'signin' ? 'signup' : 'signin'))} />

  {/* ---------- Mobile nav ---------- */ }
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV_MOBILE.map((item) => (
          <button key={item.id} className={`${screen === item.id ? 'active' : ''}${item.create ? ' create-mobile' : ''}`} onClick={() => (item.create ? startCamera() : navigate(item.id))}>
            <span className="nav-icon">{item.icon}</span>{item.label}
          </button>
        ))}
        {isAdmin && (
          <button className={screen === 'owner' ? 'active' : ''} onClick={() => navigate('owner')}>
            <span className="nav-icon">⬛</span>Owner
          </button>
        )}
        <button className={screen === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}>
          <span className="nav-icon">⚙</span>Settings
        </button>
      </nav>

      <Toast message={toastMessage} />
    </div >
  )
}
