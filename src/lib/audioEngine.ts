// Web Audio Engine for TikTok-style feed audio
// Generates realistic musical background tracks for each clip without external dependencies

class FeedAudioEngine {
  private ctx: AudioContext | null = null
  private currentTrackId: string | null = null
  private activeNodes: { stop: () => void }[] = []
  private isMuted: boolean = false
  private volume: number = 0.6
  private loopInterval: number | null = null
  private variant: 'for-you' | 'following' = 'for-you'

  // Per-variant mix: "For you" is the full, present mix; "following" is a
  // quieter, sparser bed so the two feeds are audibly different.
  private mixFor(variant: 'for-you' | 'following') {
    return variant === 'following'
      ? { chordGain: 0.035, bassGain: 0.07 }
      : { chordGain: 0.06, bassGain: 0.12 }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
    if (muted) {
      this.stop()
    } else if (this.currentTrackId) {
      this.play(this.currentTrackId)
    }
  }

  public getMuted(): boolean {
    return this.isMuted
  }

  public stop() {
    if (this.loopInterval !== null) {
      window.clearInterval(this.loopInterval)
      this.loopInterval = null
    }
    this.activeNodes.forEach((node) => {
      try {
        node.stop()
      } catch {
        // already stopped
      }
    })
    this.activeNodes = []
  }

  public play(trackId: string, variant: 'for-you' | 'following' = 'for-you') {
    this.currentTrackId = trackId
    this.variant = variant
    this.stop()
    if (this.isMuted) return

    const ctx = this.getContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this.scheduleTrack(trackId, ctx)).catch(() => {})
    } else {
      this.scheduleTrack(trackId, ctx)
    }
  }

  // Deterministic hash so every clip id maps to its own stable musical DNA.
  private hashId(id: string): number {
    let h = 2166136261
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return Math.abs(h)
  }

  // Any clip without a hand-written pattern still gets a UNIQUE track derived
  // from its id: its own key, progression, tempo, and waveform.
  private generatedPattern(trackId: string): { chords: number[][]; bpm: number; type: OscillatorType } {
    const h = this.hashId(trackId)
    const roots = [130.81, 146.83, 164.81, 174.61, 196, 220, 246.94]
    const root = roots[h % roots.length]
    const minor = (h >> 3) % 2 === 0
    const fifth = root * 1.4983
    const sixth = root * (minor ? 1.7818 : 1.6818)
    const seventh = root * (minor ? 2 * 0.9439 : 2 * 0.8909)
    const degrees = [root, root * 0.8909, root * 0.7937, root * 0.9439]
    const chords: number[][] = degrees.map((base, i) => {
      const shifted = [base, base * (minor ? 1.1892 : 1.2599), i % 2 === 1 ? seventh : fifth]
      if (i === 1 || i === 3) shifted.push(sixth)
      return shifted.map((f) => Number(f.toFixed(2)))
    })
    return {
      chords,
      bpm: 70 + (h % 46), // 70-115 bpm
      type: (['sine', 'triangle', 'sine'] as OscillatorType[])[(h >> 5) % 3],
    }
  }

  private scheduleTrack(trackId: string, ctx: AudioContext) {
    // Select chord progression and pattern based on clip ID
    const patterns: Record<string, { chords: number[][]; bpm: number; type: OscillatorType }> = {
      mountain: {
        chords: [[220, 261.63, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]], // Am - G - F - G
        bpm: 80,
        type: 'sine',
      },
      food: {
        chords: [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]], // C - Am - F - G
        bpm: 105,
        type: 'triangle',
      },
      coast: {
        chords: [[196, 246.94, 293.66], [164.81, 196, 246.94], [174.61, 220, 261.63], [196, 246.94, 293.66]], // G - Em - F - G
        bpm: 72,
        type: 'sine',
      },
      coffee: {
        chords: [[261.63, 329.63, 392, 493.88], [220, 261.63, 329.63, 392], [174.61, 220, 261.63, 329.63], [196, 246.94, 293.66, 349.23]], // Cmaj7 - Am7 - Fmaj7 - G7
        bpm: 85,
        type: 'sine',
      },
      studio: {
        chords: [[174.61, 220, 261.63], [220, 261.63, 329.63], [196, 246.94, 293.66], [164.81, 196, 246.94]],
        bpm: 95,
        type: 'triangle',
      },
      city: {
        chords: [[220, 261.63, 329.63], [174.61, 220, 261.63], [130.81, 164.81, 196], [164.81, 196, 246.94]],
        bpm: 90,
        type: 'sine',
      },
      ceramics: {
        chords: [[196, 246.94, 293.66], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]],
        bpm: 76,
        type: 'sine',
      },
      scenic: {
        chords: [[261.63, 329.63, 392], [196, 246.94, 293.66], [220, 261.63, 329.63], [174.61, 220, 261.63]],
        bpm: 84,
        type: 'sine',
      },
    }

    // Hand-tuned pattern for known clips; every other clip (uploaded videos,
    // new posts) gets its own unique generated track from its id.
    const config = patterns[trackId] ?? this.generatedPattern(trackId)
    const beatDuration = 60 / config.bpm
    const loopTotal = config.chords.length * beatDuration * 2
    const mix = this.mixFor(this.variant)

    const playLoop = () => {
      if (this.isMuted || !this.ctx) return
      const now = ctx.currentTime

      config.chords.forEach((chord, chordIdx) => {
        const chordTime = now + chordIdx * beatDuration * 2

        // Soft pad chords
        chord.forEach((freq) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          const filter = ctx.createBiquadFilter()

          osc.type = config.type
          osc.frequency.setValueAtTime(freq, chordTime)

          filter.type = 'lowpass'
          filter.frequency.setValueAtTime(800, chordTime)

          gain.gain.setValueAtTime(0.001, chordTime)
          gain.gain.exponentialRampToValueAtTime(mix.chordGain * this.volume, chordTime + 0.3)
          gain.gain.exponentialRampToValueAtTime(0.001, chordTime + beatDuration * 1.9)

          osc.connect(filter)
          filter.connect(gain)
          gain.connect(ctx.destination)

          osc.start(chordTime)
          osc.stop(chordTime + beatDuration * 2)

          this.activeNodes.push({
            stop: () => {
              try {
                osc.stop()
                osc.disconnect()
              } catch {}
            },
          })
        })

        // Gentle sub-bass pulse on the root note
        const bassFreq = chord[0] / 2
        const bassOsc = ctx.createOscillator()
        const bassGain = ctx.createGain()

        bassOsc.type = 'sine'
        bassOsc.frequency.setValueAtTime(bassFreq, chordTime)

        bassGain.gain.setValueAtTime(0.001, chordTime)
        bassGain.gain.exponentialRampToValueAtTime(mix.bassGain * this.volume, chordTime + 0.05)
        bassGain.gain.exponentialRampToValueAtTime(0.001, chordTime + beatDuration * 1.5)

        bassOsc.connect(bassGain)
        bassGain.connect(ctx.destination)

        bassOsc.start(chordTime)
        bassOsc.stop(chordTime + beatDuration * 2)

        this.activeNodes.push({
          stop: () => {
            try {
              bassOsc.stop()
              bassOsc.disconnect()
            } catch {}
          },
        })
      })
    }

    playLoop()
    this.loopInterval = window.setInterval(playLoop, loopTotal * 1000)
  }
}

export const feedAudio = new FeedAudioEngine()
