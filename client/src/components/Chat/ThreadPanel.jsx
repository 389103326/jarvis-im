/**
 * components/Chat/ThreadPanel.jsx - 话题/线程面板
 * 点击消息上的"N 条回复"或工具栏"话题"按钮后，从右侧滑入
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import useAuthStore from '../../store/useAuthStore'
import useChatStore from '../../store/useChatStore'
import Avatar from '../common/Avatar'
import { formatMessageTime, formatFullTime, renderMarkdown, highlightCode } from '../../utils/format'
import { getSocket } from '../../hooks/useSocket'

// 简单 Markdown 渲染（复用 MessageItem 的逻辑）
function SimpleMarkdown({ text }) {
  if (!text) return null
  const tokens = renderMarkdown(text)
  return (
    <span className="message-content">
      {tokens.map(token => {
        switch (token.type) {
          case 'codeblock': {
            const hlTokens = highlightCode(token.content)
            return (
              <pre key={token.key} className="bg-discord-bg rounded p-2 my-1 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                <code>
                  {hlTokens.map((t, idx) => {
                    const colorMap = { keyword: '#7aa2f7', string: '#9ece6a', comment: '#565f89', number: '#ff9e64', builtin: '#bb9af7' }
                    return <span key={idx} style={colorMap[t.type] ? { color: colorMap[t.type] } : undefined}>{t.value}</span>
                  })}
                </code>
              </pre>
            )
          }
          case 'code':
            return <code key={token.key} className="bg-discord-bg text-discord-yellow px-1 rounded font-mono text-xs">{token.content}</code>
          case 'bold':
            return <strong key={token.key} className="font-bold text-white">{token.content}</strong>
          case 'italic':
            return <em key={token.key} className="italic">{token.content}</em>
          case 'link':
            return <a key={token.key} href={token.href} target="_blank" rel="noopener noreferrer" className="text-discord-accent hover:underline">{token.content}</a>
          default:
            return <span key={token.key}>{token.content}</span>
        }
      })}
    </span>
  )
}

// 单条线程消息
function ThreadMessage({ message, isMe }) {
  const [showActions, setShowActions] = useState(false)
  const socket = getSocket()
  const { user: me } = useAuthStore()

  const handleReaction = (emoji) => {
    socket?.emit('add_reaction', { messageId: message.id, emoji })
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-discord-muted italic">{message.content}</span>
      </div>
    )
  }

  return (
    <div
      className={`flex gap-2.5 px-4 py-1.5 hover:bg-discord-hover/20 rounded group relative ${
        message.isNew ? 'message-new' : ''
      } ${message.isDeleted ? 'opacity-50' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar
        user={{ id: message.senderId, username: message.username, avatarColor: message.avatarColor }}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-semibold text-white">{message.username}</span>
          <span className="text-[11px] text-discord-muted" title={formatFullTime(message.createdAt)}>
            {formatMessageTime(message.createdAt)}
          </span>
          {message.isEdited && <span className="text-[11px] text-discord-muted italic">(已编辑)</span>}
        </div>
        <div className="text-sm text-discord-text">
          {message.isDeleted
            ? <span className="italic text-discord-muted">消息已删除</span>
            : <SimpleMarkdown text={message.content} />
          }
        </div>
        {/* 反应 */}
        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map(r => {
              const myReacted = r.users?.some(u => u.id === me?.id)
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleReaction(r.emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                    myReacted
                      ? 'bg-discord-accent/30 border-discord-accent text-white'
                      : 'bg-discord-input border-discord-input hover:border-discord-accent text-discord-muted'
                  }`}
                >
                  {r.emoji} {r.count}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// 线程输入框
function ThreadInput({ parentMessageId }) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)
  const { user } = useAuthStore()
  const socket = getSocket()
  const { addThreadMessage, updateThreadStats } = useChatStore()

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return

    const tempId = `thread_temp_${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      threadParentId: parentMessageId,
      senderId: user?.id,
      username: user?.username,
      avatarColor: user?.avatar_color,
      content: trimmed,
      type: 'text',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      reactions: [],
      isPending: true,
    }

    addThreadMessage(parentMessageId, optimisticMsg)
    setContent('')
    textareaRef.current?.focus()

    socket?.emit('send_message', {
      content: trimmed,
      type: 'text',
      threadParentId: parentMessageId,
      tempId,
    })
  }, [content, sending, parentMessageId, user, socket, addThreadMessage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-4 pb-4 pt-2 border-t border-discord-bg/60">
      <div className="flex gap-2 items-end bg-discord-input rounded-lg px-3 py-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="回复到话题..."
          rows={1}
          className="flex-1 bg-transparent text-discord-text text-sm outline-none resize-none max-h-32 min-h-[24px] leading-6"
          style={{ height: 'auto' }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="flex-shrink-0 p-1.5 text-discord-muted hover:text-white disabled:opacity-40 transition-colors"
          title="发送（Enter）"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div className="text-[11px] text-discord-muted mt-1 pl-1">
        按 <kbd className="bg-discord-input px-1 rounded text-[10px]">Enter</kbd> 发送，
        <kbd className="bg-discord-input px-1 rounded text-[10px]">Shift+Enter</kbd> 换行
      </div>
    </div>
  )
}

export default function ThreadPanel({ onClose }) {
  const { activeThread, threadMessages, threadLoading } = useChatStore()
  const { user: me } = useAuthStore()
  const bottomRef = useRef(null)
  const socket = getSocket()

  const replies = activeThread ? (threadMessages[activeThread.id] || []) : []
  const replyCount = replies.filter(m => !m.isDeleted).length

  // 加入线程房间
  useEffect(() => {
    if (!activeThread?.id || !socket) return
    socket.emit('join_thread', { threadParentId: activeThread.id })
    return () => {
      socket.emit('leave_thread', { threadParentId: activeThread.id })
    }
  }, [activeThread?.id, socket])

  // 新消息时滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  if (!activeThread) return null

  return (
    <div
      className="flex flex-col w-80 bg-discord-sidebar border-l border-discord-bg flex-shrink-0"
      style={{ animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          <span className="font-semibold text-white text-sm">话题</span>
          {replyCount > 0 && (
            <span className="text-xs text-discord-muted bg-discord-bg px-1.5 py-0.5 rounded-full">
              {replyCount} 条回复
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-discord-muted hover:text-white w-7 h-7 flex items-center justify-center rounded hover:bg-discord-hover transition-colors"
        >
          ✕
        </button>
      </div>

      {/* 父消息 */}
      <div className="px-4 py-3 border-b border-discord-bg/60 flex-shrink-0">
        <div className="flex gap-2.5">
          <Avatar
            user={{
              id: activeThread.senderId,
              username: activeThread.username,
              avatarColor: activeThread.avatarColor
            }}
            size="sm"
            className="flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">{activeThread.username}</span>
              <span className="text-[11px] text-discord-muted">
                {formatMessageTime(activeThread.createdAt)}
              </span>
            </div>
            <div className="text-sm text-discord-text">
              <SimpleMarkdown text={activeThread.content} />
            </div>
          </div>
        </div>
        {replyCount > 0 && (
          <div className="mt-2 text-[11px] text-discord-muted pl-9">
            {replyCount} 条回复
          </div>
        )}
      </div>

      {/* 回复分割线 */}
      {replyCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0">
          <div className="flex-1 h-px bg-discord-bg" />
          <span className="text-[11px] text-discord-muted font-medium">
            {replyCount} 条回复
          </span>
          <div className="flex-1 h-px bg-discord-bg" />
        </div>
      )}

      {/* 回复列表 */}
      <div className="flex-1 overflow-y-auto py-1">
        {threadLoading && replies.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin w-5 h-5 text-discord-muted" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}

        {!threadLoading && replies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm text-discord-muted">还没有回复，成为第一个回复的人！</p>
          </div>
        )}

        {replies.map(msg => (
          <ThreadMessage
            key={msg.id}
            message={msg}
            isMe={msg.senderId === me?.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <ThreadInput parentMessageId={activeThread.id} />
    </div>
  )
}
