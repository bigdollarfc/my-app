import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'

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
    tags: '#outside #slowdays #weekend', audio: 'original sound · Jonah Lee',
    likes: 128700, comments: 6432,
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'A mountain lake at golden hour',
  },
  {
    id: 'food', creator: 'Nia Cooks', handle: '@nia.cooks', initials: 'NC',
    caption: 'A little lunch break with whatever was in the fridge. Easy, bright, and really good.',
    tags: '#homecooking #lunchideas', audio: 'Sunday kitchen · Nia Cooks',
    likes: 42600, comments: 1208,
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1100&q=80',
    imageAlt: 'A colorful lunch prepared at home',
  },
  {
    id: 'coast', creator: 'Ari Rivera', handle: '@ari.outside', initials: 'AR',
    caption: 'Stayed until the light turned silver. Leaving this here for your next deep breath.',
    tags: '#coastline #slowdown', audio: 'Coastline · Ari Rivera',
    likes: 18300, comments: 920,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=85',
    imageAlt: 'A quiet blue coastline at sunset',
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

const settingsOptions = [
  { key: 'private', title: 'Private account', detail: 'Only approved followers can see your posts.', on: false },
  { key: 'activity', title: 'Activity status', detail: 'Let people you follow see when you are active.', on: true },
  { key: 'personalized', title: 'Personalized recommendations', detail: 'Use your interests to tune your For you feed.', on: true },
  { key: 'notifications', title: 'Video notifications', detail: 'Get updates from creators you follow.', on: true },
  { key: 'datasaver', title: 'Data saver', detail: 'Use less data when you are not on Wi-Fi.', on: false },
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
/* Video stage (feed card)                                             */
/* ------------------------------------------------------------------ */

function VideoStage({ clip, liked, onLike, onComments, onShare, onSave, onSound }: {
  clip: Clip
  liked: boolean
  onLike: () => void
  onComments: () => void
  onShare: () => void
  onSave: () => void
  onSound: () => void
}) {
  const [paused, setPaused] = useState(false)
  return (
    <article className={`video-stage${paused ? ' paused' : ''}`} data-video-id={clip.id}>
      {clip.videoSrc
        ? <video src={clip.videoSrc} muted playsInline loop autoPlay style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }} />
        : <img src={clip.image} alt={clip.imageAlt} />}
      <div className="feed-mode-tabs">
        <button>Following</button>
        <button className="active">For you</button>
        <button>Live</button>
      </div>
      <div className="video-top">
        <span className="live-pill"><span>●</span> FEATURED</span>
        <button className="sound-pill" onClick={onSound}>♫ {clip.audio}</button>
      </div>
      <button className="video-controls" aria-label={paused ? 'Play video' : 'Pause video'} onClick={() => setPaused((value) => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
      <div className="video-actions">
        <button className={`action-button like-button${liked ? ' liked' : ''}`} aria-label="Like video" onClick={onLike}>
          <b>{liked ? '♥' : '♡'}</b><small>{formatCount(clip.likes + (liked ? 1 : 0))}</small>
        </button>
        <button className="action-button comments-button" aria-label="View comments" onClick={onComments}>
          <b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" /></svg></b>
          <small>{formatCount(clip.comments)}</small>
        </button>
        <button className="action-button share-button" aria-label="Share video" onClick={onShare}><b>↗</b><small>Share</small></button>
        <button className="action-button save-button" aria-label="Save video" onClick={onSave}><b>♧</b><small>Save</small></button>
      </div>
      <div className="video-bottom">
        <div className="video-user">
          <Avatar initials={clip.initials} />
          <span><strong>{clip.creator}</strong><small>{clip.handle} · 18 min ago</small></span>
          <button className="follow-button">Follow</button>
        </div>
        <p className="caption">{clip.caption}</p>
        <div className="tags">{clip.tags}</div>
        <button className="audio-line" onClick={onSound}>♫ &nbsp; {clip.audio}</button>
      </div>
      <div className="video-progress"><span /></div>
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
  const isAdmin = true // TODO: revert to Boolean(profile?.is_admin) after confirming owner panel access

  /* --- feed --- */
  const [clips, setClips] = useState<Clip[]>(starterClips)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [soundsOpen, setSoundsOpen] = useState(false)
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
  const [settingsOn, setSettingsOn] = useState<Record<string, boolean>>(
    Object.fromEntries(settingsOptions.map((option) => [option.key, option.on])),
  )

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
      <label className="searchbox"><span>⌕</span><input aria-label="Search" placeholder="Search creators, sounds, and videos" /></label>
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
            <div className="feed-heading">
              <h1>Home</h1>
              <div className="feed-tabs">
                {['For you', 'Following', 'Live'].map((tab, index) => (
                  <button key={tab} className={index === 0 ? 'active' : ''} onClick={() => (tab === 'Live' ? setLiveOpen(true) : notify(`${tab} feed selected in this preview.`))}>{tab}</button>
                ))}
              </div>
            </div>
            <div className="story-strip" aria-label="Stories">
              {stories.map((story, index) => (
                <button key={story.id} className="story-item" onClick={() => openStory(index)}>
                  <span className="story-ring">
                    <img src={story.image} alt="" />
                    {index === 0 && <span className="story-add">+</span>}
                  </span>
                  <span>{story.name}</span>
                </button>
              ))}
            </div>
            <div className="video-layout" aria-label="For you videos">
              {clips.map((clip) => (
                <VideoStage
                  key={clip.id}
                  clip={clip}
                  liked={!!liked[clip.id]}
                  onLike={() => toggleLike(clip.id)}
                  onComments={() => setCommentsOpen(true)}
                  onShare={() => notify('Share link copied in this preview.')}
                  onSave={() => notify('Saved to your collection.')}
                  onSound={() => setSoundsOpen(true)}
                />
              ))}
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
            {['Account', 'Privacy', 'Notifications', 'Playback', 'Accessibility'].map((section, index) => (
              <button key={section} className={index === 0 ? 'active' : ''} onClick={() => notify(`${section} settings selected.`)}>{section}</button>
            ))}
          </nav>
          <section className="settings-content">
            <h2>Account preferences</h2>
            <p>Manage how you use Arc.</p>
            {settingsOptions.map((option) => (
              <div className="setting-item" key={option.key}>
                <span><b>{option.title}</b><small>{option.detail}</small></span>
                <input type="checkbox" checked={settingsOn[option.key]} onChange={(event) => setSettingsOn((current) => ({ ...current, [option.key]: event.target.checked }))} />
              </div>
            ))}
            <div className="button-row">
              {session && <button className="secondary-button" onClick={() => { void supabase?.auth.signOut(); notify('Signed out.'); setScreen('home') }}>Sign out</button>}
              <button className="primary-button" onClick={() => notify('Settings preview saved locally.')}>Save preferences</button>
                </div>
            {!isSupabaseConfigured && <p className="field-help">Sign in needs the app owner to configure Supabase.</p>}
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
      </nav>

      <Toast message={toastMessage} />
    </div >
  )
}
