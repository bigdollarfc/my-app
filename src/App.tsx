import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowDownToLine,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Heart,
  Home,
  ImagePlus,
  LogOut,
  MessageCircle,
  Mic2,
  MoreHorizontal,
  Music2,
  Plus,
  Search,
  Send,
  Settings2,
  Share2,
  Sparkles,
  UserRound,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Screen = 'feed' | 'profile' | 'create' | 'discover' | 'inbox'
type FeedTab = 'For You' | 'Following' | 'Nearby'
type Profile = { username: string; display_name: string; bio: string; avatar_url: string | null; banner_url: string | null }
type Clip = {
  creator: string
  handle: string
  initials: string
  caption: string
  audio: string
  likes: number
  comments: number
  image: string
  imageAlt: string
  color: string
  videoSrc?: string
  ownerId?: string
}

const starterClips: Clip[] = [
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

const navItems: { screen: Screen; label: string; Icon: typeof Home }[] = [
  { screen: 'feed', label: 'Home', Icon: Home },
  { screen: 'discover', label: 'Discover', Icon: Compass },
  { screen: 'create', label: 'Create', Icon: Plus },
  { screen: 'inbox', label: 'Inbox', Icon: MessageCircle },
  { screen: 'profile', label: 'Profile', Icon: UserRound },
]

function formatCount(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 1 : 1)}K` : String(count)
}

function App() {
  const [screen, setScreen] = useState<Screen>('feed')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [profileSaveBusy, setProfileSaveBusy] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authFeedback, setAuthFeedback] = useState('')
  const [authError, setAuthError] = useState('')
  const [feedTab, setFeedTab] = useState<FeedTab>('For You')
  const [clips, setClips] = useState(starterClips)
  const [clipIndex, setClipIndex] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [following, setFollowing] = useState(false)
  const [duration, setDuration] = useState('30s')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  const [cameraMessage, setCameraMessage] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const publishedPreviewUrlsRef = useRef(new Set<string>())
  const recordingTimeoutRef = useRef<number | null>(null)
  const recordingStartedAtRef = useRef(0)

  const clip = clips[clipIndex]

  useEffect(() => {
    if (screen !== 'create') return
    return () => {
      if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.ondataavailable = null
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [screen])

  useEffect(() => {
    if (!isRecording) return
    const timer = window.setInterval(() => {
      setRecordedSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [isRecording])

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:') && !publishedPreviewUrlsRef.current.has(previewUrl)) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => () => {
    publishedPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  useEffect(() => () => {
    if (bannerPreview.startsWith('blob:')) URL.revokeObjectURL(bannerPreview)
  }, [bannerPreview])

  useEffect(() => {
    if (!streamRef.current || !videoRef.current || previewUrl) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => undefined)
  }, [cameraReady, previewUrl, screen])

  useEffect(() => {
    if (!supabase) return

    let active = true
    const client = supabase
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError(error.message)
      setSession(data.session)
      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null)
      return
    }

    let active = true
    void supabase.from('profiles').select('username, display_name, bio, avatar_url, banner_url').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (active && data) setProfile(data)
    })

    return () => {
      active = false
    }
  }, [session])

  function changeClip(direction: number) {
    setClipIndex((current) => (current + direction + clips.length) % clips.length)
    setLiked(false)
    setSaved(false)
  }

  function openScreen(nextScreen: Screen) {
    setScreen(nextScreen)
    setIsRecording(false)
    setCameraMessage('')
    setProfileEditorOpen(false)
  }

  function beginProfileEdit() {
    setEditDisplayName(profile?.display_name || accountName)
    setEditUsername(profile?.username || accountEmail.split('@')[0] || '')
    setEditBio(profile?.bio || '')
    setAvatarFile(null)
    setBannerFile(null)
    setAvatarPreview('')
    setBannerPreview('')
    setProfileError('')
    setProfileMessage('')
    setProfileEditorOpen(true)
  }

  function selectProfileImage(file: File | undefined, target: 'avatar' | 'banner') {
    if (!file) return
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!supportedTypes.includes(file.type)) {
      setProfileError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Profile images must be 5 MB or smaller.')
      return
    }
    setProfileError('')
    const preview = URL.createObjectURL(file)
    if (target === 'avatar') {
      setAvatarFile(file)
      setAvatarPreview(preview)
    } else {
      setBannerFile(file)
      setBannerPreview(preview)
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session) {
      setProfileError('Sign in before editing your profile.')
      return
    }

    const username = editUsername.trim().toLowerCase()
    const displayName = editDisplayName.trim()
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setProfileError('Username must be 3–24 characters using letters, numbers, or underscores.')
      return
    }

    setProfileSaveBusy(true)
    setProfileError('')
    const uploadedPaths: string[] = []
    const userId = session.user.id

    try {
      const profilePatch: Partial<Profile> & { updated_at: string } = {
        display_name: displayName,
        username,
        bio: editBio.trim(),
        updated_at: new Date().toISOString(),
      }

      async function uploadProfileImage(file: File, kind: 'avatar' | 'banner') {
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        const path = `${userId}/${kind}/${crypto.randomUUID()}.${extension}`
        const { error } = await supabase!.storage.from('arc-profiles').upload(path, file, { contentType: file.type, upsert: false })
        if (error) throw error
        uploadedPaths.push(path)
        return supabase!.storage.from('arc-profiles').getPublicUrl(path).data.publicUrl
      }

      if (avatarFile) profilePatch.avatar_url = await uploadProfileImage(avatarFile, 'avatar')
      if (bannerFile) profilePatch.banner_url = await uploadProfileImage(bannerFile, 'banner')

      const { data, error } = await supabase.from('profiles').update(profilePatch).eq('id', session.user.id).select('username, display_name, bio, avatar_url, banner_url').single()
      if (error) throw error

      setProfile(data)
      setProfileEditorOpen(false)
      setAvatarFile(null)
      setBannerFile(null)
      setAvatarPreview('')
      setBannerPreview('')
      setProfileMessage('Profile updated.')
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from('arc-profiles').remove(uploadedPaths)
      const message = error instanceof Error ? error.message : 'Could not save your profile. Try again.'
      setProfileError(message.toLowerCase().includes('duplicate') ? 'That username is already taken.' : message)
    } finally {
      setProfileSaveBusy(false)
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setAuthBusy(true)
    setAuthError('')
    setAuthFeedback('')

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { display_name: authName.trim() } },
        })
        if (error) throw error
        if (!data.session) setAuthFeedback('Check your email to confirm your account, then sign in here.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
        if (error) throw error
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(error.message)
    else openScreen('feed')
  }

  async function startCamera(facing: 'user' | 'environment' = cameraFacing) {
    setCameraMessage('')
    setCameraReady(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera access needs a current browser and a secure page (HTTPS or localhost).')
      return
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      })
      streamRef.current = stream
      setCameraFacing(facing)
      setMicEnabled(true)
      setCameraReady(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const message = name === 'NotAllowedError'
        ? 'Camera or microphone permission was blocked. Allow access in your browser settings and try again.'
        : name === 'NotFoundError'
          ? 'No camera or microphone was found on this device.'
          : 'Could not open the camera. Check that another app is not using it, then try again.'
      setCameraMessage(message)
      setCameraReady(false)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraReady(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function selectVideo(file?: File) {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setCameraMessage('Choose a video file to post.')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setCameraMessage('Videos must be 100 MB or smaller.')
      return
    }
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedVideo(file)
    setUploadName(file.name)
    setPreviewUrl(URL.createObjectURL(file))
    setCameraMessage('Video ready. Add a caption and post it when you’re set.')
    stopCamera()
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream) {
      setCameraMessage('Enable the camera and microphone before recording.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setCameraMessage('Video recording is not supported in this browser. Try a recent version of Chrome, Edge, or Safari.')
      return
    }

    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type))
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recordedChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm'
        const blob = new Blob(recordedChunksRef.current, { type })
        if (blob.size > 0) {
          const extension = type.includes('mp4') ? 'mp4' : 'webm'
          const file = new File([blob], `arc-video-${Date.now()}.${extension}`, { type })
          selectVideo(file)
        } else {
          setCameraMessage('The recording was empty. Try recording again.')
        }
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setCameraReady(false)
        setIsRecording(false)
        if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current)
      }
      recorderRef.current = recorder
      recordingStartedAtRef.current = Date.now()
      setRecordedSeconds(0)
      setIsRecording(true)
      recorder.start(250)
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, Number.parseInt(duration, 10) * 1000)
    } catch {
      setCameraMessage('Could not start recording. Check camera permissions and try again.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function publishVideo() {
    if (!selectedVideo) {
      setCameraMessage('Record a video or choose one to upload first.')
      return
    }
    setUploading(true)
    setCameraMessage('')
    let videoUrl = previewUrl
    let storagePath: string | null = null

    try {
      if (supabase && session) {
        const extension = selectedVideo.name.split('.').pop()?.toLowerCase() || 'webm'
        storagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('arc-videos').upload(storagePath, selectedVideo, {
          contentType: selectedVideo.type || 'video/webm',
          upsert: false,
        })
        if (uploadError) throw uploadError

        const { data: publicUrl } = supabase.storage.from('arc-videos').getPublicUrl(storagePath)
        videoUrl = publicUrl.publicUrl
        const { error: insertError } = await supabase.from('videos').insert({
          user_id: session.user.id,
          storage_path: storagePath,
          caption: caption.trim(),
          duration_seconds: recordedSeconds || null,
          status: 'published',
        })
        if (insertError) {
          await supabase.storage.from('arc-videos').remove([storagePath])
          storagePath = null
          throw insertError
        }
      } else if (previewUrl.startsWith('blob:')) {
        publishedPreviewUrlsRef.current.add(previewUrl)
      }

      const newClip: Clip = {
        creator: session ? accountName : 'You',
        handle: session ? accountHandle : '@you',
        initials: session ? accountInitials : 'YU',
        caption: caption.trim() || 'A new moment from my corner of Arc.',
        audio: 'Original sound',
        likes: 0,
        comments: 0,
        image: '',
        imageAlt: 'Your newly posted video',
        color: 'blue',
        videoSrc: videoUrl,
        ownerId: session?.user.id,
      }
      setClips((current) => [newClip, ...current])
      setClipIndex(0)
      setSelectedVideo(null)
      setUploadName('')
      setPreviewUrl('')
      setCaption('')
      setRecordedSeconds(0)
      openScreen('feed')
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : 'Video upload failed. Check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  const accountEmail = session?.user.email ?? ''
  const accountName: string = profile?.display_name || String(session?.user.user_metadata.display_name ?? '') || accountEmail.split('@')[0] || 'Arc creator'
  const accountHandle = `@${profile?.username || accountEmail.split('@')[0] || 'creator'}`
  const accountInitials = accountName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const accountClips = session ? clips.filter((item) => item.ownerId === session.user.id) : []

  if (isSupabaseConfigured && !authReady) {
    return <main className="stage"><section className="auth-device auth-loading"><span className="auth-spinner" /><span>Connecting to Arc</span></section></main>
  }

  if (isSupabaseConfigured && !session) {
    return (
      <main className="stage">
        <section className="auth-device" aria-label="Arc account">
          <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
          <div className="auth-content">
            <button className="auth-wordmark" onClick={() => { setAuthMode('signin'); setAuthFeedback(''); setAuthError('') }}>Arc<span>.</span></button>
            <div className="auth-overline"><span /> A DIFFERENT KIND OF FEED</div>
            <h1>{authMode === 'signup' ? <>Make your<br /><em>own corner.</em></> : <>Good things<br /><em>start here.</em></>}</h1>
            <p className="auth-intro">{authMode === 'signup' ? 'Create an account to find your people and share what you love.' : 'Sign in to pick up where your people left off.'}</p>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'signup' && <label>Your name<input autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="What should we call you?" required maxLength={60} /></label>}
              <label>Email address<input type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" required /></label>
              <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              {authFeedback && <p className="auth-feedback" role="status">{authFeedback}</p>}
              <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'One moment…' : authMode === 'signup' ? 'Create account' : 'Sign in'}<Send size={15} /></button>
            </form>
            <p className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New around here?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); setAuthFeedback('') }}>{authMode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
            <div className="auth-footer"><span>MAKE ROOM FOR GOOD THINGS</span><span>ARC / 01</span></div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="stage">
      <div className={`app-device screen-${screen}`}>
        <DesktopSidebar screen={screen} onNavigate={openScreen} accountName={session ? accountName : ''} />
        {screen === 'feed' && (
          <section className="feed-screen" aria-label="Video feed">
            <header className="feed-header">
              <button className="wordmark" onClick={() => openScreen('feed')} aria-label="Arc home">Arc<span>.</span></button>
              <button className="header-icon" aria-label="Search videos" onClick={() => openScreen('discover')}><Search size={20} /></button>
            </header>
            <div className="feed-tabs" role="tablist" aria-label="Choose video feed">
              {(['For You', 'Following', 'Nearby'] as FeedTab[]).map((tab) => (
                <button key={tab} role="tab" aria-selected={feedTab === tab} className={feedTab === tab ? 'feed-tab selected' : 'feed-tab'} onClick={() => setFeedTab(tab)}>{tab}</button>
              ))}
            </div>

            <div className="desktop-feed-layout">
            <article className="clip-card" key={clipIndex} aria-label={`Video by ${clip.creator}`}>
              {clip.videoSrc ? <video src={clip.videoSrc} className="clip-image" autoPlay loop playsInline muted={videoMuted} /> : <img src={clip.image} alt={clip.imageAlt} className="clip-image" />}
              <div className="clip-tint" />
              <div className="clip-topline"><span className="clip-live"><span /> PLAYING</span><button aria-label="Video options" className="clip-more"><MoreHorizontal size={19} /></button></div>
              <button className="clip-next clip-next-up" onClick={() => changeClip(-1)} aria-label="Previous video"><ChevronDown size={18} /></button>
              <button className="clip-next clip-next-down" onClick={() => changeClip(1)} aria-label="Next video"><ChevronDown size={18} /></button>

              <div className="clip-actions" aria-label="Video actions">
                <button className={liked ? 'clip-action active like-action' : 'clip-action like-action'} onClick={() => setLiked((value) => !value)} aria-label={liked ? 'Unlike video' : 'Like video'}><Heart size={25} fill={liked ? 'currentColor' : 'none'} /><span>{formatCount(clip.likes + (liked ? 1 : 0))}</span></button>
                <button className="clip-action" onClick={() => setCameraMessage('Comments are ready to join the conversation.')} aria-label={`${clip.comments} comments`}><MessageCircle size={24} /><span>{formatCount(clip.comments)}</span></button>
                <button className="clip-action" onClick={() => setCameraMessage('Share link copied.')} aria-label="Share video"><Share2 size={23} /><span>Share</span></button>
                <button className={saved ? 'clip-action active' : 'clip-action'} onClick={() => setSaved((value) => !value)} aria-label={saved ? 'Remove saved video' : 'Save video'}><Bookmark size={22} fill={saved ? 'currentColor' : 'none'} /><span>{saved ? 'Saved' : 'Save'}</span></button>
                {clip.videoSrc && <button className="clip-action sound-action" onClick={() => setVideoMuted((value) => !value)} aria-label={videoMuted ? 'Turn video sound on' : 'Mute video'}>{videoMuted ? <VolumeX size={21} /> : <Volume2 size={21} />}<span>{videoMuted ? 'Sound off' : 'Sound on'}</span></button>}
              </div>

              <div className="clip-caption">
                <div className="creator-line">
                  <button className={`creator-avatar avatar-${clip.color}`} onClick={() => openScreen('profile')} aria-label={`View ${clip.creator}'s profile`}>{clip.initials}</button>
                  <button className="creator-identity" onClick={() => openScreen('profile')}><strong>{clip.creator}</strong><span>{clip.handle}</span></button>
                  <button className={following ? 'follow-pill is-following' : 'follow-pill'} onClick={() => setFollowing((value) => !value)}>{following ? <Check size={14} /> : 'Follow'}</button>
                </div>
                <p>{clip.caption}</p>
                <div className="clip-audio"><Music2 size={13} /><span>{clip.audio}</span></div>
              </div>
              <div className="video-progress"><span style={{ width: `${28 + clipIndex * 17}%` }} /></div>
            </article>
            <aside className="desktop-context" aria-label="Video details">
              <span className="context-kicker">ON YOUR FEED</span>
              <h2>One good thing<br />leads to <em>another.</em></h2>
              <div className="context-creator"><span className={`context-avatar avatar-${clip.color}`}>{clip.initials}</span><span><strong>{clip.creator}</strong><small>{clip.handle}</small></span><button onClick={() => setFollowing((value) => !value)}>{following ? 'Following' : 'Follow'}</button></div>
              <p className="context-caption">{clip.caption}</p>
              <div className="context-audio"><Music2 size={14} />{clip.audio}</div>
              <div className="context-divider" />
              <span className="context-kicker">YOUR NEXT RABBIT HOLE</span>
              <button className="context-topic" onClick={() => setFeedTab('Nearby')}><span className="topic-swatch topic-blue" /><span><strong>Out there, lately</strong><small>Little discoveries from the world around us</small></span><ChevronDown size={16} /></button>
              <button className="context-topic" onClick={() => setFeedTab('Following')}><span className="topic-swatch topic-coral" /><span><strong>Made by hand</strong><small>People making things their own way</small></span><ChevronDown size={16} /></button>
              <div className="context-footnote"><Sparkles size={14} /><span>Less noise. More things worth your time.</span></div>
            </aside>
            </div>
            {cameraMessage && <div className="inline-message" role="status">{cameraMessage}<button onClick={() => setCameraMessage('')} aria-label="Dismiss"><X size={14} /></button></div>}
            <BottomNav screen={screen} onNavigate={openScreen} />
          </section>
        )}

        {screen === 'profile' && (
          <section className="profile-screen" aria-label="Creator profile">
            <header className="profile-header"><button className="header-icon" onClick={() => openScreen('feed')} aria-label="Back to feed"><ArrowLeft size={20} /></button><strong>Profile</strong><button className="header-icon" onClick={session ? signOut : undefined} aria-label={session ? 'Sign out' : 'Profile options'}>{session ? <LogOut size={17} /> : <MoreHorizontal size={20} />}</button></header>
            <div className="profile-hero">{profile?.banner_url && <img className="profile-banner-image" src={profile.banner_url} alt="Profile banner" />}<div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="profile-avatar">{session && profile?.avatar_url ? <img src={profile.avatar_url} alt={`${accountName} profile`} /> : session ? accountInitials : 'MC'}</div><div className="profile-buttons">{session ? <button className="primary-pill" onClick={beginProfileEdit}>Edit profile</button> : <><button className={following ? 'primary-pill followed' : 'primary-pill'} onClick={() => setFollowing((value) => !value)}>{following ? <><Check size={15} /> Following</> : 'Follow'}</button><button className="outline-pill" onClick={() => setCameraMessage('Message Maya Cooks')}><Send size={14} /> Message</button></>}</div></div>
            <div className="profile-info"><h1>{session ? accountName : 'Maya Cooks'}</h1><span className="profile-handle">{session ? accountHandle : '@maya.cooks'}</span><p>{session ? profile?.bio || 'Your Arc profile. Add a little about yourself.' : 'Quick weeknight recipes. New video every day.'}</p></div>
            <div className="profile-stats"><div><strong>{session ? '0' : '128'}</strong><span>Following</span></div><div><strong>{session ? '0' : '48.2K'}</strong><span>Followers</span></div><div><strong>{session ? '0' : '1.1M'}</strong><span>Likes</span></div></div>
            <div className="profile-post-heading"><span>VIDEOS</span><button aria-label="Video grid settings"><Settings2 size={16} /></button></div>
            {session && accountClips.length === 0 ? <div className="profile-empty"><Video size={19} /><strong>Your videos will live here</strong><span>Share your first clip to start building your profile.</span></div> : <div className="video-grid">{(session ? accountClips : clips).map((item, index) => <button key={`${item.handle}-${index}`} className="video-tile" onClick={() => { setClipIndex(clips.indexOf(item)); openScreen('feed') }} aria-label={`Play video: ${item.caption}`}>{item.videoSrc ? <video src={item.videoSrc} muted playsInline /> : <img src={item.image} alt={item.imageAlt} />}<span className="tile-play"><Video size={14} /></span><span className="tile-views">{item.likes ? formatCount(item.likes) : 'New'}</span></button>)}{!session && <button className="video-tile tile-blue" onClick={() => setCameraMessage('More videos are on the way.')} aria-label="More videos"><Sparkles size={21} /><span className="tile-views">410K</span></button>}</div>}
            {cameraMessage && <div className="profile-message" role="status">{cameraMessage}<button onClick={() => setCameraMessage('')} aria-label="Dismiss"><X size={14} /></button></div>}
            {profileMessage && <div className="profile-message" role="status">{profileMessage}<button onClick={() => setProfileMessage('')} aria-label="Dismiss"><X size={14} /></button></div>}
            {profileEditorOpen && <div className="profile-editor-backdrop"><form className="profile-editor" onSubmit={saveProfile} role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
              <header className="profile-editor-header"><span><small>YOUR ACCOUNT</small><strong id="profile-editor-title">Edit profile</strong></span><button type="button" className="header-icon" onClick={() => setProfileEditorOpen(false)} aria-label="Close profile editor"><X size={18} /></button></header>
              <label className="profile-banner-picker" style={{ backgroundImage: bannerPreview ? `url(${bannerPreview})` : profile?.banner_url ? `url(${profile.banner_url})` : undefined }}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProfileImage(event.target.files?.[0], 'banner')} /><ImagePlus size={17} /><span>{profile?.banner_url || bannerPreview ? 'Change banner' : 'Add a banner'}</span></label>
              <div className="profile-avatar-picker-row"><label className="profile-avatar-picker">{avatarPreview || profile?.avatar_url ? <img src={avatarPreview || profile?.avatar_url || ''} alt="Profile photo preview" /> : <span>{accountInitials}</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProfileImage(event.target.files?.[0], 'avatar')} /><span className="avatar-picker-icon"><ImagePlus size={14} /></span></label><span>Profile photo<br /><small>Square images work best</small></span></div>
              <label className="editor-field">Display name<input value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} maxLength={60} required /></label>
              <label className="editor-field">Username<div className="username-input"><span>@</span><input value={editUsername} onChange={(event) => setEditUsername(event.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required /></div></label>
              <label className="editor-field">Bio<textarea value={editBio} onChange={(event) => setEditBio(event.target.value)} maxLength={160} placeholder="A little about you…" rows={3} /><small>{editBio.length}/160</small></label>
              {profileError && <p className="auth-error" role="alert">{profileError}</p>}
              <footer className="profile-editor-actions"><button type="button" className="discard-video" onClick={() => setProfileEditorOpen(false)}>Cancel</button><button type="submit" className="publish-video" disabled={profileSaveBusy}>{profileSaveBusy ? 'Saving…' : 'Save changes'}{!profileSaveBusy && <Check size={14} />}</button></footer>
            </form></div>}
            <BottomNav screen={screen} onNavigate={openScreen} />
          </section>
        )}

        {screen === 'create' && (
          <section className="create-screen" aria-label="Create a video">
            <div className={`camera-preview ${cameraReady ? 'camera-live' : ''} ${previewUrl ? 'has-video-preview' : ''}`}>
              <div className="camera-preview-bg" />
              <video ref={videoRef} className="capture-preview" src={previewUrl || undefined} autoPlay={cameraReady && !previewUrl} playsInline muted controls={Boolean(previewUrl)} />
              <header className="camera-header"><button onClick={() => openScreen('feed')} aria-label="Close camera"><X size={18} /><span>Close</span></button><button onClick={() => setCameraMessage('Choose a sound for your video.')}><Music2 size={15} /><span>Add sound</span></button></header>
              {!previewUrl && <div className="camera-tools"><button onClick={() => startCamera(cameraFacing === 'user' ? 'environment' : 'user')} disabled={!cameraReady}><span>↔</span>Flip</button><button onClick={() => setCameraMessage('Recording at normal speed.')}><span>1×</span>Speed</button><button onClick={() => setCameraMessage('Filters are coming soon.')}><Sparkles size={15} />Filters</button><button onClick={() => setCameraMessage('Timer is coming soon.')}><span>◷</span>Timer</button></div>}
              {uploadName && <div className="upload-chip"><Check size={13} />{uploadName}</div>}
              {cameraMessage && <div className="camera-toast" role="status">{cameraMessage}<button onClick={() => setCameraMessage('')} aria-label="Dismiss"><X size={13} /></button></div>}
              {!cameraReady && !previewUrl && <div className="camera-permission"><div className="camera-permission-icon"><Video size={22} /><Mic2 size={15} /></div><strong>Let life in.</strong><span>Arc needs your camera and microphone to record a video.</span><button onClick={() => startCamera()}>Enable camera & mic</button></div>}
              {previewUrl && <div className="post-video-panel"><label htmlFor="video-caption">Add a caption</label><textarea id="video-caption" value={caption} maxLength={500} onChange={(event) => setCaption(event.target.value)} placeholder="Say something about this moment…" /><div className="video-panel-actions"><button className="discard-video" onClick={() => { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setPreviewUrl(''); setSelectedVideo(null); setUploadName(''); setCaption(''); setCameraMessage('') }}>Discard</button><button className="publish-video" onClick={publishVideo} disabled={uploading}>{uploading ? 'Uploading…' : 'Post video'}{!uploading && <ArrowDownToLine size={14} />}</button></div></div>}
              {!previewUrl && <div className="camera-bottom">
                <div className="duration-picker" aria-label="Recording length">{['15s', '30s', '60s'].map((value) => <button key={value} className={duration === value ? 'chosen' : ''} onClick={() => setDuration(value)}>{value}</button>)}</div>
                <div className="capture-row">
                  <label className="capture-side" aria-label="Upload video"><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={(event) => selectVideo(event.target.files?.[0])} /><ImagePlus size={19} /><span>Upload</span></label>
                  <button className={isRecording ? 'record-button recording' : 'record-button'} onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? 'Stop recording' : 'Start recording'} disabled={!cameraReady && !isRecording}><span /></button>
                  <button className={micEnabled ? 'capture-side' : 'capture-side muted'} onClick={() => { const track = streamRef.current?.getAudioTracks()[0]; if (!track) { setCameraMessage('Enable the camera to control the microphone.'); return } track.enabled = !track.enabled; setMicEnabled(track.enabled) }} aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}><Mic2 size={19} /><span>{micEnabled ? 'Mic on' : 'Mic off'}</span></button>
                </div>
                <p className="record-hint">{isRecording ? `Recording · ${recordedSeconds}s / ${duration}` : cameraReady ? 'Camera ready · tap to record' : 'Enable the camera or upload a clip'}</p>
              </div>}
            </div>
            <div className="camera-sound"><Mic2 size={14} /><span>{cameraReady ? 'Camera and microphone are active' : 'Original sound'}</span><CircleHelp size={14} /></div>
          </section>
        )}

        {screen === 'discover' && (
          <section className="secondary-screen" aria-label="Discover videos"><header className="profile-header"><button className="wordmark" onClick={() => openScreen('feed')}>Arc<span>.</span></button><button className="header-icon" aria-label="Search"><Search size={20} /></button></header><label className="discover-search"><Search size={18} /><input placeholder="Find your next favorite" aria-label="Search creators and videos" /></label><div className="discover-heading"><span>MADE FOR YOUR CURIOSITY</span><h1>Find your<br /><em>next thing.</em></h1></div><div className="discover-chips">{['All', 'Food', 'Outdoors', 'Design', 'Music', 'Daily life'].map((tag, index) => <button className={index === 0 ? 'selected' : ''} key={tag} onClick={() => setCameraMessage(`Showing ${tag.toLowerCase()} videos.`)}>{tag}</button>)}</div><div className="discover-grid">{clips.map((item, index) => <button className="discover-card" key={item.handle} onClick={() => { setClipIndex(index); openScreen('feed') }}><img src={item.image} alt={item.imageAlt} /><span className="discover-card-overlay"><strong>{item.creator}</strong><small>{formatCount(item.likes)} likes</small></span></button>)}</div>{cameraMessage && <div className="profile-message" role="status">{cameraMessage}<button onClick={() => setCameraMessage('')} aria-label="Dismiss"><X size={14} /></button></div>}<BottomNav screen={screen} onNavigate={openScreen} /></section>
        )}

        {screen === 'inbox' && (
          <section className="secondary-screen inbox-screen" aria-label="Inbox"><header className="profile-header"><button className="wordmark" onClick={() => openScreen('feed')}>Arc<span>.</span></button><button className="header-icon" aria-label="New message"><Plus size={20} /></button></header><div className="inbox-title"><span>YOUR PEOPLE</span><h1>Inbox</h1><p>Good conversations start somewhere.</p></div><div className="inbox-empty"><div className="inbox-symbol"><MessageCircle size={25} /></div><strong>It’s quiet in here.</strong><span>When someone sends a note, you’ll find it here.</span><button onClick={() => openScreen('discover')}>Meet people <ArrowLeft size={14} /></button></div><BottomNav screen={screen} onNavigate={openScreen} /></section>
        )}
      </div>
      <div className="stage-caption"><span className="stage-dot" /> A FEED THAT MOVES WITH YOU <span>ARC / 01</span></div>
    </main>
  )
}

