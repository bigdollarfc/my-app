import { supabase } from './supabase'

/* ------------------------------------------------------------------
   Social features: saves, reposts, stories, messages, tickets, coins.
   Every helper returns empty/false when Supabase is not configured, so
   the app keeps working in demo mode.
   ------------------------------------------------------------------ */

const ready = () => supabase !== null

function unwrap<T>(data: T | null, error: { message: string } | null, fallback: T): T {
  if (error || data === null) {
    if (error) console.error('[social]', error.message)
    return fallback
  }
  return data
}

/** "now", "5 min ago", "2 h ago", "3 d ago" */
export function timeAgo(value: string): string {
  const seconds = (Date.now() - new Date(value).getTime()) / 1000
  if (!Number.isFinite(seconds) || seconds < 0) return 'now'
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86_400)} d ago`
}

/* ----------------------------- saves ----------------------------- */

export async function fetchSavedIds(userId: string): Promise<Set<string>> {
  if (!ready()) return new Set()
  const { data, error } = await supabase!
    .from('saves')
    .select('video_id')
    .eq('user_id', userId)
  if (error) { console.error('[saves]', error.message); return new Set() }
  return new Set((data ?? []).map((row) => row.video_id as string))
}

export async function setSaved(userId: string, videoId: string, saved: boolean): Promise<boolean> {
  if (!ready()) return false
  const { error } = saved
    ? await supabase!.from('saves').insert({ user_id: userId, video_id: videoId })
    : await supabase!.from('saves').delete().eq('user_id', userId).eq('video_id', videoId)
  if (error) { console.error('[saves]', error.message); return false }
  return true
}

/* ---------------------------- reposts ---------------------------- */

export async function fetchRepostedIds(userId: string): Promise<Set<string>> {
  if (!ready()) return new Set()
  const { data, error } = await supabase!
    .from('reposts')
    .select('video_id')
    .eq('user_id', userId)
  if (error) { console.error('[reposts]', error.message); return new Set() }
  return new Set((data ?? []).map((row) => row.video_id as string))
}

export async function setReposted(userId: string, videoId: string, reposted: boolean): Promise<boolean> {
  if (!ready()) return false
  const { error } = reposted
    ? await supabase!.from('reposts').insert({ user_id: userId, video_id: videoId })
    : await supabase!.from('reposts').delete().eq('user_id', userId).eq('video_id', videoId)
  if (error) { console.error('[reposts]', error.message); return false }
  return true
}

/* ---------------------------- stories ---------------------------- */

export type StoryRow = {
  id: string
  user_id: string
  media_url: string
  text: string
  kind: 'image' | 'video'
  created_at: string
  profiles: { username: string } | null
}

export async function fetchStories(userId: string | null, followingIds: string[]): Promise<StoryRow[]> {
  if (!ready()) return []
  const ids = Array.from(new Set([...(userId ? [userId] : []), ...followingIds]))
  if (!ids.length) return []
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { data, error } = await supabase!
    .from('stories')
    .select('id, user_id, media_url, text, kind, created_at, profiles(username)')
    .in('user_id', ids)
    .gt('created_at', since)
    .order('created_at', { ascending: true })
  if (error) { console.error('[stories]', error.message); return [] }
  return unwrap<StoryRow[]>(data as unknown as StoryRow[], null, [])
}

export async function addStory(userId: string, mediaUrl: string, text: string, kind: 'image' | 'video'): Promise<boolean> {
  if (!ready()) return false
  const { error } = await supabase!.from('stories').insert({
    user_id: userId,
    media_url: mediaUrl,
    text: text.slice(0, 150),
    kind,
  })
  if (error) { console.error('[stories]', error.message); return false }
  return true
}

/* --------------------------- messages ---------------------------- */

export type MessageRow = {
  id: string
  from_id: string
  to_id: string
  body: string
  created_at: string
}

export type ConversationSummary = {
  id: string
  username: string
  body: string
  created_at: string
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  if (!ready()) return []
  const { data, error } = await supabase!
    .from('messages')
    .select('from_id, to_id, body, created_at')
    .or(`from_id.eq.${userId},to_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) { console.error('[messages]', error.message); return [] }

  const latest = new Map<string, { body: string; created_at: string }>()
  for (const row of (data ?? []) as { from_id: string; to_id: string; body: string; created_at: string }[]) {
    const other = row.from_id === userId ? row.to_id : row.from_id
    if (!latest.has(other)) latest.set(other, { body: row.body, created_at: row.created_at })
  }
  if (!latest.size) return []

  const { data: people, error: peopleError } = await supabase!
    .from('profiles')
    .select('id, username')
    .in('id', Array.from(latest.keys()))
  if (peopleError) { console.error('[messages]', peopleError.message); return [] }

  const names = new Map((people ?? []).map((p) => [p.id as string, p.username as string]))
  return Array.from(latest.entries())
    .map(([id, meta]) => ({ id, username: names.get(id) ?? 'user', body: meta.body, created_at: meta.created_at }))
    .filter((row) => names.has(row.id))
}

export async function fetchThread(meId: string, otherId: string): Promise<MessageRow[]> {
  if (!ready()) return []
  const { data, error } = await supabase!
    .from('messages')
    .select('id, from_id, to_id, body, created_at')
    .or(`and(from_id.eq.${meId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${meId})`)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) { console.error('[messages]', error.message); return [] }
  return (data ?? []) as MessageRow[]
}

export async function sendMessage(fromId: string, toId: string, body: string): Promise<MessageRow | null> {
  if (!ready()) return null
  const { data, error } = await supabase!
    .from('messages')
    .insert({ from_id: fromId, to_id: toId, body: body.slice(0, 1000) })
    .select('id, from_id, to_id, body, created_at')
    .single()
  if (error) { console.error('[messages]', error.message); return null }
  return data as MessageRow
}

export function onNewMessage(userId: string, handler: (row: MessageRow) => void): () => void {
  if (!ready()) return () => {}
  const channel = supabase!
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${userId}` },
      (payload) => handler(payload.new as MessageRow),
    )
    .subscribe()
  return () => { void supabase!.removeChannel(channel) }
}

/* --------------------------- tickets ----------------------------- */

export type TicketRow = {
  id: string
  user_id: string
  subject: string
  body: string
  kind: string
  status: 'open' | 'wait' | 'done'
  created_at: string
}

export async function fetchTickets(userId: string): Promise<TicketRow[]> {
  if (!ready()) return []
  const { data, error } = await supabase!
    .from('tickets')
    .select('id, user_id, subject, body, kind, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) { console.error('[tickets]', error.message); return [] }
  return (data ?? []) as TicketRow[]
}

export async function createTicket(userId: string, subject: string, body: string, kind: string): Promise<boolean> {
  if (!ready()) return false
  const { error } = await supabase!.from('tickets').insert({
    user_id: userId,
    subject: subject.slice(0, 120),
    body: body.slice(0, 2000),
    kind,
  })
  if (error) { console.error('[tickets]', error.message); return false }
  return true
}

/* ---------------------------- coins ------------------------------ */

export async function claimCoins(): Promise<number | null> {
  if (!ready()) return null
  const { data, error } = await supabase!.rpc('claim_coins')
  if (error) { console.error('[coins]', error.message); return null }
  return typeof data === 'number' ? data : null
}

export async function fetchCoins(userId: string): Promise<number | null> {
  if (!ready()) return null
  const { data, error } = await supabase!
    .from('profiles')
    .select('coins')
    .eq('id', userId)
    .maybeSingle()
  if (error) { console.error('[coins]', error.message); return null }
  return (data?.coins as number | undefined) ?? null
}