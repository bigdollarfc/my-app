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
  avatarUrl?: string | null
  repostedFrom?: string
  originalCreator?: string
  originalHandle?: string
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