function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  return <nav className="bottom-nav" aria-label="Main navigation">{navItems.map(({ screen: target, label, Icon }) => <button key={target} className={`${screen === target ? 'current' : ''} ${target === 'create' ? 'create-tab' : ''}`} onClick={() => onNavigate(target)} aria-label={label} aria-current={screen === target ? 'page' : undefined}><Icon size={target === 'create' ? 20 : 19} strokeWidth={target === 'create' ? 2.4 : 1.8} /><span>{label}</span></button>)}</nav>
}

function DesktopSidebar({ screen, onNavigate, accountName }: { screen: Screen; onNavigate: (screen: Screen) => void; accountName: string }) {
  const initials = accountName ? accountName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : 'A'

  return (
    <aside className="desktop-sidebar">
      <button className="desktop-brand" onClick={() => onNavigate('feed')}>Arc<span>.</span></button>
      <span className="desktop-nav-label">YOUR SPACE</span>
      <nav className="desktop-nav" aria-label="Desktop navigation">
        {navItems.map(({ screen: target, label, Icon }) => <button key={target} className={`${screen === target ? 'active' : ''} ${target === 'create' ? 'desktop-create-link' : ''}`} onClick={() => onNavigate(target)} aria-current={screen === target ? 'page' : undefined}><Icon size={18} /><span>{label}</span>{screen === target && <i />}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><Sparkles size={16} /><strong>Find your frequency.</strong><span>Follow the things that make you, you.</span></div>
        <div className="sidebar-account"><span className="sidebar-account-avatar">{initials}</span><span><strong>{accountName || 'Arc guest'}</strong><small>{accountName ? 'Your account' : 'Browsing the demo'}</small></span><MoreHorizontal size={17} /></div>
      </div>
    </aside>
  )
}

export default App