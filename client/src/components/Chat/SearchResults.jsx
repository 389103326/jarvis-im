/**
 * components/Chat/SearchResults.jsx - 搜索结果展示
 * 支持: 全局/当前频道切换、点击跳转到频道、结果高亮
 */

import React, { useState } from 'react'
import useChatStore from '../../store/useChatStore'
import { formatMessageTime } from '../../utils/format'

// 高亮搜索关键词
function HighlightText({ text, query }) {
  if (!text || !query) return <span>{text}</span>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/30 text-yellow-300 rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

export default function SearchResults({ onClose, currentChannelId }) {
  const { searchResults, searchQuery, channels, setActiveChannel, fetchMessages } = useChatStore()
  const [copiedId, setCopiedId] = useState(null)

  // 跳转到指定频道的指定消息
  const handleJumpToChannel = async (msg) => {
    if (!msg.channelId) return
    // 切换频道
    setActiveChannel(msg.channelId, 'channel')
    // 加载该频道消息（如果尚未加载）
    await fetchMessages(msg.channelId, 'channel')
    onClose()

    // 延迟后滚动到目标消息
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${msg.id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.remove('message-highlight')
        void el.offsetHeight
        el.classList.add('message-highlight')
        el.addEventListener('animationend', () => el.classList.remove('message-highlight'), { once: true })
      }
    }, 300)
  }

  const getChannelName = (channelId) => {
    return channels.find(c => c.id === channelId)?.name || `频道${channelId}`
  }

  // 按频道分组显示
  const grouped = searchResults.reduce((acc, msg) => {
    const key = msg.channelId ? `channel:${msg.channelId}` : 'dm'
    if (!acc[key]) acc[key] = []
    acc[key].push(msg)
    return acc
  }, {})

  return (
    <div className="absolute inset-0 bg-discord-channel z-10 flex flex-col modal-animate">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-discord-muted" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <h3 className="text-white font-semibold text-sm">
            "{searchQuery}" 的搜索结果
            <span className="ml-2 text-discord-muted font-normal text-xs">
              共 {searchResults.length} 条
            </span>
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-discord-muted hover:text-white transition-colors p-1 rounded hover:bg-discord-hover"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* 结果列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchResults.length === 0 ? (
          <div className="text-center text-discord-muted py-16">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-medium">没有找到相关消息</p>
            <p className="text-xs mt-1 opacity-60">试试其他关键词</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([groupKey, msgs]) => {
              const isChannel = groupKey.startsWith('channel:')
              const channelId = isChannel ? parseInt(groupKey.split(':')[1]) : null
              const channelName = channelId ? getChannelName(channelId) : '私信'

              return (
                <div key={groupKey}>
                  {/* 分组标题 */}
                  {isChannel && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-discord-muted text-xs">#</span>
                      <span className="text-discord-muted text-xs font-semibold uppercase tracking-wide">
                        {channelName}
                      </span>
                      <div className="flex-1 h-px bg-discord-hover" />
                      <span className="text-discord-muted text-xs">{msgs.length} 条</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {msgs.map(msg => (
                      <div
                        key={msg.id}
                        className="bg-discord-sidebar rounded-lg px-4 py-3 group hover:bg-discord-hover/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 mb-1 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: msg.avatarColor || '#5865F2' }}
                            >
                              {msg.username?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-white font-medium text-sm">{msg.username}</span>
                            <span className="text-discord-muted text-xs">{formatMessageTime(msg.createdAt)}</span>
                            {msg.channelId && msg.channelId !== currentChannelId && (
                              <span className="text-discord-muted text-xs">
                                · <span className="text-discord-accent/70">#{channelName}</span>
                              </span>
                            )}
                          </div>

                          {/* 操作按钮（hover 时显示） */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            {msg.channelId && (
                              <button
                                onClick={() => handleJumpToChannel(msg)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-discord-accent/20 hover:bg-discord-accent text-discord-accent hover:text-white rounded transition-colors"
                                title="跳转到此消息"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                                </svg>
                                跳转
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-discord-text text-sm pl-8">
                          {msg.isDeleted
                            ? <em className="text-discord-muted">消息已删除</em>
                            : <HighlightText text={msg.content} query={searchQuery} />
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-2 border-t border-discord-bg text-xs text-discord-muted flex items-center gap-2 flex-shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        搜索范围：全部频道 · 最多显示 50 条结果
      </div>
    </div>
  )
}
