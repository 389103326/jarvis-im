/**
 * components/Chat/VoiceRecorder.jsx - 语音消息录制组件
 * 使用 MediaRecorder API 录制音频，编码为 WebM/Opus 格式
 * 录制完成后返回 base64 data URL
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'

// 最长录制时长（秒）
const MAX_DURATION = 120

export default function VoiceRecorder({ onSend, onCancel }) {
  const [state, setState] = useState('idle') // 'idle' | 'recording' | 'paused' | 'done'
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [waveform, setWaveform] = useState(Array(20).fill(3)) // 波形数据
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)

  // 清理
  useEffect(() => {
    return () => {
      stopTimer()
      stopWaveform()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopWaveform = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }

  const startWaveformAnalysis = (stream) => {
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      // 取20个点作为波形
      const bars = Array.from({ length: 20 }, (_, i) => {
        const idx = Math.floor((i / 20) * data.length)
        return Math.max(3, Math.round((data[idx] / 255) * 28))
      })
      setWaveform(bars)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      chunksRef.current = []

      // 检测支持的 MIME 类型
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(
        m => MediaRecorder.isTypeSupported(m)
      ) || ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('done')
        stream.getTracks().forEach(t => t.stop())
        stopWaveform()
        setWaveform(Array(20).fill(3))
      }

      recorder.start(100) // 每100ms产生一个chunk
      setState('recording')
      setDuration(0)

      // 开始波形分析
      startWaveformAnalysis(stream)

      // 计时器
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording()
            return MAX_DURATION
          }
          return prev + 1
        })
      }, 1000)

    } catch (err) {
      console.error('[VoiceRecorder] Error:', err)
      if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许')
      } else {
        setError('无法访问麦克风，请检查设备')
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    stopTimer()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const handleSend = useCallback(async () => {
    if (!audioBlob) return

    // 转为 base64 data URL
    const reader = new FileReader()
    reader.onloadend = () => {
      onSend(reader.result)
    }
    reader.readAsDataURL(audioBlob)
  }, [audioBlob, onSend])

  const handleCancel = () => {
    stopTimer()
    stopWaveform()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    onCancel()
  }

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-discord-input rounded-xl border border-discord-accent/40 shadow-lg">
      {/* 左：操作按钮 */}
      <button
        onClick={handleCancel}
        className="text-discord-muted hover:text-discord-red transition-colors p-1 rounded-full hover:bg-discord-red/10 flex-shrink-0"
        title="取消录音"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      {/* 中：波形 + 时长 */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {state === 'recording' && (
          <span className="w-2 h-2 rounded-full bg-discord-red flex-shrink-0 animate-pulse" />
        )}

        {state === 'done' && audioUrl ? (
          <audio
            src={audioUrl}
            controls
            className="w-full h-8 audio-player-mini"
            style={{ colorScheme: 'dark' }}
          />
        ) : (
          // 波形动画
          <div className="flex items-center gap-0.5 flex-1 h-8">
            {waveform.map((h, i) => (
              <div
                key={i}
                className={`rounded-full flex-1 transition-all duration-75 ${
                  state === 'recording' ? 'bg-discord-accent' : 'bg-discord-muted'
                }`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        )}

        <span className={`text-xs font-mono flex-shrink-0 ${
          state === 'recording' ? 'text-discord-red' : 'text-discord-muted'
        }`}>
          {formatDuration(duration)}
          {state === 'recording' && duration > 0 && (
            <span className="text-discord-muted/60">/{formatDuration(MAX_DURATION)}</span>
          )}
        </span>
      </div>

      {/* 右：录制/停止/发送按钮 */}
      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-discord-red hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-md"
          title="开始录音"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
      )}

      {state === 'recording' && (
        <button
          onClick={stopRecording}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-discord-red hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-md animate-pulse"
          title="停止录音"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z"/>
          </svg>
        </button>
      )}

      {state === 'done' && (
        <button
          onClick={handleSend}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-discord-accent hover:bg-indigo-600 text-white flex items-center justify-center transition-colors shadow-md"
          title="发送语音消息"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-full left-0 mb-2 bg-discord-red text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-64">
          {error}
        </div>
      )}
    </div>
  )
}
