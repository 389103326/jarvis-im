/**
 * components/Sidebar/ChannelList.jsx - 频道列表（支持分类折叠、右键通知设置）
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import useChatStore from '../../store/useChatStore'
import { getSocket } from '../../hooks/useSocket'

// 通知级别配置
const NOTIF_LEVELS = [
  { id: 'all', label: '全部消息', icon: '🔔', desc: '接收所有新消息通知' },
  { id: 'mentions', label: '仅@提及', icon: '💬', desc: '只在被@时通知' },
  { id: 'muted', label: '静音', icon: '🔕', desc: '不接收任何通知' },
]

function getChannelNotifLevel(channelId) {
  return localStorage.getItem(`notif:channel:${channelId}`) || 'all'
}

function setChannelNotifLevel(channelId, level) {
  if (level === 'all') {
    localStorage.removeItem(`notif:channel:${channelId}`)
  } else {
    localStorage.setItem(`notif:channel:${channelId}`, level)
  }
}

// 通知设置右键菜单
function NotifContextMenu({ channelId, channelName, position, onClose }) {
  const [level, setLevel] = useState(() => getChannelNotifLevel(channelId))
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const handleSelect = (levelId) => {
    setLevel(levelId)
    setChannelNotifLevel(channelId, levelId)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-discord-bg border border-discord-hover rounded-lg shadow-xl py-1 min-w-48"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-2 border-b border-discord-hover">
        <div className="text-xs font-semibold text-discord-muted uppercase tracking-wider">#{channelName}</div>
        <div className="text-xs text-discord-muted mt-0.5">通知设置</div>
      </div>
      {NOTIF_LEVELS.map(nl => (
        <button
          key={nl.id}
          onClick={() => handleSelect(nl.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-discord-hover transition-colors ${
            level === nl.id ? 'text-white' : 'text-discord-text'
          }`}
        >
          <span className="text-base flex-shrink-0">{nl.icon}</span>
          <div className="flex-1">
            <div className="text-sm font-medium">{nl.label}</div>
            <div className="text-xs text-discord-muted">{nl.desc}</div>
          </div>
          {level === nl.id && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-discord-accent flex-shrink-0">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

// 单个频道行
function ChannelItem({ channel, isActive, onClick }) {
  const [contextMenu, setContextMenu] = useState(null)
  const [notifLevel, setNotifLevel] = useState(() => getChannelNotifLevel(channel.id))

  const handleContextMenu = (e) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 180)
    setContextMenu({ x, y })
  }

  const handleCloseMenu = () => {
    setContextMenu(null)
    setNotifLevel(getChannelNotifLevel(channel.id))
  }

  const isMuted = notifLevel === 'muted'

  return (
    <>
      <div
        onClick={() => onClick(channel)}
        onContextMenu={handleContextMenu}
        className={`channel-item flex items-center justify-between px-3 py-1.5 mx-2 rounded-md cursor-pointer group ${
          isActive
            ? 'active'
            : 'text-discord-muted hover:text-discord-text hover:bg-discord-hover/50'
        } ${isMuted ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm flex-shrink-0 ${isActive ? 'text-white' : 'text-discord-muted'}`}>#</span>
          <span className="text-sm truncate">{channel.name}</span>
          {isMuted && (
            <span className="text-xs flex-shrink-0" title="已静音">🔕</span>
          )}
          {notifLevel === 'mentions' && !isMuted && (
            <span className="text-xs flex-shrink-0 text-discord-muted" title="仅@提及">💬</span>
          )}
        </div>
        {channel.unreadCount > 0 && !isMuted && (
          <span className="unread-badge flex-shrink-0">
            {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
          </span>
        )}
      </div>

      {contextMenu && (
        <NotifContextMenu
          channelId={channel.id}
          channelName={channel.name}
          position={contextMenu}
          onClose={handleCloseMenu}
        />
      )}
    </>
  )
}

// 分类组（可折叠）
function CategoryGroup({ category, channels, activeChannelId, activeType, onChannelClick, onCreateChannel }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasUnread = channels.some(ch => ch.unreadCount > 0)

  return (
    <div className="mb-1">
      {/* 分类标题 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-1 group"
      >
        <div className="flex items-center gap-1 min-w-0">
          <svg
            width="10" height="10"
            viewBox="0 0 24 24" fill="currentColor"
            className={`text-discord-muted flex-shrink-0 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
          >
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          <span className={`text-[11px] font-semibold uppercase tracking-wider truncate ${
            collapsed && hasUnread ? 'text-white' : 'text-discord-muted group-hover:text-discord-text'
          }`}>
            {category.name}
          </span>
          {/* 未读时折叠状态显示小点 */}
          {collapsed && hasUnread && (
            <span className="ml-1 w-2 h-2 rounded-full bg-discord-accent flex-shrink-0" />
          )}
        </div>
        {/* 添加频道按钮 */}
        <span
          className="text-discord-muted hover:text-white opacity-0 group-hover:opacity-100 transition-opacity text-base leading-none"
          onClick={e => { e.stopPropagation(); onCreateChannel(category.id) }}
          title="在此分类创建频道"
        >
          +
        </span>
      </button>

      {/* 频道列表 */}
      {!collapsed && (
        <div>
          {channels.length === 0 ? (
            <div className="px-4 py-1 text-xs text-discord-muted italic">暂无频道</div>
          ) : (
            channels.map(ch => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                isActive={activeChannelId === ch.id && activeType === 'channel'}
                onClick={onChannelClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function ChannelList({ onCreateChannel }) {
  const {
    channels,
    categories,
    activeChannelId,
    activeType,
    setActiveChannel,
    fetchMessages,
    fetchCategories,
    markChannelRead,
  } = useChatStore()

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleChannelClick = useCallback((channel) => {
    const socket = getSocket()
    if (activeChannelId && activeType === 'channel') {
      socket?.emit('leave_channel', { channelId: activeChannelId })
    }
    setActiveChannel(channel.id, 'channel')
    socket?.emit('join_channel', { channelId: channel.id })
    fetchMessages(channel.id, 'channel')
    markChannelRead(channel.id)
    socket?.emit('mark_read', { channelId: channel.id })
  }, [activeChannelId, activeType])

  // 将 channels 的 unreadCount 合并到 categories 中
  const categoriesWithUnread = categories.map(cat => ({
    ...cat,
    channels: (cat.channels || []).map(ch => {
      const live = channels.find(c => c.id === ch.id)
      return live ? { ...ch, unreadCount: live.unreadCount } : ch
    }),
  }))

  // 无分类时回退到扁平列表
  if (categoriesWithUnread.length === 0) {
    return (
      <div>
        {channels.map(channel => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isActive={activeChannelId === channel.id && activeType === 'channel'}
            onClick={handleChannelClick}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {categoriesWithUnread.map(cat => (
        <CategoryGroup
          key={cat.id ?? 'uncategorized'}
          category={cat}
          channels={cat.channels || []}
          activeChannelId={activeChannelId}
          activeType={activeType}
          onChannelClick={handleChannelClick}
          onCreateChannel={onCreateChannel || (() => {})}
        />
      ))}
    </div>
  )
}
