/**
 * components/Chat/ChatHeader.jsx - 聊天区域顶部栏
 * 支持: 固定消息查看、成员列表切换、Ctrl+K 提示
 */

import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import useChatStore from '../../store/useChatStore'
import useCallStore from '../../store/useCallStore'
import Avatar from '../common/Avatar'
import { getSocket } from '../../hooks/useSocket'
import BookmarkPanel from '../common/BookmarkPanel'
import MediaGallery from './MediaGallery'
import ScheduledMessagesPanel from './ScheduledMessagesPanel'

// 固定消息弹窗
function PinnedMessagesModal({ channelId, onClose }) {
  const { pinnedMessages } = useChatStore()
  const pins = pinnedMessages[channelId] || []
  const socket = getSocket()

  useEffect(() => {
    // 加载固定消息
    socket?.emit('get_pinned_messages', { channelId })
  }, [channelId])

  const handleUnpin = (messageId) => {
    socket?.emit('unpin_message', { messageId })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg">
          <h3 className="font-semibold text-white flex items-center gap-2">
            📌 固定消息
          </h3>
          <button onClick={onClose} className="text-discord-muted hover:text-white">✕</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {pins.length === 0 ? (
            <div className="px-4 py-8 text-center text-discord-muted text-sm">
              该频道还没有固定的消息
            </div>
          ) : (
            pins.map(pin => (
              <div key={pin.message_id} className="flex gap-3 px-4 py-3 hover:bg-discord-hover/30 border-b border-discord-bg/50">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: pin.avatar_color || '#5865f2' }}
                >
                  {pin.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-medium text-white text-sm">{pin.username}</span>
                    <span className="text-xs text-discord-muted">
                      {new Date(pin.msg_created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="text-sm text-discord-text truncate">
                    {pin.type === 'image' ? '🖼️ 图片消息' : pin.content}
                  </div>
                  <div className="text-xs text-discord-muted mt-1">
                    由 {pin.pinned_by_username} 固定
                  </div>
                </div>
                <button
                  onClick={() => handleUnpin(pin.message_id)}
                  className="text-discord-muted hover:text-discord-red text-xs flex-shrink-0 transition-colors"
                  title="取消固定"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// 频道设置弹窗
function ChannelSettingsModal({ channel, onClose }) {
  const [name, setName] = useState(channel.name || '')
  const [description, setDescription] = useState(channel.description || '')
  const [topic, setTopic] = useState(channel.topic || '')
  const [slowMode, setSlowMode] = useState(channel.slow_mode_seconds || 0)
  const socket = getSocket()
  const { updateChannelInfo } = useChatStore()

  const handleSave = () => {
    socket?.emit('update_channel', {
      channelId: channel.id, name, description, topic,
      slowModeSeconds: parseInt(slowMode),
    })
    onClose()
  }

  const SLOW_OPTIONS = [
    { value: 0, label: '关闭' },
    { value: 5, label: '5 秒' },
    { value: 10, label: '10 秒' },
    { value: 30, label: '30 秒' },
    { value: 60, label: '1 分钟' },
    { value: 300, label: '5 分钟' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg">
          <h3 className="font-semibold text-white">⚙️ 频道设置</h3>
          <button onClick={onClose} className="text-discord-muted hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wider block mb-1.5">
              频道名称
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-discord-input text-discord-text px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 ring-discord-accent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wider block mb-1.5">
              频道描述
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-discord-input text-discord-text px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 ring-discord-accent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wider block mb-1.5">
              频道话题
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="设置一个话题让大家知道聊什么..."
              className="w-full bg-discord-input text-discord-text px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 ring-discord-accent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              🐢 慢速模式
              {slowMode > 0 && (
                <span className="text-discord-yellow text-[10px] px-1.5 py-0.5 bg-discord-yellow/10 border border-discord-yellow/30 rounded-full font-medium">
                  已启用
                </span>
              )}
            </label>
            <select
              value={slowMode}
              onChange={e => setSlowMode(e.target.value)}
              className="w-full bg-discord-input text-discord-text px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 ring-discord-accent"
            >
              {SLOW_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-discord-muted mt-1">
              {slowMode > 0
                ? `成员每 ${SLOW_OPTIONS.find(o => o.value == slowMode)?.label} 才能发送一条消息`
                : '不限制发送频率'}
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 bg-discord-accent hover:bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              保存
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-discord-hover text-discord-muted hover:text-white py-2 rounded-lg text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Webhook 管理弹窗
function WebhookModal({ channelId, channelName, onClose }) {
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axios.get(`/api/webhooks/channel/${channelId}`)
      setWebhooks(res.data)
    } catch (err) {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }, [channelId])

  useEffect(() => { loadWebhooks() }, [loadWebhooks])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      await axios.post(`/api/webhooks/channel/${channelId}`, { name: newName.trim() })
      setNewName('')
      await loadWebhooks()
    } catch (err) {
      setError(err.response?.data?.error || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (webhook) => {
    if (!confirm(`确认删除 Webhook "${webhook.name}"？`)) return
    try {
      await axios.delete(`/api/webhooks/${webhook.id}`, { data: { channelId } })
      await loadWebhooks()
    } catch (err) {
      setError('删除失败')
    }
  }

  const handleCopy = (webhook) => {
    const url = `${window.location.origin}/api/webhooks/incoming/${webhook.token}`
    navigator.clipboard.writeText(url)
    setCopiedId(webhook.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg flex-shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            🔗 Webhook 集成 <span className="text-discord-muted text-xs font-normal">#{channelName}</span>
          </h3>
          <button onClick={onClose} className="text-discord-muted hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 说明 */}
          <div className="bg-discord-bg rounded-lg p-3 text-sm text-discord-muted">
            <p className="mb-1 text-discord-text font-medium">📡 什么是 Webhook？</p>
            <p>通过 HTTP POST 请求向此频道发送消息，适合机器人、CI/CD 通知等自动化集成。</p>
            <code className="block mt-2 text-xs bg-discord-input p-2 rounded text-discord-yellow font-mono">
              POST /api/webhooks/incoming/&#123;token&#125;<br />
              {`{ "content": "你好，世界！", "username": "MyBot" }`}
            </code>
          </div>

          {/* 创建新 Webhook */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Webhook 名称（如：GitHub CI）"
              maxLength={50}
              className="flex-1 bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="bg-discord-accent hover:bg-indigo-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </form>
          {error && <p className="text-discord-red text-sm">{error}</p>}

          {/* Webhook 列表 */}
          {loading ? (
            <div className="text-discord-muted text-sm text-center py-4">加载中...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-discord-muted text-sm text-center py-4">暂无 Webhook，创建一个开始吧！</div>
          ) : (
            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.id} className="bg-discord-bg rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{wh.name}</span>
                        <span className="text-xs text-discord-muted">
                          by {wh.creatorUsername}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-xs text-discord-yellow font-mono bg-discord-input px-2 py-0.5 rounded truncate max-w-xs">
                          {wh.tokenPreview}
                        </code>
                        {wh.usageCount > 0 && (
                          <span className="text-xs text-discord-muted">
                            已使用 {wh.usageCount} 次
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(wh)}
                        className="text-xs text-discord-accent hover:text-white px-2 py-1 rounded hover:bg-discord-hover transition-colors"
                        title="复制 Webhook URL"
                      >
                        {copiedId === wh.id ? '✓ 已复制' : '📋 复制'}
                      </button>
                      <button
                        onClick={() => handleDelete(wh)}
                        className="text-xs text-discord-red hover:text-red-400 px-2 py-1 rounded hover:bg-discord-hover transition-colors"
                        title="删除 Webhook"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatHeader({ channelId, dmChannelId, onSearch, onShowShortcuts, onOpenMobileSidebar }) {
  const { channels, dmList, sidebarOpen, toggleSidebar, toggleMemberSidebar, memberSidebarOpen, setCommandPaletteOpen, bookmarkPanelOpen, setBookmarkPanelOpen } = useChatStore()
  const { callStatus, initiateCall } = useCallStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPins, setShowPins] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showWebhooks, setShowWebhooks] = useState(false)
  const [showMediaGallery, setShowMediaGallery] = useState(false)
  const [showScheduledPanel, setShowScheduledPanel] = useState(false)
  const [scheduledCount, setScheduledCount] = useState(0) // 当前频道待发数
  const [exporting, setExporting] = useState(false)

  let title = ''
  let subtitle = ''
  let topic = ''
  let slowModeSecs = 0
  let dmUser = null
  let currentChannel = null

  if (channelId) {
    currentChannel = channels.find(c => c.id === channelId)
    title = `#${currentChannel?.name || '频道'}`
    subtitle = currentChannel?.description || ''
    topic = currentChannel?.topic || ''
    slowModeSecs = currentChannel?.slow_mode_seconds || 0
  } else if (dmChannelId) {
    const dm = dmList.find(d => d.id === dmChannelId)
    dmUser = dm?.otherUser
    title = dmUser?.username || '私信'
  }

  // 频道通知偏好：从 localStorage 读取
  const notifKey = channelId ? `notif:channel:${channelId}` : dmChannelId ? `notif:dm:${dmChannelId}` : null
  const [notifLevel, setNotifLevel] = useState(() =>
    notifKey ? (localStorage.getItem(notifKey) || 'all') : 'all'
  )

  const handleNotifChange = (level) => {
    setNotifLevel(level)
    if (notifKey) localStorage.setItem(notifKey, level)
    setShowNotifMenu(false)
  }

  // 消息导出
  const handleExport = async (format = 'txt') => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ format, limit: 5000 })
      if (channelId) params.set('channelId', channelId)
      else if (dmChannelId) params.set('dmChannelId', dmChannelId)

      const res = await axios.get(`/api/messages/export?${params}`, {
        responseType: 'blob',
      })
      const ext = format === 'json' ? 'json' : 'txt'
      const name = channelId
        ? `${currentChannel?.name || 'channel'}-export.${ext}`
        : `dm-export.${ext}`

      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      alert('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  const NOTIF_OPTIONS = [
    { value: 'all', label: '所有消息', emoji: '🔔' },
    { value: 'mentions', label: '仅 @提及', emoji: '🔕' },
    { value: 'nothing', label: '静默', emoji: '🚫' },
  ]

  const currentNotif = NOTIF_OPTIONS.find(o => o.value === notifLevel) || NOTIF_OPTIONS[0]

  const handleSearch = (e) => {
    e.preventDefault()
    onSearch?.(searchQuery)
  }

  // 监听定时消息数量变化
  const socket = getSocket()
  useEffect(() => {
    if (!socket) return
    const handleList = ({ messages }) => setScheduledCount(messages.length)
    const handleAck = (msg) => {
      if (
        (channelId && msg.channelId === channelId) ||
        (dmChannelId && msg.dmChannelId === dmChannelId)
      ) {
        setScheduledCount(prev => prev + 1)
      }
    }
    const handleCancelled = () => setScheduledCount(prev => Math.max(0, prev - 1))
    const handleDelivered = () => setScheduledCount(prev => Math.max(0, prev - 1))

    socket.on('scheduled_list', handleList)
    socket.on('schedule_ack', handleAck)
    socket.on('scheduled_cancelled', handleCancelled)
    socket.on('scheduled_delivered', handleDelivered)

    // 切换频道时重新查询数量
    socket.emit('list_scheduled', { channelId, dmChannelId })

    return () => {
      socket.off('scheduled_list', handleList)
      socket.off('schedule_ack', handleAck)
      socket.off('scheduled_cancelled', handleCancelled)
      socket.off('scheduled_delivered', handleDelivered)
    }
  }, [socket, channelId, dmChannelId])

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-discord-bg bg-discord-channel shadow-sm flex-shrink-0">
        {/* 移动端：汉堡菜单按钮（打开侧边栏抽屉） */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden text-discord-muted hover:text-white mr-1 p-1 rounded hover:bg-discord-hover transition-colors"
          title="打开菜单"
        >
          ☰
        </button>

        {/* 桌面端：折叠按钮 */}
        {!sidebarOpen && (
          <button onClick={toggleSidebar} className="hidden md:block text-discord-muted hover:text-white mr-1" title="展开侧边栏">
            ☰
          </button>
        )}

        {/* 标题 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {dmUser ? (
            <Avatar user={dmUser} size="sm" showStatus />
          ) : (
            <span className="text-discord-muted font-bold text-xl">#</span>
          )}
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-sm leading-tight flex items-center gap-2">
              {title}
              {slowModeSecs > 0 && (
                <span className="text-[10px] text-discord-yellow bg-discord-yellow/10 border border-discord-yellow/30 rounded-full px-1.5 py-0.5 font-medium flex items-center gap-0.5 flex-shrink-0" title={`慢速模式：每 ${slowModeSecs} 秒可发送一条`}>
                  🐢 {slowModeSecs >= 60 ? `${slowModeSecs/60}分` : `${slowModeSecs}s`}
                </span>
              )}
            </h2>
            {topic ? (
              <p className="text-discord-muted text-xs truncate" title={topic}>{topic}</p>
            ) : subtitle ? (
              <p className="text-discord-muted text-xs truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          {/* 通知偏好 */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors text-base"
              title={`通知设置：${currentNotif.label}`}
            >
              {currentNotif.emoji}
            </button>
            {showNotifMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-discord-sidebar border border-discord-bg rounded-lg shadow-xl overflow-hidden z-30">
                <div className="px-3 py-1.5 text-xs text-discord-muted border-b border-discord-bg">通知偏好</div>
                {NOTIF_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleNotifChange(opt.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      notifLevel === opt.value
                        ? 'bg-discord-accent text-white'
                        : 'text-discord-text hover:bg-discord-hover'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                    {notifLevel === opt.value && <span className="ml-auto text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DM 通话按钮（仅在 DM 频道显示） */}
          {dmChannelId && dmUser && (
            <>
              <button
                onClick={() => initiateCall(
                  { id: dmUser.id, username: dmUser.username, avatarColor: dmUser.avatar_color },
                  dmChannelId,
                  'voice'
                )}
                disabled={callStatus !== 'idle'}
                className="text-discord-muted hover:text-discord-green p-1.5 rounded hover:bg-discord-hover transition-colors disabled:opacity-40"
                title="语音通话"
              >
                📞
              </button>
              <button
                onClick={() => initiateCall(
                  { id: dmUser.id, username: dmUser.username, avatarColor: dmUser.avatar_color },
                  dmChannelId,
                  'video'
                )}
                disabled={callStatus !== 'idle'}
                className="text-discord-muted hover:text-discord-green p-1.5 rounded hover:bg-discord-hover transition-colors disabled:opacity-40"
                title="视频通话"
              >
                📹
              </button>
            </>
          )}

          {/* 定时消息 */}
          <button
            onClick={() => setShowScheduledPanel(true)}
            className="relative text-discord-muted hover:text-discord-accent p-1.5 rounded hover:bg-discord-hover transition-colors"
            title="定时消息"
          >
            🕐
            {scheduledCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-discord-accent text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {scheduledCount > 9 ? '9+' : scheduledCount}
              </span>
            )}
          </button>

          {/* 收藏夹 */}
          <button
            onClick={() => setBookmarkPanelOpen(true)}
            className="text-discord-muted hover:text-discord-yellow p-1.5 rounded hover:bg-discord-hover transition-colors"
            title="我的收藏"
          >
            🔖
          </button>

          {/* 消息导出 */}
          <div className="relative group">
            <button
              disabled={exporting}
              className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors disabled:opacity-40"
              title="导出聊天记录"
              onClick={() => handleExport('txt')}
              onContextMenu={(e) => { e.preventDefault(); handleExport('json') }}
            >
              {exporting ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
              )}
            </button>
            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-44 bg-discord-bg border border-discord-hover rounded-lg shadow-xl p-2 z-30 pointer-events-none">
              <p className="text-xs text-discord-text">点击导出 TXT</p>
              <p className="text-xs text-discord-muted">右键导出 JSON</p>
            </div>
          </div>

          {/* Webhook 管理（仅频道） */}
          {channelId && (
            <button
              onClick={() => setShowWebhooks(true)}
              className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors"
              title="Webhook 集成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.05ZM11 2.06C9.05 2.25 7.19 3 5.67 4.26L7.1 5.74C8.22 4.84 9.57 4.26 11 4.06V2.06ZM4.26 5.67C3 7.19 2.25 9.04 2.05 11H4.05C4.24 9.58 4.8 8.23 5.69 7.1L4.26 5.67ZM2.06 13C2.26 14.96 3.03 16.81 4.27 18.33L5.69 16.9C4.81 15.77 4.24 14.42 4.06 13H2.06ZM7.06 18.37L5.67 19.74C7.18 21 9.04 21.79 11 22V20C9.58 19.82 8.23 19.25 7.06 18.37ZM13 13V7H11V13H13ZM15 13H13V15H15V13Z"/>
              </svg>
            </button>
          )}

          {/* 媒体画廊 */}
          <button
            onClick={() => setShowMediaGallery(true)}
            className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors"
            title="媒体画廊"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </button>

          {/* Ctrl+K 提示 */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors"
            title="快速跳转 (Ctrl+K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>

          {/* 固定消息（只对频道） */}
          {channelId && (
            <button
              onClick={() => setShowPins(true)}
              className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors"
              title="固定消息"
            >
              📌
            </button>
          )}

          {/* 频道设置（只对频道） */}
          {channelId && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors"
              title="频道设置"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
            </button>
          )}

          {/* 搜索 */}
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索消息..."
                className="bg-discord-bg text-discord-text text-sm px-3 py-1.5 rounded-md outline-none focus:ring-1 ring-discord-accent w-40"
                autoFocus
              />
              <button type="submit" className="text-discord-accent text-sm hover:text-white">搜索</button>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchQuery(''); onSearch?.('') }}
                className="text-discord-muted hover:text-white text-sm"
              >✕</button>
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors"
              title="搜索消息"
            >
              🔍
            </button>
          )}

          {/* 键盘快捷键帮助 */}
          <button
            onClick={onShowShortcuts}
            className="text-discord-muted hover:text-white p-1.5 rounded hover:bg-discord-hover transition-colors text-sm font-bold"
            title="键盘快捷键 (?)"
          >
            ?
          </button>

          {/* 成员列表切换 */}
          <button
            onClick={toggleMemberSidebar}
            className={`p-1.5 rounded hover:bg-discord-hover transition-colors ${
              memberSidebarOpen ? 'text-white bg-discord-hover' : 'text-discord-muted hover:text-white'
            }`}
            title="成员列表"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 固定消息弹窗 */}
      {showPins && channelId && (
        <PinnedMessagesModal channelId={channelId} onClose={() => setShowPins(false)} />
      )}

      {/* 频道设置弹窗 */}
      {showSettings && currentChannel && (
        <ChannelSettingsModal channel={currentChannel} onClose={() => setShowSettings(false)} />
      )}

      {/* 书签面板 */}
      {bookmarkPanelOpen && (
        <BookmarkPanel onClose={() => setBookmarkPanelOpen(false)} />
      )}

      {/* 定时消息面板 */}
      {showScheduledPanel && (
        <ScheduledMessagesPanel
          channelId={channelId}
          dmChannelId={dmChannelId}
          onClose={() => setShowScheduledPanel(false)}
        />
      )}

      {/* Webhook 管理弹窗 */}
      {showWebhooks && channelId && (
        <WebhookModal
          channelId={channelId}
          channelName={currentChannel?.name || ''}
          onClose={() => setShowWebhooks(false)}
        />
      )}

      {/* 媒体画廊 */}
      {showMediaGallery && (
        <MediaGallery
          channelId={channelId}
          dmChannelId={dmChannelId}
          onClose={() => setShowMediaGallery(false)}
        />
      )}
    </>
  )
}
