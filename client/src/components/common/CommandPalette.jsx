/**
 * components/common/CommandPalette.jsx - 命令面板 (Ctrl+K)
 */

import React, { useState, useEffect, useRef } from 'react'
import useChatStore from '../../store/useChatStore'
import { getSocket } from '../../hooks/useSocket'

export default function CommandPalette({ onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const { channels, dmList, setActiveChannel, fetchMessages, activeChannelId, activeType } = useChatStore()
  const socket = getSocket()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 按 Esc 关闭
  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  // 构建搜索结果
  const channelResults = channels.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  )
  const dmResults = dmList.filter(d =>
    d.otherUser?.username?.toLowerCase().includes(query.toLowerCase())
  )

  const allResults = [
    ...channelResults.map(c => ({ type: 'channel', id: c.id, label: `#${c.name}`, desc: c.description, data: c })),
    ...dmResults.map(d => ({ type: 'dm', id: d.id, label: d.otherUser?.username, desc: '私信', data: d })),
  ]

  const [selectedIdx, setSelectedIdx] = useState(0)

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allResults[selectedIdx]) selectItem(allResults[selectedIdx])
    }
  }

  const selectItem = (item) => {
    // 离开旧频道
    if (activeChannelId && activeType === 'channel') {
      socket?.emit('leave_channel', { channelId: activeChannelId })
    }

    setActiveChannel(item.id, item.type)
    fetchMessages(item.id, item.type)

    if (item.type === 'channel') {
      socket?.emit('join_channel', { channelId: item.id })
    }

    onClose()
  }

  // query 变化时重置选中
  useEffect(() => setSelectedIdx(0), [query])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-24 z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-discord-bg">
          <svg className="w-5 h-5 text-discord-muted flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="快速跳转到频道或用户..."
            className="flex-1 bg-transparent text-discord-text outline-none text-base placeholder-discord-muted"
          />
          <kbd className="text-xs text-discord-muted bg-discord-bg px-1.5 py-0.5 rounded border border-discord-hover">ESC</kbd>
        </div>

        {/* 结果列表 */}
        <div className="max-h-80 overflow-y-auto">
          {allResults.length === 0 ? (
            <div className="px-4 py-6 text-center text-discord-muted text-sm">
              {query ? `没有找到 "${query}"` : '输入关键词搜索频道或用户'}
            </div>
          ) : (
            <div className="py-1">
              {channelResults.length > 0 && (
                <div className="px-3 py-1.5 text-xs font-semibold text-discord-muted uppercase tracking-wider">
                  频道
                </div>
              )}
              {allResults.map((item, idx) => (
                <button
                  key={`${item.type}_${item.id}`}
                  onClick={() => selectItem(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    idx === selectedIdx
                      ? 'bg-discord-accent text-white'
                      : 'text-discord-text hover:bg-discord-hover'
                  }`}
                >
                  {item.type === 'channel' ? (
                    <span className={`text-base font-bold ${idx === selectedIdx ? 'text-white' : 'text-discord-muted'}`}>#</span>
                  ) : (
                    <span className="text-base">💬</span>
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-medium">{item.label}</div>
                    {item.desc && <div className={`text-xs ${idx === selectedIdx ? 'text-white/70' : 'text-discord-muted'}`}>{item.desc}</div>}
                  </div>
                  {item.type === 'channel' && item.data.unreadCount > 0 && (
                    <span className="unread-badge">{item.data.unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-discord-bg flex items-center gap-4 text-xs text-discord-muted">
          <span>↑↓ 导航</span>
          <span>Enter 跳转</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
