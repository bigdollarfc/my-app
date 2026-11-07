import type { LucideIcon } from 'lucide-react'
import {
  Award,
  BarChart3,
  Compass,
  CreditCard,
  Gift,
  Home,
  Megaphone,
  MessageCircle,
  Plus,
  Radio,
  UserRound,
} from 'lucide-react'

export type Screen = 'feed' | 'profile' | 'create' | 'discover' | 'inbox' | 'studio'

export type StudioSectionId = 'overview' | 'rewards' | 'subscriptions' | 'promote' | 'gifts' | 'live'

export type Profile = {
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  banner_url: string | null
}

export type Clip = {
  creator: string
  handle: string
  initials: string
  caption: string
  audio: string
  likes: number
  comments: number
  image: string
  imageAlt: string
  color: 'blue' | 'coral' | 'green'
  videoSrc?: string
  ownerId?: string
}

export type NavItem = {
  screen: Screen
  label: string
  Icon: LucideIcon
}

export type StudioItem = {
  id: StudioSectionId
  label: string
  description: string
  Icon: LucideIcon
}

export const navItems: NavItem[] = [
  { screen: 'feed', label: 'Home', Icon: Home },
  { screen: 'discover', label: 'Discover', Icon: Compass },
  { screen: 'create', label: 'Create', Icon: Plus },
  { screen: 'inbox', label: 'Inbox', Icon: MessageCircle },
  { screen: 'profile', label: 'Profile', Icon: UserRound },
]

export const studioItems: readonly StudioItem[] = [
  { id: 'overview', label: 'Insights', description: 'Views and audience activity at a glance.', Icon: BarChart3 },
  { id: 'rewards', label: 'Visual Creator Rewards', description: 'Track eligible views and creator reward estimates.', Icon: Award },
  { id: 'subscriptions', label: 'Subscriptions', description: 'Manage subscribers and recurring creator income.', Icon: CreditCard },
  { id: 'promote', label: 'Promote content', description: 'Choose a video and grow its reach with a promotion.', Icon: Megaphone },
  { id: 'gifts', label: 'Video gifts', description: 'See gifts viewers send on your videos.', Icon: Gift },
  { id: 'live', label: 'Live rewards', description: 'Review gifts and rewards from your live sessions.', Icon: Radio },
] as const

export const starterClips: Clip[] = [
  {
    creator: 'Maya Cooks',
    handle: '@maya.cooks',
    initials: 'MC',
    caption: 'Crispy chili oil noodles in 10 minutes. Full recipe in the comments.',
    audio: 'Maya Cooks · original audio',
    likes: 12400,
    comments: 342,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=85',
    imageAlt: 'A bowl of spicy noodles topped with herbs and chili oil',
    color: 'blue',
  },
  {
    creator: 'Nico Flores',
    handle: '@nicoflores',
    initials: 'NF',
    caption: 'Golden hour found us before we found the trail.',
    audio: 'soft hours · Nico Flores',
    likes: 8930,
    comments: 128,
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=85',
    imageAlt: 'A mountain lake at golden hour',
    color: 'coral',
  },
  {
    creator: 'Ivy & Co.',
    handle: '@ivyandco',
    initials: 'IC',
    caption: 'A tiny studio refresh with things we already had around.',
    audio: 'Sunday in the studio · Ivy & Co.',
    likes: 21600,
    comments: 506,
    image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=85',
    imageAlt: 'A bright, plant-filled creative studio',
    color: 'green',
  },
]
