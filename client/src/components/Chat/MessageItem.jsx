/**
 * components/Chat/MessageItem.jsx - 单条消息组件
 * 支持: 消息分组、Markdown、图片灯箱、用户资料卡片、Pin、收藏、转发、长消息折叠
 */

import React, { useState, useRef, useCallback } from 'react'
import useAuthStore from '../../store/useAuthStore'
import useChatStore from '../../store/useChatStore'
import Avatar from '../common/Avatar'
import EmojiPicker from './EmojiPicker'
import UserProfileCard from './UserProfileCard'
import ForwardModal from './ForwardModal'
import ContextMenu from './ContextMenu'
import AudioPlayer from './AudioPlayer'
import LinkPreviewCard, { extractFirstUrl } from './LinkPreviewCard'
import { formatMessageTime, formatFullTime, renderMarkdown, highlightCode } from '../../utils/format'
import { getSocket } from '../../hooks/useSocket'

// @提及高亮：解析文本中的 @username
function parseMentions(text, currentUsername) {
  if (!text || !text.includes('@')) return [{ type: 'text', content: text }]
  const parts = []
  const regex = /@([\w\u4e00-\u9fa5]+)/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index) })
    const isMe = match[1] === currentUsername
    parts.push({ type: 'mention', username: match[1], isMe })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) })
  return parts
}

