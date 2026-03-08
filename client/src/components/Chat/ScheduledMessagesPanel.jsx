/**
 * ScheduledMessagesPanel.jsx - 定时消息管理面板
 * 查看和取消当前频道/DM 的待发送定时消息
 */

import React, { useState, useEffect } from 'react'
import { getSocket } from '../../hooks/useSocket'

// 格式化时间为本地可读字符串
function formatScheduledTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = d - now
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)

  if (diffMin < 60) {
    return `${diffMin} 分钟后（${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}）`
  }
  if (diffHour < 24) {
    return `${diffHour} 小时后（${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}）`
  }
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ScheduledMessagesPanel({ channelId, dmChannelId, onClose }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const socket = getSocket()

  useEffect(() => {
    if (!socket) return

    const handleList = ({ messages }) => {
      setMessages(messages)
      setLoading(false)
    }

    const handleCancelled = ({ id }) => {
      setMessages(prev => prev.filter(m => m.id !== id))
    }

    const handleDelivered = ({ scheduledId }) => {
      setMessages(prev => prev.filter(m => m.id !== scheduledId))
    }

    const handleAck = (msg) => {
      // 新增的定时消息
      if (
        (channelId && msg.channelId === channelId) ||
        (dmChannelId && msg.dmChannelId === dmChannelId)
      ) {
        setMessages(prev => [...prev, msg].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
      }
    }

    socket.on('scheduled_list', handleList)
    socket.on('scheduled_cancelled', handleCancelled)
    socket.on('scheduled_delivered', handleDelivered)
    socket.on('schedule_ack', handleAck)

    // 请求列表
    socket.emit('list_scheduled', { channelId, dmChannelId })

    return () => {
      socket.off('scheduled_list', handleList)
      socket.off('scheduled_cancelled', handleCancelled)
      socket.off('scheduled_delivered', handleDelivered)
      socket.off('schedule_ack', handleAck)
    }
  }, [socket, channelId, dmChannelId])

  const handleCancel = (id) => {
    socket?.emit('cancel_scheduled', { id })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-bg">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-lg">🕐</span>
            定时消息
          </h3>
          <button onClick={onClose} className="text-discord-muted hover:text-white transition-colors">✕</button>
        </div>

        {/* 内容区 */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-discord-muted text-sm">
              <div className="animate-spin text-2xl mb-2">⏳</div>
              加载中...
            </div>
          ) : messages.length === 0 ? (
            <div className="px-4 py-10 text-center text-discord-muted text-sm">
              <div className="text-4xl mb-3">🕐</div>
              <p className="font-medium text-discord-text/70">没有待发送的定时消息</p>
              <p className="text-xs mt-1 text-discord-muted">在输入框点击 📅 按钮创建定时消息</p>
            </div>
          ) : (
            <ul>
              {messages.map(msg => (
                <li
                  key={msg.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-discord-bg/50 hover:bg-discord-hover/20 transition-colors"
                >
                  {/* 时钟图标 */}
                  <div className="w-8 h-8 rounded-full bg-discord-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm">🕐</span>
                  </div>

                  {/* 消息内容 */}
                  <div className="flex-1 min-w-0">
                    {/* 时间徽章 */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-discord-accent bg-discord-accent/10 rounded px-2 py-0.5">
                        {formatScheduledTime(msg.scheduled_at)}
                      </span>
                    </div>
                    {/* 消息预览 */}
                    <p className="text-sm text-discord-text truncate">
                      {msg.type === 'image' ? '📷 图片消息' : msg.content}
                    </p>
                    {/* 创建时间 */}
                    <p className="text-xs text-discord-muted mt-0.5">
                      创建于 {new Date(msg.created_at).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* 取消按钮 */}
                  <button
                    onClick={() => handleCancel(msg.id)}
                    className="flex-shrink-0 text-xs px-2 py-1 rounded text-discord-muted hover:text-discord-red hover:bg-discord-red/10 transition-colors border border-discord-muted/20"
                    title="取消定时消息"
                  >
                    取消
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底部提示 */}
        {messages.length > 0 && (
          <div className="px-4 py-2 border-t border-discord-bg bg-discord-bg/30">
            <p className="text-xs text-discord-muted">
              共 {messages.length} 条待发送 · 消息会在指定时间自动发出
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
