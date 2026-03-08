/**
 * components/Chat/ForwardModal.jsx - 消息转发弹窗
 * 将消息转发到指定频道或私信
 */

import React, { useState, useMemo } from 'react'
import useChatStore from '../../store/useChatStore'
import useAuthStore from '../../store/useAuthStore'
import { getSocket } from '../../hooks/useSocket'

export default function ForwardModal({ message, onClose }) {
  const { channels, dmList } = useChatStore()
  const { user } = useAuthStore()
  const socket = getSocket()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTarget, setSelectedTarget] = useState(null) // {type: 'channel'|'dm', id, name}
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  // 过滤频道和 DM
  const filteredChannels = useMemo(() =>
    channels.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [channels, searchQuery]
  )

  const filteredDMs = useMemo(() =>
    dmList.filter(dm =>
      dm.otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [dmList, searchQuery]
  )

  const handleForward = () => {
    if (!selectedTarget || !socket) return
    setSending(true)

    // 构造转发内容
    const forwardedContent = message.type === 'image'
      ? message.content  // 图片直接转发
      : `> **[转发自 @${message.username}]**\n> ${message.content}`

    const msgType = message.type === 'image' ? 'image' : 'text'

    socket.emit('send_message', {
      channelId: selectedTarget.type === 'channel' ? selectedTarget.id : undefined,
      dmChannelId: selectedTarget.type === 'dm' ? selectedTarget.id : undefined,
      content: forwardedContent,
      type: msgType,
    })

    setSent(true)
    setSending(false)
    setTimeout(() => onClose(), 1000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span>📤</span> 转发消息
          </h3>
          <button onClick={onClose} className="text-discord-muted hover:text-white">✕</button>
        </div>

        {/* 原始消息预览 */}
        <div className="px-4 pt-3">
          <div className="bg-discord-bg rounded-lg px-3 py-2 mb-3">
            <div className="text-xs text-discord-muted mb-1">原消息 · {message.username}</div>
            <div className="text-sm text-discord-text line-clamp-3">
              {message.type === 'image' ? '🖼️ 图片消息' : message.content}
            </div>
          </div>

          {/* 搜索框 */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索频道或用户..."
            className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent mb-2"
            autoFocus
          />
        </div>

        {/* 目标选择列表 */}
        <div className="max-h-64 overflow-y-auto px-4 pb-2">
          {/* 频道 */}
          {filteredChannels.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-discord-muted uppercase tracking-wider px-1 py-1">频道</div>
              {filteredChannels.map(ch => (
                <button
                  key={`ch-${ch.id}`}
                  onClick={() => setSelectedTarget({ type: 'channel', id: ch.id, name: `#${ch.name}` })}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedTarget?.type === 'channel' && selectedTarget.id === ch.id
                      ? 'bg-discord-accent text-white'
                      : 'text-discord-text hover:bg-discord-hover'
                  }`}
                >
                  <span className="text-discord-muted">#</span>
                  <span>{ch.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* 私信 */}
          {filteredDMs.length > 0 && (
            <div>
              <div className="text-xs text-discord-muted uppercase tracking-wider px-1 py-1">私信</div>
              {filteredDMs.map(dm => (
                <button
                  key={`dm-${dm.id}`}
                  onClick={() => setSelectedTarget({ type: 'dm', id: dm.id, name: dm.otherUser?.username })}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedTarget?.type === 'dm' && selectedTarget.id === dm.id
                      ? 'bg-discord-accent text-white'
                      : 'text-discord-text hover:bg-discord-hover'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: dm.otherUser?.avatarColor || '#5865f2' }}
                  >
                    {dm.otherUser?.username?.[0]?.toUpperCase()}
                  </div>
                  <span>{dm.otherUser?.username}</span>
                </button>
              ))}
            </div>
          )}

          {filteredChannels.length === 0 && filteredDMs.length === 0 && (
            <div className="text-center text-discord-muted text-sm py-4">无匹配结果</div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-4 py-3 border-t border-discord-bg flex items-center justify-between">
          {selectedTarget ? (
            <span className="text-sm text-discord-muted">
              转发到 <span className="text-white font-medium">{selectedTarget.name}</span>
            </span>
          ) : (
            <span className="text-sm text-discord-muted">请选择转发目标</span>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-discord-muted hover:text-white rounded-lg hover:bg-discord-hover transition-colors">
              取消
            </button>
            <button
              onClick={handleForward}
              disabled={!selectedTarget || sending || sent}
              className="px-4 py-1.5 text-sm bg-discord-accent hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg transition-colors font-medium"
            >
              {sent ? '✓ 已转发' : sending ? '转发中...' : '转发'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
