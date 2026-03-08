/**
 * components/common/Avatar.jsx - 用户头像组件
 * 支持: 图片头像（avatar_url）+ 颜色字母头像（fallback）
 */

import React, { useState } from 'react'
import useChatStore from '../../store/useChatStore'
import { getAvatarInitial } from '../../utils/format'

export default function Avatar({ user, size = 'md', showStatus = false, onClick, className = '' }) {
  const onlineUsers = useChatStore(state => state.onlineUsers)
  const isOnline = onlineUsers.has(user?.id)
  const [imgError, setImgError] = useState(false)

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }

  const avatarUrl = user?.avatar_url
  const hasImg = avatarUrl && !imgError

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {hasImg ? (
        <img
          src={avatarUrl}
          alt={user?.username || '?'}
          className={`${sizeClasses[size]} rounded-full object-cover cursor-pointer select-none`}
          onClick={onClick}
          title={user?.username}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white cursor-pointer select-none`}
          style={{ backgroundColor: user?.avatarColor || user?.avatar_color || '#5865F2' }}
          onClick={onClick}
          title={user?.username}
        >
          {getAvatarInitial(user?.username)}
        </div>
      )}
      {showStatus && (
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-sidebar ${
            isOnline ? 'bg-discord-green' : 'bg-discord-muted'
          }`}
        />
      )}
    </div>
  )
}
