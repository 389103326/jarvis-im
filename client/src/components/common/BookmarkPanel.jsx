/**
 * components/common/BookmarkPanel.jsx - 书签/收藏面板
 * 侧边抽屉，显示用户收藏的所有消息
 */

import React, { useEffect, useState } from 'react'
import useChatStore from '../../store/useChatStore'
import useAuthStore from '../../store/useAuthStore'
import Avatar from './Avatar'

function BookmarkItem({ bookmark, onRemove, onJump }) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove(bookmark.message_id)
    setRemoving(false)
  }

  const timeStr = new Date(bookmark.bookmarked_at || bookmark.created_at).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const msgTime = new Date(bookmark.msg_created_at).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric'
  })

  return (
    <div className="group flex gap-3 px-4 py-3 hover:bg-discord-hover/30 border-b border-discord-bg/40 transition-colors">
      {/* 头像 */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white font-bold flex-shrink-0 mt-0.5"
        style={{ backgroundColor: bookmark.avatar_color || '#5865f2' }}
      >
        {bookmark.username?.[0]?.toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* 来源信息 */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-medium text-white text-sm">{bookmark.username}</span>
          <span className="text-xs text-discord-muted">{msgTime}</span>
          {bookmark.channel_name && (
            <span className="text-xs text-discord-accent">#{bookmark.channel_name}</span>
          )}
        </div>

        {/* 消息内容 */}
        <div className="text-sm text-discord-text">
          {bookmark.type === 'image' ? (
            <span className="text-discord-muted italic">🖼️ 图片消息</span>
          ) : (
            <span className="line-clamp-3 break-words">{bookmark.content}</span>
          )}
        </div>

        {/* 收藏时间 */}
        <div className="text-xs text-discord-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          收藏于 {timeStr}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-discord-muted hover:text-discord-red text-xs px-2 py-1 rounded hover:bg-discord-hover transition-colors"
          title="取消收藏"
        >
          {removing ? '...' : '✕'}
        </button>
      </div>
    </div>
  )
}

export default function BookmarkPanel({ onClose }) {
  const { bookmarkList, fetchBookmarks, removeBookmark, setActiveChannel, fetchMessages } = useChatStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      await fetchBookmarks()
      setLoading(false)
    }
    load()
  }, [])

  const handleRemove = async (messageId) => {
    await removeBookmark(messageId)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-end z-50" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-discord-sidebar border-l border-discord-bg flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg flex-shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-lg">🔖</span>
            <span>我的收藏</span>
            {bookmarkList.length > 0 && (
              <span className="text-xs bg-discord-accent/20 text-discord-accent px-1.5 py-0.5 rounded-full">
                {bookmarkList.length}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white p-1 rounded hover:bg-discord-hover transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-discord-muted text-sm">
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                加载中...
              </div>
            </div>
          ) : bookmarkList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-discord-muted">
              <div className="text-4xl mb-3">🔖</div>
              <div className="text-sm font-medium">还没有收藏</div>
              <div className="text-xs mt-1 text-center px-6">
                在消息上悬停，点击 🔖 收藏重要消息
              </div>
            </div>
          ) : (
            <div>
              {bookmarkList.map(bookmark => (
                <BookmarkItem
                  key={bookmark.id || bookmark.message_id}
                  bookmark={bookmark}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
