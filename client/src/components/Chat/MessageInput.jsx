/**
 * components/Chat/MessageInput.jsx - 消息输入框
 * 支持: @提及补全、格式工具栏、乐观更新、草稿持久化、语音消息录制
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import useAuthStore from '../../store/useAuthStore'
import useChatStore from '../../store/useChatStore'
import EmojiPicker from './EmojiPicker'
import GifPicker from './GifPicker'
import VoiceRecorder from './VoiceRecorder'
import { getSocket } from '../../hooks/useSocket'
import { fileToBase64, isImageFile, searchEmojiShortcodes } from '../../utils/format'

// 消息字数上限
const MAX_CHARS = 2000

/**
 * 前端图片压缩：Canvas 压缩到最大 1280px，质量 0.82
 * 返回 base64 data URL
 */
async function compressImage(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        // 优先使用 webp，fallback jpeg
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, quality))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 草稿 localStorage key
const getDraftKey = (channelId, dmChannelId) =>
  channelId ? `draft:channel:${channelId}` : `draft:dm:${dmChannelId}`

// @提及补全下拉
function MentionDropdown({ users, selectedIndex, onSelect }) {
  if (!users.length) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-discord-sidebar border border-discord-bg rounded-lg shadow-xl overflow-hidden z-30">
      <div className="px-3 py-1.5 text-xs text-discord-muted border-b border-discord-bg">频道成员</div>
      {users.map((user, idx) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
            idx === selectedIndex
              ? 'bg-discord-accent text-white'
              : 'text-discord-text hover:bg-discord-hover'
          }`}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold flex-shrink-0"
            style={{ backgroundColor: user.avatar_color || '#5865f2' }}
          >
            {user.username[0].toUpperCase()}
          </div>
          <span>{user.username}</span>
        </button>
      ))}
    </div>
  )
}

// Emoji 短码补全下拉（:fire: 风格）
function ShortcodeDropdown({ items, selectedIndex, onSelect }) {
  if (!items.length) return null
  return (
    <div className="absolute bottom-full left-0 mb-2 w-56 bg-discord-sidebar border border-discord-bg rounded-lg shadow-xl overflow-hidden z-30">
      <div className="px-3 py-1 text-xs text-discord-muted border-b border-discord-bg">Emoji 短码</div>
      {items.map((item, idx) => (
        <button
          key={item.code}
          onClick={() => onSelect(item)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
            idx === selectedIndex
              ? 'bg-discord-accent text-white'
              : 'text-discord-text hover:bg-discord-hover'
          }`}
        >
          <span className="text-xl leading-none w-7 text-center">{item.emoji}</span>
          <span className="font-mono text-xs opacity-80">:{item.code}:</span>
        </button>
      ))}
    </div>
  )
}

