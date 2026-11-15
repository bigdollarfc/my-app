import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { feedAudio } from './lib/audioEngine'
import { addStory, claimCoins, createTicket, fetchCoins, fetchConversations, fetchRepostedIds, fetchSavedIds, fetchStories, fetchThread, fetchTickets, onNewMessage, sendMessage as postMessage, setReposted, setSaved, timeAgo, type StoryRow, type TicketRow } from './lib/social'

/* ------------------------------------------------------------------ */
/* Types & data                                                        */
/* ------------------------------------------------------------------ */

type ScreenId = 'home' | 'discover' | 'create' | 'post' | 'message' | 'chat' | 'profile' | 'profile-view' | 'settings' | 'studio' | 'owner'

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
  video_url: string
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
  avatarUrl?: string | null
  verified?: boolean
  repostedFrom?: string
  originalCreator?: string
  originalHandle?: string
}

type Conversation = { 
  id: string; 
  name: string; 
  initials: string; 
  preview: string; 
  time: string; 
  unread?: number;
  avatar?: string | null;
  handle?: string | null;
  online?: boolean;
  muted?: boolean;
  pinned?: boolean;
  verified?: boolean;
}
type Attachment = { id: string; type: 'image' | 'video' | 'file'; url: string; name?: string; size?: number; thumbnail?: string }
type Story = { id: string; name: string; initials: string; image: string; caption: string; time: string; video?: string }
type Sound = { 
  id: string; 
  title: string; 
  artist: string; 
  usage: string;
  cover?: string;
  videos?: Clip[];
}

/* Hashtag types */
type Hashtag = { 
  id: string; 
  tag: string; 
  count: number; 
  growth?: string;
  videos?: Clip[];
}

/* Effect types */
type VideoEffect = { 
  id: string; 
  name: string; 
  icon: string; 
  category: 'visual' | 'beauty' | 'fun' | 'transition' | 'green-screen';
  shader?: string; // CSS filter or WebGL shader
}

/* Block user types */
type BlockedUser = { 
  id: string; 
  name: string; 
  handle: string; 
  initials: string; 
  avatar?: string | null;
  blockedAt: string;
}

/* Future types - reserved for upcoming features */
/*
type LiveStream = { 
  id: string; 
  title: string; 
  creator: string; 
  handle: string; 
  initials: string; 
  avatar?: string | null;
  thumbnail: string;
  viewers: number;
  startedAt: string;
  tags?: string[];
  isLive: boolean;
}

type RemixVideo = { 
  id: string; 
  originalClipId: string; 
  type: 'duet' | 'stitch' | 'remix';
  creator: string;
  handle: string;
}
*/

/* Message types for rich chat */
type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderAvatar?: string | null;
  text: string;
  time: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  attachments?: Attachment[];
  replyTo?: Message;
  isEdited?: boolean;
  isDeleted?: boolean;
  mine?: boolean;
}

/* Chat screen state */
type ChatCategory = 'all' | 'unread' | 'groups' | 'channels';

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

/* Bottom bar on phones: Home / Discover / Create / Inbox only.
   Profile is reached from the topbar avatar, Owner from the studio/sidebar. */
const NAV_MOBILE: { id: ScreenId; label: string; icon: string; create?: boolean }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'discover', label: 'Discover', icon: '⌕' },
  { id: 'create', label: 'Create', icon: '＋', create: true },
  { id: 'message', label: 'Inbox', icon: '◌' },
  { id: 'profile', label: 'Profile', icon: '◉' },
]

/* Line icons for the phone bottom nav (see visual-app.html). */
const NAV_ICONS: Record<string, ReactNode> = {
  home: <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>,
  discover: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>,
  create: <svg viewBox="0 0 24 24" style={{ strokeWidth: 2.4 }}><path d="M12 5v14M5 12h14" /></svg>,
  message: <svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /></svg>,
  profile: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></svg>,
}

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

