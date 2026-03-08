/**
 * components/Sidebar/MentionsList.jsx - @提及消息列表
 * 显示所有包含 @当前用户名 的消息
 */

import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/useAuthStore'
import useChatStore from '../../store/useChatStore'
import { formatMessageTime } from '../../utils/format'

// 高亮提及文本
function HighlightMention({ text, username }) {
  if (!text || !username) return <span>{text}</span>
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(@${escaped})`, 'gi'))
  return (
    <span>
      {parts.map((p, i) =>
        p.toLowerCase() === `@${username.toLowerCase()}`
          ? <mark key={i} className="bg-discord-accent/40 text-white rounded px-0.5 not-italic">{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}

export default function MentionsList() {
  const { user } = useAuthStore()
  const { setActiveChannel, fetchMessages, channels } = useChatStore()
  const [mentions, setMentions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadMentions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get('/api/messages/mentions', { params: { limit: 50 } })
      setMentions(res.data)
    } catch (err) {
      setError('加载失败')
      console.error('Load mentions error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadMentions()
  }, [loadMentions])

  const handleJump = async (msg) => {
    if (!msg.channelId) return
    setActiveChannel(msg.channelId, 'channel')
    await fetchMessages(msg.channelId, 'channel')

    // 滚动到目标消息并高亮
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${msg.id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.remove('message-highlight')
        void el.offsetHeight
        el.classList.add('message-highlight')
        el.addEventListener('animationend', () => el.classList.remove('message-highlight'), { once: true })
      }
    }, 350)
  }

  const getChannelName = (channelId) =>
    channels.find(c => c.id === channelId)?.name || `频道${channelId}`

  if (loading) {
    return (
      <div className="px-3 py-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-discord-bg rounded-lg p-3 space-y-2">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-2.5 w-40 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-8 text-center">
        <div className="text-discord-red text-sm mb-2">{error}</div>
        <button
          onClick={loadMentions}
          className="text-xs text-discord-accent hover:underline"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-discord-bg flex-shrink-0">
        <span className="text-xs font-semibold text-discord-muted uppercase tracking-wider">
          最近提及 · {mentions.length}
        </span>
        <button
          onClick={loadMentions}
          className="text-discord-muted hover:text-white text-xs p-1 rounded hover:bg-discord-hover transition-colors"
          title="刷新"
        >
          ↻
        </button>
      </div>

      {/* 提及列表 */}
      <div className="flex-1 overflow-y-auto py-1">
        {mentions.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">🔔</div>
            <p className="text-discord-muted text-xs">暂无 @提及</p>
          </div>
        ) : (
          <div className="space-y-1 px-2 py-1">
            {mentions.map(msg => (
              <button
                key={msg.id}
                onClick={() => handleJump(msg)}
                className="w-full text-left bg-discord-bg hover:bg-discord-hover/60 rounded-lg px-3 py-2.5 transition-colors group"
              >
                {/* 用户名 + 频道 + 时间 */}
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: msg.avatarColor || '#5865F2' }}
                  >
                    {msg.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-white">{msg.username}</span>
                  {msg.channelId && (
                    <span className="text-[10px] text-discord-muted">
                      # {getChannelName(msg.channelId)}
                    </span>
                  )}
                  <span className="text-[10px] text-discord-muted ml-auto flex-shrink-0">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>

                {/* 消息内容（截断 + 高亮） */}
                <div className="text-xs text-discord-text leading-relaxed line-clamp-2">
                  <HighlightMention
                    text={msg.content?.length > 120 ? msg.content.slice(0, 120) + '…' : msg.content}
                    username={user?.username}
                  />
                </div>

                {/* 跳转提示 */}
                <div className="text-[10px] text-discord-accent opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                  点击跳转 →
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
