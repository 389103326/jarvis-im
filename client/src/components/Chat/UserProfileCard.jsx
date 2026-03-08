/**
 * components/Chat/UserProfileCard.jsx - 用户资料卡片
 */

import React, { useEffect, useRef } from 'react'
import useAuthStore from '../../store/useAuthStore'
import useChatStore from '../../store/useChatStore'
import Avatar from '../common/Avatar'

export default function UserProfileCard({ userId, username, avatarColor, position, onClose }) {
  const { user: me } = useAuthStore()
  const { users, onlineUsers, openDM, setActiveChannel, fetchMessages } = useChatStore()
  const cardRef = useRef(null)

  const userDetail = users.find(u => u.id === userId)
  const isOnline = onlineUsers.has(userId)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // 计算卡片位置，防止溢出屏幕
  const cardStyle = {}
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const cardW = 260
  const cardH = 200

  let x = position.x
  let y = position.y

  if (x + cardW > vpW) x = vpW - cardW - 8
  if (y + cardH > vpH) y = vpH - cardH - 8
  if (y < 8) y = 8
  if (x < 8) x = 8

  cardStyle.position = 'fixed'
  cardStyle.left = x
  cardStyle.top = y
  cardStyle.zIndex = 1000

  const handleSendDM = async () => {
    const result = await openDM(userId)
    if (result.success) {
      setActiveChannel(result.dm.id, 'dm')
      fetchMessages(result.dm.id, 'dm')
    }
    onClose()
  }

  const formatJoinDate = (dateStr) => {
    if (!dateStr) return '未知'
    return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className="w-64 bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden"
    >
      {/* 顶部色块 */}
      <div className="h-16 w-full" style={{ backgroundColor: avatarColor || '#5865f2', opacity: 0.8 }} />

      {/* 头像（覆盖在色块上） */}
      <div className="relative px-4">
        <div className="absolute -top-8">
          <div className="ring-4 ring-discord-sidebar rounded-full">
            <Avatar
              user={{ id: userId, username, avatarColor }}
              size="lg"
            />
          </div>
        </div>

        {/* 用户信息 */}
        <div className="pt-10 pb-3">
          <div className="font-bold text-white text-base">{username}</div>
          <div className={`text-xs flex items-center gap-1 mt-0.5 ${isOnline ? 'text-discord-green' : 'text-discord-muted'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-discord-green' : 'bg-discord-muted'}`} />
            {isOnline ? '在线' : '离线'}
          </div>

          {userDetail?.created_at && (
            <div className="text-xs text-discord-muted mt-2">
              <span className="font-medium text-discord-text">加入时间</span><br/>
              {formatJoinDate(userDetail.created_at)}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSendDM}
              className="flex-1 bg-discord-accent hover:bg-indigo-600 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
            >
              💬 发私信
            </button>
            <button
              onClick={onClose}
              className="px-3 bg-discord-hover text-discord-muted hover:text-white text-xs py-1.5 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