// 代码块（带复制按钮）
function CodeBlock({ content, hlTokens }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const colorMap = {
    keyword: '#7aa2f7',
    string: '#9ece6a',
    comment: '#565f89',
    number: '#ff9e64',
    builtin: '#bb9af7',
    plain: undefined,
  }

  return (
    <div className="relative group/code my-1">
      <pre className="bg-discord-bg rounded p-2 overflow-x-auto text-xs font-mono whitespace-pre-wrap pr-12">
        <code>
          {hlTokens.map((t, idx) => (
            <span key={idx} style={colorMap[t.type] ? { color: colorMap[t.type] } : undefined}>
              {t.value}
            </span>
          ))}
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded text-xs font-medium transition-all
          opacity-0 group-hover/code:opacity-100
          ${copied
            ? 'bg-discord-green/20 text-discord-green border border-discord-green/40'
            : 'bg-discord-hover text-discord-muted hover:text-white border border-discord-bg'
          }`}
        title="复制代码"
      >
        {copied ? '✓ 已复制' : '复制'}
      </button>
    </div>
  )
}

// Markdown 渲染组件（支持 @提及高亮）
function MarkdownContent({ text, currentUsername }) {
  if (!text) return null
  const tokens = renderMarkdown(text)

  return (
    <span className="message-content">
      {tokens.map(token => {
        switch (token.type) {
          case 'codeblock': {
            const hlTokens = highlightCode(token.content)
            return (
              <CodeBlock key={token.key} content={token.content} hlTokens={hlTokens} />
            )
          }
          case 'code':
            return (
              <code key={token.key} className="bg-discord-bg text-discord-yellow px-1 rounded font-mono text-sm">
                {token.content}
              </code>
            )
          case 'bold':
            return <strong key={token.key} className="font-bold text-white">{token.content}</strong>
          case 'italic':
            return <em key={token.key} className="italic">{token.content}</em>
          case 'strikethrough':
            return <del key={token.key} className="line-through text-discord-muted/80">{token.content}</del>
          case 'link':
            return (
              <a
                key={token.key}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-discord-accent hover:underline"
              >
                {token.content}
              </a>
            )
          case 'plain':
          default: {
            const mentionParts = parseMentions(token.content, currentUsername)
            return (
              <span key={token.key}>
                {mentionParts.map((p, i) => {
                  if (p.type === 'mention') {
                    return (
                      <span
                        key={i}
                        className={`mention-tag inline-block px-0.5 rounded cursor-default ${
                          p.isMe
                            ? 'bg-discord-accent/40 text-white font-medium ring-1 ring-discord-accent/60'
                            : 'bg-discord-accent/20 text-discord-accent/90'
                        }`}
                        title={`@${p.username}`}
                      >
                        @{p.username}
                      </span>
                    )
                  }
                  return <span key={i}>{p.content}</span>
                })}
              </span>
            )
          }
        }
      })}
    </span>
  )
}

// 长消息折叠组件（超过 20 行或 800 字符时折叠）
const COLLAPSE_CHARS = 800
const COLLAPSE_LINES = 20

function CollapsibleMessageContent({ children, text }) {
  const shouldCollapse = text && (
    text.length > COLLAPSE_CHARS ||
    (text.match(/\n/g) || []).length >= COLLAPSE_LINES
  )
  const [expanded, setExpanded] = useState(false)

  if (!shouldCollapse) return children

  return (
    <div>
      <div
        className={`relative overflow-hidden transition-all duration-200 ${
          expanded ? '' : 'max-h-40'
        }`}
      >
        {children}
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-discord-channel to-transparent pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-xs text-discord-accent hover:underline flex items-center gap-1 font-medium"
      >
        {expanded ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14l5-5 5 5z"/>
            </svg>
            收起
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
            显示更多（{text.length} 字）
          </>
        )}
      </button>
    </div>
  )
}

// 图片灯箱
function ImageLightbox({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl bg-black/50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/80"
      >
        ✕
      </button>
      <img
        src={src}
        alt="图片预览"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// 消息操作工具栏组件
function MessageToolbar({
  showActions, isEditing, isMe, message,
  isBookmarked, bookmarkAnim,
  showEmojiPicker, onEmojiToggle, onEmojiSelect, onEmojiClose,
  onReply, onThread, onEdit, onDelete, onPin, onCopy, onBookmark, onForward
}) {
  if (!showActions || isEditing || message.isDeleted) return null

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '✅']

  return (
    <div className="message-actions absolute right-4 -top-4 flex items-center gap-0.5 bg-discord-sidebar border border-discord-bg rounded-md px-1 py-0.5 shadow-lg z-10">
      {/* 快捷 Emoji 反应条 */}
      <div className="flex items-center gap-0 border-r border-discord-bg/60 mr-0.5 pr-0.5">
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            className="p-1 rounded hover:bg-discord-hover transition-colors text-sm leading-none"
            onClick={() => onEmojiSelect(emoji)}
            title={`回应 ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Emoji 选择器（更多） */}
      <div className="relative">
        <button
          className="p-1.5 text-discord-muted hover:text-white rounded hover:bg-discord-hover transition-colors text-sm"
          onClick={onEmojiToggle}
          title="更多回应"
        >
          +
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-1 z-20">
            <EmojiPicker onSelect={onEmojiSelect} onClose={onEmojiClose} />
          </div>
        )}
      </div>

      {/* 回复 */}
      <button
        className="p-1.5 text-discord-muted hover:text-white rounded hover:bg-discord-hover transition-colors"
        onClick={onReply}
        title="回复"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 3L5 7l4 4V8h5.4c1.6 0 3 1.3 3.1 2.9.2 1.8-.5 3.5-1.8 4.6l1.5 1.5C18.7 15.4 19.8 13 19.5 10.5 19.2 7.5 16.6 5 13.4 5H9V3z"/>
        </svg>
      </button>

      {/* 话题（仅频道消息，非线程消息） */}
      {message.channelId && !message.threadParentId && (
        <button
          className="p-1.5 text-discord-muted hover:text-discord-accent rounded hover:bg-discord-hover transition-colors"
          onClick={onThread}
          title="在话题中回复"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        </button>
      )}

      {/* 转发 */}
      <button
        className="p-1.5 text-discord-muted hover:text-white rounded hover:bg-discord-hover transition-colors"
        onClick={onForward}
        title="转发消息"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 8V4l8 8-8 8v-4H4V8h8z"/>
        </svg>
      </button>

      {/* 收藏/书签 */}
      <button
        className={`p-1.5 rounded hover:bg-discord-hover transition-all duration-150 ${
          isBookmarked
            ? 'text-yellow-400 hover:text-yellow-300'
            : 'text-discord-muted hover:text-yellow-400'
        } ${bookmarkAnim ? 'scale-125' : 'scale-100'}`}
        onClick={onBookmark}
        title={isBookmarked ? '取消收藏' : '收藏消息'}
      >
        {isBookmarked ? (
          <span className="text-sm leading-none">🔖</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
          </svg>
        )}
      </button>

      {/* 复制 */}
      <button
        className="p-1.5 text-discord-muted hover:text-white rounded hover:bg-discord-hover transition-colors"
        onClick={onCopy}
        title="复制文本"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>

      {/* Pin（只对频道消息） */}
      {message.channelId && (
        <button
          className="p-1.5 text-discord-muted hover:text-white rounded hover:bg-discord-hover transition-colors"
          onClick={onPin}
          title="固定消息"
        >
          📌
        </button>
      )}

      {/* 编辑（只有自己的消息） */}
      {isMe && (
        <button
          className="p-1.5 text-discord-muted hover:text-white rounded hover:bg-discord-hover transition-colors"
          onClick={onEdit}
          title="编辑"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      )}

      {/* 删除（只有自己的消息） */}
      {isMe && (
        <button
          className="p-1.5 text-discord-muted hover:text-discord-red rounded hover:bg-discord-hover transition-colors"
          onClick={onDelete}
          title="删除"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// 消息反应区（带新增动画）
// 浮动 emoji 粒子动画
function EmojiBurst({ emoji, onDone }) {
  const items = React.useMemo(() => {
    // 生成 5-7 个随机方向的粒子
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 60,
      y: -(20 + Math.random() * 50),
      rotate: (Math.random() - 0.5) * 60,
      delay: i * 40,
    }))
  }, [])

  React.useEffect(() => {
    const t = setTimeout(onDone, 800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      {items.map(p => (
        <div
          key={p.id}
          className="absolute text-lg select-none emoji-burst-particle"
          style={{
            left: '50%',
            top: '50%',
            '--tx': `${p.x}px`,
            '--ty': `${p.y}px`,
            '--rot': `${p.rotate}deg`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          {emoji}
        </div>
      ))}
    </div>
  )
}

function ReactionBar({ reactions, onReaction, currentUserId }) {
  const [burst, setBurst] = React.useState(null) // { emoji, key }
  const [tooltip, setTooltip] = React.useState(null) // emoji string

  const handleClick = (emoji) => {
    onReaction(emoji)
    setBurst({ emoji, key: Date.now() })
  }

  if (!reactions || reactions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map(reaction => {
        const myReacted = reaction.users?.some(u => u.id === currentUserId)
        const isBursting = burst?.emoji === reaction.emoji
        const isTooltipOpen = tooltip === reaction.emoji
        const userNames = reaction.users?.map(u => u.username) || []
        return (
          <div key={reaction.emoji} className="relative">
            <button
              onClick={() => handleClick(reaction.emoji)}
              onMouseEnter={() => setTooltip(reaction.emoji)}
              onMouseLeave={() => setTooltip(null)}
              className={`relative flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-all duration-150 active:scale-90 ${
                myReacted
                  ? 'bg-discord-accent/30 border-discord-accent text-white scale-105'
                  : 'bg-discord-input border-discord-input hover:border-discord-accent text-discord-muted hover:text-white hover:scale-105'
              }`}
              style={{ transformOrigin: 'center' }}
            >
              <span>{reaction.emoji}</span>
              <span key={reaction.count} className="text-xs tabular-nums font-medium reaction-count-pop">{reaction.count}</span>
              {isBursting && (
                <EmojiBurst
                  key={burst.key}
                  emoji={reaction.emoji}
                  onDone={() => setBurst(null)}
                />
              )}
            </button>
            {/* Reaction 用户列表气泡 */}
            {isTooltipOpen && userNames.length > 0 && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 pointer-events-none">
                <div className="bg-discord-bg border border-discord-hover rounded-lg px-2.5 py-1.5 shadow-xl text-xs text-discord-text whitespace-nowrap max-w-[180px]">
                  <div className="text-[10px] text-discord-muted mb-0.5 font-medium">
                    {myReacted ? `你和其他 ${userNames.length - 1} 人` : `${userNames.length} 人`}回应了 {reaction.emoji}
                  </div>
                  <div className="truncate text-discord-muted">
                    {userNames.slice(0, 8).join(', ')}{userNames.length > 8 ? `... +${userNames.length - 8}` : ''}
                  </div>
                </div>
                {/* 小三角 */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-discord-hover" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// 线程统计徽章（显示在有话题的消息下方）
function ThreadStats({ stats, onClick }) {
  if (!stats || stats.replyCount === 0) return null
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 mt-1.5 px-2 py-1 rounded hover:bg-discord-accent/10 group/thread transition-colors max-w-xs"
    >
      {/* 参与者头像 */}
      <div className="flex -space-x-1 flex-shrink-0">
        {(stats.participants || []).slice(0, 3).map((p, i) => (
          <div
            key={p.id}
            className="w-5 h-5 rounded-full border border-discord-channel flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0"
            style={{ backgroundColor: p.avatar_color || '#5865f2', zIndex: 3 - i }}
            title={p.username}
          >
            {p.username?.[0]?.toUpperCase()}
          </div>
        ))}
      </div>
      {/* 回复数 */}
      <span className="text-xs font-medium text-discord-accent group-hover/thread:underline flex-shrink-0">
        {stats.replyCount} 条回复
      </span>
      {/* 最后回复时间 */}
      {stats.lastReplyAt && (
        <span className="text-xs text-discord-muted hidden group-hover/thread:inline">
          · 最后回复于 {formatMessageTime(stats.lastReplyAt)}
        </span>
      )}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted group-hover/thread:text-white transition-colors flex-shrink-0">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    </button>
  )
}

function MessageItem({ message, onReply, onThread, isGrouped = false, onJumpToMessage }) {
  const { user: me } = useAuthStore()
  const { bookmarks, addBookmark, removeBookmark, dmReadReceipts } = useChatStore()
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [profileCardPos, setProfileCardPos] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showForward, setShowForward] = useState(false)
  const [bookmarkAnim, setBookmarkAnim] = useState(false)
  const [contextMenu, setContextMenu] = useState(null) // { x, y }
  const editRef = useRef(null)
  const avatarRef = useRef(null)

  const isMe = message.senderId === me?.id
  const isBookmarked = bookmarks?.has(message.id)
  const socket = getSocket()

  // DM 已读状态（仅对我发出的 DM 消息有意义）
  const dmReadStatus = (() => {
    if (!isMe || !message.dmChannelId || !message.id || typeof message.id !== 'number') return null
    const receipts = dmReadReceipts[message.dmChannelId] || {}
    const otherReadId = Object.entries(receipts)
      .filter(([uid]) => parseInt(uid) !== me?.id)
      .map(([, msgId]) => msgId)[0]
    return otherReadId && otherReadId >= message.id ? '已读' : null
  })()

  // 重试发送失败的消息
  const handleRetry = useCallback(() => {
    if (!socket || !message.isFailed) return
    useChatStore.getState().retryMessage(message.id)
    socket.emit('send_message', {
      channelId: message.channelId || undefined,
      dmChannelId: message.dmChannelId || undefined,
      content: message.content,
      type: message.type || 'text',
      replyTo: message.replyTo || undefined,
      tempId: message.id,
    })
  }, [socket, message])

  // 系统消息特殊渲染
  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center px-4 py-1">
        <div className="text-xs text-discord-muted italic bg-discord-hover/30 px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  // Webhook/Bot 消息标记（显示 Bot 标签）
  const isWebhook = message.type === 'webhook'

  const handleAvatarClick = useCallback((e) => {
    if (isMe) return
    const rect = avatarRef.current?.getBoundingClientRect()
    if (rect) {
      setProfileCardPos({ x: rect.right + 8, y: rect.top })
    }
    setShowProfileCard(true)
  }, [isMe])

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(message.content)
    setTimeout(() => {
      if (editRef.current) {
        editRef.current.focus()
        editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length)
      }
    }, 50)
  }

  const handleEditSubmit = (e) => {
    e?.preventDefault()
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false)
      return
    }
    socket?.emit('edit_message', { messageId: message.id, content: editContent })
    setIsEditing(false)
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit(e)
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const handleDelete = () => {
    if (confirm('确认删除这条消息？')) {
      socket?.emit('delete_message', { messageId: message.id })
    }
  }

  const handleReaction = (emoji) => {
    const myReaction = message.reactions?.find(r => r.users?.some(u => u.id === me?.id) && r.emoji === emoji)
    if (myReaction) {
      socket?.emit('remove_reaction', { messageId: message.id, emoji })
    } else {
      socket?.emit('add_reaction', { messageId: message.id, emoji })
    }
    setShowEmojiPicker(false)
  }

  const handlePin = () => {
    socket?.emit('pin_message', { messageId: message.id })
  }

  const handleCopyText = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
    }
  }

  const handleBookmark = async () => {
    setBookmarkAnim(true)
    setTimeout(() => setBookmarkAnim(false), 400)
    if (isBookmarked) {
      await removeBookmark(message.id)
    } else {
      await addBookmark(message.id)
    }
  }

  // 右键上下文菜单
  const handleContextMenu = useCallback((e) => {
    if (message.isDeleted) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [message.isDeleted])

  // 构建右键菜单项
  const buildContextMenuItems = () => {
    const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥']
    const items = []

    // 快速回应（小 emoji 行）
    if (!message.isDeleted) {
      items.push({
        label: (
          <div className="flex items-center gap-1">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                className="text-base px-1 py-0.5 rounded hover:bg-discord-hover transition-colors"
                onClick={(e) => { e.stopPropagation(); handleReaction(emoji); setContextMenu(null) }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ),
        onClick: () => {}, // 不关闭
        disabled: false,
      })
      items.push({ divider: true })
    }

    if (!message.isDeleted) {
      items.push({ icon: '↩️', label: '回复', onClick: () => onReply?.(message) })
    }
    if (message.channelId && !message.threadParentId && !message.isDeleted) {
      items.push({ icon: '💬', label: '在话题中回复', onClick: () => onThread?.(message) })
    }
    if (!message.isDeleted) {
      items.push({ icon: '➡️', label: '转发消息', onClick: () => setShowForward(true) })
    }

    items.push({ divider: true })

    if (!message.isDeleted) {
      items.push({
        icon: isBookmarked ? '🔖' : '🔖',
        label: isBookmarked ? '取消收藏' : '收藏消息',
        onClick: handleBookmark,
      })
    }
    if (message.channelId && !message.isDeleted) {
      items.push({ icon: '📌', label: '固定消息', onClick: handlePin })
    }
    if (message.content && !message.isDeleted) {
      items.push({ icon: '📋', label: '复制文本', shortcut: 'Ctrl+C', onClick: handleCopyText })
    }

    if (isMe && !message.isDeleted) {
      items.push({ divider: true })
      items.push({ icon: '✏️', label: '编辑消息', onClick: handleEdit })
      items.push({ icon: '🗑️', label: '删除消息', onClick: handleDelete, danger: true })
    }

    return items
  }

  // 渲染消息内容
  const renderContent = () => {
    if (message.isDeleted) {
      return <span className="italic text-discord-muted text-sm">消息已删除</span>
    }

    if (message.type === 'image') {
      return (
        <div className="mt-1">
          {!imgLoaded && (
            <div className="skeleton w-64 h-40 rounded-lg" />
          )}
          <img
            src={message.content}
            alt="图片消息"
            className={`message-image cursor-zoom-in transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
            onClick={() => setShowImageModal(true)}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
          {showImageModal && (
            <ImageLightbox src={message.content} onClose={() => setShowImageModal(false)} />
          )}
        </div>
      )
    }

    if (message.type === 'gif') {
      return (
        <div className="mt-1">
          {!imgLoaded && (
            <div className="skeleton w-64 h-40 rounded-lg" />
          )}
          <div className="relative inline-block group/gif">
            <img
              src={message.content}
              alt="GIF"
              className={`message-image cursor-zoom-in transition-opacity rounded-lg ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
              style={{ maxWidth: '320px', maxHeight: '240px', objectFit: 'contain' }}
              onClick={() => setShowImageModal(true)}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
            />
            {/* GIF 标签徽章 */}
            {imgLoaded && (
              <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded pointer-events-none select-none">
                GIF
              </span>
            )}
          </div>
          {showImageModal && (
            <ImageLightbox src={message.content} onClose={() => setShowImageModal(false)} />
          )}
        </div>
      )
    }

    if (message.type === 'audio') {
      return (
        <div className="mt-1 flex items-center gap-2">
          <svg className="w-4 h-4 text-discord-accent flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <AudioPlayer src={message.content} />
        </div>
      )
    }

    return (
      <CollapsibleMessageContent text={message.content}>
        <MarkdownContent text={message.content} currentUsername={me?.username} />
        {/* 链接预览卡片 */}
        {!message.isDeleted && !message.isPending && (
          <LinkPreviewCard url={extractFirstUrl(message.content)} />
        )}
      </CollapsibleMessageContent>
    )
  }

  const toolbarProps = {
    showActions,
    isEditing,
    isMe,
    message,
    isBookmarked,
    bookmarkAnim,
    showEmojiPicker,
    onEmojiToggle: () => setShowEmojiPicker(!showEmojiPicker),
    onEmojiSelect: handleReaction,
    onEmojiClose: () => setShowEmojiPicker(false),
    onReply: () => onReply && onReply(message),
    onThread: () => onThread && onThread(message),
    onEdit: handleEdit,
    onDelete: handleDelete,
    onPin: handlePin,
    onCopy: handleCopyText,
    onBookmark: handleBookmark,
    onForward: () => setShowForward(true),
  }

  // 分组消息：不显示头像和用户名，只显示内容
  if (isGrouped) {
    return (
      <div
        data-message-id={message.id}
        className={`message-item grouped group relative flex gap-3 px-4 hover:bg-discord-hover/30 rounded-sm ${message.isPending ? 'opacity-60' : ''} ${message.isFailed ? 'bg-discord-red/10 border-l-2 border-discord-red' : ''} ${message.isNew ? 'message-new' : ''}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}
        onContextMenu={handleContextMenu}
      >
        {/* 时间戳占位（hover 时显示） */}
        <div className="w-9 flex-shrink-0 flex items-center justify-end">
          {showActions && (
            <span className="text-[10px] text-discord-muted opacity-0 group-hover:opacity-100 transition-opacity">
              {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div>
              <textarea
                ref={editRef}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-md outline-none resize-none"
                rows={2}
              />
              <div className="text-xs text-discord-muted mt-1">按 Enter 保存，Esc 取消</div>
            </div>
          ) : (
            <div className={`text-sm text-discord-text ${message.isDeleted ? 'italic' : ''}`}>
              {renderContent()}
              {message.isEdited && !message.isDeleted && (
                <span className="text-xs text-discord-muted italic ml-1">(已编辑)</span>
              )}
            </div>
          )}

          <ReactionBar reactions={message.reactions} onReaction={handleReaction} currentUserId={me?.id} />
        </div>

        <MessageToolbar {...toolbarProps} />

        {showForward && (
          <ForwardModal message={message} onClose={() => setShowForward(false)} />
        )}

        {/* 右键菜单 */}
        {contextMenu && (
          <ContextMenu
            items={buildContextMenuItems()}
            position={contextMenu}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div
      data-message-id={message.id}
      className={`message-item group relative flex gap-3 px-4 hover:bg-discord-hover/30 rounded-sm ${message.isPending ? 'opacity-60' : ''} ${message.isFailed ? 'bg-discord-red/10 border-l-2 border-discord-red' : ''} ${message.isNew ? 'message-new' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}
      onContextMenu={handleContextMenu}
    >
      {/* 头像 */}
      <div className="mt-0.5 flex-shrink-0" ref={avatarRef}>
        <Avatar
          user={{ id: message.senderId, username: message.username, avatarColor: message.avatarColor }}
          size="md"
          showStatus={true}
          onClick={handleAvatarClick}
          className={!isMe ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        />
      </div>

      <div className="flex-1 min-w-0">
        {/* 用户名 + 时间 */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span
            className="font-semibold text-white text-sm hover:underline cursor-pointer"
            onClick={handleAvatarClick}
          >
            {message.username}
          </span>
          {isWebhook && (
            <span className="text-[10px] bg-discord-accent px-1.5 py-0.5 rounded text-white font-bold tracking-wide" title="Webhook 机器人">
              BOT
            </span>
          )}
          <span className="text-xs text-discord-muted" title={formatFullTime(message.createdAt)}>
            {formatMessageTime(message.createdAt)}
          </span>
          {message.isEdited && !message.isDeleted && (
            <span className="text-xs text-discord-muted italic">(已编辑)</span>
          )}
          {message.isPending && (
            <span className="text-xs text-discord-muted">发送中...</span>
          )}
          {message.isFailed && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-discord-red font-medium">发送失败</span>
              <button
                onClick={handleRetry}
                className="text-xs text-discord-accent hover:underline"
              >
                重试
              </button>
            </span>
          )}
          {dmReadStatus && (
            <span className="text-[10px] text-discord-muted flex items-center gap-0.5" title="对方已读">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-discord-accent">
                <path d="M0.41 13.41L6 19l1.41-1.42L1.83 12zM22.24 5.58l-11.4 11.4L6.82 13l-1.41 1.41L10.83 19l13-13zM18 7l-1.41-1.41-6.34 6.34 1.41 1.41z"/>
              </svg>
              已读
            </span>
          )}
        </div>

        {/* 引用回复 */}
        {message.replyTo && !message.isDeleted && (
          <div
            className="reply-preview mb-1"
            onClick={() => onJumpToMessage?.(message.replyTo)}
            title="点击跳转到原消息"
          >
            <span className="font-medium">{message.replyUsername}: </span>
            {message.replyContent?.length > 80 ? message.replyContent.slice(0, 80) + '...' : message.replyContent}
          </div>
        )}

        {/* 消息内容 */}
        {isEditing ? (
          <div>
            <textarea
              ref={editRef}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-md outline-none resize-none"
              rows={2}
            />
            <div className="text-xs text-discord-muted mt-1">按 Enter 保存，Esc 取消</div>
          </div>
        ) : (
          <div className={`text-sm text-discord-text ${message.isDeleted ? 'italic' : ''}`}>
            {renderContent()}
          </div>
        )}

        <ReactionBar reactions={message.reactions} onReaction={handleReaction} currentUserId={me?.id} />
        <ThreadStats stats={message.threadStats} onClick={() => onThread && onThread(message)} />
      </div>

      <MessageToolbar {...toolbarProps} />

      {/* 用户资料卡片 */}
      {showProfileCard && !isMe && (
        <UserProfileCard
          userId={message.senderId}
          username={message.username}
          avatarColor={message.avatarColor}
          position={profileCardPos}
          onClose={() => setShowProfileCard(false)}
        />
      )}

      {/* 转发弹窗 */}
      {showForward && (
        <ForwardModal
          message={message}
          onClose={() => setShowForward(false)}
        />
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          items={buildContextMenuItems()}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

// 使用 React.memo 避免父组件重渲染时不必要的子组件重渲染
export default React.memo(MessageItem, (prev, next) => {
  return prev.message === next.message &&
         prev.isGrouped === next.isGrouped &&
         prev.onReply === next.onReply &&
         prev.onJumpToMessage === next.onJumpToMessage
})