// 多文件上传预览面板
function FilePreviewPanel({ files, onRemove, onClear }) {
  if (!files.length) return null
  return (
    <div className="bg-discord-input border-b border-discord-bg px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-discord-muted font-medium">📎 待发送 {files.length} 张图片</span>
        <button
          onClick={onClear}
          className="ml-auto text-xs text-discord-muted hover:text-discord-red transition-colors"
        >
          清空全部
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map(pf => (
          <div key={pf.id} className="relative group flex-shrink-0">
            <img
              src={pf.previewUrl}
              alt="preview"
              className="w-20 h-20 object-cover rounded-lg border-2 border-discord-bg group-hover:border-discord-accent transition-colors"
            />
            <button
              onClick={() => onRemove(pf.id)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-discord-red hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center font-bold shadow-lg transition-colors"
              title="移除此图片"
            >
              ✕
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-lg text-center py-0.5">
              <span className="text-white text-xs">{(pf.file.size / 1024).toFixed(0)}KB</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MessageInput({ channelId, dmChannelId, channelName, replyTo, onCancelReply }) {
  const [content, setContent] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [shortcodeQuery, setShortcodeQuery] = useState(null)
  const [shortcodeIndex, setShortcodeIndex] = useState(0)
  const [showMobileFormat, setShowMobileFormat] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [slowModeCooldown, setSlowModeCooldown] = useState(0) // 剩余冷却秒数
  const [pendingFiles, setPendingFiles] = useState([]) // 多图预览队列
  const [showGifPicker, setShowGifPicker] = useState(false) // GIF 选择器
  const [showScheduler, setShowScheduler] = useState(false) // 定时消息弹窗
  const [scheduledTime, setScheduledTime] = useState('') // 定时时间 (datetime-local value)
  const textareaRef = useRef(null)
  const typingTimer = useRef(null)
  const isTyping = useRef(false)
  const tempIdCounter = useRef(0)
  // Track the channel key for draft logic
  const prevKeyRef = useRef(null)
  const slowModeTimerRef = useRef(null)

  const { user } = useAuthStore()
  const { users, addOptimisticMessage, channels } = useChatStore()
  const socket = getSocket()

  // 获取当前频道的慢速模式配置
  const currentChannel = channelId ? channels.find(c => c.id === channelId) : null
  const slowModeSecs = currentChannel?.slow_mode_seconds || 0

  const currentKey = getDraftKey(channelId, dmChannelId)

  // 切换频道时：保存旧草稿，加载新草稿
  useEffect(() => {
    const prevKey = prevKeyRef.current

    // 保存离开频道的草稿（如果不是首次渲染）
    if (prevKey && prevKey !== currentKey) {
      const draftVal = textareaRef.current?.value || ''
      if (draftVal.trim()) {
        localStorage.setItem(prevKey, draftVal)
      } else {
        localStorage.removeItem(prevKey)
      }
    }

    // 加载新频道的草稿
    const savedDraft = localStorage.getItem(currentKey) || ''
    setContent(savedDraft)

    // 重置 textarea 高度
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        if (savedDraft) {
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
        textareaRef.current.focus()
      }
    }, 30)

    prevKeyRef.current = currentKey
    setMentionQuery(null)
    setMentionIndex(0)
    setShortcodeQuery(null)
    setShortcodeIndex(0)
  }, [channelId, dmChannelId])

  // 卸载时保存草稿
  useEffect(() => {
    return () => {
      const key = getDraftKey(channelId, dmChannelId)
      const val = textareaRef.current?.value || ''
      if (val.trim()) {
        localStorage.setItem(key, val)
      } else {
        localStorage.removeItem(key)
      }
    }
  }, [channelId, dmChannelId])

  // 监听慢速模式错误，启动倒计时
  useEffect(() => {
    if (!socket) return
    const handleFail = ({ error }) => {
      // 检测慢速模式错误，提取剩余秒数
      const match = error?.match(/等待 (\d+) 秒/)
      if (match) {
        let remaining = parseInt(match[1])
        setSlowModeCooldown(remaining)
        if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current)
        slowModeTimerRef.current = setInterval(() => {
          remaining -= 1
          setSlowModeCooldown(remaining)
          if (remaining <= 0) {
            clearInterval(slowModeTimerRef.current)
            slowModeTimerRef.current = null
          }
        }, 1000)
      }
    }
    const handleScheduleAck = ({ scheduledAt }) => {
      const t = new Date(scheduledAt)
      const label = t.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      // 用 useToastStore 提示（如已导入），否则用简单 console
      console.log(`[Schedule] 定时消息已设置：将在 ${label} 发送`)
    }
    const handleScheduleFail = ({ error }) => {
      alert(`定时消息失败：${error}`)
    }
    socket.on('message_fail', handleFail)
    socket.on('schedule_ack', handleScheduleAck)
    socket.on('schedule_fail', handleScheduleFail)
    return () => {
      socket.off('message_fail', handleFail)
      socket.off('schedule_ack', handleScheduleAck)
      socket.off('schedule_fail', handleScheduleFail)
      if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current)
    }
  }, [socket])

  // 过滤 @提及用户
  const mentionUsers = mentionQuery !== null
    ? users.filter(u =>
        u.username.toLowerCase().includes(mentionQuery.toLowerCase()) &&
        u.id !== user?.id
      ).slice(0, 8)
    : []

  // Emoji 短码候选
  const shortcodeItems = shortcodeQuery !== null
    ? searchEmojiShortcodes(shortcodeQuery, 8)
    : []

  // 发送消息（带乐观更新）
  const sendMessage = useCallback((msgContent, type = 'text') => {
    if (!socket) return
    if (type === 'text' && !msgContent.trim()) return
    if (type === 'text' && msgContent.length > MAX_CHARS) return

    const tempId = `temp_${Date.now()}_${++tempIdCounter.current}`

    if (type === 'text') {
      addOptimisticMessage(tempId, {
        channelId: channelId || null,
        dmChannelId: dmChannelId || null,
        senderId: user?.id,
        username: user?.username,
        avatarColor: user?.avatar_color || '#5865f2',
        content: msgContent,
        type,
        replyTo: replyTo?.id || null,
        replyContent: replyTo?.content || null,
        replyUsername: replyTo?.username || null,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reactions: [],
        isPending: true,
      })
    }

    socket.emit('send_message', {
      channelId: channelId || undefined,
      dmChannelId: dmChannelId || undefined,
      content: msgContent,
      type,
      replyTo: replyTo?.id || undefined,
      tempId,
    })

    if (isTyping.current) {
      socket.emit('typing_stop', { channelId, dmChannelId })
      isTyping.current = false
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)

    onCancelReply?.()
    setContent('')
    setMentionQuery(null)
    setShortcodeQuery(null)

    // 清除草稿
    localStorage.removeItem(currentKey)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [socket, channelId, dmChannelId, replyTo, onCancelReply, user, addOptimisticMessage, currentKey])

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault(); insertFormat('**'); return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault(); insertFormat('*'); return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault(); insertFormat('`'); return
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
      e.preventDefault(); insertFormat('~~'); return
    }

    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionUsers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }

    if (shortcodeQuery !== null && shortcodeItems.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setShortcodeIndex(i => Math.min(i + 1, shortcodeItems.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setShortcodeIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertShortcode(shortcodeItems[shortcodeIndex]); return }
      if (e.key === 'Tab') { e.preventDefault(); insertShortcode(shortcodeItems[shortcodeIndex]); return }
      if (e.key === 'Escape') { setShortcodeQuery(null); return }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (pendingFiles.length > 0) {
        sendAllPending()
      } else {
        sendMessage(content)
      }
    }
    if (e.key === 'Escape') {
      if (replyTo) onCancelReply?.()
      setMentionQuery(null)
    }
  }

  const insertMention = (selectedUser) => {
    const atIdx = content.lastIndexOf('@')
    if (atIdx === -1) return
    const newContent = content.slice(0, atIdx) + `@${selectedUser.username} `
    setContent(newContent)
    setMentionQuery(null)
    setMentionIndex(0)
    textareaRef.current?.focus()
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newContent.length
        textareaRef.current.selectionEnd = newContent.length
      }
    }, 0)
  }

  // 插入 emoji 短码（替换 :query 部分）
  const insertShortcode = (item) => {
    const textarea = textareaRef.current
    const cursorPos = textarea?.selectionStart ?? content.length
    const textBefore = content.slice(0, cursorPos)
    const colonIdx = textBefore.lastIndexOf(':')
    if (colonIdx === -1) return
    const newContent = content.slice(0, colonIdx) + item.emoji + ' ' + content.slice(cursorPos)
    setContent(newContent)
    setShortcodeQuery(null)
    setShortcodeIndex(0)
    textarea?.focus()
    const newPos = colonIdx + item.emoji.length + 1
    setTimeout(() => {
      if (textarea) {
        textarea.selectionStart = newPos
        textarea.selectionEnd = newPos
      }
    }, 0)
  }

  const handleInput = (e) => {
    const val = e.target.value
    setContent(val)

    // 自动调整高度
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }

    // 实时保存草稿（防抖写入 localStorage）
    if (val.trim()) {
      localStorage.setItem(currentKey, val)
    } else {
      localStorage.removeItem(currentKey)
    }

    // 检测 @提及
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }

    // 检测 :shortcode 补全（至少 1 个字符）
    const colonMatch = textBeforeCursor.match(/:(\w{1,20})$/)
    if (colonMatch && !atMatch) {
      setShortcodeQuery(colonMatch[1])
      setShortcodeIndex(0)
    } else {
      setShortcodeQuery(null)
    }

    if (val.trim() && !isTyping.current) {
      isTyping.current = true
      socket?.emit('typing_start', { channelId, dmChannelId })
    }

    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      if (isTyping.current) {
        isTyping.current = false
        socket?.emit('typing_stop', { channelId, dmChannelId })
      }
    }, 3000)

    if (!val.trim() && isTyping.current) {
      isTyping.current = false
      socket?.emit('typing_stop', { channelId, dmChannelId })
    }
  }

  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const newContent = content.slice(0, start) + emoji + content.slice(start)
    setContent(newContent)
    setShowEmoji(false)
    textareaRef.current?.focus()
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      // 多图 → 预览队列；单图直接走队列统一处理
      await addPendingFiles(imageFiles)
    }
  }

  const sendImage = async (file) => {
    if (file.size > 10 * 1024 * 1024) { alert('图片大小不能超过 10MB'); return }
    try {
      // 前端压缩：减少 base64 体积，保护数据库
      const compressed = await compressImage(file)
      sendMessage(compressed, 'image')
    } catch (err) {
      console.error('Image upload error:', err)
      // 压缩失败时降级使用原始 base64
      try {
        const base64 = await fileToBase64(file)
        sendMessage(base64, 'image')
      } catch (e) {
        alert('图片处理失败')
      }
    }
  }

  // 将文件加入预览队列（而非立即发送）
  const addPendingFiles = useCallback(async (files) => {
    const newFiles = files.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPendingFiles(prev => [...prev, ...newFiles])
  }, [])

  // 移除单个预览文件
  const removePendingFile = useCallback((id) => {
    setPendingFiles(prev => {
      const pf = prev.find(f => f.id === id)
      if (pf) URL.revokeObjectURL(pf.previewUrl)
      return prev.filter(f => f.id !== id)
    })
  }, [])

  // 清空所有预览文件
  const clearPendingFiles = useCallback(() => {
    setPendingFiles(prev => { prev.forEach(f => URL.revokeObjectURL(f.previewUrl)); return [] })
  }, [])

  // 发送所有待发文件（先文字，再逐张图片）
  const sendAllPending = useCallback(async () => {
    if (content.trim()) sendMessage(content)
    for (const pf of pendingFiles) {
      await sendImage(pf.file)
    }
    pendingFiles.forEach(f => URL.revokeObjectURL(f.previewUrl))
    setPendingFiles([])
  }, [pendingFiles, content, sendMessage, sendImage])

  // 离开频道时清空预览
  useEffect(() => {
    return () => {
      setPendingFiles(prev => { prev.forEach(f => URL.revokeObjectURL(f.previewUrl)); return [] })
    }
  }, [channelId, dmChannelId])

  // 定时发送消息
  const scheduleMessage = useCallback((msgContent, when) => {
    if (!socket) return
    if (!msgContent.trim()) { alert('请输入消息内容后再定时发送'); return }
    if (!when) { alert('请选择发送时间'); return }
    const scheduledAt = new Date(when)
    const now = new Date()
    if (scheduledAt - now < 60000) { alert('定时时间至少需要在 1 分钟之后'); return }

    socket.emit('schedule_message', {
      channelId: channelId || undefined,
      dmChannelId: dmChannelId || undefined,
      content: msgContent,
      type: 'text',
      replyTo: replyTo?.id || undefined,
      scheduledAt: scheduledAt.toISOString(),
    })

    // 清空输入框和定时面板
    setContent('')
    setShowScheduler(false)
    setScheduledTime('')
    localStorage.removeItem(currentKey)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onCancelReply?.()
  }, [socket, channelId, dmChannelId, replyTo, onCancelReply, currentKey])

  // 生成 datetime-local 最小值（当前时间 + 1分钟）
  const getMinDateTime = () => {
    const d = new Date(Date.now() + 61000)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
  }

  const insertFormat = (prefix, suffix = prefix) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end)
    const newContent = content.slice(0, start) + prefix + (selected || 'text') + suffix + content.slice(end)
    setContent(newContent)
    setTimeout(() => {
      textarea.focus()
      const newStart = start + prefix.length
      const newEnd = newStart + (selected || 'text').length
      textarea.setSelectionRange(newStart, newEnd)
    }, 0)
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(f => isImageFile(f))
    if (imageFiles.length > 0) {
      await addPendingFiles(imageFiles)
    }
  }

  // 检查是否有未发送草稿（用于显示提示）
  const hasDraft = content.trim().length > 0

  return (
    <div
      className="px-2 pb-2 md:px-4 md:pb-4 relative safe-area-bottom"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drag-overlay rounded-xl">📎 拖拽图片到这里（支持多图）</div>
      )}

      {/* 多图预览面板 */}
      <FilePreviewPanel
        files={pendingFiles}
        onRemove={removePendingFile}
        onClear={clearPendingFiles}
      />

      {/* 回复预览 */}
      {replyTo && (
        <div className="flex items-center justify-between bg-discord-input px-3 py-2 rounded-t-lg border-b border-discord-bg text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-discord-muted">↩ 回复</span>
            <span className="font-medium text-white">{replyTo.username}</span>
            <span className="text-discord-muted truncate">: {replyTo.content?.slice(0, 60)}</span>
          </div>
          <button onClick={onCancelReply} className="text-discord-muted hover:text-white ml-2 flex-shrink-0">✕</button>
        </div>
      )}

      {/* @提及下拉 */}
      {mentionQuery !== null && (
        <MentionDropdown
          users={mentionUsers}
          selectedIndex={mentionIndex}
          onSelect={insertMention}
        />
      )}

      {/* Emoji 短码下拉 */}
      {shortcodeQuery !== null && shortcodeItems.length > 0 && (
        <ShortcodeDropdown
          items={shortcodeItems}
          selectedIndex={shortcodeIndex}
          onSelect={insertShortcode}
        />
      )}

      {/* 格式工具栏 - 桌面端常显，移动端可切换 */}
      <div className={`format-toolbar flex items-center gap-1 px-3 py-1.5 bg-discord-input border-b border-discord-bg ${replyTo ? '' : 'rounded-t-xl'} ${showMobileFormat ? 'mobile-visible' : ''}`}>
        <button onClick={() => insertFormat('**')} className="px-2 py-0.5 text-discord-muted hover:text-white hover:bg-discord-hover rounded text-sm font-bold transition-colors" title="粗体 (Ctrl+B)">B</button>
        <button onClick={() => insertFormat('*')} className="px-2 py-0.5 text-discord-muted hover:text-white hover:bg-discord-hover rounded text-sm italic transition-colors" title="斜体">I</button>
        <button onClick={() => insertFormat('~~')} className="px-2 py-0.5 text-discord-muted hover:text-white hover:bg-discord-hover rounded text-sm line-through transition-colors" title="删除线 (Ctrl+Shift+X)">S</button>
        <button onClick={() => insertFormat('`')} className="px-2 py-0.5 text-discord-muted hover:text-white hover:bg-discord-hover rounded text-xs font-mono transition-colors" title="行内代码">{'<>'}</button>
        <button onClick={() => insertFormat('```\n', '\n```')} className="px-2 py-0.5 text-discord-muted hover:text-white hover:bg-discord-hover rounded text-xs font-mono transition-colors" title="代码块">```</button>
        {/* 慢速模式提示 */}
        {slowModeSecs > 0 && (
          <span className="ml-auto text-xs text-discord-yellow flex items-center gap-1">
            🐢 慢速模式
            {slowModeCooldown > 0 && (
              <span className="font-mono bg-discord-yellow/10 border border-discord-yellow/30 rounded px-1">
                {slowModeCooldown}s
              </span>
            )}
          </span>
        )}
        {/* 字数计数器 */}
        {content.length > MAX_CHARS * 0.8 && (
          <span className={`ml-auto text-xs font-mono tabular-nums ${
            content.length >= MAX_CHARS
              ? 'text-discord-red font-semibold'
              : content.length >= MAX_CHARS * 0.9
              ? 'text-discord-yellow'
              : 'text-discord-muted'
          }`}>
            {MAX_CHARS - content.length}
          </span>
        )}
        {/* 草稿指示器 */}
        {hasDraft && slowModeSecs === 0 && content.length <= MAX_CHARS * 0.8 && (
          <span className="ml-auto text-xs text-discord-muted/70 italic flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-discord-yellow inline-block" />
            草稿已保存
          </span>
        )}
      </div>

      {/* 移动端格式工具栏顶部切换按钮（仅在 md 以下显示） */}
      <div className={`md:hidden flex justify-start px-3 py-1 bg-discord-input border-b border-discord-bg/50 ${replyTo ? '' : showMobileFormat ? '' : 'rounded-t-xl'}`}
           style={{ display: showMobileFormat ? undefined : undefined }}>
        <button
          onClick={() => setShowMobileFormat(v => !v)}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${showMobileFormat ? 'text-discord-accent bg-discord-accent/10' : 'text-discord-muted hover:text-white'}`}
          title="格式工具栏"
        >
          Aa {showMobileFormat ? '▲' : '▼'}
        </button>
      </div>

      {/* 语音录制器（替换输入框） */}
      {showVoiceRecorder ? (
        <div className="bg-discord-input px-4 py-2.5 rounded-b-xl">
          <VoiceRecorder
            onSend={(audioDataUrl) => {
              sendMessage(audioDataUrl, 'audio')
              setShowVoiceRecorder(false)
            }}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      ) : (
        <div className="flex items-end gap-2 bg-discord-input px-4 py-2.5 rounded-b-xl">
          {/* 图片上传按钮 */}
          <label className="flex-shrink-0 cursor-pointer text-discord-muted hover:text-discord-text transition-colors mb-1" title="上传图片（支持多选）">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || [])
                if (files.length > 0) { await addPendingFiles(files); e.target.value = '' }
              }}
            />
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
          </label>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`发消息到 ${channelId ? '#' : ''}${channelName || '...'}`}
            className="chat-input flex-1 py-0.5"
            rows={1}
            style={{ height: 'auto' }}
          />

          {/* Emoji 按钮 */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowEmoji(!showEmoji); setShowGifPicker(false) }}
              className="text-discord-muted hover:text-discord-text transition-colors text-xl mb-1"
              title="添加 Emoji"
            >
              😊
            </button>
            {showEmoji && (
              <div className="absolute bottom-full right-0 mb-2 z-30">
                <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
              </div>
            )}
          </div>

          {/* GIF 按钮 */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowGifPicker(!showGifPicker); setShowEmoji(false); setShowScheduler(false) }}
              className={`mb-1 text-xs font-bold px-1.5 py-0.5 rounded transition-colors border ${
                showGifPicker
                  ? 'text-discord-accent border-discord-accent bg-discord-accent/10'
                  : 'text-discord-muted border-discord-muted/40 hover:text-white hover:border-discord-text'
              }`}
              title="发送 GIF"
            >
              GIF
            </button>
            {showGifPicker && (
              <GifPicker
                onSelect={(gif) => {
                  // content 存 GIF URL，type 存 'gif'
                  sendMessage(gif.url, 'gif')
                  setShowGifPicker(false)
                }}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>

          {/* 定时发送按钮 */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowScheduler(v => !v); setShowEmoji(false); setShowGifPicker(false) }}
              className={`text-xl mb-1 transition-colors ${showScheduler ? 'text-discord-accent' : 'text-discord-muted hover:text-discord-text'}`}
              title="定时发送消息"
            >
              🕐
            </button>
            {/* 定时消息弹窗 */}
            {showScheduler && (
              <div
                className="absolute bottom-full right-0 mb-2 w-72 bg-discord-sidebar border border-discord-bg rounded-xl shadow-2xl z-30 p-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    🕐 定时发送
                  </h4>
                  <button
                    onClick={() => setShowScheduler(false)}
                    className="text-discord-muted hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-discord-muted mb-3">
                  消息将在指定时间自动发送到当前频道
                </p>
                <label className="block text-xs text-discord-muted mb-1">选择发送时间</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  min={getMinDateTime()}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="w-full bg-discord-bg border border-discord-hover rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:border-discord-accent transition-colors mb-3"
                />
                {content.trim() ? (
                  <div className="bg-discord-bg rounded-lg px-3 py-2 text-xs text-discord-muted mb-3 max-h-16 overflow-hidden">
                    <span className="text-discord-text/70">预览：</span>
                    {content.slice(0, 80)}{content.length > 80 ? '...' : ''}
                  </div>
                ) : (
                  <div className="bg-discord-bg/50 rounded-lg px-3 py-2 text-xs text-discord-muted mb-3 italic">
                    ⚠️ 请先在输入框填写消息内容
                  </div>
                )}
                <button
                  onClick={() => scheduleMessage(content, scheduledTime)}
                  disabled={!scheduledTime || !content.trim()}
                  className="w-full bg-discord-accent hover:bg-indigo-600 disabled:opacity-30 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  确认定时发送
                </button>
              </div>
            )}
          </div>

          {/* 语音录制按钮（仅在输入框为空时显示） */}
          {!content.trim() && (
            <button
              onClick={() => setShowVoiceRecorder(true)}
              className="flex-shrink-0 text-discord-muted hover:text-discord-accent transition-colors mb-1"
              title="录制语音消息"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          )}

          <button
            onClick={() => pendingFiles.length > 0 ? sendAllPending() : sendMessage(content)}
            disabled={(!content.trim() && pendingFiles.length === 0) || slowModeCooldown > 0 || content.length > MAX_CHARS}
            className="flex-shrink-0 bg-discord-accent hover:bg-indigo-600 disabled:opacity-30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors mb-0.5"
          >
            {slowModeCooldown > 0 ? `${slowModeCooldown}s` : content.length > MAX_CHARS ? '超限' : pendingFiles.length > 0 ? `发送 ${pendingFiles.length > 1 ? `(${pendingFiles.length}图)` : ''}` : '发送'}
          </button>
        </div>
      )}

      <div className="text-xs text-discord-muted mt-1 px-1">
        Enter 发送 · Shift+Enter 换行 · @ 提及 · :emoji: 短码 · Ctrl+B 粗体 · 🕐 定时发送 · 🎬 GIF · Ctrl+V 粘贴多图
      </div>
    </div>
  )
}