const DISCOVER_CHIPS = ['For you', 'Food', 'Travel', 'Outdoors', 'Design', 'Daily life', 'Creative']

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
  { 
    id: 'sk', 
    name: 'Sofia Kim', 
    initials: 'SK', 
    handle: '@sofia.kim',
    preview: 'That color palette is perfect. Sending you the result tonight ✨', 
    time: '2m', 
    unread: 2,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    online: true,
    muted: false,
    pinned: true,
  },
  { 
    id: 'ar', 
    name: 'Ari Rivera', 
    initials: 'AR', 
    handle: '@ari.outside',
    preview: '📹 Video: Blue hour coastline', 
    time: '1h', 
    unread: 1,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
    online: true,
    muted: false,
    pinned: false,
  },
  { 
    id: 'nl', 
    name: 'Nico Lane', 
    initials: 'NL', 
    handle: '@nico.lane',
    preview: 'Are you free this weekend? Want to check out that new trail.', 
    time: '3h', 
    unread: 0,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    online: false,
    muted: true,
    pinned: false,
  },
  { 
    id: 'jw', 
    name: 'Jules Walker', 
    initials: 'JW', 
    handle: '@jules.walker',
    preview: 'Liked your post "Mountain lake at golden hour"', 
    time: '1d', 
    unread: 0,
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80',
    online: true,
    muted: false,
    pinned: false,
  },
  { 
    id: 'dm', 
    name: 'Devon Miles', 
    initials: 'DM', 
    handle: '@devon.miles',
    preview: '🎵 Shared a sound: "Midnight sessions"', 
    time: '2d', 
    unread: 0,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
    online: false,
    muted: false,
    pinned: false,
  },
  { 
    id: 'group1', 
    name: 'Weekend Crew 🝕︝', 
    initials: 'WC', 
    handle: 'group',
    preview: 'Ari: Who\'s down for Saturday hike?', 
    time: '3d', 
    unread: 5,
    avatar: null,
    online: false,
    muted: false,
    pinned: true,
  },
  { 
    id: 'channel1', 
    name: 'Visual Announcements', 
    initials: 'AA', 
    handle: 'channel',
    preview: '📢 New features rolling out this week!', 
    time: '1w', 
    unread: 0,
    avatar: null,
    online: false,
    muted: true,
    pinned: false,
  },
]
const demoStories: Story[] = [

  { id: 'you', name: 'Your story', initials: 'MC', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', caption: 'A little moment from today.', time: 'just now' },
  { id: 's1', name: 'Jonah', initials: 'JL', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80', caption: 'Trail treats and thin air.', time: '3 hours ago' },
  { id: 's2', name: 'Sofia', initials: 'SK', image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80', caption: 'New palette, same chaos.', time: '2 hours ago' },
  { id: 's3', name: 'Ari', initials: 'AR', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80', caption: 'Blue hour is undefeated.', time: '5 hours ago' },
  { id: 's4', name: 'Nia', initials: 'NC', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80', caption: 'Lunch in ten minutes.', time: '1 hour ago' },
]

function toStoryList(rows: StoryRow[]): Story[] {
  return rows.map((row) => {
    const name = row.profiles?.username ?? 'user'
    return {
      id: row.id,
      name,
      initials: name.slice(0, 2).toUpperCase(),
      image: row.media_url,
      caption: row.text || 'A moment from today.',
      time: timeAgo(row.created_at),
      video: row.kind === 'video' ? row.media_url : undefined,
    }
  })
}

const sounds: Sound[] = [
  { id: 'snd1', title: 'Original sound', artist: 'Jonah Lee', usage: '12.4K videos', cover: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd2', title: 'Blue hour', artist: 'Northbound', usage: '84.2K videos', cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd3', title: 'Slow morning', artist: 'Studio Notes', usage: '26.8K videos', cover: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd4', title: 'Coastline (instrumental)', artist: 'Rae Sol', usage: '102K videos', cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd5', title: 'Midnight sessions', artist: 'Devon Miles', usage: '45.6K videos', cover: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd6', title: 'Weekend vibes', artist: 'Ari Rivera', usage: '32.1K videos', cover: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd7', title: 'Golden hour', artist: 'Nia Cooks', usage: '28.9K videos', cover: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&q=80' },
  { id: 'snd8', title: 'Trail mix', artist: 'Nico Lane', usage: '19.3K videos', cover: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=200&q=80' },
]

/* Hashtags data */
const hashtags: Hashtag[] = [
  { id: 'tag1', tag: '#fyp', count: 12000000, growth: '+15%' },
  { id: 'tag2', tag: '#foryou', count: 8500000, growth: '+12%' },
  { id: 'tag3', tag: '#viral', count: 6200000, growth: '+8%' },
  { id: 'tag4', tag: '#trending', count: 4800000, growth: '+10%' },
  { id: 'tag5', tag: '#outside', count: 2100000, growth: '+18%' },
  { id: 'tag6', tag: '#slowdays', count: 1800000, growth: '+22%' },
  { id: 'tag7', tag: '#weekend', count: 3400000, growth: '+25%' },
  { id: 'tag8', tag: '#trail', count: 950000, growth: '+14%' },
  { id: 'tag9', tag: '#coastline', count: 1200000, growth: '+16%' },
  { id: 'tag10', tag: '#homecooking', count: 2800000, growth: '+19%' },
  { id: 'tag11', tag: '#foodtok', count: 3100000, growth: '+17%' },
  { id: 'tag12', tag: '#slowdown', count: 1400000, growth: '+20%' },
  { id: 'tag13', tag: '#oceanvibes', count: 890000, growth: '+13%' },
  { id: 'tag14', tag: '#lunchideas', count: 1600000, growth: '+11%' },
  { id: 'tag15', tag: '#goldenhour', count: 2300000, growth: '+9%' },
  { id: 'tag16', tag: '#bluetime', count: 650000, growth: '+7%' },
  { id: 'tag17', tag: '#slowliving', count: 1100000, growth: '+15%' },
  { id: 'tag18', tag: '#nature', count: 4200000, growth: '+8%' },
  { id: 'tag19', tag: '#photography', count: 3800000, growth: '+6%' },
  { id: 'tag20', tag: '#aesthetic', count: 2900000, growth: '+5%' },
]

/* Video Effects data */
const videoEffects: VideoEffect[] = [
  { id: 'none', name: 'Normal', icon: '✕', category: 'visual', shader: 'none' },
  { id: 'vintage', name: 'Vintage', icon: '📷', category: 'visual', shader: 'sepia(0.3) contrast(1.1) brightness(0.9)' },
  { id: 'cinematic', name: 'Cinematic', icon: '🎬', category: 'visual', shader: 'contrast(1.2) saturate(1.1) brightness(0.95)' },
  { id: 'bw', name: 'B&W', icon: '⚫', category: 'visual', shader: 'grayscale(1) contrast(1.15)' },
  { id: 'warm', name: 'Warm', icon: '🌅', category: 'visual', shader: 'sepia(0.2) saturate(1.2) brightness(1.05)' },
  { id: 'cool', name: 'Cool', icon: '❄︝', category: 'visual', shader: 'hue-rotate(180deg) saturate(1.1)' },
  { id: 'vhs', name: 'VHS', icon: '📼', category: 'visual', shader: 'contrast(1.3) brightness(0.9) saturate(0.8)' },
  { id: 'dreamy', name: 'Dreamy', icon: '☝︝', category: 'visual', shader: 'blur(0.5px) brightness(1.1) saturate(1.1)' },
  { id: 'smooth', name: 'Smooth Skin', icon: '✨', category: 'beauty', shader: 'blur(0.3px) brightness(1.05)' },
  { id: 'bright', name: 'Bright Eyes', icon: '👝︝', category: 'beauty', shader: 'brightness(1.15) contrast(1.1)' },
  { id: 'glow', name: 'Glow', icon: '✨', category: 'beauty', shader: 'brightness(1.1) saturate(1.2) contrast(1.05)' },
  { id: 'retouch', name: 'Retouch', icon: '🎨', category: 'beauty', shader: 'blur(0.4px) brightness(1.08)' },
  { id: 'mirror', name: 'Mirror', icon: '🪞', category: 'fun', shader: 'scaleX(-1)' },
  { id: 'kaleidoscope', name: 'Kaleidoscope', icon: '🔮', category: 'fun', shader: 'hue-rotate(90deg) saturate(1.5)' },
  { id: 'glitch', name: 'Glitch', icon: '📺', category: 'fun', shader: 'hue-rotate(45deg) contrast(1.4)' },
  { id: 'invert', name: 'Invert', icon: '🌈', category: 'fun', shader: 'invert(1) hue-rotate(180deg)' },
  { id: 'zoom', name: 'Zoom', icon: '🔝', category: 'transition', shader: 'scale(1.1)' },
  { id: 'pan', name: 'Pan', icon: '↔︝', category: 'transition', shader: 'translateX(10%)' },
  { id: 'spin', name: 'Spin', icon: '🔄', category: 'transition', shader: 'rotate(5deg)' },
  { id: 'greenscreen', name: 'Green Screen', icon: '🟢', category: 'green-screen', shader: 'none' },
]

const peopleFollowing = [
  { name: 'Sofia Kim', initials: 'SK', handle: '@sofia.draws', meta: '@sofia.draws · Art & illustration' },
  { name: 'Ari Rivera', initials: 'AR', handle: '@ari.outside', meta: '@ari.outside · Outdoors' },
  { name: 'Nico Lane', initials: 'NL', handle: '@nico.lane', meta: '@nico.lane · Travel' },
]

const peopleFollowers = [
  { name: 'Jonah Lee', initials: 'JL', handle: '@jonah.lee', meta: '@jonah.lee · Outdoors' },
  { name: 'Jules Walker', initials: 'JW', handle: '@jules.walker', meta: '@jules.walker · Film' },
  { name: 'Devon Miles', initials: 'DM', handle: '@devon.miles', meta: '@devon.miles · Music' },
]

const chartBars = [34, 49, 42, 63, 55, 77, 66, 91, 72, 100, 83, 94]

type LiveRoom = {
  id: string
  name: string
  handle: string
  initials: string
  color: string
  title: string
  viewers: number
  image: string
}

const liveRooms: LiveRoom[] = [
  { id: 'bluehour', name: 'Ari Rivera', handle: 'ari.outside', initials: 'AR', color: '#3b73f2', title: 'Blue hour walk, ask me anything', viewers: 1240, image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80' },
  { id: 'studio', name: 'Sofia Kim', handle: 'sofia.draws', initials: 'SK', color: '#7a4fd6', title: 'Sketching the skyline, live', viewers: 860, image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=80' },
  { id: 'kitchen', name: 'Nico Lane', handle: 'nico.lane', initials: 'NL', color: '#d98a1f', title: 'Dinner for six, come hang', viewers: 412, image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80' },
  { id: 'trail', name: 'Jonah Lee', handle: 'jonah.lee', initials: 'JL', color: '#1f9d7a', title: 'Ridge line, golden hour', viewers: 233, image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80' },
]

const liveChatSeed = [
  { id: 1, name: 'sofia.draws', text: 'This view is incredible!' },
  { id: 2, name: 'jonah.lee', text: 'Adding this spot to my list.' },
  { id: 3, name: 'nico.lane', text: 'Stay for the sunset ??' },
  { id: 4, name: 'jules.walker', text: 'What lens are you using?' },
]

const LIVE_GIFTS = [
  { name: 'Rose', emoji: '??', cost: 1 },
  { name: 'Heart', emoji: '??', cost: 5 },
  { name: 'Coffee', emoji: '?', cost: 10 },
  { name: 'Rocket', emoji: '??', cost: 50 },
  { name: 'Crown', emoji: '??', cost: 100 },
]

const LIVE_VIEWERS = [
  { name: 'Lena Park', handle: 'lenapark' },
  { name: 'Jo Reyes', handle: 'joreyes' },
  { name: 'Priya Nair', handle: 'priyan' },
  { name: 'Sam Ortiz', handle: 'samcooks' },
  { name: 'Alex Kim', handle: 'alexkim' },
  { name: 'Noor Ali', handle: 'noorali' },
  { name: 'Theo Brandt', handle: 'theobrandt' },
  { name: 'Mina Cho', handle: 'minacho' },
]

function giftEmoji(name: string) {
  return LIVE_GIFTS.find((gift) => gift.name === name)?.emoji ?? '??'
}

const inboxActivity = [
  { id: 1, name: 'Eddy Hutt', text: 'liked your video �Cabin, no signal�', time: '2m', followBack: false },
  { id: 2, name: 'Lena Park', text: 'started following you', time: '1h', followBack: true },
  { id: 3, name: 'Priya Nair', text: 'commented: �Saving this for the weekend�', time: '3h', followBack: false },
  { id: 4, name: 'Jo Reyes', text: 'mentioned you in a comment', time: 'Yesterday', followBack: false },
]

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

// Build a sound page for a clip whose audio track is not in the sound catalogue
function fallbackSound(clip: Clip): Sound {
  return {
    id: `sound-${clip.id}`,
    title: clip.audio || 'Original audio',
    artist: clip.creator,
    usage: '0:24',
    cover: clip.image,
  }
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

// Verified tick shown next to creator names everywhere (feed, live, messages, stories, profile)
function Verified() {
  return (
    <span className="vb" role="img" aria-label="Verified">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  )
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

/* ============ EMOJI PICKER ============ */
const EMOJI_CATEGORIES = [
  { name: 'Smileys', emojis: ['😀','😃','😄','😝','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😝','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧝','🤓','😎','🤩','🥳','😝','😒','😞','😔','😟','😕','🙝','☹︝','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😝','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤝','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠'] },
  { name: 'People', emojis: ['👋','🤚','🖝︝','✋','🖖','👌','🤝','✌︝','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝︝','👝','👎','✊','👊','🤛','🤜','👝','🙌','👝','🤲','🙝','🤝','👂','👃','🧠','🫀','🫝','🦷','🦴','👀','👝︝','👅','👄','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙝','🙎','🙅','🙆','💝','🙋','🙇','🤦','🤷','🧑”⚕︝','🧑”🎓','🧑”🝫','🧑”⚖︝','🧑”🌾','🧑”🝳','🧑”🔧','🧑”🝭','🧑”💼','🧑”🔬','🧑”💻','🧑”🎤','🧑”🎨','🧑”✈︝','🧑”🚀','🧑”🚒','👮','🕵︝','💂','🥷','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💆','💇','🚶','🝃','💃','🕺','🕴︝','👯','🧖','🧗','🤺','🝇','⛷︝','🝂','🝌︝','🝄','🝊','⛹︝','🝋︝','🚴','🚵','🤸','🤼','🤽','🤾','🤹','🧘','🛀','🛌','🤔','🤥','🤨','😝','😑','😶','😝','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧝','😕','😟','🙝','☹︝','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','😤','😡','😠','🤬','😈','👿','💀','☠︝','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { name: 'Nature', emojis: ['🝶','🝱','🝭','🝹','🝰','🦊','🝻','🝼','🝻”❄︝','🝨','🝯','🦝','🝮','🝷','🝽','🝸','🝵','🙈','🙉','🙊','🝒','🝔','🝧','🝦','🝤','🝣','🝥','🦆','🦅','🦉','🦇','🝺','🝗','🝴','🦄','🝝','🝛','🦋','🝌','🝞','🝜','🪰','🪲','🪳','🦟','🦗','🕷︝','🦂','🦠','💝','🌸','💮','🝵︝','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🪴','🌲','🌳','🌴','🌵','🌾','🌿','☘︝','🝀','🝝','🝂','🝃','🝄','🝇','🝈','🝉','🝊','🝋','🝌','🝝','🥭','🝎','🝝','🝝','🝑','🝒','🝓','🫝','🥝','🝅','🥥','🥑','🝆','🥔','🥕','🌽','🌶︝','🫑','🥒','🥬','🥦','🧄','🧅','🝄','🥜','🫘'] },
  { name: 'Food', emojis: ['🝕','🝔','🝟','🝗','🝖','🥩','🥓','🝞','🥖','🥨','🧀','🥚','🝳','🥘','🝲','🥣','🥗','🝿','🧈','🧂','🥫','🝱','🝘','🝙','🝚','🝛','🝜','🝝','🝠','🝢','🝣','🝤','🝥','🥮','🝡','🥟','🥠','🥡','🝦','🝧','🝨','🝩','🝪','🎂','🝰','🧝','🥧','🝫','🝬','🝭','🝮','🝯','🝼','🥛','☕','🝵','🧃','🥤','🝶','🝺','🝻','🥂','🝷','🥃','🝸','🝹','🧋','🝾','🧊'] },
  { name: 'Activity', emojis: ['⚽','🝀','🝈','⚾','🥎','🎾','🝝','🝉','🥝','🎱','🪀','🝓','🝸','🝒','🝑','🥝','🝝','🪃','🥅','⛳','🪝','🝹','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸︝','🥌','🎿','⛷︝','🝂','🪂','🝋︝','🤼','🤸','⛹︝','🤺','🤾','🝌︝','🝇','🧘','🝄','🝊','🚣','🧗','🚴','🚵','🝎︝','🝝︝','🝝','🎿','🛷','🥌','🎯','🎮','🕹︝','🎰','🎲','🧩','🧸','🪅','🪆','🃝','🀄','🎴','🎭','🖼︝','🎨','🎪','🎟︝','🎫'] },
  { name: 'Travel', emojis: ['🚗','🚕','🚙','🚌','🚎','🝎︝','🝝︝','🛵','🦽','🦼','🛺','🚲','🛴','🛹','🛼','🚝','🛣︝','🛤︝','🛢︝','⛽','🚨','🚥','🚦','🛑','🚧','⚓','⛵','🛶','🚤','🛳︝','⛴︝','🛥︝','🚢','✈︝','🛩︝','🛫','🛬','🪂','💺','🛰︝','🚀','🛸','🛎︝','🧳','🎒','🝝︝','🝖︝','🝜︝','🌋','⛰︝','🝔︝','🗻','🝕︝','⛺','🛖','🝠','🝡','🝘︝','🝚︝','🝗︝','🝭','🝢','🝬','🝣','🝤','🝥','🝦','🝨','🝪','🝫','🝩','💒','🝛︝','⛪','🕌','🕝','🛕','⛩︝','🕋','⛲','⛱︝','🗽','🗼','🝰','🝯','🝟︝','🎡','🎢','🎠','⛱︝','🝖︝','🝝︝','🝞︝','🌅','🌄','🌠','🎆','🎇','🌇','🌆','🌃','🌌','🌉','🌝'] },
  { name: 'Objects', emojis: ['⌚','📱','📲','💻','⌨︝','🖥︝','🖨︝','🖱︝','🖲︝','💽','💾','💿','📀','📷','📸','📹','🎥','📽︝','🎞︝','📞','☎︝','📟','📠','📺','📻','🎙︝','🎚︝','🎛︝','🧭','❱︝','❲︝','❰','🕰︝','⌛','❳','🔋','🔌','💡','🔦','🕯︝','🪔','🧯','🛢︝','💸','💵','💴','💶','💷','🪙','💰','💳','🧾','💹','✉︝','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','📝','📋','📄','📃','📑','📊','📈','📉','📂','📝','🗂︝','📅','📆','🗒︝','🗓︝','📇','📈','📉','📊','📋','📌','📝','📎','🖇︝','📝','📝','✂︝','🗃︝','🗄︝','🗑︝','🔒','🔓','🔝','🔝','🔑','🗝︝','🔨','🪓','⛝︝','⚒︝','🛠︝','🗡︝','⚔︝','💣','🪃','🝹','🛡︝','🪚','🔧','🔩','⚙︝','🗜︝','⚖︝','🦯','🔗','⛓︝','🧰','🧲','🧪','🧫','🧬','🔬','🔭','📡','💉','💊','🩹','🩺','🩻','🚪','🛝︝','🛋︝','🪑','🚽','🪠','🚿','🛝','🪒','🧴','🧷','🧹','🧺','🧻','🧼','🧽','🧯','🛒'] },
  { name: 'Symbols', emojis: ['❤︝','🧡','💛','💚','💙','💜','🖤','🤝','🤎','💔','❣︝','💕','💞','💓','💗','💖','💘','💝','💟','☮︝','✝︝','☪︝','🕉︝','☸︝','✡︝','🔯','🕎','☯︝','☦︝','🛝','⛎','♈','♉','♊','♋','♌','♝','♎','♝','♝','♑','♒','♓','🔯','🆔','⚛︝','🉑','☢︝','☣︝','📴','📳','🈶','🈚','🈸','🈺','🈷︝','✴︝','🆚','💮','🉝','㊗︝','㊙︝','🈳','🈲','🅰︝','🅱︝','🆎','🆑','🅾︝','🆘','🚫','🚷','🚯','🚳','🚭','🚱','🔞','📵','🚸','⛔','✳︝','❌','⭕','🛑','🛝','🛤︝','🛣︝','🗾','🎌','🝳︝','🝴','🝳︝”🌈','🝳︝”⚧︝','🝝','🚩','🝴”☠︝','🇺🇳','🇦🇫','🇦🇽','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇮','🇦🇶','🇦🇬','🇦🇷','🇦🇲','🇦🇼','🇦🇺','🇦🇹','🇦🇿','🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇲','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇮🇴','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇨🇻','🇰🇭','🇨🇲','🇨🇦','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇳','🇨🇽','🇨🇨','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇰','🇨🇷','🇭🇷','🇨🇺','🇨🇼','🇨🇾','🇨🇿','🇨🇮','🇩🇰','🇩🇯','🇩🇲','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇸🇿','🇪🇹','🇫🇰','🇫🇴','🇫🇯','🇫🇮','🇫🇷','🇬🇫','🇵🇫','🇹🇫','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭','🇬🇮','🇬🇷','🇬🇱','🇬🇩','🇬🇵','🇬🇺','🇬🇹','🇬🇬','🇬🇳','🇬🇼','🇬🇾','🇭🇹','🇭🇳','🇭🇰','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇯🇲','🇯🇵','🇯🇪','🇯🇴','🇰🇿','🇰🇪','🇰🇮','🇽🇰','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇮','🇱🇹','🇱🇺','🇲🇴','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇭','🇲🇶','🇲🇷','🇲🇺','🇾🇹','🇲🇽','🇫🇲','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇸','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇷','🇳🇵','🇳🇱','🇳🇨','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇳🇺','🇳🇫','🇲🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇼','🇵🇸','🇵🇦','🇵🇬','🇵🇾','🇵🇪','🇵🇭','🇵🇳','🇵🇱','🇵🇹','🇵🇷','🇶🇦','🇷🇪','🇷🇴','🇷🇸','🇷🇼','🇧🇱','🇸🇭','🇰🇳','🇱🇨','🇵🇲','🇻🇨','🇼🇸','🇸🇲','🇸🇹','🇸🇦','🇸🇳','🇷🇸','🇸🇨','🇸🇱','🇸🇬','🇸🇽','🇸🇰','🇸🇮','🇸🇧','🇸🇴','🇿🇦','🇬🇸','🇸🇸','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇯','🇸🇪','🇨🇭','🇸🇾','🇹🇼','🇹🇯','🇹🇿','🇹🇭','🇹🇱','🇹🇬','🇹🇰','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇹🇨','🇹🇻','🇺🇬','🇺🇦','🇦🇪','🇬🇧','🇺🇸','🇺🇾','🇺🇿','🇻🇺','🇻🇦','🇻🇪','🇻🇳','🇼🇫','🇪🇭','🇾🇪','🇿🇲','🇿🇼'] },
]

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const searchResults = useMemo(() => {
    if (!searchQuery) return null
    return EMOJI_CATEGORIES.flatMap((cat) => cat.emojis).filter((e) => e.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [searchQuery])

  return (
    <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
      <div className="emoji-picker-header">
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="emoji-search"
          autoFocus
        />
        <div className="emoji-tabs" role="tablist">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              role="tab"
              aria-selected={activeCategory === i}
              className={activeCategory === i ? 'active' : ''}
              onClick={() => { setActiveCategory(i); setSearchQuery('') }}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="emoji-grid">
        {searchResults ? (
          searchResults.slice(0, 100).map((emoji) => (
            <button key={emoji} className="emoji-btn" onClick={() => { onSelect(emoji); onClose() }}>{emoji}</button>
          ))
        ) : (
          EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button key={emoji} className="emoji-btn" onClick={() => { onSelect(emoji); onClose() }}>{emoji}</button>
          ))
        )}
      </div>
      <div className="emoji-footer">
        <button className="emoji-close" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}

/* ============ CONVERSATION LIST ============ */
function ConversationList({
  conversations,
  onOpenChat,
  onSearchChange,
  searchQuery,
  onCategoryChange,
  activeCategory,
  onProfileClick,
}: {
  conversations: Conversation[]
  onOpenChat: (c: Conversation) => void
  onSearchChange: (q: string) => void
  searchQuery: string
  onCategoryChange: (cat: ChatCategory) => void
  activeCategory: ChatCategory
  onProfileClick: (c: Conversation, e: React.MouseEvent) => void
}) {
  const categories: { id: ChatCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '💬' },
    { id: 'unread', label: 'Unread', icon: '🔵' },
    { id: 'groups', label: 'Groups', icon: '👥' },
    { id: 'channels', label: 'Channels', icon: '📢' },
  ]

  return (
    <div className="conversation-list">
      <div className="conversation-search">
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
          aria-label="Search conversations"
        />
      </div>
      <div className="conversation-categories" role="tablist" aria-label="Chat categories">
        {categories.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={activeCategory === cat.id}
            className={`category-tab${activeCategory === cat.id ? ' active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-label">{cat.label}</span>
          </button>
        ))}
      </div>
      <div className="conversation-items" role="listbox" aria-label="Conversations">
        {conversations.length === 0 ? (
          <div className="conversation-empty">
            <span className="empty-icon">💬</span>
            <p>No conversations found</p>
            <small>Start a new conversation from the home screen</small>
          </div>
        ) : (
          conversations.map((conv) => (
            <article
              key={conv.id}
              className={`conversation-item${conv.unread ? ' unread' : ''}${conv.pinned ? ' pinned' : ''}${conv.muted ? ' muted' : ''}`}
              role="option"
              onClick={() => onOpenChat(conv)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChat(conv) } }}
              tabIndex={0}
            >
              <button
                className="conversation-avatar"
                onClick={(e) => { e.stopPropagation(); onProfileClick(conv, e) }}
                aria-label={`View ${conv.name}'s profile`}
              >
                {conv.avatar ? (
                  <img src={conv.avatar} alt="" />
                ) : (
                  <span className="avatar-initials">{conv.initials}</span>
                )}
                {conv.online && <span className="online-indicator" aria-label="Online" />}
                {conv.handle === 'group' && <span className="group-badge">👥</span>}
                {conv.handle === 'channel' && <span className="channel-badge">📢</span>}
              </button>
              <div className="conversation-content">
                <div className="conversation-header">
                  <div>
            <strong>{conv.name}{conv.verified && <Verified />}</strong>
                    {conv.pinned && <span className="pin-badge" title="Pinned">📌</span>}
                    {conv.muted && <span className="mute-badge" title="Muted">🔕</span>}
                  </div>
                  <time>{conv.time}</time>
                </div>
                <div className="conversation-preview">
                  <small>{conv.preview}</small>
                  {conv.unread && <span className="unread-badge" aria-label={`${conv.unread} unread messages`}>{conv.unread > 99 ? '99+' : conv.unread}</span>}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

/* ============ CHAT SCREEN ============ */
function ChatScreen({
  conversation,
  messages,
  onClose,
  onSendMessage,
  onProfileClick,
  onAttachmentSelect,
  onEmojiSelect,
  onMuteToggle,
  onThemeChange,
  onMoreAction,
  notify,
  chatDraft,
  setChatDraft,
  showEmojiPicker,
  setShowEmojiPicker,
  showAttachments,
  setShowAttachments,
  showMoreMenu,
  setShowMoreMenu,
  showThemePicker,
  setShowThemePicker,
  chatMuted,
  chatTheme,
  replyingTo,
  setReplyingTo,
  selectedAttachment,
}: {
  conversation: Conversation | null
  messages: Message[]
  onClose: () => void
  onSendMessage: (e: FormEvent) => void
  onProfileClick: (e: React.MouseEvent) => void
  onAttachmentSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEmojiSelect: (emoji: string) => void
  onMuteToggle: () => void
  onThemeChange: (theme: 'default' | 'dark' | 'blue' | 'green' | 'purple') => void
  onMoreAction: (action: string) => void
  notify: (message: string) => void
  chatDraft: string
  setChatDraft: (v: string) => void
  showEmojiPicker: boolean
  setShowEmojiPicker: (v: boolean) => void
  showAttachments: boolean
  setShowAttachments: (v: boolean) => void
  showMoreMenu: boolean
  setShowMoreMenu: (v: boolean) => void
  showThemePicker: boolean
  setShowThemePicker: (v: boolean) => void
  chatMuted: boolean
  chatTheme: 'default' | 'dark' | 'blue' | 'green' | 'purple'
  replyingTo: Message | null
  setReplyingTo: (m: Message | null) => void
  selectedAttachment: File | null
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: Record<string, Message[]> = {}
    msgs.forEach((msg) => {
      const date = new Date(msg.timestamp).toDateString()
      if (!groups[date]) groups[date] = []
      groups[date].push(msg)
    })
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  if (!conversation) return null

  return (
    <div className={`chat-screen theme-${chatTheme}`}>
      <header className="chat-header">
        <button className="chat-back" onClick={onClose} aria-label="Back to conversations">‹</button>
        <button className="chat-avatar" onClick={onProfileClick} aria-label={`View ${conversation.name}'s profile`}>
          {conversation.avatar ? (
            <img src={conversation.avatar} alt="" />
          ) : (
            <span className="avatar-initials">{conversation.initials}</span>
          )}
          {conversation.online && <span className="online-indicator" />}
        </button>
        <div className="chat-info" onClick={onProfileClick}>
          <strong>{conversation.name}{conversation.verified && <Verified />}</strong>
          <small>{conversation.online ? 'Online' : `Last seen ${conversation.time}`}</small>
        </div>
        <div className="chat-actions">
          <button className="chat-action-btn" onClick={(e) => { e.stopPropagation(); onMuteToggle() }} aria-label={chatMuted ? 'Unmute' : 'Mute'} title={chatMuted ? 'Unmute' : 'Mute'}>
            {chatMuted ? '🔊' : '🔕'}
          </button>
          <button className="chat-action-btn" onClick={(e) => { e.stopPropagation(); setShowThemePicker(!showThemePicker) }} aria-label="Theme" title="Theme">
            🎨
          </button>
          <button className="chat-action-btn" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu) }} aria-label="More options" title="More">
            •••
          </button>
        </div>
      </header>

      <div className="chat-messages" role="log" aria-live="polite" aria-label="Messages">
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date} className="message-date-group">
            <div className="date-divider"><span>{date === new Date().toDateString() ? 'Today' : date === new Date(Date.now() - 86400000).toDateString() ? 'Yesterday' : date}</span></div>
            {msgs.map((msg, i) => {
              const isMine = msg.senderId === 'me'
              const showAvatar = !isMine && (i === 0 || msgs[i - 1].senderId !== msg.senderId)
              const showTail = !isMine && (i === msgs.length - 1 || msgs[i + 1].senderId !== msg.senderId)
              return (
                <div
                  key={msg.id}
                  className={`message-bubble${isMine ? ' mine' : ''}${showAvatar ? ' show-avatar' : ''}${showTail ? ' show-tail' : ''}${msg.status === 'sending' ? ' sending' : ''}`}
                >
                  {showAvatar && !isMine && (
                    <button className="message-avatar" onClick={(e) => { e.stopPropagation(); onProfileClick(e) }} aria-label={`View ${msg.senderName}'s profile`}>
                      {msg.senderAvatar ? <img src={msg.senderAvatar} alt="" /> : <span>{msg.senderInitials}</span>}
                    </button>
                  )}
                  <div className="message-content">
                    {msg.replyTo && (
                      <div className="message-reply">
                        <span className="reply-label">Replying to {msg.replyTo.senderName}</span>
                        <span className="reply-text">{msg.replyTo.text.slice(0, 50)}{msg.replyTo.text.length > 50 ? '...' : ''}</span>
                        {msg.replyTo.attachments && <span className="reply-attachment">📎 Attachment</span>}
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="message-attachments">
                        {msg.attachments.map((att) => (
                          <div key={att.id} className={`attachment${att.type === 'image' ? ' image' : att.type === 'video' ? ' video' : ''}`}>
                            {att.type === 'image' && att.url && (
                              <img src={att.url} alt={att.name || 'Image'} onClick={() => window.open(att.url, '_blank')} />
                            )}
                            {att.type === 'video' && att.thumbnail && (
                              <div className="video-attachment" onClick={() => window.open(att.url, '_blank')}>
                                <img src={att.thumbnail} alt={att.name || 'Video'} />
                                <span className="play-overlay">▶</span>
                              </div>
                            )}
                            {(att.type === 'file' || !att.url) && (
                              <div className="file-attachment">
                                <span className="file-icon">{att.type === 'video' ? '🎬' : att.type === 'image' ? '🖼︝' : '📄'}</span>
                                <span className="file-name">{att.name || 'File'}</span>
                                {att.size && <span className="file-size">{(att.size / 1024 / 1024).toFixed(1)} MB</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.text && <div className="message-text">{msg.text}</div>}
                    <div className="message-meta">
                      <time>{formatTime(msg.timestamp)}</time>
                      {isMine && (
                        <span className={`message-status${msg.status === 'read' ? ' read' : msg.status === 'delivered' ? ' delivered' : ''}`}>
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'sent' ? '✓' : '❳'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {replyingTo && (
        <div className="reply-bar">
          <span>Replying to {replyingTo.senderName}</span>
          <span className="reply-preview">{replyingTo.text.slice(0, 40)}...</span>
          <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply">✕</button>
        </div>
      )}

      <form className="chat-composer" onSubmit={onSendMessage}>
        <div className="composer-tools">
          <button type="button" className="composer-btn" onClick={() => { setShowAttachments(!showAttachments); setShowEmojiPicker(false); setShowMoreMenu(false) }} aria-label="Attachments">
            📎
          </button>
          <button type="button" className="composer-btn" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachments(false); setShowMoreMenu(false) }} aria-label="Emojis">
            😀
          </button>
        </div>
        <div className="composer-input-wrapper">
          <input
            type="text"
            placeholder="Message..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            className="composer-input"
            aria-label="Message input"
            disabled={!conversation}
          />
        </div>
        <div className="composer-actions">
          <button type="button" className="composer-btn" onClick={() => { setShowMoreMenu(!showMoreMenu); setShowEmojiPicker(false); setShowAttachments(false) }} aria-label="More">
            +
          </button>
          <button type="submit" className="composer-send" aria-label="Send message" disabled={!chatDraft.trim() && !selectedAttachment}>
            ➤
          </button>
        </div>
      </form>

      {showAttachments && (
        <div className="attachments-panel">
          <div className="attachment-options">
            <label className="attachment-option">
              <input type="file" accept="image/*,video/*" onChange={onAttachmentSelect} hidden ref={fileInputRef} />
              <span className="option-icon">📷</span>
              <span>Photo & Video</span>
            </label>
            <label className="attachment-option">
              <input type="file" accept="*" onChange={onAttachmentSelect} hidden />
              <span className="option-icon">📄</span>
              <span>Document</span>
            </label>
            <button className="attachment-option" onClick={() => notify('Camera coming soon')}>
              <span className="option-icon">📸</span>
              <span>Camera</span>
            </button>
            <button className="attachment-option" onClick={() => notify('Location coming soon')}>
              <span className="option-icon">📝</span>
              <span>Location</span>
            </button>
            <button className="attachment-option" onClick={() => notify('Contact coming soon')}>
              <span className="option-icon">👤</span>
              <span>Contact</span>
            </button>
          </div>
          <button className="attachments-close" onClick={() => setShowAttachments(false)}>✕</button>
        </div>
      )}

      {showEmojiPicker && (
        <EmojiPicker onSelect={onEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
      )}

      {showThemePicker && (
        <div className="theme-picker-panel">
          <div className="theme-options">
            {['default', 'dark', 'blue', 'green', 'purple'].map((theme) => (
              <button
                key={theme}
                className={`theme-option${chatTheme === theme ? ' active' : ''}`}
                onClick={() => { onThemeChange(theme as any); setShowThemePicker(false) }}
              >
                <span className="theme-preview theme-preview-{theme}"></span>
                <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              </button>
            ))}
          </div>
          <button className="theme-picker-close" onClick={() => setShowThemePicker(false)}>✕</button>
        </div>
      )}

      {showMoreMenu && (
        <div className="more-menu-panel">
          <div className="more-options">
            <button onClick={() => { onMoreAction('mute'); setShowMoreMenu(false) }}>
              <span>{chatMuted ? '🔊' : '🔕'}</span>
              <span>{chatMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button onClick={() => { onMoreAction('pin'); setShowMoreMenu(false) }}>
              <span>📌</span>
              <span>Pin conversation</span>
            </button>
            <button onClick={() => { onMoreAction('search'); setShowMoreMenu(false) }}>
              <span>🔝</span>
              <span>Search in chat</span>
            </button>
            <button onClick={() => { onMoreAction('media'); setShowMoreMenu(false) }}>
              <span>🖼︝</span>
              <span>Media, links & docs</span>
            </button>
            <button onClick={() => { onMoreAction('notifications'); setShowMoreMenu(false) }}>
              <span>🔔</span>
              <span>Notification settings</span>
            </button>
            <button onClick={() => { onMoreAction('block'); setShowMoreMenu(false) }} className="destructive">
              <span>🚫</span>
              <span>Block / Report</span>
            </button>
            <button onClick={() => { onMoreAction('delete'); setShowMoreMenu(false) }} className="destructive">
              <span>🗑︝</span>
              <span>Delete chat</span>
            </button>
          </div>
          <button className="more-menu-close" onClick={() => setShowMoreMenu(false)}>✕</button>
        </div>
      )}
    </div>
  )
}

/* ============ PROFILE VIEW ============ */
function ProfileView({
  conversation,
  onClose,
  onMessage,
  onVideoCall,
  onVoiceCall,
  onBlock,
  onReport,
}: {
  conversation: Conversation | null
  onClose: () => void
  onMessage: () => void
  onVideoCall: () => void
  onVoiceCall: () => void
  onBlock: () => void
  onReport: () => void
}) {
  if (!conversation) return null

  return (
    <div className="profile-view">
      <header className="profile-header">
        <button className="profile-back" onClick={onClose} aria-label="Back to chat">‹</button>
        <h1>Profile</h1>
        <button className="profile-more" aria-label="More options">•••</button>
      </header>
      <div className="profile-content">
        <div className="profile-hero">
          <div className="profile-avatar-large">
            {conversation.avatar ? (
              <img src={conversation.avatar} alt="" />
            ) : (
              <span className="avatar-initials-large">{conversation.initials}</span>
            )}
          </div>
          <div className="profile-name-row">
            <h2>{conversation.name}</h2>
            {conversation.verified && <span className="verified-badge">✓</span>}
          </div>
          <p className="profile-handle">{conversation.handle}</p>
          {conversation.online && <p className="profile-status">🟢 Online</p>}
        </div>

        <div className="profile-actions">
          <button className="profile-action-btn primary" onClick={onMessage}>
            <span>💬</span>
            <span>Message</span>
          </button>
          <button className="profile-action-btn" onClick={onVideoCall}>
            <span>📹</span>
            <span>Video Call</span>
          </button>
          <button className="profile-action-btn" onClick={onVoiceCall}>
            <span>📞</span>
            <span>Voice Call</span>
          </button>
        </div>

        <div className="profile-details">
          <div className="detail-section">
            <h3>About</h3>
            <p>Content creator sharing moments and stories. Based in Portland, OR.</p>
          </div>
          <div className="detail-section">
            <h3>Stats</h3>
            <div className="stats-grid">
              <div className="stat"><strong>4.2K</strong><span>Followers</span></div>
              <div className="stat"><strong>612</strong><span>Following</span></div>
              <div className="stat"><strong>82.4K</strong><span>Likes</span></div>
            </div>
          </div>
          <div className="detail-section">
            <h3>Shared Media</h3>
            <div className="shared-media-grid">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className="shared-media-item">
                  <img src={`https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=200&q=80&sig=${i}`} alt="Shared media" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="profile-danger">
          <button className="danger-btn" onClick={onBlock}>Block User</button>
          <button className="danger-btn" onClick={onReport}>Report User</button>
        </div>
      </div>
    </div>
  )
}

/* ============ SOUND DETAIL MODAL ============ */
function SoundDetailModal({ 
  sound, 
  open, 
  onClose, 
  onUseSound,
  clips,
  formatCount,
  scrollToVideo,
  setScreen,
  notify,
}: { 
  sound: Sound | null; 
  open: boolean; 
  onClose: () => void; 
  onUseSound: () => void;
  clips: Clip[];
  formatCount: (n: number) => string;
  scrollToVideo: (index: number) => void;
  setScreen: (screen: ScreenId) => void;
  notify: (msg: string) => void;
}) {
  if (!sound || !open) return null

  const soundVideos = (() => {
    const matches = clips.filter((clip) => clip.audio.toLowerCase().includes(sound.title.toLowerCase()))
    if (matches.length > 0) return matches
    // Always show something: fall back to the rest of the feed
    return clips.slice(0, 8)
  })()

  return (
    <Modal open={open} onClose={onClose} labelledBy="sound-detail-title" className="sound-detail-card">
      <ModalHead title={sound.title} subtitle={sound.artist} onClose={onClose} />
      <div className="sound-detail-content">
        <div className="sound-detail-header">
          {sound.cover && <img src={sound.cover} alt={sound.title} className="sound-detail-cover" />}
          <div className="sound-detail-info">
            <h3>{sound.title}</h3>
            <p>{sound.artist} · {sound.usage}</p>
            <div className="sound-detail-actions">
              <button className="primary-button" onClick={onUseSound}>Use this sound</button>
              <button className="secondary-button" onClick={() => notify('Added to favorites')}>♡ Save</button>
              <button className="secondary-button" onClick={() => notify('Share link copied')}>↗ Share</button>
            </div>
          </div>
        </div>
        <div className="sound-detail-videos">
          <h4>{soundVideos.length} videos</h4>
          {soundVideos.length === 0 ? (
            <p className="panel-note">No videos using this sound yet.</p>
          ) : (
            <div className="sound-video-grid">
              {soundVideos.map((clip) => (
                <button key={clip.id} className="sound-video-card" onClick={() => { onClose(); scrollToVideo(clips.findIndex((c) => c.id === clip.id)); setScreen('home') }}>
                  {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline crossOrigin="anonymous" onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', clip.videoSrc)} /> : <img src={clip.image} alt={clip.imageAlt} />}
                  <div className="sound-video-overlay">
                    <span>▶ {formatCount(clip.likes)}</span>
                    <span>💬 {formatCount(clip.comments)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ============ HASHTAG MODAL ============ */
function HashtagModal({ 
  hashtag, 
  open, 
  onClose,
  clips,
  formatCount,
  scrollToVideo,
  setScreen,
}: { 
  hashtag: Hashtag | null; 
  open: boolean; 
  onClose: () => void;
  clips: Clip[];
  formatCount: (n: number) => string;
  scrollToVideo: (index: number) => void;
  setScreen: (screen: ScreenId) => void;
}) {
  if (!hashtag || !open) return null

  const hashtagVideos = clips.filter((clip) => clip.tags.toLowerCase().includes(hashtag.tag.toLowerCase()))

  return (
    <Modal open={open} onClose={onClose} labelledBy="hashtag-title" className="hashtag-card">
      <ModalHead title={hashtag.tag} subtitle={`${formatCount(hashtag.count)} videos · ${hashtag.growth || ''}`} onClose={onClose} />
      <div className="hashtag-content">
        <div className="hashtag-tabs" role="tablist">
          <button role="tab" className="active">Videos</button>
          <button role="tab">Top</button>
          <button role="tab">Live</button>
          <button role="tab">Sounds</button>
          <button role="tab">People</button>
        </div>
        <div className="hashtag-videos">
          {hashtagVideos.length === 0 ? (
            <p className="panel-note">No videos with this hashtag yet.</p>
          ) : (
            <div className="hashtag-video-grid">
              {hashtagVideos.map((clip) => (
                <button key={clip.id} className="hashtag-video-card" onClick={() => { onClose(); scrollToVideo(clips.findIndex((c) => c.id === clip.id)); setScreen('home') }}>
                  {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline crossOrigin="anonymous" onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', clip.videoSrc)} /> : <img src={clip.image} alt={clip.imageAlt} />}
                  <div className="hashtag-video-overlay">
                    <span>▶ {formatCount(clip.likes)}</span>
                    <span>💬 {formatCount(clip.comments)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ============ EFFECT PICKER ============ */
function EffectPicker({ 
  activeEffect, 
  onSelectEffect, 
  onClose,
  videoEffects,
}: { 
  activeEffect: VideoEffect | null; 
  onSelectEffect: (effect: VideoEffect) => void; 
  onClose: () => void;
  videoEffects: VideoEffect[];
}) {
  const categories = ['visual', 'beauty', 'fun', 'transition', 'green-screen'] as const
  const [activeCategory, setActiveCategory] = useState<'visual' | 'beauty' | 'fun' | 'transition' | 'green-screen'>('visual')

  const categoryEffects = videoEffects.filter((e) => e.category === activeCategory)

  return (
    <div className="effect-picker" role="dialog" aria-label="Video effects">
      <div className="effect-picker-header">
        <h3>Effects</h3>
        <button className="effect-close" onClick={onClose}>✕</button>
      </div>
      <div className="effect-categories" role="tablist">
        {categories.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeCategory === cat}
            className={activeCategory === cat ? 'active' : ''}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>
      <div className="effect-grid">
        {categoryEffects.map((effect) => (
          <button
            key={effect.id}
            className={`effect-btn${activeEffect?.id === effect.id ? ' active' : ''}`}
            onClick={() => { onSelectEffect(effect); onClose() }}
          >
            <span className="effect-icon">{effect.icon}</span>
            <span className="effect-name">{effect.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ============ BLOCKED USERS MODAL ============ */
function BlockedUsersModal({ blockedUsers, open, onClose, onUnblock }: { blockedUsers: BlockedUser[]; open: boolean; onClose: () => void; onUnblock: (userId: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="blocked-title" className="blocked-card">
      <ModalHead title="Blocked accounts" subtitle={`${blockedUsers.length} blocked`} onClose={onClose} />
      <div className="blocked-list">
        {blockedUsers.length === 0 ? (
          <p className="panel-note">You haven't blocked anyone yet.</p>
        ) : (
          blockedUsers.map((user) => (
            <div key={user.id} className="blocked-row">
              <Avatar initials={user.initials} src={user.avatar} />
              <div>
                <b>{user.name}</b>
                <small>{user.handle} · Blocked {user.blockedAt}</small>
              </div>
              <button className="secondary-button" onClick={() => onUnblock(user.id)}>Unblock</button>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}


/* ============ LIVE STREAM MODAL ============ */
/* ============ COMMENTS SHEET (preview parity) ============ */
type SheetComment = {
  id: number
  name: string
  text: string
  time: string
  likes: number
  liked?: boolean
  fresh?: boolean
  sticker?: string
  open?: boolean
  replies: SheetComment[]
}

const COMMENT_STICKERS = ['??', '??', '??', '??', '?', '??', '??', '??', '??', '??', '??', '??']

const COMMENT_POOL: Array<{ name: string; text: string }> = [
  { name: 'Jo Reyes', text: 'this made my day' },
  { name: 'Priya Nair', text: 'Okay but where is this?? ??' },
  { name: 'Sam Ortiz', text: 'the colors are unreal' },
  { name: 'Lena Park', text: 'sending this to everyone I know' },
  { name: 'Alex Kim', text: 'first time here and I am staying' },
  { name: 'Noor Ali', text: 'the light!! ??' },
]

const COMMENT_PEOPLE = [
  { handle: 'lenapark', name: 'Lena Park' },
  { handle: 'joreyes', name: 'Jo Reyes' },
  { handle: 'priyan', name: 'Priya Nair' },
  { handle: 'samcooks', name: 'Sam Ortiz' },
  { handle: 'mayamakes', name: 'Maya Chen' },
  { handle: 'eddyhutt', name: 'Eddy Hutt' },
]

function seedComments(creator: string): SheetComment[] {
  return [
    {
      id: 1,
      name: 'Lena Park',
      text: 'That light is unreal ??',
      time: '12m',
      likes: 148,
      open: false,
      replies: [
        { id: 2, name: creator, text: '@lenapark thank you!! it only lasted ten minutes', time: '9m', likes: 36, replies: [] },
        { id: 3, name: 'Jo Reyes', text: 'ten minutes well spent', time: '6m', likes: 12, replies: [] },
      ],
    },
    {
      id: 4,
      name: 'Jo Reyes',
      text: 'Where is this?',
      time: '40m',
      likes: 21,
      open: false,
      replies: [
        { id: 5, name: 'Priya Nair', text: '@joreyes looks like the coast to me', time: '31m', likes: 5, replies: [] },
      ],
    },
    { id: 6, name: 'Priya Nair', text: 'Saving this for the weekend', time: '1h', likes: 64, replies: [] },
    { id: 7, name: 'Sam Ortiz', text: '', time: '1h', likes: 9, sticker: '??', replies: [] },
  ]
}

function CommentsSheet({
  clip,
  open,
  onClose,
}: {
  clip: Clip | null
  open: boolean
  onClose: () => void
}) {
  const [comments, setComments] = useState<SheetComment[]>(() => (clip ? seedComments(clip.creator) : []))
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [typing, setTyping] = useState('')
  const [watchers, setWatchers] = useState(248)
  const [nextId, setNextId] = useState(100)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !clip) return
    setComments(seedComments(clip.creator))
    setDraft('')
    setReplyTo(null)
    setStickerOpen(false)
    setTyping('')
    setWatchers(200 + Math.floor(Math.random() * 120))
  }, [clip?.id, clip?.creator, open])

  // Simulated live activity while the sheet is open
  useEffect(() => {
    if (!open || !clip) return
    let alive = true
    let typingTimer = 0
    let postTimer = 0

    const tick = () => {
      if (!alive) return
      const person = COMMENT_POOL[Math.floor(Math.random() * COMMENT_POOL.length)]
      setTyping(`${person.name.split(' ')[0]} is typing�`)
      typingTimer = window.setTimeout(() => {
        if (!alive) return
        setTyping('')
        setComments((current) => [
          { id: Date.now(), name: person.name, text: person.text, time: 'now', likes: 0, fresh: true, replies: [] },
          ...current,
        ])
        postTimer = window.setTimeout(tick, 5200)
      }, 1500)
    }

    const first = window.setTimeout(tick, 2600)
    const watch = window.setInterval(() => {
      setWatchers((value) => Math.max(120, value + Math.round(Math.random() * 8 - 3)))
    }, 2400)

    return () => {
      alive = false
      window.clearTimeout(first)
      window.clearTimeout(typingTimer)
      window.clearTimeout(postTimer)
      window.clearInterval(watch)
    }
  }, [open])

  const total = (clip?.comments ?? 0) + comments.filter((comment) => comment.fresh).length

  const post = (text: string, sticker?: string) => {
    const body = text.trim()
    if (!body && !sticker) return
    const comment: SheetComment = {
      id: nextId,
      name: 'You',
      text: replyTo ? body : body,
      time: 'now',
      likes: 0,
      fresh: true,
      sticker,
      replies: [],
    }
    setNextId((value) => value + 1)
    if (replyTo) {
      setComments((current) =>
        current.map((item) =>
          item.id === replyTo ? { ...item, open: true, replies: [...item.replies, comment] } : item,
        ),
      )
      setReplyTo(null)
    } else {
      setComments((current) => [comment, ...current])
    }
    setDraft('')
    setStickerOpen(false)
  }

  const toggleLike = (id: number) => {
    setComments((current) =>
      current.map((comment) => {
        if (comment.id === id) {
          return { ...comment, liked: !comment.liked, likes: comment.likes + (comment.liked ? -1 : 1) }
        }
        return {
          ...comment,
          replies: comment.replies.map((reply) =>
            reply.id === id ? { ...reply, liked: !reply.liked, likes: reply.likes + (reply.liked ? -1 : 1) } : reply,
          ),
        }
      }),
    )
  }

  const suggestions = (() => {
    const match = /@(\w*)$/.exec(draft)
    if (!match) return []
    const query = match[1].toLowerCase()
    return COMMENT_PEOPLE.filter((person) => person.handle.startsWith(query) || person.name.toLowerCase().startsWith(query)).slice(0, 4)
  })()

  const renderRow = (comment: SheetComment, top: boolean) => (
    <div className={`cm${top ? '' : ' rep'}${comment.fresh ? ' new' : ''}`} key={`${top ? 't' : 'r'}-${comment.id}`}>
      <Avatar initials={initialsOf(comment.name)} size={top ? 36 : 28} />
      <div className="cb">
        <div>
          <b>{comment.name}</b>
          {comment.name === clip?.creator && <span className="crt">Creator</span>}
          <small>{comment.time}</small>
        </div>
        {comment.sticker ? <div className="cst">{comment.sticker}</div> : <p>{comment.text}</p>}
        <div className="cact">
          <button
            type="button"
            className={comment.liked ? 'on' : ''}
            aria-pressed={!!comment.liked}
            aria-label={`Like comment by ${comment.name}`}
            onClick={() => toggleLike(comment.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill={comment.liked ? 'currentColor' : 'none'}><path d="M12 20.5S3.5 15 3.5 9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5z" /></svg>
            {formatCount(comment.likes)}
          </button>
          <button
            type="button"
            onClick={() => {
              setReplyTo(comment.id)
              const handle = COMMENT_PEOPLE.find((p) => p.name === comment.name)?.handle ?? comment.name.toLowerCase().replace(/\s+/g, '')
              setDraft(`@${handle} `)
              inputRef.current?.focus()
            }}
          >
            Reply
          </button>
        </div>
        {top && comment.replies.length > 0 && (
          <button
            type="button"
            className="vr"
            onClick={() =>
              setComments((current) =>
                current.map((item) => (item.id === comment.id ? { ...item, open: !item.open } : item)),
              )
            }
          >
            {comment.open ? 'Hide replies' : `View ${comment.replies.length} ${comment.replies.length > 1 ? 'replies' : 'reply'}`}
          </button>
        )}
        {top && comment.open && comment.replies.map((reply) => renderRow(reply, false))}
      </div>
    </div>
  )

  if (!open || !clip) return null

  return (
    <div className="sheet open" role="dialog" aria-modal="true" aria-label="Comments">
      <div className="scrim" onClick={onClose} />
      <div className="panel big">
        <div className="grab" />
        <div className="chead">
          <div>
            <b>{formatCount(total)} comments</b>
            <div className="lv">
              <span className="dot" aria-hidden="true" />
              <span>{formatCount(watchers)}</span>&nbsp;watching now
            </div>
          </div>
          <button type="button" className="ib" onClick={onClose} aria-label="Close comments">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="clist">
          {comments.map((comment) => renderRow(comment, true))}
        </div>

        <div className="typ" aria-live="polite">{typing}</div>

        {suggestions.length > 0 && (
          <div className="sug open">
            {suggestions.map((person) => (
              <button
                key={person.handle}
                type="button"
                onClick={() => {
                  setDraft((value) => value.replace(/@(\w*)$/, `@${person.handle} `))
                  inputRef.current?.focus()
                }}
              >
                <Avatar initials={initialsOf(person.name)} size={30} />
                <span>
                  <b>{person.name}</b> <small>@{person.handle}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {stickerOpen && (
          <div className="stk open">
            {COMMENT_STICKERS.map((sticker) => (
              <button key={sticker} type="button" onClick={() => post('', sticker)} aria-label={`Send ${sticker}`}>
                {sticker}
              </button>
            ))}
          </div>
        )}

        {replyTo && (
          <div className="rto open">
            <span>Replying to a comment</span>
            <button type="button" onClick={() => { setReplyTo(null); setDraft('') }} aria-label="Cancel reply">?</button>
          </div>
        )}

        <form
          className="cin"
          onSubmit={(event) => {
            event.preventDefault()
            post(draft)
          }}
        >
          <button type="button" className="ib" onClick={() => setStickerOpen((value) => !value)} aria-label="Stickers" aria-pressed={stickerOpen}>
            ??
          </button>
          <button
            type="button"
            className="ib"
            onClick={() => {
              setDraft((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@`)
              inputRef.current?.focus()
            }}
            aria-label="Tag someone"
          >
            @
          </button>
          <input
            ref={inputRef}
            placeholder="Add a comment"
            aria-label="Add a comment"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn">Post</button>
        </form>
      </div>
    </div>
  )
}
function LiveStreamModal({ open, onClose, onGoLive, isLive, streamTitle, setStreamTitle, streamTags, setStreamTags, notify }: { open: boolean; onClose: () => void; onGoLive: () => void; isLive: boolean; streamTitle: string; setStreamTitle: (v: string) => void; streamTags: string; setStreamTags: (v: string) => void; notify: (msg: string) => void }) {
  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} labelledBy="live-title" className="live-modal-card">
      <ModalHead title={isLive ? 'Live now' : 'Go live'} subtitle={isLive ? 'You are live to your followers' : 'Start a live stream'} onClose={onClose} />
      <div className="live-modal-content">
        {isLive ? (
          <div className="live-active">
            <div className="live-preview">
              <video muted playsInline style={{ width: '100%', aspectRatio: '9/16', background: '#000', borderRadius: 12 }} />
              <div className="live-overlay-stats">
                <span>👝︝ 0 viewers</span>
                <span>❱︝ 0:00</span>
                <span>💬 0 comments</span>
              </div>
            </div>
            <div className="live-chat-preview">
              <h4>Live chat</h4>
              <div className="live-chat-messages">
                <p className="panel-note">No messages yet</p>
              </div>
            </div>
            <div className="live-actions">
              <button className="danger-btn" onClick={() => notify('Ending live stream...')}>End live</button>
            </div>
          </div>
        ) : (
          <div className="live-setup">
            <div className="live-preview-placeholder">
              <div className="camera-preview">📷 Camera preview</div>
            </div>
            <label className="field">Title<input value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} placeholder="What's happening?" maxLength={60} /></label>
            <label className="field">Tags (optional)<input value={streamTags} onChange={(e) => setStreamTags(e.target.value)} placeholder="#live #qna #music" /></label>
            <div className="live-options">
              <label className="switch-row"><span>Allow comments</span><button className="switch" /></label>
              <label className="switch-row"><span>Allow gifts</span><button className="switch" /></label>
              <label className="switch-row"><span>Followers only</span><button className="switch" /></label>
            </div>
            <button className="primary-button live-go-btn" onClick={onGoLive}>Go live</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ============ DUET/STITCH MODAL ============ */
function DuetStitchModal({ clip, open, onClose, onConfirm, remixType, setRemixType }: { clip: Clip | null; open: boolean; onClose: () => void; onConfirm: (type: 'duet' | 'stitch') => void; remixType: 'duet' | 'stitch'; setRemixType: (t: 'duet' | 'stitch') => void }) {
  if (!clip || !open) return null

  return (
    <Modal open={open} onClose={onClose} labelledBy="remix-title" className="remix-card">
      <ModalHead title="Create with this video" subtitle={`Duet or Stitch with ${clip.creator}`} onClose={onClose} />
      <div className="remix-content">
        <div className="remix-options">
          <button className={`remix-option${remixType === 'duet' ? ' active' : ''}`} onClick={() => setRemixType('duet')}>
            <div className="remix-icon">↔︝</div>
            <div>
              <b>Duet</b>
              <small>Record side-by-side</small>
            </div>
          </button>
          <button className={`remix-option${remixType === 'stitch' ? ' active' : ''}`} onClick={() => setRemixType('stitch')}>
            <div className="remix-icon">✂︝</div>
            <div>
              <b>Stitch</b>
              <small>Clip and add to your video</small>
            </div>
          </button>
        </div>
        <div className="remix-preview">
          {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline controls crossOrigin="anonymous" onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', clip.videoSrc)} /> : <img src={clip.image} alt={clip.imageAlt} />}
        </div>
        <button className="primary-button" onClick={() => { onConfirm(remixType); onClose() }}>Use this video</button>
      </div>
    </Modal>
  )
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
  saved = false,
  onRepost,
  isPlaying,
  onPlayingChange,
  onOpenSoundDetail,
  onOpenHashtag,
  onOpenDuetStitch,
  onDelete,
  onStory,
  onCopyLink,
  onReport,
  reposted = false,
  following = false,
  onFollow,
  accountHandle,
  onMutedChange,
}: {
  clip: Clip
  isActive: boolean
  isMuted: boolean
  liked: boolean
  onLike: () => void
  onComments: () => void
  onShare: () => void
  onSave: () => void
  saved?: boolean
  onRepost: (clip: Clip) => void
  isPlaying: boolean
  onPlayingChange: (playing: boolean) => void
  onOpenSoundDetail: (sound: Sound) => void
  onOpenHashtag: (hashtag: Hashtag) => void
  onOpenDuetStitch: (clip: Clip) => void
  onDelete: (clip: Clip) => void
  onStory: (clip: Clip) => void
  onCopyLink: (clip: Clip) => void
  onReport: (clip: Clip) => void
  reposted?: boolean
  following?: boolean
  onFollow: (clip: Clip) => void
  accountHandle: string
  notify: (msg: string) => void
  onMutedChange?: (muted: boolean) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const paused = !isPlaying
  const [progressPercent, setProgressPercent] = useState(0)
  const [heartAnim, setHeartAnim] = useState(false)
  const lastClickRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [longPressMenuPos, setLongPressMenuPos] = useState<{x: number, y: number} | null>(null)

  // Long press handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, .action-button, .feed-mode-tabs, .sound-disc')) return
    setLongPressMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, .action-button, .feed-mode-tabs, .sound-disc')) return
    longPressTimerRef.current = setTimeout(() => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      setLongPressMenuPos({ x: clientX, y: clientY })
    }, 500)
  }, [])

  const handleMouseUp = useCallback((_e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleMouseLeave = useCallback((_e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleMouseDown(e)
  }, [handleMouseDown])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    handleMouseUp(e)
  }, [handleMouseUp])

  const handleTouchCancel = useCallback((e: React.TouchEvent) => {
    handleMouseLeave(e)
  }, [handleMouseLeave])

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
      className={`card${paused ? ' paused' : ''}${isActive ? ' active-stage' : ''}`}
      data-video-id={clip.id}
      onClick={handleStageClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {clip.videoSrc ? (
        <video
          ref={videoRef}
          src={clip.videoSrc}
          poster={clip.image}
          muted={isMuted}
          playsInline
          loop
          crossOrigin="anonymous"
          autoPlay
          className="sc"
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', clip.videoSrc)}
        />
      ) : (
        <img className="sc" src={clip.image} alt={clip.imageAlt} />
      )}

      {/* Floating double-tap heart animation */}
      {heartAnim && <div className="heart-pulse-anim" aria-hidden="true">♥</div>}

      <div className="shade" />

      {/* Right-side TikTok action rail */}
      <div className="rail" onClick={(e) => e.stopPropagation()}>
        <button className="act" data-k="like" aria-pressed={liked} aria-label="Like video" onClick={onLike}>
          <span className="ib glass">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5z" /></svg>
          </span>
          <span>{formatCount(clip.likes + (liked ? 1 : 0))}</span>
        </button>
        <button className="act" aria-label="View comments" onClick={onComments}>
          <span className="ib glass">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
          </span>
          <span>{formatCount(clip.comments)}</span>
        </button>
        <button className="act" data-k="save" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save video'} onClick={onSave}>
          <span className="ib glass">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z" /></svg>
          </span>
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
        <button className="act" aria-label="Share video" onClick={onShare}>
          <span className="ib glass">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12v7h14v-7M12 15V3M8 7l4-4 4 4" /></svg>
          </span>
          <span>Share</span>
        </button>
        <button className="act" aria-label={isMuted ? 'Unmute' : 'Mute'} onClick={() => { if (onMutedChange) onMutedChange(!isMuted); }}>
          <span className="ib glass">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10v4h3l4 3V7L7 10z" />
              {isMuted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </span>
          <span>{isMuted ? 'Muted' : 'Sound'}</span>
        </button>
        {/* Rotating sound disc */}
        <div
          className={`disc${paused || !isActive ? ' paused' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            const sound = sounds.find((s) => clip.audio.includes(s.title)) ?? fallbackSound(clip)
            onOpenSoundDetail(sound)
          }}
          title={clip.audio}
          role="img"
          aria-label="Sound track"
        />
      </div>

      {/* Bottom video details */}
      <div className="info">
        {reposted && (
          <div className="rp">
            <span className="ib glass" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></svg>
            </span>
            <span>{clip.repostedFrom ? 'Reposted' : 'You reposted'}</span>
          </div>
        )}
        <div className="who row">
          <span className="avw">
            <Avatar initials={clip.initials} src={clip.avatarUrl} />
            {following ? (
              <span className="fplus done" role="img" aria-label="Following">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
            ) : (
              <button
                type="button"
                className="fplus"
                aria-label={`Follow ${clip.creator}`}
                onClick={(event) => { event.stopPropagation(); onFollow(clip) }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>
              {clip.creator}
              {clip.verified && <Verified />}
            </b>
            <span>
              {clip.repostedFrom
                ? `Reposted${clip.originalHandle ? ' from @' + clip.originalHandle : ''}`
                : `@${clip.handle.replace(/^@/, '')} � 18 min ago`}
            </span>
          </div>
        </div>
        <p>
          {clip.caption.split(' ').map((word) => {
            if (word.startsWith('#')) {
              const tag = hashtags.find((h) => h.tag.toLowerCase() === word.toLowerCase())
              return tag ? <button key={word} className="tag" onClick={(e) => { e.stopPropagation(); onOpenHashtag(tag) }}>{word} </button> : <span key={word}>{word} </span>
            }
            if (word.startsWith('@')) {
              return <span key={word} className="mention-link">{word} </span>
            }
            return <span key={word}>{word} </span>
          })}
        </p>
        <div className="tags">
          {clip.tags.split(' ').map((tag) => {
            const hashtag = hashtags.find((h) => h.tag.toLowerCase() === tag.toLowerCase())
            return hashtag ? <button key={tag} className="tag" onClick={(e) => { e.stopPropagation(); onOpenHashtag(hashtag) }}>{tag} </button> : <span key={tag}>{tag} </span>
          })}
        </div>
        <button
          className="aud glass"
          onClick={(e) => {
            e.stopPropagation()
            const sound = sounds.find((s) => clip.audio.includes(s.title)) ?? fallbackSound(clip)
            onOpenSoundDetail(sound)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></svg>
          {clip.audio}
        </button>
      </div>

      {/* Scrub / progress bar */}
      <div className="bar">
        <i style={{ width: `${progressPercent}%`, transition: clip.videoSrc ? 'width 0.1s linear' : 'none' }} />
      </div>

      <button className="pause" aria-hidden="true" tabIndex={-1}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
      </button>
      <LongPressMenu
        clip={clip}
        position={longPressMenuPos}
        onClose={() => setLongPressMenuPos(null)}
        onRepost={onRepost}
        onDuet={onOpenDuetStitch}
        onStitch={onOpenDuetStitch}
        onShare={onShare}
        onSave={onSave}
        onDelete={clip.handle === accountHandle ? onDelete : undefined}
        onStory={onStory}
        onCopyLink={onCopyLink}
        onReport={onReport}
      />
    </article>
  )
}

/* ============ LONG PRESS MENU ============ */
function LongPressMenu({ 
  clip, 
  position, 
  onClose, 
  onRepost, 
  onDuet, 
  onStitch,
  onShare,
  onSave,
  onDelete,
  onStory,
  onCopyLink,
  onReport
}: { 
  clip: Clip
  position: { x: number; y: number } | null
  onClose: () => void
  onRepost: (clip: Clip) => void
  onDuet: (clip: Clip) => void
  onStitch: (clip: Clip) => void
  onShare: () => void
  onSave: () => void
  onDelete?: (clip: Clip) => void
  onStory: (clip: Clip) => void
  onCopyLink: (clip: Clip) => void
  onReport: (clip: Clip) => void
}) {
  if (!position) return null

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.long-press-menu')) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      <div className="sheet open" role="dialog" aria-modal="true" aria-label="Video actions">
        <div className="scrim" onClick={onClose} />
        <div className="panel">
          <div className="grab" />
          <div className="chead">
            <div>
              <b>Video options</b>
              <div className="lv">@{clip.handle}</div>
            </div>
            <button type="button" className="ib" onClick={onClose} aria-label="Close menu">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <button type="button" className="mi" onClick={() => { onRepost(clip); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></svg>
            <span>Repost</span>
          </button>
          <button type="button" className="mi" onClick={() => { onStory(clip); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
            <span>Add to story</span>
          </button>
          <button type="button" className="mi" onClick={() => { onDuet(clip); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="8" height="12" rx="2" /><rect x="13" y="6" width="8" height="12" rx="2" /></svg>
            <span>Duet</span>
          </button>
          <button type="button" className="mi" onClick={() => { onStitch(clip); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 8l12 8M8 16L20 8" /></svg>
            <span>Stitch</span>
          </button>
          <button type="button" className="mi" onClick={() => { onSave(); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z" /></svg>
            <span>Save video</span>
          </button>
          <button type="button" className="mi" onClick={() => { onShare(); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12v7h14v-7M12 15V3M8 7l4-4 4 4" /></svg>
            <span>Share to other app</span>
          </button>
          <button type="button" className="mi" onClick={() => { onCopyLink(clip); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
            <span>Copy link</span>
          </button>
          <button type="button" className="mi bad" onClick={() => { onReport(clip); onClose() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg>
            <span>Report</span>
          </button>
          {onDelete ? (
            <button type="button" className="mi bad" onClick={() => { if (confirm('Delete this video?')) { onDelete(clip); onClose() } }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></svg>
              <span>Delete</span>
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

/* ============ PROFILE VIDEO PLAYER ============ */
function ProfileVideoPlayer({ clip, onClose, onDelete }: { clip: Clip; onClose: () => void; onDelete: (clip: Clip) => void }) {
  const [muted, setMuted] = useState(true)
  return (
    <div className="modal-layer open" onClick={onClose}>
      <section className="modal-card profile-video-player" role="dialog" aria-modal="true" aria-label="Video player" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>{clip.caption.slice(0, 50)}</h2>
            <small>@{clip.handle}</small>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close video">×</button>
        </header>
        <div className="profile-video-content">
          {clip.videoSrc ? (
            <video src={clip.videoSrc} muted={muted} playsInline controls crossOrigin="anonymous" onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', clip.videoSrc)} style={{ width: '100%', aspectRatio: '9/16', background: '#000', borderRadius: 8 }} />
          ) : (
            <img src={clip.image} alt={clip.imageAlt} style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 8 }} />
          )}
          <div className="profile-video-actions">
            <button className="secondary-button" onClick={() => setMuted(!muted)}>{muted ? '🔇' : '🔊'}</button>
            <button className="primary-button" onClick={() => { if (confirm('Delete this video?')) { onDelete(clip); onClose() } }}>🗑 Delete</button>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Owner panel (hidden from regular users)                             */
/* ------------------------------------------------------------------ */

function OwnerPanel({ notify, refreshProfile, clips }: { notify: (message: string) => void; refreshProfile?: () => void; clips: Clip[] }) {
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
        .select('id, caption, status, created_at, storage_path, user_id, profiles:user_id(display_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (videoError) throw videoError
      const rows = (videoData ?? []) as unknown as Array<Record<string, unknown> & { profiles?: { display_name?: string } | { display_name?: string }[] }>
      const supabaseVideos = rows.map((row) => {
        const storagePath = row.storage_path as string
        const videoUrl = supabase ? supabase.storage.from('arc-videos').getPublicUrl(storagePath).data.publicUrl : ''
        return {
          id: row.id as string,
          caption: row.caption as string | null,
          status: row.status as string | null,
          created_at: row.created_at as string | null,
          video_url: videoUrl,
          owner_id: row.user_id as string | null,
          ownerName: Array.isArray(row.profiles) ? row.profiles[0]?.display_name ?? '' : row.profiles?.display_name ?? '',
        }
      })

      // Convert local clips to AdminVideo format and merge with Supabase videos
      const localVideos: AdminVideo[] = clips
        .filter((clip) => clip.videoSrc && clip.ownerId)
        .map((clip) => ({
          id: clip.id,
          caption: clip.caption,
          status: 'published',
          created_at: new Date().toISOString(),
          video_url: clip.videoSrc ?? '',
          owner_id: clip.ownerId ?? null,
          ownerName: clip.creator,
        }))

      // Merge, avoiding duplicates by id
      const allVideos = [...supabaseVideos]
      for (const lv of localVideos) {
        if (!allVideos.some((sv) => sv.id === lv.id)) {
          allVideos.push(lv)
        }
      }
      setVideos(allVideos.sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()))
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
        <span><b>{user.display_name || user.username || "�"}{user.verified && <Verified />}</b><small>@{user.username || "unset"}</small></span>
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
                ? <video src={video.video_url} muted playsInline crossOrigin="anonymous" onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', video.video_url)} />
                : <span className="owner-video-blank">No file</span>}
              <span className="owner-video-meta">
                <b>{video.ownerName || 'Unknown'} · {video.status ?? 'published'}</b>
                <small>{video.caption || '(no caption)'} — {video.created_at ? new Date(video.created_at).toLocaleString() : ''}</small>
              </span>
              <button className="pill on-red" disabled={busyId === video.id} onClick={() => { if (confirm('Delete this video?')) removeVideo(video) }}>{busyId === video.id ? 'Removing…' : 'Delete'}</button>
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
  const [showAuthOnFirstVisit, setShowAuthOnFirstVisit] = useState(true)

  useEffect(() => {
    const hasSeenAuth = localStorage.getItem('hasSeenAuth')
    if (!hasSeenAuth && !session) {
      setShowAuthOnFirstVisit(true)
    } else {
      setShowAuthOnFirstVisit(false)
    }
  }, [session])

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
  const [clips, setClips] = useState<Clip[]>([])
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [profileTab, setProfileTab] = useState<'videos' | 'reposts' | 'liked' | 'saved' | 'collections'>('videos')
  const [followedHandles, setFollowedHandles] = useState<Set<string>>(new Set())
  const [homeFeedTab, setHomeFeedTab] = useState<'following' | 'for-you' | 'live'>('for-you')
  const [discoverChip, setDiscoverChip] = useState('For you')
  const visibleDiscoverCards = useMemo(
    () => (discoverChip === 'For you'
      ? discoverCards
      : discoverCards.filter((card) => `${card.meta} ${card.alt}`.toLowerCase().includes(discoverChip.toLowerCase()))),
    [discoverChip],
  )
  const videoLayoutRef = useRef<HTMLDivElement>(null)
  const lastWheelTimeRef = useRef(0)

  // Filter clips based on feed tab
  const feedClips = useMemo(() => {
    switch (homeFeedTab) {
      case 'following': {
        // Show clips from followed creators + the signed-in account's own clips
        const handles = new Set(peopleFollowing.map((p) => p.handle.replace(/^@/, '').toLowerCase()))
        const names = new Set(peopleFollowing.map((p) => p.name.toLowerCase()))
        const matches = clips.filter(
          (clip) =>
            handles.has(clip.handle.toLowerCase()) ||
            names.has(clip.creator.toLowerCase()) ||
            clip.handle === accountHandle ||
            clip.creator === accountName,
        )
        // Never leave the tab empty: fall back to the freshest clips
        return matches.length > 0 ? matches : clips.slice(0, 3)
      }
      case 'live':
        // The Live tab renders the live-room grid instead of the vertical feed
        return []
      case 'for-you':
      default:
        return clips
    }
  }, [clips, homeFeedTab, accountHandle, accountName])

  // The clip the comments sheet is attached to
  const activeClip = feedClips[activeClipIndex] ?? feedClips[0] ?? clips[0]

  // Playback state for the active clip. Tapping the stage (or the play control)
  // toggles this, and it feeds both the video element and the sound engine so
  // pausing halts the audio and resuming brings it back.
  const [feedPlaying, setFeedPlaying] = useState(true)

  const scrollToVideo = (index: number) => {
    const el = videoLayoutRef.current
    if (!el) return
    const targetIndex = Math.max(0, Math.min(index, feedClips.length - 1))
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
    if (newIdx >= 0 && newIdx < feedClips.length && newIdx !== activeClipIndex) {
      setActiveClipIndex(newIdx)
    }
  }

  const handleFeedWheel = (e: React.WheelEvent) => {
    if (commentsOpen || soundsOpen) return
    const now = Date.now()
    if (now - lastWheelTimeRef.current < 380) return
    if (Math.abs(e.deltaY) < 25) return

    if (e.deltaY > 0 && activeClipIndex < feedClips.length - 1) {
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
          .select('id, caption, status, created_at, storage_path, user_id, profiles:user_id(display_name, username, avatar_url, verified)')
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
              avatarUrl: profileData?.avatar_url ?? null,
              verified: profileData?.verified ?? false,
            }
          })
          setClips((prev) => {
            const existingIds = new Set(dbClips.map((c) => c.id))
            return [...dbClips, ...prev.filter((c) => !existingIds.has(c.id))]
          })
        }
      } catch {
        // No demo clips; feed will be empty if no videos in database
      }
    }
    void loadFeedVideos()
    return () => { cancelled = true }
  }, [])
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [soundsOpen, setSoundsOpen] = useState(false)
  const [soundDetailOpen, setSoundDetailOpen] = useState(false)
  const [selectedSoundDetail, setSelectedSoundDetail] = useState<Sound | null>(null)
  const [hashtagOpen, setHashtagOpen] = useState(false)
  const [selectedHashtag, setSelectedHashtag] = useState<Hashtag | null>(null)
  const [activeEffect, setActiveEffect] = useState<VideoEffect | null>(videoEffects[0])
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [liveStreaming, setLiveStreaming] = useState(false)
  const [liveStreamTitle, setLiveStreamTitle] = useState('')
  const [liveStreamTags, setLiveStreamTags] = useState('')
  const [showDuetStitch, setShowDuetStitch] = useState(false)
  const [duetStitchClip, setDuetStitchClip] = useState<Clip | null>(null)
  const [remixType, setRemixType] = useState<'duet' | 'stitch'>('duet')

  // Drive the background-music engine from the active clip + mute state.
  // Clips that ship a real video file keep their own track; the rest get generated audio.
  // DISABLED: using video's own audio instead
  /*
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
  */

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

  /* --- saves & reposts (Supabase-backed) --- */
  const [savedClips, setSavedClips] = useState<Set<string>>(new Set())
  const [repostedClips, setRepostedClips] = useState<Set<string>>(new Set())

  // Derived collections for the profile tabs
  const likedClips = useMemo(() => clips.filter((clip) => !!liked[clip.id]), [clips, liked])
  const savedClipsList = useMemo(() => clips.filter((clip) => savedClips.has(clip.id)), [clips, savedClips])

  useEffect(() => {
    if (!session || !supabase) {
      setSavedClips(new Set())
      setRepostedClips(new Set())
      return
    }
    let alive = true
    const userId = session.user.id
    void fetchSavedIds(userId).then((ids) => { if (alive) setSavedClips(ids) })
    void fetchRepostedIds(userId).then((ids) => { if (alive) setRepostedClips(ids) })
    return () => { alive = false }
  }, [session])

  async function toggleSave(clip: Clip) {
    if (!session || !supabase || !clip.id) { notify('Sign in to save videos.'); return }
    const userId = session.user.id
    const on = !savedClips.has(clip.id)
    setSavedClips((current) => {
      const next = new Set(current)
      if (on) next.add(clip.id); else next.delete(clip.id)
      return next
    })
    const ok = await setSaved(userId, clip.id, on)
    if (!ok) {
      setSavedClips((current) => {
        const next = new Set(current)
        if (on) next.delete(clip.id); else next.add(clip.id)
        return next
      })
      notify('Could not update your saves.')
      return
    }
    notify(on ? 'Saved to your collection.' : 'Removed from your collection.')
  }

  async function toggleRepost(clip: Clip) {
    const userId = session?.user.id
    const on = !repostedClips.has(clip.id)
    setRepostedClips((current) => {
      const next = new Set(current)
      if (on) next.add(clip.id); else next.delete(clip.id)
      return next
    })
    if (on) {
      handleRepost(clip)
      notify('Reposted to your profile.')
    } else {
      setClips((prev) => prev.filter((item) => item.repostedFrom !== clip.id))
      notify('Repost removed.')
    }
    if (!userId || !supabase) return
    const ok = await setReposted(userId, clip.id, on)
    if (!ok) notify('Could not update your reposts.')
  }

  function toggleFollow(clip: Clip) {
    const handle = clip.handle.replace(/^@/, '').toLowerCase()
    setFollowedHandles((current) => {
      const next = new Set(current)
      if (next.has(handle)) { next.delete(handle); notify(`Unfollowed ${clip.creator}`) } else { next.add(handle); notify(`Following ${clip.creator}`) }
      return next
    })
  }
  function addClipToStory(clip: Clip) {
    const entry: Story = {
      id: `story-${Date.now()}`,
      name: accountName || 'You',
      initials: accountInitials,
      image: clip.image,
      caption: clip.caption,
      time: 'now',
      video: clip.videoSrc,
    }
    setStories((current) => [entry, ...current])
    notify('Added to your story.')
  }

  async function copyClipLink(clip: Clip) {
    const url = `${window.location.origin}/?v=${encodeURIComponent(clip.id)}`
    try {
      await navigator.clipboard.writeText(url)
      notify('Link copied')
    } catch {
      notify(url)
    }
  }

  function reportClip(clip: Clip) {
    notify(`Report sent for “${clip.caption.slice(0, 40)}”. Thanks.`)
  }


  /* --- stories --- */
  const [storyOpen, setStoryOpen] = useState(false)
  const [storyIndex, setStoryIndex] = useState(0)
  const [storyReply, setStoryReply] = useState('')
  const [storyLiked, setStoryLiked] = useState(false)
  const [stories, setStories] = useState<Story[]>(demoStories)
  const currentStory = stories[storyIndex] ?? stories[0]

  useEffect(() => {
    if (!session || !supabase) {
      setStories(demoStories)
      return
    }
    let alive = true
    void fetchStories(session.user.id, []).then((rows) => {
      if (!alive || !rows.length) return
      setStories(toStoryList(rows))
    })
    return () => { alive = false }
  }, [session])

  function openStory(index: number) {
    setStoryIndex(index)
    setStoryOpen(true)
  }
  function moveStory(direction: 1 | -1) {
    setStoryIndex((current) => (current + direction + stories.length) % stories.length)
  }
  async function submitStoryReply(event: FormEvent) {
    event.preventDefault()
    const text = storyReply.trim()
    if (!text) return
    setStoryReply('')
    setStoryOpen(false)

    const isRealStory = currentStory && !demoStories.some((story) => story.id === currentStory.id)
    if (session && supabase && currentStory && isRealStory) {
      const sent = await postMessage(session.user.id, currentStory.id, `↩ Story: ${text}`)
      notify(sent ? 'Reply sent.' : 'Could not send that reply.')
      return
    }
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
    { id: 2, title: 'Q&A: growing on Visual', when: 'Nov 14', viewers: 3110, minutes: 48, coins: 12800 },
    { id: 3, title: 'Late night studio', when: 'Nov 3', viewers: 1980, minutes: 75, coins: 7300 },
  ]

  /* --- live --- */
  const [liveOpen, setLiveOpen] = useState(false)
  const [liveRoom, setLiveRoom] = useState<LiveRoom | null>(null)
  const [liveViewers, setLiveViewers] = useState(1240)
  const [liveChat, setLiveChat] = useState(liveChatSeed)
  const [liveDraft, setLiveDraft] = useState('')
  const [liveHeart, setLiveHeart] = useState(false)
  const [liveHearts, setLiveHearts] = useState<number[]>([])
  const [giftOpen, setGiftOpen] = useState(false)
  const [coinPacksOpen, setCoinPacksOpen] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [liveCoins, setLiveCoins] = useState(40)
  const [giftBanners, setGiftBanners] = useState<Array<{ id: number; gift: string }>>([])
  const [giftBurst, setGiftBurst] = useState<{ id: number; gift: string; big: boolean } | null>(null)
  const liveViewersList = useMemo(
    () => (liveRoom ? [{ name: liveRoom.name, handle: liveRoom.handle }, ...LIVE_VIEWERS] : LIVE_VIEWERS),
    [liveRoom],
  )

  function openLiveRoom(room: LiveRoom) {
    setLiveRoom(room)
    setLiveViewers(room.viewers)
    setLiveChat(liveChatSeed)
    setGiftOpen(false)
    setCoinPacksOpen(false)
    setViewersOpen(false)
    setGiftBanners([])
    setGiftBurst(null)
    setLiveOpen(true)
  }

  function closeLiveRoom() {
    setLiveOpen(false)
    setGiftOpen(false)
    setCoinPacksOpen(false)
    setViewersOpen(false)
  }

  function sendLiveGift(gift: string) {
    const meta = LIVE_GIFTS.find((item) => item.name === gift)
    const cost = meta?.cost ?? 1
    if (liveCoins < cost) {
      notify(`You need ${cost - liveCoins} more coins to send ${gift}.`)
      setCoinPacksOpen(true)
      return
    }
    const id = Date.now()
    setLiveCoins((value) => value - cost)
    setGiftBanners((current) => [...current, { id, gift }])
    setGiftBurst({ id, gift, big: cost >= 50 })
    setLiveChat((current) => [...current, { id: id + 1, name: 'you', text: `sent a ${gift}` }])
    window.setTimeout(() => setGiftBanners((current) => current.filter((banner) => banner.id !== id)), 2800)
    window.setTimeout(() => setGiftBurst((current) => (current && current.id === id ? null : current)), 3200)
    notify(`Gift sent: ${gift}`)
  }

  function popHeart() {
    const id = Date.now()
    setLiveHearts((current) => [...current, id])
    window.setTimeout(() => setLiveHearts((current) => current.filter((value) => value !== id)), 1600)
  }

  useEffect(() => {
    if (!liveOpen) return
    const timer = window.setInterval(() => {
      setLiveViewers((value) => Math.max(50, value + Math.round(Math.random() * 10 - 3)))
    }, 3000)
    return () => window.clearInterval(timer)
  }, [liveOpen])

  function submitLiveChat(event: FormEvent) {
    event.preventDefault()
    const text = liveDraft.trim()
    if (!text) return
    setLiveChat((current) => [...current, { id: Date.now(), name: 'you', text }])
    setLiveDraft('')
  }

  /* --- messages & activity --- */
  const [conversations, setConversations] = useState<Conversation[]>(starterConversations)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [chatDraft, setChatDraft] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [chatCategory, setChatCategory] = useState<ChatCategory>('all')
  const [inboxTab, setInboxTab] = useState<'activity' | 'messages'>('activity')
  const [supportView, setSupportView] = useState<'home' | 'tickets' | 'new' | 'chat'>('home')
  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'done'>('all')
  const [supportDraft, setSupportDraft] = useState('')
  const [supportChat, setSupportChat] = useState<Array<{ id: number; mine: boolean; text: string }>>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [chatTheme, setChatTheme] = useState<'default' | 'dark' | 'blue' | 'green' | 'purple'>('default')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null)

  // Real conversations from Supabase (falls back to the samples above).
  useEffect(() => {
    if (!session || !supabase) {
      setConversations(starterConversations)
      return
    }
    let alive = true
    const userId = session.user.id
    void fetchConversations(userId).then((rows) => {
      if (!alive || !rows.length) return
      setConversations(rows.map((row) => ({
        id: row.id,
        name: row.username,
        initials: row.username.slice(0, 2).toUpperCase(),
        handle: `@${row.username}`,
        preview: row.body,
        time: timeAgo(row.created_at),
      })))
    })
    return () => { alive = false }
  }, [session])

  // New messages arrive over Realtime.
  useEffect(() => {
    if (!session || !supabase) return
    const userId = session.user.id
    return onNewMessage(userId, (row) => {
      const other = row.from_id === userId ? row.to_id : row.from_id
      const incoming: Message = {
        id: row.id,
        conversationId: other,
        senderId: row.from_id,
        senderName: '',
        senderInitials: '',
        senderAvatar: null,
        text: row.body,
        time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(row.created_at).getTime(),
        status: 'delivered',
        mine: row.from_id === userId,
      }
      setMessages((current) => {
        const existing = current[other] ?? []
        if (existing.some((message) => message.id === row.id)) return current
        return { ...current, [other]: [...existing, incoming] }
      })
    })
  }, [session])

  // Derived mute state from active conversation
  const chatMuted = activeConversation?.muted ?? false

  // Initialize messages for each conversation
  useEffect(() => {
    const initialMessages: Record<string, Message[]> = {
      sk: [
        { id: 'm1', conversationId: 'sk', senderId: 'sk', senderName: 'Sofia Kim', senderInitials: 'SK', senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', text: 'Hey Maya! I tried that blue wash you shared on my last edit.', time: '10:42 AM', timestamp: Date.now() - 3600000, status: 'read' },
        { id: 'm2', conversationId: 'sk', senderId: 'me', senderName: 'You', senderInitials: 'MC', senderAvatar: null, text: 'Oh nice, how did it turn out?', time: '10:43 AM', timestamp: Date.now() - 3540000, status: 'read', mine: true },
        { id: 'm3', conversationId: 'sk', senderId: 'sk', senderName: 'Sofia Kim', senderInitials: 'SK', senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', text: 'That color palette is perfect. Sending you the result tonight ✨', time: '10:45 AM', timestamp: Date.now() - 3420000, status: 'delivered' },
        { id: 'm4', conversationId: 'sk', senderId: 'sk', senderName: 'Sofia Kim', senderInitials: 'SK', senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', text: 'Also, have you seen the new brush set they released?', time: '10:46 AM', timestamp: Date.now() - 3360000, status: 'sent' },
      ],
      ar: [
        { id: 'm5', conversationId: 'ar', senderId: 'ar', senderName: 'Ari Rivera', senderInitials: 'AR', senderAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80', text: 'Thought you\'d like this one 🌊', time: '9:30 AM', timestamp: Date.now() - 7200000, status: 'read' },
        { id: 'm6', conversationId: 'ar', senderId: 'ar', senderName: 'Ari Rivera', senderInitials: 'AR', senderAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80', text: '', time: '9:30 AM', timestamp: Date.now() - 7199000, status: 'read', attachments: [{ id: 'att1', type: 'video', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80', thumbnail: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=120&q=80', name: 'Blue hour coastline.mp4' }] },
      ],
      nl: [
        { id: 'm7', conversationId: 'nl', senderId: 'nl', senderName: 'Nico Lane', senderInitials: 'NL', senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80', text: 'Are you free this weekend? Want to check out that new trail.', time: '2:15 PM', timestamp: Date.now() - 10800000, status: 'read' },
        { id: 'm8', conversationId: 'nl', senderId: 'me', senderName: 'You', senderInitials: 'MC', senderAvatar: null, text: 'Yeah! Saturday morning works for me.', time: '2:18 PM', timestamp: Date.now() - 10780000, status: 'read', mine: true },
        { id: 'm9', conversationId: 'nl', senderId: 'nl', senderName: 'Nico Lane', senderInitials: 'NL', senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80', text: 'Perfect. I\'ll send you the trailhead location.', time: '2:20 PM', timestamp: Date.now() - 10760000, status: 'read' },
      ],
      jw: [
        { id: 'm10', conversationId: 'jw', senderId: 'jw', senderName: 'Jules Walker', senderInitials: 'JW', senderAvatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80', text: 'Liked your post "Mountain lake at golden hour" 🝔︝', time: 'Yesterday', timestamp: Date.now() - 86400000, status: 'read' },
      ],
      dm: [
        { id: 'm11', conversationId: 'dm', senderId: 'dm', senderName: 'Devon Miles', senderInitials: 'DM', senderAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80', text: 'Shared a sound: "Midnight sessions" 🎵', time: '2 days ago', timestamp: Date.now() - 172800000, status: 'read' },
      ],
      group1: [
        { id: 'm12', conversationId: 'group1', senderId: 'ar', senderName: 'Ari Rivera', senderInitials: 'AR', senderAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80', text: 'Who\'s down for Saturday hike?', time: '3 days ago', timestamp: Date.now() - 259200000, status: 'read' },
        { id: 'm13', conversationId: 'group1', senderId: 'sk', senderName: 'Sofia Kim', senderInitials: 'SK', senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', text: 'Count me in! What time?', time: '3 days ago', timestamp: Date.now() - 259100000, status: 'read' },
        { id: 'm14', conversationId: 'group1', senderId: 'nl', senderName: 'Nico Lane', senderInitials: 'NL', senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80', text: 'Same here. Trail suggestions?', time: '3 days ago', timestamp: Date.now() - 259000000, status: 'read' },
      ],
      channel1: [
        { id: 'm15', conversationId: 'channel1', senderId: 'channel1', senderName: 'Visual Announcements', senderInitials: 'VA', senderAvatar: null, text: '📢 New features rolling out this week! Check out the updated creator studio.', time: '1 week ago', timestamp: Date.now() - 604800000, status: 'read' },
      ],
    }
    setMessages(initialMessages)
  }, [])

  async function openChat(conversation: Conversation) {
    setActiveConversation(conversation)
    setScreen('chat')
    // Mark as read
    setConversations((current) => current.map((c) => c.id === conversation.id ? { ...c, unread: 0 } : c))

    if (!session || !supabase) return
    const rows = await fetchThread(session.user.id, conversation.id)
    if (!rows.length) return
    setMessages((current) => ({
      ...current,
      [conversation.id]: rows.map((row) => ({
        id: row.id,
        conversationId: conversation.id,
        senderId: row.from_id,
        senderName: row.from_id === session.user.id ? accountName : conversation.name,
        senderInitials: row.from_id === session.user.id ? accountInitials : conversation.initials,
        senderAvatar: null,
        text: row.body,
        time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(row.created_at).getTime(),
        status: 'read',
        mine: row.from_id === session.user.id,
      })),
    }))
  }

  function closeChat() {
    setActiveConversation(null)
    setReplyingTo(null)
    setScreen('message')
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault()
    const text = chatDraft.trim()
    if (!text && !selectedAttachment) return
    if (!activeConversation) return

    const newMessage: Message = {
      id: crypto.randomUUID(),
      conversationId: activeConversation.id,
      senderId: 'me',
      senderName: 'You',
      senderInitials: accountInitials,
      senderAvatar: null,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      status: 'sending',
      attachments: selectedAttachment ? [{
        id: crypto.randomUUID(),
        type: selectedAttachment.type.startsWith('image/') ? 'image' : 'video',
        url: URL.createObjectURL(selectedAttachment),
        name: selectedAttachment.name,
        size: selectedAttachment.size,
      }] : undefined,
      replyTo: replyingTo || undefined,
      mine: true,
    }

    setMessages((current) => ({
      ...current,
      [activeConversation!.id]: [...(current[activeConversation!.id] || []), newMessage],
    }))

    if (session && supabase) {
      void postMessage(session.user.id, activeConversation.id, text)
    }

    // Simulate sending
    setTimeout(() => {
      setMessages((current) => ({
        ...current,
        [activeConversation!.id]: current[activeConversation!.id].map((m) =>
          m.id === newMessage.id ? { ...m, status: 'sent' as const } : m
        ),
      }))
      setTimeout(() => {
        setMessages((current) => ({
          ...current,
          [activeConversation!.id]: current[activeConversation!.id].map((m) =>
            m.id === newMessage.id ? { ...m, status: 'delivered' as const } : m
          ),
        }))
        setTimeout(() => {
          setMessages((current) => ({
            ...current,
            [activeConversation!.id]: current[activeConversation!.id].map((m) =>
              m.id === newMessage.id ? { ...m, status: 'read' as const } : m
            ),
          }))
        }, 500)
      }, 500)
    }, 300)

    setChatDraft('')
    setSelectedAttachment(null)
    setReplyingTo(null)
    setShowAttachments(false)
  }

  function handleAttachmentSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        notify('File too large. Max 50MB.')
        return
      }
      setSelectedAttachment(file)
    }
  }

  function toggleMute(conversation: Conversation) {
    setConversations((current) => current.map((c) => c.id === conversation.id ? { ...c, muted: !c.muted } : c))
  }

  function togglePin(conversation: Conversation) {
    setConversations((current) => current.map((c) => c.id === conversation.id ? { ...c, pinned: !c.pinned } : c))
  }

  /* --- sound & hashtag & effects --- */
  function openSoundDetail(sound: Sound) {
    setSelectedSoundDetail(sound)
    setSoundDetailOpen(true)
  }

  function openHashtag(tag: Hashtag) {
    setSelectedHashtag(tag)
    setHashtagOpen(true)
  }

  /* blockUser and endLive are defined for future use */
  // function _blockUser(user: { id: string; name: string; handle: string; initials: string; avatar?: string | null }) {
  //   const blocked: BlockedUser = {
  //     id: user.id,
  //     name: user.name,
  //     handle: user.handle,
  //     initials: user.initials,
  //     avatar: user.avatar,
  //     blockedAt: new Date().toLocaleDateString(),
  //   }
  //   setBlockedUsers((current) => [...current, blocked])
  //   setConversations((current) => current.filter((c) => c.id !== user.id))
  //   notify(`${user.name} blocked.`)
  // }

  // function _endLive() {
  //   setLiveStreaming(false)
  //   setLiveOpen(false)
  //   notify('Live stream ended.')
  // }

  function unblockUser(userId: string) {
    setBlockedUsers((current) => current.filter((u) => u.id !== userId))
    notify('User unblocked.')
  }


  function goLive() {
    if (!liveStreamTitle.trim()) {
      notify('Add a title for your live stream.')
      return
    }
    setLiveStreaming(true)
    setLiveOpen(true)
    notify('You are now live!')
  }

  /* function _endLive() {
    setLiveStreaming(false)
    setLiveOpen(false)
    notify('Live stream ended.')
  } */

  function openDuetStitch(clip: Clip) {
    setDuetStitchClip(clip)
    setShowDuetStitch(true)
  }

  function confirmDuetStitch(type: 'duet' | 'stitch') {
    if (duetStitchClip) {
      notify(`${type.charAt(0).toUpperCase() + type.slice(1)} mode opened with ${duetStitchClip.creator}'s video.`)
      setShowDuetStitch(false)
      setDuetStitchClip(null)
      startCamera()
    }
  }

  function handleRepost(clip: Clip) {
    // Find the sound associated with this clip
    const sound = sounds.find((s) => clip.audio.toLowerCase().includes(s.title.toLowerCase()))
    // Add to clips as a repost
    const repostClip: Clip = {
      ...clip,
      id: `repost-${Date.now()}`,
      caption: `Reposted: ${clip.caption}`,
      creator: accountName,
      handle: accountHandle,
      initials: accountInitials,
      likes: 0,
      comments: 0,
      audio: sound ? sound.title : clip.audio,
      repostedFrom: clip.id,
      originalCreator: clip.creator,
      originalHandle: clip.handle,
    }
    setClips((prev) => [repostClip, ...prev])
    notify(`Reposted ${clip.creator}'s video! Sound: ${sound?.title || 'Original'}`)
  }

  function handleDeleteVideo(clip: Clip) {
    if (!window.confirm('Delete this video?')) return
    setClips((prev) => prev.filter((c) => c.id !== clip.id))
    notify('Video deleted.')
  }

  const filteredConversations = useMemo(() => {
    let filtered = conversations
    if (messageSearch.trim()) {
      const query = messageSearch.trim().toLowerCase()
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(query) ||
        c.handle?.toLowerCase().includes(query) ||
        c.preview.toLowerCase().includes(query)
      )
    }
    switch (chatCategory) {
      case 'unread':
        filtered = filtered.filter((c) => (c.unread || 0) > 0)
        break
      case 'groups':
        filtered = filtered.filter((c) => c.handle === 'group')
        break
      case 'channels':
        filtered = filtered.filter((c) => c.handle === 'channel')
        break
    }
    // Sort: pinned first, then by unread, then by time
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if ((b.unread || 0) !== (a.unread || 0)) return (b.unread || 0) - (a.unread || 0)
      return 0
    })
  }, [conversations, messageSearch, chatCategory])

  const currentMessages = activeConversation ? messages[activeConversation.id] || [] : []

  /* --- people modal --- */
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [peopleGroup, setPeopleGroup] = useState<'followers' | 'following'>('following')
  const [personFollowState, setPersonFollowState] = useState<Record<string, string>>({})

  function openPeople(group: 'followers' | 'following') {
    setPeopleGroup(group)
    setPeopleOpen(true)
  }

  /* --- settings --- */
  type SettingsView = 'main' | 'more' | 'support'
  const [settingsView, setSettingsView] = useState<SettingsView>('main')
  const [blockedOpen, setBlockedOpen] = useState(false)

  /* --- support tickets & coins (Supabase) --- */
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDetails, setTicketDetails] = useState('')
  const [ticketBusy, setTicketBusy] = useState(false)
  const [coins, setCoins] = useState<number | null>(null)

  useEffect(() => {
    if (!session || !supabase) { setTickets([]); setCoins(null); return }
    let alive = true
    const userId = session.user.id
    void fetchTickets(userId).then((rows) => { if (alive) setTickets(rows) })
    void fetchCoins(userId).then((value) => { if (alive) setCoins(value) })
    return () => { alive = false }
  }, [session, screen])

  async function submitTicket() {
    if (!session || !supabase) { notify('Sign in to contact support.'); return }
    if (!ticketSubject.trim() || !ticketDetails.trim()) { notify('Add a subject and some details first.'); return }
    setTicketBusy(true)
    const ok = await createTicket(session.user.id, ticketSubject.trim(), ticketDetails.trim(), 'ticket')
    setTicketBusy(false)
    if (!ok) { notify('Could not send that ticket.'); return }
    setTicketSubject('')
    setTicketDetails('')
    notify('Ticket sent. We will reply here.')
    const rows = await fetchTickets(session.user.id)
    setTickets(rows)
  }

  async function claimDailyCoins() {
    if (!session || !supabase) { notify('Sign in to claim coins.'); return }
    const balance = await claimCoins()
    if (balance === null) { notify('Could not claim coins. Try again tomorrow.'); return }
    setCoins(balance)
    notify('+20 coins added')
  }

  // Persistent app settings. Every switch below is stored locally and the ones
  // that affect the app (playback, accessibility) are applied live.
  const defaultPrefs = {
    privateAccount: false, activityStatus: true, personalized: true,
    notifyPush: true, notifyLikes: true, notifyComments: true, notifyFollows: true, notifyUploads: true, notifyAnnouncements: true,
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
      console.log('[Camera] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })))
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
    console.log('[Recording] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })))
    // Prefer VP8 (widest support), then VP9, then generic webm, then mp4
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type))
    console.log('[Recording] Using mimeType:', mimeType)
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm'
        console.log('[Recording] Final mimeType:', type)
        const blob = new Blob(chunksRef.current, { type })
        console.log('[Recording] Blob size:', blob.size, 'type:', blob.type)
        // Debug: create object URL and test in a video element
        const testUrl = URL.createObjectURL(blob)
        console.log('[Recording] Test URL:', testUrl)
        const testVideo = document.createElement('video')
        testVideo.src = testUrl
        testVideo.onloadedmetadata = () => {
          console.log('[Recording] Video metadata - width:', testVideo.videoWidth, 'height:', testVideo.videoHeight, 'duration:', testVideo.duration)
        }
        testVideo.onerror = (e) => console.error('[Recording] Test video error:', e)
        testVideo.load()
        URL.revokeObjectURL(testUrl)
        
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

  async function publishStory() {
    if (!session || !supabase) { notify('Sign in to post a story.'); return }
    if (!capturedFile) { notify('Record or choose a video first.'); return }
    setUploading(true)
    try {
      const extension = capturedFile.name.split('.').pop()?.toLowerCase() || 'webm'
      const storagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('arc-videos').upload(storagePath, capturedFile, {
        contentType: capturedFile.type || 'video/webm', upsert: false,
      })
      if (uploadError) throw uploadError
      const { data: publicUrlData } = supabase.storage.from('arc-videos').getPublicUrl(storagePath)
      const kind: 'image' | 'video' = capturedFile.type.startsWith('image/') ? 'image' : 'video'
      const ok = await addStory(session.user.id, publicUrlData.publicUrl, caption.trim(), kind)
      if (!ok) {
        await supabase.storage.from('arc-videos').remove([storagePath])
        throw new Error('Could not save your story')
      }
      const rows = await fetchStories(session.user.id, [])
      setStories((current) => (rows.length ? toStoryList(rows) : current))
      setCapturedUrl('')
      setCapturedName('')
      setCapturedFile(null)
      setCaption('')
      setRecordingSeconds(0)
      setScreen('home')
      notify('Story posted.')
    } catch (error) {
      notify(toErrorMessage(error, 'Story upload failed. Check your connection and try again.'))
    } finally {
      setUploading(false)
    }
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
        const { data: publicUrlData } = supabase.storage.from('arc-videos').getPublicUrl(storagePath)
        videoUrl = publicUrlData.publicUrl
        console.log('[Publish] Video URL:', videoUrl)
        console.log('[Publish] Storage path:', storagePath)
        // Test the URL
        const testRes = await fetch(videoUrl, { method: 'HEAD' })
        console.log('[Publish] HEAD response:', testRes.status, testRes.headers.get('content-type'))
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
      // Create a thumbnail from the video for the feed image
      const thumbnailUrl = videoUrl // Use video as poster for now
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
        image: thumbnailUrl,
        imageAlt: 'Your newly posted video',
        videoSrc: videoUrl,
        ownerId: session?.user.id,
        avatarUrl: profile?.avatar_url ?? null,
        verified: profile?.verified ?? false,
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
      setTimeout(() => scrollToVideo(index), 60)
    }
  }

  /* --- derived --- */
  const myClips = useMemo(() => (session ? clips.filter((clip) => clip.ownerId === session.user.id) : []), [clips, session])
  const [profileVideoPlayer, setProfileVideoPlayer] = useState<Clip | null>(null)
  const filteredSounds = sounds.filter((sound) => `${sound.title} ${sound.artist}`.toLowerCase().includes(soundQuery.trim().toLowerCase()))

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
        <span><strong>{accountName}{profile?.verified && <Verified />}</strong><small>{accountHandle}</small></span>
        {isAdmin && <button className="sidebar-more" onClick={() => navigate('owner')} aria-label="Owner panel" title="Owner panel">⬛</button>}
        {!isAdmin && <button className="sidebar-more" onClick={() => navigate('settings')} aria-label="Account settings">•••</button>}
      </div>
    </aside>

      {/* ---------- Main ---------- */ }
  <div className="main-area">
    <header className="topbar">
      <div className="mobile-brand"><span className="mobile-brand-mark"><VisualMark /></span>Visual</div>
      <label className="searchbox"><span className="searchbox-icon">⌕</span><input aria-label="Search" placeholder="Search creators, sounds, and videos" readOnly value="" onClick={() => navigate('discover')} /></label>
      <span className="topbar-spacer" />
      <span className="topbar-label">Make room for good things</span>
      <button className="top-profile" onClick={() => navigate('profile')} aria-label="Open profile"><Avatar initials={accountInitials} src={profile?.avatar_url} /></button>
      <button className="phone-story-shortcut" onClick={() => openStory(2)} aria-label="Open stories"><Avatar initials="SK" src={stories[2]?.image} /></button>
      <button className="top-icon" onClick={() => navigate('studio')} aria-label="Open Studio">▥</button>
      <button className="top-icon" onClick={() => navigate('settings')} aria-label="Open settings">⚙</button>
      <button className="top-create" onClick={startCamera}>＋ Create</button>
      {!session && <button className="primary-button top-auth" onClick={() => openAuth('signin')}>Sign in</button>}
    </header>

    <main className="main-content">
      {/* ================= HOME ================= */}
      <section className={`screen${screen === 'home' ? ' active' : ''}`} data-view="home" aria-label="Home feed">
        <div className="top">
          <span className="ib" aria-hidden="true" />
          <div className="tabs" role="tablist" aria-label="Feed mode">
            {(['live', 'following', 'for-you'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={homeFeedTab === tab}
                onClick={() => setHomeFeedTab(tab)}
              >
                {tab === 'live' && <span className="dot" aria-hidden="true" />}
                {tab === 'live' ? 'Live' : tab === 'following' ? 'Following' : 'For you'}
              </button>
            ))}
          </div>
          <button type="button" className="ib glass" aria-label="Search" onClick={() => navigate('discover')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          </button>
        </div>

        {homeFeedTab === 'live' ? (
          <div className="feed live-feed" aria-label="Live rooms">
            <h2 className="live-feed-title">Live now</h2>
            <p className="sub">Join in, say hi, send a heart.</p>
            <div className="grid">
              {liveRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="th live-card"
                  onClick={() => openLiveRoom(room)}
                  aria-label={`Watch ${room.name} live: ${room.title}`}
                >
                  {room.image && <img src={room.image} alt="" />}
                  <span className="badge">LIVE</span>
                  <span className="view glass">▶ {formatCount(room.viewers)}</span>
                  <span className="ov">
                    {room.name}<Verified />
                    <span className="live-card-title">{room.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
        <div
          className="feed"
          ref={videoLayoutRef}
          onScroll={handleFeedScroll}
          onWheel={handleFeedWheel}
          onTouchStart={handleFeedTouchStart}
          onTouchEnd={handleFeedTouchEnd}
          aria-label={homeFeedTab === 'following' ? 'Following videos' : 'For you videos'}
        >
              {feedClips.map((clip, index) => (
                <VideoStage
                  key={clip.id}
                  clip={clip}
                  isActive={screen === 'home' && activeClipIndex === index}
                  isMuted={isMuted}
                  liked={!!liked[clip.id]}
                  onLike={() => toggleLike(clip.id)}
                  onComments={() => setCommentsOpen(true)}
                  onShare={() => notify('Share link copied in this preview.')}
                  onSave={() => toggleSave(clip)}
                  saved={savedClips.has(clip.id)}
                  onRepost={toggleRepost}
                  isPlaying={feedPlaying && activeClipIndex === index}
                  onPlayingChange={setFeedPlaying}
                  onOpenSoundDetail={openSoundDetail}
                  onOpenHashtag={openHashtag}
                  onOpenDuetStitch={openDuetStitch}
                  onDelete={handleDeleteVideo}
                  onStory={addClipToStory}
                  onCopyLink={copyClipLink}
                  onReport={reportClip}
                  reposted={repostedClips.has(clip.id)}
                  following={followedHandles.has(clip.handle.replace(/^@/, '').toLowerCase())}
                  onFollow={toggleFollow}
                  accountHandle={accountHandle}
                  notify={notify}
                  onMutedChange={setIsMuted}
                />
              ))}
        </div>
        )}
      </section>

      {/* ================= DISCOVER ================= */}
      <section className={`screen${screen === 'discover' ? ' active' : ''}`} data-view="discover" aria-label="Discover videos">
        <PageHead
          title="Discover"
          subtitle="Different angles on everything."
        />
        <label className="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input
            type="search"
            placeholder="Search creators, sounds and videos"
            aria-label="Search creators, sounds and videos"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        {q ? (
          <>
            <h3 className="discover-heading">Results for �{searchQuery.trim()}�</h3>
            {searchClipResults.length > 0 && (
              <div className="trend-list">
                {searchClipResults.map((clip) => (
                  <button
                    key={`search-${clip.id}`}
                    type="button"
                    className="trend-list-row"
                    onClick={() => { jumpToClip(clip.id) }}
                  >
                    <div><b>{clip.caption.slice(0, 42)}</b></div>
                    <span>@{clip.handle}</span>
                  </button>
                ))}
              </div>
            )}
            {searchCreatorResults.length > 0 && (
              <>
                <h3 className="discover-heading">People</h3>
                <div className="trend-list">
                  {searchCreatorResults.map((person) => (
                    <button
                      key={`person-${person.handle}`}
                      type="button"
                      className="trend-list-row"
                      onClick={() => navigate('profile-view')}
                    >
                      <div><b>{person.name}</b></div>
                      <span>@{person.handle}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {searchSoundResults.length > 0 && (
              <>
                <h3 className="discover-heading">Sounds</h3>
                <div className="trend-list">
                  {searchSoundResults.map((sound) => (
                    <button
                      key={`sound-${sound.id}`}
                      type="button"
                      className="trend-list-row"
                      onClick={() => openSoundDetail(sound)}
                    >
                      <div><b>{sound.title}</b></div>
                      <span>{sound.artist}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {searchClipResults.length === 0 && searchCreatorResults.length === 0 && searchSoundResults.length === 0 && (
              <p className="sub">No videos, people or sounds match that search yet.</p>
            )}
          </>
        ) : (
          <>
        <div className="chips" role="group" aria-label="Discover categories">
          {DISCOVER_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`chip${discoverChip === chip ? ' active' : ''}`}
              aria-pressed={discoverChip === chip}
              onClick={() => setDiscoverChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <h3 className="discover-heading">Trending now</h3>
        <div className="trend-list">
          {trends.map((trend, index) => (
            <div className="trend-list-row" key={trend.tag}>
              <div><b>{index + 1}. #{trend.tag}</b></div>
              <span>{trend.count}</span>
            </div>
          ))}
        </div>
        <h3 className="discover-heading">Picked for you</h3>
        <div className="discover-grid">
          {visibleDiscoverCards.map((card) => (
            <article className="discover-card" key={card.title}>
              <img src={card.image} alt={card.alt} />
              <div className="discover-card-info"><strong>{card.title}</strong><small>{card.meta}</small></div>
            </article>
          ))}
        </div>
          </>
        )}
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
            <span className="capture-status">{isRecording ? `◝ RECORDING · ${recordingSeconds}s` : 'CAMERA PREVIEW'}</span>
            <button className="capture-center" onClick={toggleRecord} aria-label={isRecording ? 'Stop recording' : 'Start camera'}>{isRecording ? '■' : '◝'}</button>
            <div className="capture-tools">
              <button aria-label="Filters" onClick={() => notify('Filters are coming soon.')}>✧</button>
              <button aria-label="Timer" onClick={() => notify('Timer is coming soon.')}>◷</button>
              <button aria-label="Effects" onClick={() => setActiveEffect(activeEffect === videoEffects[0] ? null : videoEffects[0])}>✨ Effects</button>
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
          tools={<button className="secondary-button" onClick={() => navigate('create')}>↝ Back to edit</button>}
        />
        <div className="compose-layout">
          <div className="capture-preview">
            {capturedUrl
              ? <video src={capturedUrl} muted playsInline controls onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', capturedUrl)} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }} />
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
            <label className="field">
              Hashtags
              <select multiple size={4} value={caption.split(' ').filter(w => w.startsWith('#')).map(w => hashtags.find(h => h.tag === w)?.id || '').filter(Boolean)} onChange={() => {}}>
                {hashtags.slice(0, 10).map((h) => <option key={h.id} value={h.id}>{h.tag}</option>)}
              </select>
              <span className="field-help">Select trending hashtags or type # in caption.</span>
            </label>
            <label className="field">Who can watch<select><option>Everyone</option><option>Followers</option><option>Only me</option></select></label>
            <div className="switch-row"><span>Allow comments</span><button className="switch" aria-label="Allow comments enabled" /></div>
            <div className="switch-row"><span>Allow remix</span><button className="switch" aria-label="Allow remix enabled" /></div>
            <div className="switch-row"><span>Show on profile</span><button className="switch" aria-label="Show on profile enabled" /></div>
            <div className="button-row">
              <button className="secondary-button" onClick={discardCapture}>Discard draft</button>
              <button className="secondary-button" onClick={publishStory} disabled={uploading || !capturedFile}>Post to story</button>
              <button className="primary-button" onClick={publishVideo} disabled={uploading}>{uploading ? 'Publishing…' : 'Publish video'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CONVERSATION LIST (INBOX) ================= */}
      <section className={`screen${screen === 'message' ? ' active' : ''}`} data-view="message" aria-label="Messages">
        <PageHead
          title="Inbox"
          subtitle="Replies, follows and messages."
          tools={
            <button className="primary-button" onClick={() => notify('New message feature coming soon')}>
              ? New
            </button>
          }
        />

        <div className="strow" aria-label="Stories">
          {stories.map((story, index) => (
            <button
              key={story.id}
              type="button"
              className="stb"
              onClick={() => (index === 0 ? notify('Camera opens here to add a story') : openStory(index))}
              aria-label={index === 0 ? 'Add to your story' : `Open ${story.name}'s story`}
            >
              <span className={`ring${index === 0 ? ' own' : ''}`}>
                <Avatar initials={story.initials} src={story.image} />
                {index === 0 && <span className="plus" aria-hidden="true">+</span>}
              </span>
              <span className="sn">{index === 0 ? 'Your story' : story.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <button type="button" className="sup" onClick={() => navigate('settings')}>
          <span className="ic">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.1 1-1.1 1.8v.4" /><path d="M12 17.2h.01" /></svg>
          </span>
          <span style={{ textAlign: 'left' }}>
            <b>Support</b>
            <span className="s">Help, tickets and reporting</span>
          </span>
          <span className="ch">�</span>
        </button>

        <div className="tabs" role="tablist" aria-label="Inbox sections">
          <button type="button" role="tab" aria-selected={inboxTab === 'activity'} onClick={() => setInboxTab('activity')}>Activity</button>
          <button type="button" role="tab" aria-selected={inboxTab === 'messages'} onClick={() => setInboxTab('messages')}>Messages</button>
        </div>

        {inboxTab === 'activity' ? (
          <div>
            {inboxActivity.map((entry) => (
              <div className="item" key={entry.id}>
                <Avatar initials={initialsOf(entry.name)} size={40} />
                <div className="t">
                  <b>{entry.name}</b>
                  <span>{entry.text}</span>
                </div>
                <small>{entry.time}</small>
                {entry.followBack ? (
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '7px 14px', fontSize: 13, borderRadius: 12 }}
                    onClick={() => notify(`Followed ${entry.name}`)}
                  >
                    Follow back
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations}
            onOpenChat={openChat}
            onSearchChange={setMessageSearch}
            searchQuery={messageSearch}
            onCategoryChange={setChatCategory}
            activeCategory={chatCategory}
            onProfileClick={(_, e) => { e.stopPropagation(); setScreen('profile-view'); }}
          />
        )}
      </section>

      {/* ================= CHAT SCREEN ================= */}
      <section className={`screen${screen === 'chat' ? ' active' : ''}`} data-view="chat" aria-label="Chat">
        <ChatScreen
          conversation={activeConversation}
          messages={currentMessages}
          onClose={closeChat}
          onSendMessage={sendMessage}
          onProfileClick={() => setScreen('profile-view')}
          onAttachmentSelect={handleAttachmentSelect}
          onEmojiSelect={(emoji) => setChatDraft((prev) => prev + emoji)}
          onMuteToggle={() => activeConversation && toggleMute(activeConversation)}
          onThemeChange={setChatTheme}
          onMoreAction={(action) => {
            switch (action) {
              case 'mute': activeConversation && toggleMute(activeConversation); break
              case 'pin': activeConversation && togglePin(activeConversation); break
              case 'search': notify('Search in chat coming soon'); break
              case 'media': notify('Media gallery coming soon'); break
              case 'notifications': notify('Notification settings coming soon'); break
              case 'block': notify('Block user coming soon'); break
              case 'delete': notify('Delete chat coming soon'); break
            }
          }}
          notify={notify}
          chatDraft={chatDraft}
          setChatDraft={setChatDraft}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          showAttachments={showAttachments}
          setShowAttachments={setShowAttachments}
          showMoreMenu={showMoreMenu}
          setShowMoreMenu={setShowMoreMenu}
          showThemePicker={showThemePicker}
          setShowThemePicker={setShowThemePicker}
          chatMuted={chatMuted}
          chatTheme={chatTheme}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          selectedAttachment={selectedAttachment}
        />
      </section>

      {/* ================= PROFILE VIEW (from chat) ================= */}
      <section className={`screen${screen === 'profile-view' ? ' active' : ''}`} data-view="profile-view" aria-label="Profile">
        <ProfileView
          conversation={activeConversation}
          onClose={() => setScreen(activeConversation ? 'chat' : 'message')}
          onMessage={() => { setScreen('chat'); }}
          onVideoCall={() => notify('Video call coming soon')}
          onVoiceCall={() => notify('Voice call coming soon')}
          onBlock={() => notify('Block user coming soon')}
          onReport={() => notify('Report user coming soon')}
        />
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
        <div className="profile-details"><h2>{accountName}{profile?.verified && <Verified />}</h2><p>{accountHandle} � Portland, OR</p></div>
          <button className="secondary-button" onClick={() => navigate('studio')}>Open Studio</button>
        </div>
        <div className="profile-stats">
          <span><b>{myClips.length || 38}</b> videos</span>
          <button className="profile-stat-link" onClick={() => openPeople('followers')}><b>4,820</b> followers</button>
          <button className="profile-stat-link" onClick={() => openPeople('following')}><b>612</b> following</button>
          <span><b>82.4K</b> likes</span>
        </div>
        <p className="profile-bio">{profile?.bio || 'Collecting small moments, good food, and places with no signal. Here for the things that make an ordinary day feel like yours.'}</p>
        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          {([
            ['videos', 'Videos'],
            ['reposts', 'Reposts'],
            ['liked', 'Liked'],
            ['saved', 'Saved'],
            ['collections', 'Collections'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={profileTab === id}
              className={profileTab === id ? 'active' : ''}
              onClick={() => setProfileTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="profile-grid">
          {profileTab === 'videos' && (myClips.length > 0 ? (
            myClips.map((clip) => (
              <button
                className="profile-tile"
                key={clip.id}
                onClick={() => setProfileVideoPlayer(clip)}
                aria-label={`Play video: ${clip.caption}`}
              >
                {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline crossOrigin="anonymous" onError={(e) => console.error('Video error:', e.currentTarget.error, 'src:', clip.videoSrc)} /> : <img src={clip.image} alt={clip.imageAlt} />}
                <span>▶ {clip.likes ? formatCount(clip.likes) : 'New'}</span>
                <button className="profile-tile-delete" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this video?')) handleDeleteVideo(clip) }} aria-label="Delete video">🗑</button>
              </button>
            ))
          ) : (
            profileTiles.map((tile, index) => (
              <button className="profile-tile" key={`${tile.alt}-${index}`} onClick={() => navigate('home')} aria-label={`Play video: ${tile.alt}`}>
                <img src={tile.image} alt={tile.alt} />
                <span>▶ {tile.views}</span>
              </button>
            ))
          ))}
          {profileTab === 'reposts' && (repostedClips.size > 0 ? (
            clips
              .filter((clip) => repostedClips.has(clip.id))
              .map((clip) => (
                <button
                  key={`repost-${clip.id}`}
                  className="profile-tile"
                  onClick={() => setProfileVideoPlayer(clip)}
                  aria-label={`Reposted video: ${clip.caption}`}
                >
                  {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline crossOrigin="anonymous" /> : <img src={clip.image} alt={clip.imageAlt} />}
                  <span className="tile-badge">Reposted</span>
                </button>
              ))
          ) : (
            <p className="sub">Videos you repost show up here. Long-press a video to repost it.</p>
          ))}
          {profileTab === 'liked' && (likedClips.length > 0 ? (
            likedClips.map((clip) => (
              <button key={`liked-${clip.id}`} className="profile-tile" onClick={() => setProfileVideoPlayer(clip)} aria-label={`Liked video: ${clip.caption}`}>
                {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline crossOrigin="anonymous" /> : <img src={clip.image} alt={clip.imageAlt} />}
                <span>♥ Liked</span>
              </button>
            ))
          ) : (
            <p className="sub">Videos you like show up here.</p>
          ))}
          {profileTab === 'saved' && (savedClipsList.length > 0 ? (
            savedClipsList.map((clip) => (
              <button key={`saved-${clip.id}`} className="profile-tile" onClick={() => setProfileVideoPlayer(clip)} aria-label={`Saved video: ${clip.caption}`}>
                {clip.videoSrc ? <video src={clip.videoSrc} muted playsInline crossOrigin="anonymous" /> : <img src={clip.image} alt={clip.imageAlt} />}
                <span>🔖 Saved</span>
              </button>
            ))
          ) : (
            <p className="sub">Tap Save on a video to keep it here.</p>
          ))}
          {profileTab === 'collections' && (
            <>
              {['Slow mornings', 'No-signal trips', 'Dinner for six', 'Blue hour'].map((name, index) => (
                <div className="col" key={name}>
                  {name}
                  <span>{[12, 8, 5, 21][index]} videos</span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* ================= SETTINGS ================= */}
      <section className={`screen${screen === 'settings' ? ' active' : ''}`} data-view="settings" aria-label="Settings">
        <div className="row" style={{ marginBottom: 10 }}>
          <button type="button" className="ib glass" onClick={() => navigate('profile')} aria-label="Back">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <h1 style={{ fontSize: 24 }}>Settings</h1>
        </div>
        {settingsView === 'main' && (
          <>
            <h3>Account</h3>
            <button type="button" className="srow" onClick={() => notify(`${accountName} · ${accountHandle}`)}>
              Account info<span className="ch">›</span>
            </button>
            <div className="srow">
              Private account
              <button
                type="button"
                className="sw"
                role="switch"
                aria-checked={prefs.privateAccount}
                aria-label="Private account"
                onClick={() => setPref('privateAccount', !prefs.privateAccount)}
              />
            </div>
            <button type="button" className="srow" onClick={() => setBlockedOpen(true)}>
              Blocked users<span className="ch">{blockedUsers.length > 0 ? `${blockedUsers.length} ›` : '›'}</span>
            </button>

            <h3>Preferences</h3>
            <div className="srow">
              Push notifications
              <button
                type="button"
                className="sw"
                role="switch"
                aria-checked={prefs.notifyPush}
                aria-label="Push notifications"
                onClick={() => setPref('notifyPush', !prefs.notifyPush)}
              />
            </div>
            <div className="srow">
              Data saver
              <button
                type="button"
                className="sw"
                role="switch"
                aria-checked={prefs.dataSaver}
                aria-label="Data saver"
                onClick={() => setPref('dataSaver', !prefs.dataSaver)}
              />
            </div>
            <div className="srow">
              Captions on by default
              <button
                type="button"
                className="sw"
                role="switch"
                aria-checked={prefs.captions}
                aria-label="Captions"
                onClick={() => setPref('captions', !prefs.captions)}
              />
            </div>
            <button type="button" className="srow" onClick={() => notify('Language is set to English.')}>
              Language<span className="ch">English ›</span>
            </button>
            <button type="button" className="srow" onClick={() => setSettingsView('more')}>
              More preferences<span className="ch">›</span>
            </button>

            <h3>Support</h3>
            <button type="button" className="srow" onClick={() => { setSupportView('home'); setSettingsView('support') }}>
              Help &amp; support<span className="ch">›</span>
            </button>
            <button type="button" className="srow" onClick={() => { setSupportView('new'); setSettingsView('support') }}>
              Report a problem<span className="ch">›</span>
            </button>
            <button type="button" className="srow" onClick={() => notify('Community guidelines')}>
              Community guidelines<span className="ch">›</span>
            </button>
            {session ? (
              <button
                type="button"
                className="srow"
                style={{ color: '#ff5a6e', border: 0 }}
                onClick={() => { void supabase?.auth.signOut(); notify('Signed out.'); setScreen('home') }}
              >
                Log out
              </button>
            ) : (
              <div className="button-row">
                <button className="primary-button" onClick={() => openAuth('signin')}>Sign in</button>
                <button className="secondary-button" onClick={() => openAuth('signup')}>Create account</button>
              </div>
            )}
          </>
        )}

        {settingsView === 'more' && (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <button type="button" className="ib glass" onClick={() => setSettingsView('main')} aria-label="Back">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <h1 style={{ fontSize: 22 }}>More preferences</h1>
            </div>

            <h3>Privacy</h3>
            <div className="setting-item">
              <span><b>Activity status</b><small>Let people you follow see when you are active.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.activityStatus} aria-label="Activity status" onClick={() => setPref('activityStatus', !prefs.activityStatus)} />
            </div>
            <div className="setting-item">
              <span><b>Personalized recommendations</b><small>Use your interests to tune your For you feed.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.personalized} aria-label="Personalized recommendations" onClick={() => setPref('personalized', !prefs.personalized)} />
            </div>
            <label className="field">Who can send you messages
              <select defaultValue="followers"><option value="everyone">Everyone</option><option value="followers">Followers you follow back</option><option value="nobody">Nobody</option></select>
            </label>
            <label className="field">Who can duet / remix your videos
              <select defaultValue="everyone"><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="nobody">Nobody</option></select>
            </label>

            <h3>Notifications</h3>
            <div className="setting-item">
              <span><b>Likes</b><small>When someone likes your video.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.notifyLikes} aria-label="Likes" onClick={() => setPref('notifyLikes', !prefs.notifyLikes)} />
            </div>
            <div className="setting-item">
              <span><b>Comments</b><small>Replies and mentions.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.notifyComments} aria-label="Comments" onClick={() => setPref('notifyComments', !prefs.notifyComments)} />
            </div>
            <div className="setting-item">
              <span><b>New followers</b><small>When someone follows you.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.notifyFollows} aria-label="New followers" onClick={() => setPref('notifyFollows', !prefs.notifyFollows)} />
            </div>
            <div className="setting-item">
              <span><b>Uploads from creators</b><small>New videos from people you follow.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.notifyUploads} aria-label="Uploads from creators" onClick={() => setPref('notifyUploads', !prefs.notifyUploads)} />
            </div>
            <div className="setting-item">
              <span><b>Announcements</b><small>Platform news from the owner.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.notifyAnnouncements} aria-label="Announcements" onClick={() => setPref('notifyAnnouncements', !prefs.notifyAnnouncements)} />
            </div>

            <h3>Playback</h3>
            <div className="setting-item">
              <span><b>Autoplay videos</b><small>Start playing when a video fills the screen.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.autoplay} aria-label="Autoplay videos" onClick={() => setPref('autoplay', !prefs.autoplay)} />
            </div>
            <div className="setting-item">
              <span><b>Start muted</b><small>Videos begin silent until you unmute.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.startMuted} aria-label="Start muted" onClick={() => setPref('startMuted', !prefs.startMuted)} />
            </div>
            <label className="field">Video quality
              <select value={prefs.quality} onChange={(e) => setPref('quality', e.target.value)}><option value="auto">Auto</option><option value="high">High (1080p)</option><option value="medium">Medium (720p)</option><option value="low">Low (480p)</option></select>
            </label>
            <label className="field">Default volume<b className="volume-value">{prefs.volume}%</b>
              <input type="range" min={0} max={100} value={prefs.volume} onChange={(e) => setPref('volume', Number(e.target.value))} aria-label="Default volume" />
            </label>

            <h3>Accessibility</h3>
            <div className="setting-item">
              <span><b>Reduce motion</b><small>Turn off animated transitions and the rotating sound disc.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.reduceMotion} aria-label="Reduce motion" onClick={() => setPref('reduceMotion', !prefs.reduceMotion)} />
            </div>
            <div className="setting-item">
              <span><b>Larger text</b><small>Increase the size of text across the app.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.largeText} aria-label="Larger text" onClick={() => setPref('largeText', !prefs.largeText)} />
            </div>
            <div className="setting-item">
              <span><b>High contrast</b><small>Stronger borders and brighter text.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.highContrast} aria-label="High contrast" onClick={() => setPref('highContrast', !prefs.highContrast)} />
            </div>
            <div className="setting-item">
              <span><b>Captions</b><small>Show captions on videos when available.</small></span>
              <button type="button" className="sw" role="switch" aria-checked={prefs.captions} aria-label="Captions" onClick={() => setPref('captions', !prefs.captions)} />
            </div>
          </>
        )}

        {settingsView === 'support' && (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <button type="button" className="ib glass" onClick={() => setSettingsView('main')} aria-label="Back">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <h1 style={{ fontSize: 22 }}>Support</h1>
            </div>
            <p className="sub">How can we help today?</p>
            <div className="stat">
              <span className="dot" style={{ background: 'currentColor' }} aria-hidden="true" />
              Typically replies within 2 hours
            </div>
            <button type="button" className="opt" onClick={() => setSupportView('tickets')}>
              <span className="sic">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z" /></svg>
              </span>
              <span>
                <b>My tickets</b>
                <span className="s">Track and reply to requests</span>
              </span>
              {tickets.filter((ticket) => ticket.status !== 'done').length > 0 && (
                <span className="nb2">{tickets.filter((ticket) => ticket.status !== 'done').length}</span>
              )}
            </button>
            <button type="button" className="opt" onClick={() => setSupportView('new')}>
              <span className="sic">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg>
              </span>
              <span>
                <b>Report a problem</b>
                <span className="s">Bugs, payments, abuse or content</span>
              </span>
            </button>
            <button type="button" className="opt" onClick={() => setSupportView('chat')}>
              <span className="sic">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
              </span>
              <span>
                <b>Chat with us</b>
                <span className="s">Talk to a person, 8am–8pm</span>
              </span>
            </button>

            {supportView === 'tickets' && (
              <div style={{ marginTop: 16 }}>
                <div className="tabs" role="tablist" aria-label="Ticket filters">
                  {(['all', 'active', 'done'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      role="tab"
                      aria-selected={ticketFilter === filter}
                      onClick={() => setTicketFilter(filter)}
                    >
                      {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Resolved'}
                    </button>
                  ))}
                </div>
                {tickets
                  .filter((ticket) => ticketFilter === 'all' || (ticketFilter === 'done' ? ticket.status === 'done' : ticket.status !== 'done'))
                  .map((ticket) => (
                    <div className="tk" key={ticket.id}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <small>{ticket.id.slice(0, 10)}</small>
                        <span className={`pill ${ticket.status === 'done' ? 'done' : ticket.status === 'wait' ? 'wait' : 'open'}`}>
                          {ticket.status === 'done' ? 'Resolved' : ticket.status === 'wait' ? 'Needs reply' : 'Open'}
                        </span>
                      </div>
                      <b>{ticket.subject}</b>
                      <small>{ticket.kind} · {timeAgo(ticket.created_at)}</small>
                    </div>
                  ))}
                {tickets.length === 0 && <p className="sub">Nothing here yet.</p>}
                <button type="button" className="btn" style={{ width: '100%', marginTop: 6 }} onClick={() => setSupportView('new')}>New ticket</button>
              </div>
            )}

            {supportView === 'new' && (
              <div style={{ marginTop: 16 }}>
                <div className="setting-item">
                  <span><b>Coin balance</b><small>{coins === null ? 'Sign in to see your balance' : `${coins} coins`}</small></span>
                  <button className="secondary-button" onClick={claimDailyCoins} disabled={!session}>Claim 20 free</button>
                </div>
                <label className="field">Subject<input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} maxLength={120} placeholder="Short summary" /></label>
                <label className="field">What happened?<textarea value={ticketDetails} onChange={(e) => setTicketDetails(e.target.value)} placeholder="Steps to reproduce, what you saw, what you expected" /></label>
                <div className="button-row">
                  <button className="primary-button" onClick={submitTicket} disabled={ticketBusy || !ticketSubject.trim() || !ticketDetails.trim()}>
                    {ticketBusy ? 'Sending…' : 'Send ticket'}
                  </button>
                </div>
              </div>
            )}

            {supportView === 'chat' && (
              <div style={{ marginTop: 16 }}>
                <div className="tl" style={{ minHeight: 160 }}>
                  <div className="msg them">Hi! What can we help you with?</div>
                  {supportChat.map((line) => (
                    <div className={`msg ${line.mine ? 'me' : 'them'}`} key={line.id}>{line.text}</div>
                  ))}
                </div>
                <form
                  className="cin"
                  style={{ marginTop: 10 }}
                  onSubmit={(event) => {
                    event.preventDefault()
                    const text = supportDraft.trim()
                    if (!text) return
                    setSupportChat((current) => [...current, { id: Date.now(), mine: true, text }])
                    setSupportDraft('')
                    window.setTimeout(() => {
                      setSupportChat((current) => [...current, { id: Date.now() + 1, mine: false, text: 'Thanks, we are looking into it. Can you share your account email?' }])
                    }, 1400)
                  }}
                >
                  <input
                    placeholder="Type a message"
                    aria-label="Message support"
                    value={supportDraft}
                    onChange={(event) => setSupportDraft(event.target.value)}
                  />
                  <button type="submit" className="btn">Send</button>
                </form>
              </div>
            )}

            <p className="field-help">Preferences are saved automatically on this device.</p>
          </>
        )}
      </section>

      {/* ================= STUDIO ================= */}
      <section className={`screen${screen === 'studio' ? ' active' : ''}`} data-view="studio" aria-label="Creator Studio">
        <PageHead
          title="Studio"
          subtitle="Your videos are finding their people."
          tools={<><button className="secondary-button">Last 30 days?</button><button className="primary-button" onClick={startCamera}>? New video</button></>}
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
                <span className="sound-cover">🎝</span>
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
      {isAdmin && screen === 'owner' && <OwnerPanel notify={notify} refreshProfile={fetchProfile} clips={clips} />}

    </main>
  </div>

  {/* ---------- Comments sheet (preview parity) ---------- */}
  <CommentsSheet
    clip={activeClip}
    open={commentsOpen}
    onClose={() => setCommentsOpen(false)}
  />
  {/* ---------- Story viewer ---------- */ }
  <div className={`story-overlay${storyOpen ? ' open' : ''}`} aria-hidden={!storyOpen}>
      <section className="story-viewer" role="dialog" aria-modal="true" aria-label="Story viewer">
      {currentStory.video ? (
        <video
          key={currentStory.id}
          src={currentStory.video}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }}
        />
      ) : (
        <img src={currentStory.image} alt={`${currentStory.name} story`} />
      )}
      <div className="story-scrim" />
      <div className="story-progress">{stories.map((story, index) => <i key={story.id} className={index <= storyIndex ? 'on' : ''} />)}</div>
      <header className="story-view-head">
        <button className="story-view-back" onClick={() => setStoryOpen(false)} aria-label="Close story">‹</button>
        <Avatar initials={currentStory.initials} />
        <span><b>{currentStory.name}{currentStory.name !== 'Your story' && <Verified />}</b><small>{currentStory.time}</small></span>
        <button className="story-view-close" onClick={() => setStoryOpen(false)} aria-label="Close story">×</button>
      </header>
      <button className="story-skip story-prev" onClick={() => moveStory(-1)} aria-label="Previous story">‹</button>
      <button className="story-skip story-next" onClick={() => moveStory(1)} aria-label="Next story">›</button>
      <div className="story-view-caption">{currentStory.caption}</div>
      <form className="story-reply" onSubmit={submitStoryReply}>
        <input placeholder="Reply to story..." aria-label="Reply to story" value={storyReply} onChange={(event) => setStoryReply(event.target.value)} />
        <button type="submit" aria-label="Send reply">?</button>
        <button
          type="button"
          className={`ib glass${storyLiked ? ' lk' : ''}`}
          aria-pressed={storyLiked}
          aria-label="Like story"
          onClick={() => setStoryLiked((value) => !value)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill={storyLiked ? 'currentColor' : 'none'}><path d="M12 20.5S3.5 15 3.5 9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5z" /></svg>
        </button>
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

  {/* ---------- Profile video player ---------- */ }
  {profileVideoPlayer && (
    <ProfileVideoPlayer
      clip={profileVideoPlayer}
      onClose={() => setProfileVideoPlayer(null)}
      onDelete={handleDeleteVideo}
    />
  )}

  {/* ---------- Live viewer ---------- */ }
  <div className={`live-overlay${liveOpen ? ' open' : ''}`} aria-hidden={!liveOpen}>
    <section className="live-viewer" role="dialog" aria-modal="true" aria-label="Live room">
      {liveRoom && <img src={liveRoom.image} alt="" />}
      <div className="live-shade" />
      <div className="live-hearts" aria-hidden="true">
        {liveHearts.map((id) => (
          <span className="live-heart-pop" key={id}>♥</span>
        ))}
      </div>
      <header className="live-view-head">
        <span className="live-badge">LIVE</span>
        <Avatar initials={liveRoom?.initials ?? 'AR'} src={profile?.avatar_url} />
        <span className="live-host">
        <b>{liveRoom?.name ?? 'Ari Rivera'}{liveRoom && <Verified />}</b>
          <small>{liveRoom?.title ?? 'Blue hour walk, ask me anything'}</small>
        </span>
        <button type="button" className="live-viewers-pill glass" onClick={() => setViewersOpen(true)} aria-label="People watching">
          <span className="stack" aria-hidden="true">
            {liveViewersList.slice(0, 3).map((person) => (
              <Avatar key={person.handle} initials={initialsOf(person.name)} size={26} />
            ))}
          </span>
          <b>{formatCount(liveViewers)}</b>
        </button>
        <button type="button" className="modal-close" onClick={closeLiveRoom} aria-label="Leave live">�</button>
      </header>

      <div className="gbans" aria-live="polite">
        {giftBanners.map((banner) => (
          <div className="gban" key={banner.id}>
            <Avatar initials={initialsOf('You')} size={30} />
            <div>
              <b>You</b>
              <span>sent {banner.gift}</span>
            </div>
            <span className="gem">{giftEmoji(banner.gift)}</span>
          </div>
        ))}
      </div>

      {giftBurst && (
        <div className={`gfx${giftBurst.big ? ' big' : ''}`} key={giftBurst.id} aria-hidden="true">
          {giftBurst.big && <span className="flash" />}
          <span className="gbig">{giftEmoji(giftBurst.gift)}</span>
          {giftBurst.big && Array.from({ length: 12 }).map((_, index) => (
            <i className="spk" key={index} style={{ '--a': `${(index / 12) * 360}deg` } as React.CSSProperties} />
          ))}
        </div>
      )}

      <div className="live-chat">
        {liveChat.map((message) => (
          <p key={message.id}>
            <Avatar initials={initialsOf(message.name)} size={26} />
            <span><b>{message.name}</b> {message.text}</span>
          </p>
        ))}
      </div>

      {viewersOpen && (
        <div className="sheet open" role="dialog" aria-modal="true" aria-label="People watching">
          <div className="scrim" onClick={() => setViewersOpen(false)} />
          <div className="panel">
            <div className="grab" />
            <div className="chead">
              <div>
                <b>{formatCount(liveViewers)} watching</b>
                <div className="lv">People in this live</div>
              </div>
              <button type="button" className="ib" onClick={() => setViewersOpen(false)} aria-label="Close viewers">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="clist">
              {liveViewersList.map((person) => (
                <div className="item" key={person.handle}>
                  <Avatar initials={initialsOf(person.name)} size={38} />
                  <div className="t">
                    <b>{person.name}</b>
                    <span>Watching</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {coinPacksOpen && (
        <div className="sheet open" role="dialog" aria-modal="true" aria-label="Get coins">
          <div className="scrim" onClick={() => setCoinPacksOpen(false)} />
          <div className="panel">
            <div className="grab" />
            <div className="chead">
              <div>
                <b>Get coins</b>
                <div className="lv">Coins let you send gifts to creators.</div>
              </div>
              <button type="button" className="ib" onClick={() => setCoinPacksOpen(false)} aria-label="Close coins">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="gift-grid">
              {[70, 350, 700, 1400].map((pack, index) => (
                <button
                  key={pack}
                  type="button"
                  className="gift"
                  onClick={() => {
                    setLiveCoins((value) => value + pack)
                    setCoinPacksOpen(false)
                    notify(`+${pack} coins added`)
                  }}
                >
                  {pack} coins � ${[0.99, 4.99, 9.99, 19.99][index]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {giftOpen && (
        <div className="gift-tray" role="group" aria-label="Send a gift">
          <div className="gift-tray-head">
            <b>Send a gift</b>
            <button type="button" className="coin-chip" onClick={() => setCoinPacksOpen(true)}>
              <span className="cn" aria-hidden="true" /> {liveCoins} +
            </button>
            <button type="button" className="gift-close" onClick={() => setGiftOpen(false)} aria-label="Close gifts">�</button>
          </div>
          <div className="gift-grid">
            {LIVE_GIFTS.map((gift) => {
              const affordable = liveCoins >= gift.cost
              return (
                <button
                  key={gift.name}
                  type="button"
                  className={`gift${affordable ? '' : ' poor'}`}
                  aria-pressed={false}
                  onClick={() => sendLiveGift(gift.name)}
                  title={`${gift.name} � ${gift.cost} coins`}
                >
                  <span className="ge">{gift.emoji}</span>
                  <b>{gift.name}</b>
                  <span className="gp">{gift.cost}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <form className="live-compose" onSubmit={submitLiveChat}>
        <input placeholder="Say something..." aria-label="Send a live comment" value={liveDraft} onChange={(event) => setLiveDraft(event.target.value)} />
        <button type="submit" aria-label="Send comment">➤</button>
        <button type="button" className="live-gift-btn" onClick={() => setGiftOpen((value) => !value)} aria-label="Send a gift" aria-pressed={giftOpen}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M8 8a2.5 2.5 0 1 1 4-2 2.5 2.5 0 1 1 4 2" /></svg>
        </button>
        <button type="button" className="live-heart" onClick={() => { popHeart(); setLiveHeart((value) => !value); }} aria-label="Send hearts">
          {liveHeart ? '♥' : '♡'}
        </button>
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

  {/* ---------- Sound Detail modal ---------- */ }
  <SoundDetailModal
    sound={selectedSoundDetail}
    open={soundDetailOpen}
    onClose={() => setSoundDetailOpen(false)}
    onUseSound={() => { setSelectedSound(selectedSoundDetail!); setSoundDetailOpen(false); setSoundsOpen(false); notify(`${selectedSoundDetail!.title} selected for your next video.`) }}
    clips={clips}
    formatCount={formatCount}
    scrollToVideo={scrollToVideo}
    setScreen={setScreen}
    notify={notify}
  />

  {/* ---------- Hashtag modal ---------- */ }
  <HashtagModal
    hashtag={selectedHashtag}
    open={hashtagOpen}
    onClose={() => setHashtagOpen(false)}
    clips={clips}
    formatCount={formatCount}
    scrollToVideo={scrollToVideo}
    setScreen={setScreen}
  />

  {/* ---------- Effect picker ---------- */ }
  {screen === 'create' && (
    <EffectPicker
      activeEffect={activeEffect}
      onSelectEffect={setActiveEffect}
      onClose={() => {}}
      videoEffects={videoEffects}
    />
  )}

  {/* ---------- Blocked users modal ---------- */ }
  <BlockedUsersModal
    blockedUsers={blockedUsers}
    open={blockedOpen}
    onClose={() => setBlockedOpen(false)}
    onUnblock={unblockUser}
  />

  {/* ---------- Live stream modal ---------- */ }
  <LiveStreamModal
    open={false}
    onClose={() => {}}
    onGoLive={goLive}
    isLive={liveStreaming}
    streamTitle={liveStreamTitle}
    setStreamTitle={setLiveStreamTitle}
    streamTags={liveStreamTags}
    setStreamTags={setLiveStreamTags}
    notify={notify}
  />

  {/* ---------- Duet/Stitch modal ---------- */ }
  <DuetStitchModal
    clip={duetStitchClip}
    open={showDuetStitch}
    onClose={() => { setShowDuetStitch(false); setDuetStitchClip(null) }}
    onConfirm={confirmDuetStitch}
    remixType={remixType}
    setRemixType={setRemixType}
  />

  {/* ---------- Sound Detail modal ---------- */ }
  <SoundDetailModal
    sound={selectedSoundDetail}
    open={soundDetailOpen}
    onClose={() => setSoundDetailOpen(false)}
    onUseSound={() => { setSelectedSound(selectedSoundDetail!); setSoundDetailOpen(false); setSoundsOpen(false); notify(`${selectedSoundDetail!.title} selected for your next video.`) }}
    clips={clips}
    formatCount={formatCount}
    scrollToVideo={scrollToVideo}
    setScreen={setScreen}
    notify={notify}
  />

  {/* ---------- Hashtag modal ---------- */ }
  <HashtagModal
    hashtag={selectedHashtag}
    open={hashtagOpen}
    onClose={() => setHashtagOpen(false)}
    clips={clips}
    formatCount={formatCount}
    scrollToVideo={scrollToVideo}
    setScreen={setScreen}
  />

  {/* ---------- Auth modal ---------- */ }
  <AuthModal
    open={authOpen || showAuthOnFirstVisit}
    mode={authMode}
    busy={authBusy}
    onClose={() => { setAuthOpen(false); setShowAuthOnFirstVisit(false); localStorage.setItem('hasSeenAuth', 'true') }}
    onSubmit={submitAuth}
    onSwitch={() => setAuthMode((mode) => (mode === 'signin' ? 'signup' : 'signin'))}
  />

      {/* ---------- Mobile nav ---------- */ }
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV_MOBILE.map((item) => (
          <button
            key={item.id}
            className={`${screen === item.id ? 'active' : ''}${item.create ? ' create-mobile' : ''}`}
            aria-current={screen === item.id ? 'page' : undefined}
            aria-label={item.create ? 'Create' : undefined}
            onClick={() => (item.create ? startCamera() : navigate(item.id))}
          >
            <span className="nav-icon" aria-hidden="true">{NAV_ICONS[item.id]}</span>
            {!item.create && item.label}
          </button>
        ))}
      </nav>

      <Toast message={toastMessage} />
    </div >
  )
}
