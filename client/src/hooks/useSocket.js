/**
 * hooks/useSocket.js - Socket.io 连接和事件处理
 */

import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import useAuthStore from '../store/useAuthStore'
import useChatStore from '../store/useChatStore'
import useCallStore from '../store/useCallStore'
import { playMessageSound, playMentionSound } from '../utils/sound'
import { toast } from '../store/useToastStore'

let socketInstance = null

export function getSocket() {
  return socketInstance
}

export function useSocket() {
  const { token, user } = useAuthStore()
  const {
    addMessage,
    editMessage,
    deleteMessage,
    updateReactions,
    setOnlineUsers,
    updateUserStatus,
    updateUserProfile,
    setTyping,
    setConnectionStatus,
    setPinnedMessages,
    updateChannelInfo,
    confirmMessage,
    failMessage,
  } = useChatStore()

  const reconnectTimer = useRef(null)

  useEffect(() => {
    if (!token || !user) {
      if (socketInstance) {
        socketInstance.disconnect()
        socketInstance = null
      }
      return
    }

    // 创建 Socket 连接
    socketInstance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    })

    socketInstance.on('connect', () => {
      console.log('[Socket] 已连接:', socketInstance.id)
      setConnectionStatus('connected')
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    })

    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] 连接错误:', err.message)
      setConnectionStatus('disconnected')
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] 断开连接:', reason)
      if (reason !== 'io client disconnect') {
        setConnectionStatus('disconnected')
      }
    })

    socketInstance.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting')
    })

    socketInstance.on('reconnect', () => {
      setConnectionStatus('connected')
      // 重连后重新加入当前频道
      const { activeChannelId, activeType } = useChatStore.getState()
      if (activeChannelId && activeType === 'channel') {
        socketInstance.emit('join_channel', { channelId: activeChannelId })
      }
    })

    // ==================== 消息事件 ====================

    socketInstance.on('new_message', (message) => {
      addMessage(message)

      // 自动发送 DM 已读回执（当用户正在查看该 DM 时）
      const { activeChannelId, activeDmId, activeType } = useChatStore.getState()
      const isActiveDm = message.dmChannelId && activeType === 'dm' && activeDmId === message.dmChannelId
      if (isActiveDm && message.senderId !== user.id) {
        socketInstance.emit('dm_mark_read', { dmChannelId: message.dmChannelId, messageId: message.id })
      }

      // 桌面通知（不在当前频道时）
      const isActive = (message.channelId && activeType === 'channel' && activeChannelId === message.channelId)
        || (message.dmChannelId && activeType === 'dm' && activeDmId === message.dmChannelId)

      if (!isActive && message.senderId !== user.id && message.type !== 'system') {
        // 检查通知偏好
        const notifKey = message.channelId
          ? `notif:channel:${message.channelId}`
          : message.dmChannelId ? `notif:dm:${message.dmChannelId}` : null
        const notifLevel = notifKey ? (localStorage.getItem(notifKey) || 'all') : 'all'

        const isMention = message.content?.includes(`@${user.username}`)
        const shouldNotify = notifLevel === 'all'
          || (notifLevel === 'mentions' && isMention)

        if (shouldNotify) {
          const notifBody = message.isDeleted ? '消息已删除' : message.content
          const notifTag = message.dmChannelId
            ? `dm:${message.dmChannelId}`
            : `channel:${message.channelId}`
          showNotification(
            message.dmChannelId ? `私信来自 ${message.username}` : `#${message.channelName || message.username}`,
            notifBody,
            { tag: notifTag, renotify: true }
          )
        }

        // 🍞 In-app toast 提醒
        if (isMention) {
          toast.mention(
            `${message.username} 提到了你${message.content ? `："${message.content.slice(0, 50)}${message.content.length > 50 ? '…' : ''}"` : ''}`,
            {
              avatar: {
                color: message.avatarColor || '#5865f2',
                initial: message.username?.[0]?.toUpperCase(),
              },
              duration: 6000,
            }
          )
        } else if (message.dmChannelId && shouldNotify) {
          toast.info(
            `${message.username}: ${message.type === 'image' ? '🖼️ 发来了图片' : (message.content?.slice(0, 60) || '')}`,
            {
              avatar: {
                color: message.avatarColor || '#5865f2',
                initial: message.username?.[0]?.toUpperCase(),
              },
              duration: 4500,
            }
          )
        }

        // 🔔 音效提醒
        const isMentionCheck = message.content?.includes(`@${user.username}`)
        if (isMentionCheck) {
          playMentionSound()
        } else if (shouldNotify) {
          playMessageSound()
        }
      }
    })

    // ✅ 消息 ACK：服务器确认消息已保存
    socketInstance.on('message_ack', ({ tempId, messageId, createdAt }) => {
      confirmMessage(tempId, messageId, createdAt)
    })

    // ❌ 消息失败：服务器保存失败
    socketInstance.on('message_fail', ({ tempId }) => {
      failMessage(tempId)
    })

    socketInstance.on('message_edited', ({ messageId, content, updatedAt }) => {
      editMessage(messageId, content, updatedAt)
    })

    socketInstance.on('message_deleted', ({ messageId }) => {
      deleteMessage(messageId)
    })

    socketInstance.on('reaction_updated', ({ messageId, reactions }) => {
      updateReactions(messageId, reactions)
    })

    // 有人反应了你的消息
    socketInstance.on('reaction_received', ({ emoji, reactorUsername, reactorAvatarColor, messagePreview }) => {
      toast.reaction(
        `${reactorUsername} 用 ${emoji} 回应了你的消息${messagePreview ? `："${messagePreview.slice(0, 40)}${messagePreview.length > 40 ? '…' : ''}"` : ''}`,
        {
          emoji,
          avatar: {
            color: reactorAvatarColor || '#5865f2',
            initial: reactorUsername?.[0]?.toUpperCase(),
          },
        }
      )
    })

    // ==================== 固定消息事件 ====================

    socketInstance.on('pinned_messages_updated', ({ channelId, pinnedMessages }) => {
      setPinnedMessages(channelId, pinnedMessages)
    })

    // ==================== 频道更新事件 ====================

    socketInstance.on('channel_updated', (channel) => {
      updateChannelInfo(channel)
    })

    // ==================== 用户状态事件 ====================

    socketInstance.on('online_users', (userIds) => {
      setOnlineUsers(userIds)
    })

    socketInstance.on('user_status_changed', ({ userId, status }) => {
      updateUserStatus(userId, status)

      // 当 DM 联系人上线时，显示 toast 提醒
      if (status === 'online' && userId !== user.id) {
        const { dmList } = useChatStore.getState()
        const dmContact = dmList.find(dm => dm.otherUser?.id === userId)
        if (dmContact) {
          const contactUser = dmContact.otherUser
          toast.info(
            `${contactUser.username} 上线了`,
            {
              avatar: {
                color: contactUser.avatarColor || '#5865f2',
                initial: contactUser.username?.[0]?.toUpperCase(),
              },
              duration: 3000,
            }
          )
        }
      }
    })

    // 用户资料变更（头像颜色、自定义状态、头像图片）
    socketInstance.on('user_profile_changed', ({ userId, avatarColor, customStatus, avatarUrl }) => {
      updateUserProfile({ id: userId, avatarColor, customStatus, avatarUrl })
    })

    // ==================== Thread 事件 ====================

    socketInstance.on('new_thread_message', (message) => {
      const { activeThread, addThreadMessage } = useChatStore.getState()
      if (activeThread && activeThread.id === message.threadParentId) {
        addThreadMessage(message.threadParentId, { ...message, isNew: true })
      }
    })

    socketInstance.on('thread_stats_updated', ({ messageId, threadStats }) => {
      useChatStore.getState().updateThreadStats(messageId, threadStats)
    })

    // ==================== DM 已读回执 ====================

    socketInstance.on('dm_read_receipt', ({ dmChannelId, userId, lastReadMessageId }) => {
      useChatStore.getState().setDmReadReceipt(dmChannelId, userId, lastReadMessageId)
    })

    // ==================== 输入状态事件 ====================

    socketInstance.on('user_typing', ({ userId, username, channelId, dmChannelId }) => {
      if (userId !== user.id) {
        setTyping(channelId, dmChannelId, userId, username, true)
      }
    })

    socketInstance.on('user_stop_typing', ({ userId, channelId, dmChannelId }) => {
      setTyping(channelId, dmChannelId, userId, null, false)
    })

    // ==================== WebRTC 信令 ====================

    // 注入 socket 到 callStore
    useCallStore.getState().setSocket(socketInstance)

    // 收到来电 offer
    socketInstance.on('webrtc_call_offer', async (data) => {
      await useCallStore.getState().handleIncomingOffer(data)
      toast.info(`📞 ${data.fromUser?.username} 发起了${data.callType === 'video' ? '视频' : '语音'}通话`)
    })

    // 对方接听（主叫收到 answer）
    socketInstance.on('webrtc_call_answer', async ({ answer }) => {
      await useCallStore.getState().handleAnswer({ answer })
    })

    // ICE 候选
    socketInstance.on('webrtc_ice_candidate', async ({ candidate }) => {
      await useCallStore.getState().handleIceCandidate({ candidate })
    })

    // 对方挂断
    socketInstance.on('webrtc_call_hangup', () => {
      useCallStore.getState().handleRemoteHangup()
      toast.info('📵 对方已挂断')
    })

    // 对方拒绝
    socketInstance.on('webrtc_call_reject', () => {
      useCallStore.getState().handleRemoteHangup()
      toast.info('📵 对方拒绝了通话')
    })

    // 通话失败（如对方不在线）
    socketInstance.on('webrtc_call_failed', ({ reason }) => {
      useCallStore.getState()._cleanup()
      toast.error(`通话失败：${reason}`)
    })

    return () => {
      if (socketInstance) {
        socketInstance.off('connect')
        socketInstance.off('connect_error')
        socketInstance.off('disconnect')
        socketInstance.off('reconnect_attempt')
        socketInstance.off('reconnect')
        socketInstance.off('new_message')
        socketInstance.off('message_ack')
        socketInstance.off('message_fail')
        socketInstance.off('message_edited')
        socketInstance.off('message_deleted')
        socketInstance.off('reaction_updated')
        socketInstance.off('reaction_received')
        socketInstance.off('pinned_messages_updated')
        socketInstance.off('channel_updated')
        socketInstance.off('online_users')
        socketInstance.off('user_status_changed')
        socketInstance.off('new_thread_message')
        socketInstance.off('thread_stats_updated')
        socketInstance.off('dm_read_receipt')
        socketInstance.off('user_typing')
        socketInstance.off('user_stop_typing')
        socketInstance.off('user_profile_changed')
        socketInstance.off('webrtc_call_offer')
        socketInstance.off('webrtc_call_answer')
        socketInstance.off('webrtc_ice_candidate')
        socketInstance.off('webrtc_call_hangup')
        socketInstance.off('webrtc_call_reject')
        socketInstance.off('webrtc_call_failed')
        socketInstance.disconnect()
        socketInstance = null
      }
    }
  }, [token, user?.id])
}

/**
 * 显示桌面通知（仅在页面隐藏时触发，避免打扰正在聊天的用户）
 */
function showNotification(title, body, options = {}) {
  if (!('Notification' in window)) return
  // 页面可见时不弹通知（用户已在页面，in-app toast 已覆盖）
  if (!document.hidden) return

  if (Notification.permission === 'granted') {
    const notif = new Notification(`Jarvis IM · ${title}`, {
      body: body?.length > 120 ? body.slice(0, 120) + '...' : (body || ''),
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'jarvis-im-message', // 同一来源只显示最新通知
      renotify: !!options.tag, // 有 tag 时重新提醒
      silent: options.silent || false,
    })
    // 点击通知时聚焦窗口
    notif.onclick = () => {
      window.focus()
      notif.close()
    }
    // 5 秒后自动关闭
    setTimeout(() => notif.close(), 5000)
  } else if (Notification.permission === 'default') {
    // 静默请求权限（下次才生效）
    Notification.requestPermission()
  }
}

/**
 * 请求通知权限
 */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}
