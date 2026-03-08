/**
 * components/Chat/VoiceCallModal.jsx - WebRTC 音视频通话弹窗
 * 支持: 音频/视频通话，静音，摄像头开关，通话计时，来电铃声
 */

import React, { useEffect, useRef } from 'react'
import useCallStore from '../../store/useCallStore'
import Avatar from '../common/Avatar'

// 格式化通话时长
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// 通话中控制按钮
function CallButton({ onClick, active, danger, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all text-white font-medium
        ${danger
          ? 'bg-discord-red hover:bg-red-600 active:scale-95'
          : active
          ? 'bg-discord-accent hover:bg-indigo-600 active:scale-95'
          : 'bg-discord-hover hover:bg-discord-input active:scale-95'
        }
      `}
    >
      {children}
    </button>
  )
}

export default function VoiceCallModal() {
  const {
    callStatus,
    callType,
    remoteUser,
    isCaller,
    isMuted,
    isCameraOff,
    callDuration,
    _streamVersion,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCallStore()

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)

  // 订阅 callStatus/_streamVersion 变化后绑定流
  useEffect(() => {
    if (callStatus !== 'connected') return
    
    // 轮询直到 remoteStream 就绪（RTCPeerConnection 的 ontrack 是异步的）
    let attempts = 0
    const tryBind = () => {
      const store = useCallStore.getState()
      const remoteStream = store._remoteStream
      if (remoteStream) {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream
        if (remoteVideoRef.current && callType === 'video') remoteVideoRef.current.srcObject = remoteStream
        // 本地视频
        const localStream = store._localStream
        if (localVideoRef.current && localStream && callType === 'video') {
          localVideoRef.current.srcObject = localStream
        }
      } else if (attempts < 20) {
        attempts++
        setTimeout(tryBind, 200)
      }
    }
    tryBind()
  }, [callStatus, callType, _streamVersion])

  if (callStatus === 'idle') return null

  return (
    <div className="fixed inset-0 flex items-end md:items-center justify-center z-[100] pointer-events-none">
      {/* 背景遮罩（仅来电时全屏遮） */}
      {callStatus === 'incoming' && (
        <div className="absolute inset-0 bg-black/70 pointer-events-auto" />
      )}

      {/* 通话弹窗 */}
      <div className={`
        relative pointer-events-auto call-modal-enter
        w-full md:w-auto md:min-w-[340px] md:max-w-sm
        bg-discord-sidebar rounded-t-2xl md:rounded-2xl shadow-2xl
        border border-discord-bg/50
        ${callStatus === 'incoming' ? 'mb-0 md:mb-0' : 'mb-0'}
      `}>
        {/* 远端音频（始终挂载） */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* ====== 来电 UI ====== */}
        {callStatus === 'incoming' && (
          <div className="flex flex-col items-center px-8 py-8 gap-5">
            <div className="text-discord-muted text-sm font-medium tracking-wide">
              来电 {callType === 'video' ? '📹 视频通话' : '📞 语音通话'}
            </div>

            {/* 头像（脉冲动画） */}
            <div
              className="call-avatar-pulse rounded-full"
              style={{ borderRadius: '50%' }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl text-white font-bold"
                style={{ backgroundColor: remoteUser?.avatarColor || '#5865f2' }}
              >
                {remoteUser?.username?.[0]?.toUpperCase() || '?'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-white text-xl font-semibold">{remoteUser?.username}</div>
              <div className="text-discord-muted text-sm mt-1 flex items-center gap-1 justify-center">
                <span className="call-ring-icon">📱</span>
                <span>正在呼叫你…</span>
              </div>
            </div>

            {/* 接听 / 拒绝按钮 */}
            <div className="flex items-center gap-8 mt-2">
              <div className="flex flex-col items-center gap-1.5">
                <CallButton onClick={rejectCall} danger title="拒绝">
                  <span className="text-2xl">📵</span>
                </CallButton>
                <span className="text-xs text-discord-muted">拒绝</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <CallButton onClick={answerCall} active title="接听">
                  <span className="text-2xl">📞</span>
                </CallButton>
                <span className="text-xs text-discord-muted">接听</span>
              </div>
            </div>
          </div>
        )}

        {/* ====== 拨出等待 UI ====== */}
        {callStatus === 'calling' && (
          <div className="flex flex-col items-center px-8 py-8 gap-5">
            <div className="text-discord-muted text-sm font-medium">
              正在拨出 {callType === 'video' ? '📹 视频通话' : '📞 语音通话'}
            </div>

            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white font-bold call-avatar-pulse"
              style={{ backgroundColor: remoteUser?.avatarColor || '#5865f2' }}
            >
              {remoteUser?.username?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="text-center">
              <div className="text-white text-lg font-semibold">{remoteUser?.username}</div>
              <div className="text-discord-muted text-sm mt-1 animate-pulse">等待对方接听…</div>
            </div>

            <CallButton onClick={endCall} danger title="取消">
              <span className="text-2xl">📵</span>
            </CallButton>
          </div>
        )}

        {/* ====== 通话中 UI ====== */}
        {callStatus === 'connected' && (
          <div className="flex flex-col items-center px-6 py-5 gap-4">
            {/* 视频通话视图 */}
            {callType === 'video' && (
              <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* 本地小画面 */}
                <div className="absolute bottom-2 right-2 w-24 aspect-video rounded-lg overflow-hidden border-2 border-white/20 bg-black">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  {isCameraOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-discord-sidebar text-2xl">
                      🚫
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 音频通话头像 */}
            {callType === 'voice' && (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold"
                  style={{ backgroundColor: remoteUser?.avatarColor || '#5865f2' }}
                >
                  {remoteUser?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="text-white font-medium">{remoteUser?.username}</div>
              </div>
            )}

            {/* 通话状态 */}
            <div className="flex items-center gap-2 text-discord-green text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-discord-green animate-pulse" />
              通话中 {formatDuration(callDuration)}
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <CallButton onClick={toggleMute} active={isMuted} title={isMuted ? '取消静音' : '静音'}>
                  <span className="text-xl">{isMuted ? '🔇' : '🎙️'}</span>
                </CallButton>
                <span className="text-xs text-discord-muted">{isMuted ? '静音中' : '麦克风'}</span>
              </div>

              {callType === 'video' && (
                <div className="flex flex-col items-center gap-1">
                  <CallButton onClick={toggleCamera} active={isCameraOff} title={isCameraOff ? '开启摄像头' : '关闭摄像头'}>
                    <span className="text-xl">{isCameraOff ? '📷' : '📹'}</span>
                  </CallButton>
                  <span className="text-xs text-discord-muted">{isCameraOff ? '摄像头关' : '摄像头'}</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-1">
                <CallButton onClick={endCall} danger title="挂断">
                  <span className="text-xl">📵</span>
                </CallButton>
                <span className="text-xs text-discord-muted">挂断</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
