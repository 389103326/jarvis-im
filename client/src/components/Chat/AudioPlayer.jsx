/**
 * components/Chat/AudioPlayer.jsx - 语音消息播放器
 * 自定义音频播放 UI，支持进度条、播放速度、波形显示
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'

export default function AudioPlayer({ src, duration: initialDuration }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [loading, setLoading] = useState(true)
  const audioRef = useRef(null)

  const RATES = [1, 1.5, 2]

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => {
      setTotalDuration(audio.duration || 0)
      setLoading(false)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {})
    }
  }, [playing])

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !totalDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * totalDuration
    setCurrentTime(pct * totalDuration)
  }

  const cycleRate = () => {
    const audio = audioRef.current
    if (!audio) return
    const next = RATES[(RATES.indexOf(playbackRate) + 1) % RATES.length]
    audio.playbackRate = next
    setPlaybackRate(next)
  }

  const formatTime = (secs) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0

  // 简单的静态波形（20根竖条，模拟声音分布）
  const staticWave = [4, 8, 14, 10, 18, 22, 16, 12, 20, 24, 20, 16, 22, 18, 14, 10, 16, 12, 8, 4]

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-discord-input rounded-xl mt-1 max-w-xs group/audio">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* 播放/暂停按钮 */}
      <button
        onClick={togglePlay}
        disabled={loading}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-discord-accent hover:bg-indigo-600 text-white flex items-center justify-center transition-colors disabled:opacity-40"
        title={playing ? '暂停' : '播放'}
      >
        {loading ? (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* 波形进度条 */}
      <div
        className="flex-1 flex items-center gap-px cursor-pointer h-8 select-none"
        onClick={handleSeek}
        title="点击跳转"
      >
        {staticWave.map((h, i) => {
          const isPlayed = i / staticWave.length <= progress
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors ${
                isPlayed ? 'bg-discord-accent' : 'bg-discord-muted/40 group-hover/audio:bg-discord-muted/60'
              }`}
              style={{ height: `${h}px` }}
            />
          )
        })}
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {/* 时间 */}
        <span className="text-[10px] text-discord-muted font-mono">
          {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(totalDuration)}
        </span>

        {/* 倍速按钮 */}
        <button
          onClick={cycleRate}
          className="text-[9px] text-discord-muted hover:text-discord-accent transition-colors font-mono leading-none px-0.5 rounded"
          title={`播放速度：${playbackRate}x，点击切换`}
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  )
}
