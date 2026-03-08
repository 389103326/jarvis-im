/**
 * store/useCallStore.js - WebRTC 通话状态管理
 * 支持: 音视频通话发起/接收/挂断，ICE 候选交换，静音/摄像头开关
 */
import { create } from 'zustand'

// STUN 服务器（Google 公共）
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const useCallStore = create((set, get) => ({
  // ==================== 通话状态 ====================
  // 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  callStatus: 'idle',
  callType: null,        // 'voice' | 'video'
  remoteUser: null,      // 通话对方信息 { id, username, avatarColor }
  dmChannelId: null,     // 关联的 DM 频道 ID
  isCaller: false,       // 是否为主叫方
  isMuted: false,        // 是否静音
  isCameraOff: false,    // 是否关闭摄像头
  callDuration: 0,       // 通话时长（秒）

  // ==================== 内部资源（不放入 state，用 ref 存） ====================
  _pc: null,             // RTCPeerConnection
  _localStream: null,    // 本地媒体流
  _remoteStream: null,   // 远端媒体流
  _socket: null,         // Socket.io 实例
  _durationTimer: null,  // 计时器
  _pendingCandidates: [], // 等待 remoteDescription 设置后处理的 ICE 候选

  // ==================== Actions ====================

  /** 注入 socket 引用（在 useSocket hook 中调用） */
  setSocket(socket) {
    get()._socket = socket
    set({ _socket: socket })
  },

  /** 主叫：向对方发起通话 */
  async initiateCall(remoteUser, dmChannelId, callType = 'voice') {
    const store = get()
    if (store.callStatus !== 'idle') return

    set({
      callStatus: 'calling',
      callType,
      remoteUser,
      dmChannelId,
      isCaller: true,
      isMuted: false,
      isCameraOff: false,
      callDuration: 0,
    })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      })
      store._localStream = stream

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      store._pc = pc
      store._pendingCandidates = []

      // 添加本地轨道
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      // 收集远端流
      pc.ontrack = (event) => {
        store._remoteStream = event.streams[0]
        set({ _streamVersion: (get()._streamVersion || 0) + 1 }) // 触发重渲染
      }

      // ICE 候选
      pc.onicecandidate = (event) => {
        if (event.candidate && store._socket) {
          store._socket.emit('webrtc_ice_candidate', {
            targetUserId: remoteUser.id,
            candidate: event.candidate,
          })
        }
      }

      // 连接状态变化
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          set({ callStatus: 'connected' })
          // 开始计时
          const timer = setInterval(() => {
            set(s => ({ callDuration: s.callDuration + 1 }))
          }, 1000)
          store._durationTimer = timer
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          get().endCall()
        }
      }

      // 创建 Offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      store._socket?.emit('webrtc_call_offer', {
        targetUserId: remoteUser.id,
        dmChannelId,
        callType,
        offer,
      })
    } catch (err) {
      console.error('[WebRTC] initiateCall error:', err)
      get().endCall()
    }
  },

  /** 被叫：接听来电 */
  async answerCall() {
    const store = get()
    if (store.callStatus !== 'incoming') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: store.callType === 'video',
      })
      store._localStream = stream

      const pc = store._pc
      if (!pc) return

      // 添加本地轨道
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      // 处理积压的 ICE 候选
      for (const candidate of store._pendingCandidates) {
        try { await pc.addIceCandidate(candidate) } catch (e) {}
      }
      store._pendingCandidates = []

      // 创建 Answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      store._socket?.emit('webrtc_call_answer', {
        targetUserId: store.remoteUser.id,
        answer,
      })
    } catch (err) {
      console.error('[WebRTC] answerCall error:', err)
      get().rejectCall()
    }
  },

  /** 被叫：拒绝来电 */
  rejectCall() {
    const store = get()
    store._socket?.emit('webrtc_call_reject', {
      targetUserId: store.remoteUser?.id,
    })
    get()._cleanup()
  },

  /** 主动挂断 */
  endCall() {
    const store = get()
    if (store.callStatus === 'idle') return
    store._socket?.emit('webrtc_call_hangup', {
      targetUserId: store.remoteUser?.id,
    })
    get()._cleanup()
  },

  /** 切换静音 */
  toggleMute() {
    const store = get()
    const newMuted = !store.isMuted
    store._localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    set({ isMuted: newMuted })
  },

  /** 切换摄像头 */
  toggleCamera() {
    const store = get()
    const newOff = !store.isCameraOff
    store._localStream?.getVideoTracks().forEach(t => { t.enabled = !newOff })
    set({ isCameraOff: newOff })
  },

  // ==================== Socket 事件处理（由 useSocket 调用） ====================

  /** 收到来电 Offer */
  async handleIncomingOffer({ fromUser, dmChannelId, callType, offer }) {
    const store = get()
    if (store.callStatus !== 'idle') {
      // 已在通话中，直接拒绝
      store._socket?.emit('webrtc_call_reject', { targetUserId: fromUser.id })
      return
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    store._pc = pc
    store._pendingCandidates = []

    pc.ontrack = (event) => {
        store._remoteStream = event.streams[0]
        set({ _streamVersion: (get()._streamVersion || 0) + 1 }) // 触发重渲染（handleIncomingOffer 内的 pc）
      }

    pc.onicecandidate = (event) => {
      if (event.candidate && store._socket) {
        store._socket.emit('webrtc_ice_candidate', {
          targetUserId: fromUser.id,
          candidate: event.candidate,
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        set({ callStatus: 'connected' })
        const timer = setInterval(() => {
          set(s => ({ callDuration: s.callDuration + 1 }))
        }, 1000)
        store._durationTimer = timer
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        get().endCall()
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    set({
      callStatus: 'incoming',
      callType,
      remoteUser: fromUser,
      dmChannelId,
      isCaller: false,
      isMuted: false,
      isCameraOff: false,
      callDuration: 0,
    })
  },

  /** 收到接听 Answer */
  async handleAnswer({ answer }) {
    const store = get()
    const pc = store._pc
    if (!pc) return
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
      // 处理积压候选
      for (const candidate of store._pendingCandidates) {
        try { await pc.addIceCandidate(candidate) } catch (e) {}
      }
      store._pendingCandidates = []
    } catch (err) {
      console.error('[WebRTC] handleAnswer error:', err)
    }
  },

  /** 收到 ICE 候选 */
  async handleIceCandidate({ candidate }) {
    const store = get()
    const pc = store._pc
    if (!pc) return
    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        store._pendingCandidates.push(new RTCIceCandidate(candidate))
      }
    } catch (err) {}
  },

  /** 对方拒绝/挂断 */
  handleRemoteHangup() {
    get()._cleanup()
  },

  // ==================== 内部工具 ====================

  _cleanup() {
    const store = get()

    // 清理计时器
    if (store._durationTimer) {
      clearInterval(store._durationTimer)
      store._durationTimer = null
    }

    // 停止本地流
    store._localStream?.getTracks().forEach(t => t.stop())
    store._localStream = null

    // 关闭 PeerConnection
    store._pc?.close()
    store._pc = null
    store._remoteStream = null
    store._pendingCandidates = []

    set({
      callStatus: 'idle',
      callType: null,
      remoteUser: null,
      dmChannelId: null,
      isCaller: false,
      isMuted: false,
      isCameraOff: false,
      callDuration: 0,
    })
  },
}))

export default useCallStore
